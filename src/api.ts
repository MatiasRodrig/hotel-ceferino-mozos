import * as signalR from '@microsoft/signalr';

// ─────────────────────────────────────────────────────────────
// Tipos (subconjunto del contrato de la API que usa el mozo)
// ─────────────────────────────────────────────────────────────
export interface Usuario { id: number; nombre: string; username: string; rol: string; }

export interface Mesa { id: number; codigo: string; tipo: string; capacidad: number; orden: number; activa: boolean; }

export interface Categoria { id: number; nombre: string; orden: number; }

export interface OpcionConsumoInterno {
  id: number;
  nombre: string;
  descripcion?: string;
  orden: number;
  activo: boolean;
}

export interface Opcion { id: number; nombre: string; orden: number; }
export interface GrupoOpcion {
  id: number; nombre: string; obligatorio: boolean; seleccionMultiple: boolean; orden: number; opciones: Opcion[];
}

export interface Producto {
  id: number; codigo: string; nombre: string; descripcion?: string; precio: number;
  categoriaId: number; categoriaNombre: string; subcategoria?: string;
  controlaStock: boolean; stockActual: number; stockMinimo: number;
  sector?: string; gruposOpcion?: GrupoOpcion[];
}

export interface ComandaItem {
  id: number; productoNombre: string; cantidad: number; notas?: string;
  sector?: string; opciones?: { grupoNombre: string; opcionNombre: string }[];
}
export interface SectorResumen { id?: number; sector: string; estado: string; listoEn?: string; }
export interface Comanda {
  id: number; numero: number; mesaCodigo: string; mesaTipo: string;
  mozoId: number; mozoNombre: string; fechaHora: string; estado: string;
  observaciones?: string; items: ComandaItem[]; sectores?: SectorResumen[];
  esConsumoInterno?: boolean;
  opcionConsumoInternoId?: number | null;
  consumoInternoNombre?: string | null;
}

export interface AlertaPedidoListo {
  comandaId: number;
  comandaNumero: number;
  mesaId: number;
  mesaCodigo: string;
  mesaTipo: string;
  mozoId: number;
  mozoNombre: string;
  sector: string;
  listoEn: string;
  items: ComandaItem[];
}

export interface PedidoQr {
  id: number; mesaCodigo: string; mesaTipo: string; nombreHuesped?: string; observaciones?: string;
  direccionEntrega?: string; telefonoContacto?: string; metodoPago?: string;
  fechaCreacion: string;
  items: { id: number; productoNombre: string; cantidad: number; notas?: string; opcionesTexto?: string }[];
}

export interface Turno {
  id: number;
  nombre: string;
  fechaApertura: string;
  fechaCierre?: string;
  estado?: string;
  totalComandas: number;
  empleadoId?: number;
  empleadoNombre?: string;
  empleadoRol?: string;
  abiertoPorUsuarioId?: number;
  duracionMinutos?: number;
}
export interface TurnoConfiguracion { id: number; nombre: string; horaInicio: string; horaFin: string; }

export interface NuevoItem { productoId: number; cantidad: number; notas?: string; opcionIds?: number[]; }

// ─────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'ceferino_mozo_token';
const USER_KEY = 'ceferino_mozo_user';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export function resolveApiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const AUTH_EXPIRED_EVENT = 'ceferino:auth-expired';

async function req<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  let res: Response;
  try {
    res = await fetch(resolveApiUrl(url), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
  } catch {
    throw new Error('Sin conexión con el servidor. Revisá el Wi-Fi.');
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new Error('La sesión expiró. Ingresá tu PIN nuevamente.');
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      msg = body.mensaje || body.message || body.title || msg;
    } catch { /* sin cuerpo */ }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

import { hoyArgentina } from './fechas';

/** Fecha local YYYY-MM-DD en hora oficial Argentina (UTC-3). */
export function hoyLocal(): string {
  return hoyArgentina();
}

export const api = {
  async loginPin(pin: string): Promise<Usuario> {
    let res: Response;
    try {
      res = await fetch(resolveApiUrl('/api/auth/login-pin'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
      });
    } catch {
      throw new Error('Sin conexión con el servidor. Revisá el Wi-Fi.');
    }
    if (!res.ok) throw new Error(res.status >= 500 ? 'Error del servidor' : 'PIN incorrecto');
    const data: { token: string; usuario: Usuario } = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
    return data.usuario;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    resetSignalR();
  },

  usuarioActual(): Usuario | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? JSON.parse(raw) : null;
  },

  getMesas: () => req<Mesa[]>('/api/catalogo/mesas'),
  getCategorias: () => req<Categoria[]>('/api/catalogo/categorias'),
  getProductos: () => req<Producto[]>('/api/catalogo/productos'),
  getOpcionesConsumoInterno: () => req<OpcionConsumoInterno[]>('/api/catalogo/opciones-consumo-interno'),

  crearComanda: (
    mesaId: number,
    items: NuevoItem[],
    observaciones?: string,
    esConsumoInterno?: boolean,
    opcionConsumoInternoId?: number | null
  ) =>
    req<Comanda>('/api/comandas', {
      method: 'POST',
      body: JSON.stringify({
        mesaId,
        items,
        observaciones,
        esConsumoInterno: !!esConsumoInterno,
        opcionConsumoInternoId: esConsumoInterno ? (opcionConsumoInternoId ?? null) : null
      })
    }),

  getComandas: (turnoId?: number) =>
    req<Comanda[]>(turnoId ? `/api/comandas?turnoId=${turnoId}` : `/api/comandas?fecha=${hoyLocal()}`),

  marcarSectorEntregado: (sector: string, comandaId: number) =>
    req<unknown>(`/api/sectores/${sector}/comandas/${comandaId}/entregado`, { method: 'POST' }),

  getTurnoActivo: () => req<Turno | null>('/api/turnos/activo'),
  getMiTurno: () => req<Turno | null>('/api/turnos/mi-turno'),
  getConfiguracionesTurno: () => req<TurnoConfiguracion[]>('/api/turnos/configuraciones'),
  abrirTurno: (observaciones?: string, nombrePersonalizado?: string) =>
    req<Turno>('/api/turnos/abrir', { method: 'POST', body: JSON.stringify({ observaciones, nombrePersonalizado }) }),
  cerrarTurno: (turnoId: number, observaciones?: string) =>
    req<Turno>(`/api/turnos/${turnoId}/cerrar`, { method: 'POST', body: JSON.stringify({ observaciones }) }),

  getPedidosQrPendientes: () => req<PedidoQr[]>('/api/pedidos-qr/pendientes'),
  resolverPedidoQr: (id: number, aprobar: boolean, motivoRechazo?: string) =>
    req<unknown>(`/api/pedidos-qr/${id}/resolver`, { method: 'POST', body: JSON.stringify({ aprobar, motivoRechazo }) })
};

// ─────────────────────────────────────────────────────────────
// SignalR (tiempo real)
// ─────────────────────────────────────────────────────────────
let hub: signalR.HubConnection | null = null;

export function getHub(): signalR.HubConnection {
  if (!hub) {
    hub = new signalR.HubConnectionBuilder()
      .withUrl(resolveApiUrl('/hubs/operaciones'), { accessTokenFactory: () => localStorage.getItem(TOKEN_KEY) || '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .build();
    hub.start().catch(err => console.warn('SignalR', err));
  }
  return hub;
}

function resetSignalR() {
  if (hub) {
    hub.stop().catch(() => { });
    hub = null;
  }
}

/** Vibración corta (Android). En iOS se ignora silenciosamente. */
export function vibrar(patron: number | number[] = 15) {
  try { navigator.vibrate?.(patron); } catch { /* noop */ }
}

let audioCtx: AudioContext | null = null;

export function desbloquearAudioMozo() {
  try {
    if (typeof window === 'undefined') return;
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => { });
    }
  } catch { /* noop */ }
}

/** Reproduce un timbre sonoro claro para avisar al mozo que su pedido está listo en cocina. */
export function sonarAlertaListo() {
  try {
    desbloquearAudioMozo();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const notas = [
      { freq: 659.25, inicio: 0, dur: 0.18 },     // E5
      { freq: 880.0, inicio: 0.16, dur: 0.22 },   // A5
      { freq: 1046.5, inicio: 0.34, dur: 0.45 }   // C6
    ];
    for (const n of notas) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t0 + n.inicio);
      gain.gain.setValueAtTime(0.32, t0 + n.inicio);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.inicio + n.dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0 + n.inicio);
      osc.stop(t0 + n.inicio + n.dur);
    }
  } catch { /* noop */ }
}
