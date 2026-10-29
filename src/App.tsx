import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPlus, ClipboardList, QrCode, ChevronRight, CheckCircle2, AlertTriangle, LogOut, Clock, Bell } from 'lucide-react';
import {
  api, getHub, vibrar, sonarAlertaListo, desbloquearAudioMozo, AUTH_EXPIRED_EVENT,
  type Usuario, type Mesa, type Categoria, type Producto, type Comanda, type PedidoQr, type Turno, type SectorResumen, type AlertaPedidoListo, type OpcionConsumoInterno
} from './api';
import { agregarItem, cargarBorrador, guardarBorrador, type ItemCarrito } from './carrito';
import { LoginPin } from './components/LoginPin';
import { Sheet } from './components/Sheet';
import { MesaPicker } from './components/MesaPicker';
import { OpcionesSheet } from './components/OpcionesSheet';
import { CartSheet } from './components/CartSheet';
import { NuevaComanda } from './views/NuevaComanda';
import { MisComandas } from './views/MisComandas';
import { PedidosQr } from './views/PedidosQr';
import { formatearHoraArgentina } from './fechas';

type Tab = 'nueva' | 'comandas' | 'qr';
type Toast = { tipo: 'ok' | 'bad' | 'info'; texto: string } | null;

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(api.usuarioActual());
  if (!usuario) return <LoginPin onLogin={setUsuario} />;
  return <AppMozo usuario={usuario} onLogout={() => { api.logout(); setUsuario(null); }} />;
}

function AppMozo({ usuario, onLogout }: { usuario: Usuario; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('nueva');
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Datos
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [opcionesConsumoInterno, setOpcionesConsumoInterno] = useState<OpcionConsumoInterno[]>([]);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [pedidosQr, setPedidosQr] = useState<PedidoQr[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoComandas, setCargandoComandas] = useState(false);

  // Borrador (persistido)
  const inicial = useMemo(cargarBorrador, []);
  const [mesaId, setMesaId] = useState<number | null>(inicial.mesaId);
  const [items, setItems] = useState<ItemCarrito[]>(inicial.items);
  const [observaciones, setObservaciones] = useState(inicial.observaciones);
  const [esConsumoInterno, setEsConsumoInterno] = useState<boolean>(!!inicial.esConsumoInterno);
  const [opcionConsumoInternoId, setOpcionConsumoInternoId] = useState<number | null>(inicial.opcionConsumoInternoId ?? null);

  // UI
  const [verMesas, setVerMesas] = useState(false);
  const [mesaPendienteCambio, setMesaPendienteCambio] = useState<Mesa | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const [productoOpciones, setProductoOpciones] = useState<Producto | null>(null);
  const [verTurno, setVerTurno] = useState(false);
  const [verCerrarTurno, setVerCerrarTurno] = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<{ numero: number; mesa: string } | null>(null);
  const [marcandoKey, setMarcandoKey] = useState<string | null>(null);

  const tabRef = useRef(tab);
  tabRef.current = tab;
  const turnoRef = useRef(turno);
  turnoRef.current = turno;

  const mostrar = useCallback((t: Toast, ms = 3200) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    guardarBorrador({ mesaId, items, observaciones, esConsumoInterno, opcionConsumoInternoId });
  }, [mesaId, items, observaciones, esConsumoInterno, opcionConsumoInternoId]);

  // Mantener actualizados los productos del carrito (stock/opciones) cuando cambia el catálogo
  useEffect(() => {
    if (!productos.length) return;
    setItems(prev => prev
      .filter(i => productos.some(p => p.id === i.producto.id))
      .map(i => ({ ...i, producto: productos.find(p => p.id === i.producto.id)! })));
  }, [productos]);

  const cargarComandas = useCallback(async (t: Turno | null = turnoRef.current) => {
    setCargandoComandas(true);
    try {
      const todas = await api.getComandas(t?.id);
      setComandas(todas.filter(c => c.mozoId === usuario.id));
    } catch (e) {
      mostrar({ tipo: 'bad', texto: (e as Error).message });
    } finally {
      setCargandoComandas(false);
    }
  }, [usuario.id, mostrar]);

  const cargarTodo = useCallback(async () => {
    try {
      const [m, c, p, t, qr, opcInterno] = await Promise.all([
        api.getMesas(),
        api.getCategorias(),
        api.getProductos(),
        api.getMiTurno().catch(() => null),
        api.getPedidosQrPendientes(),
        api.getOpcionesConsumoInterno().catch(() => [])
      ]);
      setMesas(m.filter(x => x.activa !== false).sort((a, b) => a.orden - b.orden));
      setCategorias(c);
      setProductos(p);
      setTurno(t);
      setPedidosQr(qr);
      setOpcionesConsumoInterno(opcInterno.filter(o => o.activo !== false));
      await cargarComandas(t);
    } catch (e) {
      mostrar({ tipo: 'bad', texto: (e as Error).message }, 5000);
    } finally {
      setCargando(false);
    }
  }, [cargarComandas, mostrar]);

  // Carga inicial + tiempo real
  useEffect(() => {
    cargarTodo();

    const onExpired = () => onLogout();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener('pointerdown', desbloquearAudioMozo, { passive: true });

    const hub = getHub();
    const esMia = (mozoId: number) => mozoId === usuario.id;

    hub.on('PedidoQrCreado', (p: PedidoQr) => {
      setPedidosQr(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
      vibrar([80, 60, 80]);
      if (tabRef.current !== 'qr') mostrar({ tipo: 'info', texto: `Nuevo pedido QR · ${p.mesaCodigo}` }, 4500);
    });
    hub.on('PedidoQrResuelto', (p: PedidoQr) => setPedidosQr(prev => prev.filter(x => x.id !== p.id)));
    hub.on('TurnoIniciado', (t: Turno) => {
      if (t.empleadoId === usuario.id || t.abiertoPorUsuarioId === usuario.id) {
        setTurno(t);
        cargarComandas(t);
        mostrar({ tipo: 'ok', texto: 'Tu turno ha comenzado' });
      }
    });
    hub.on('TurnoCerrado', (t?: Turno) => {
      if (!t || t.empleadoId === usuario.id || t.abiertoPorUsuarioId === usuario.id || t.id === turnoRef.current?.id) {
        setTurno(null);
        setComandas([]);
        mostrar({ tipo: 'info', texto: 'Tu turno fue cerrado' });
      }
    });
    hub.on('ComandaCreada', (c: Comanda) => {
      if (!esMia(c.mozoId)) return;
      setComandas(prev => [c, ...prev.filter(x => x.id !== c.id)]);
    });
    hub.on('ComandaDividida', (d: { comandaCobrada: Comanda; comandaPendienteRestante?: Comanda | null }) => {
      if (!esMia(d.comandaCobrada.mozoId)) return;
      setComandas(prev => {
        let lista = prev.filter(x => x.id !== d.comandaCobrada.id);
        if (d.comandaPendienteRestante) {
          lista = lista.map(x => (x.id === d.comandaPendienteRestante!.id ? d.comandaPendienteRestante! : x));
        }
        return [d.comandaCobrada, ...lista];
      });
    });
    hub.on('ComandaEstadoActualizado', (d: { comandaId: number; estado: string; sectores?: SectorResumen[] }) => {
      setComandas(prev => prev.map(c => c.id === d.comandaId ? { ...c, estado: d.estado, sectores: d.sectores ?? c.sectores } : c));
    });
    hub.on('ComandaListaParaRetirar', (alerta: AlertaPedidoListo) => {
      if (!esMia(alerta.mozoId)) return;
      setComandas(prev => {
        const existe = prev.some(c => c.id === alerta.comandaId);
        if (!existe) {
          cargarComandas();
          return prev;
        }
        return prev.map(c => {
          if (c.id !== alerta.comandaId) return c;
          const sectoresActuales = c.sectores ?? [];
          const tieneSector = sectoresActuales.some(s => s.sector === alerta.sector);
          const nuevosSectores = tieneSector
            ? sectoresActuales.map(s => s.sector === alerta.sector ? { ...s, estado: 'Listo', listoEn: alerta.listoEn } : s)
            : [...sectoresActuales, { sector: alerta.sector, estado: 'Listo', listoEn: alerta.listoEn }];
          return { ...c, estado: c.estado === 'Pendiente' ? 'EnCurso' : c.estado, sectores: nuevosSectores };
        });
      });
      sonarAlertaListo();
      vibrar([200, 100, 200, 100, 350]);
      const sectorNombre = alerta.sector === 'Cocina' ? 'Cocina' : 'Barra';
      mostrar({
        tipo: 'ok',
        texto: `🔔 ¡Pedido LISTO en ${sectorNombre}! · ${alerta.mesaCodigo} (#${alerta.comandaNumero.toString().padStart(4, '0')})`
      }, 6500);
    });
    hub.on('ComandaAnulada', (d: { comandaId: number; motivo: string }) => {
      setComandas(prev => {
        const c = prev.find(x => x.id === d.comandaId);
        if (c) {
          vibrar([100, 50, 100]);
          mostrar({ tipo: 'bad', texto: `Comanda #${c.numero} (${c.mesaCodigo}) anulada: ${d.motivo}` }, 6000);
        }
        return prev.map(x => x.id === d.comandaId ? { ...x, estado: 'Anulada' } : x);
      });
    });
    hub.on('StockActualizado', (d: { productoId: number; nuevoStock: number }) => {
      setProductos(prev => prev.map(p => p.id === d.productoId ? { ...p, stockActual: d.nuevoStock } : p));
    });

    // Al volver a la app (desbloqueo del celular) refrescar datos
    const onVisible = () => { if (document.visibilityState === 'visible') cargarTodo(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener('pointerdown', desbloquearAudioMozo);
      document.removeEventListener('visibilitychange', onVisible);
      ['PedidoQrCreado', 'PedidoQrResuelto', 'TurnoIniciado', 'TurnoCerrado', 'ComandaCreada', 'ComandaDividida',
        'ComandaEstadoActualizado', 'ComandaListaParaRetirar', 'ComandaAnulada', 'StockActualizado'].forEach(ev => hub.off(ev));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mesa = mesas.find(m => m.id === mesaId) ?? null;
  const totalItems = items.reduce((a, i) => a + i.cantidad, 0);
  const tieneDatosComanda = items.length > 0 || observaciones.trim().length > 0 || esConsumoInterno;
  const tieneComandaAbierta = Boolean(mesa && tieneDatosComanda);

  const intentarElegirMesa = (nuevaMesa: Mesa) => {
    if (mesa && nuevaMesa.id !== mesa.id && tieneDatosComanda) {
      vibrar([80, 50, 80]);
      setMesaPendienteCambio(nuevaMesa);
      return;
    }
    vibrar(12);
    setMesaId(nuevaMesa.id);
    setVerMesas(false);
  };

  const mesasConPedido = useMemo(() => new Set(
    comandas.filter(c => c.estado !== 'Anulada').map(c => mesas.find(m => m.codigo === c.mesaCodigo)?.id).filter((x): x is number => !!x)
  ), [comandas, mesas]);

  // ── Acciones del carrito ─────────────────────────────────
  const agregar = (p: Producto) => {
    if (p.gruposOpcion?.length) { setProductoOpciones(p); return; }
    vibrar(10);
    setItems(prev => agregarItem(prev, p, 1, '', []));
  };
  const cambiarCantidad = (key: string, delta: number) =>
    setItems(prev => prev.map(i => i.key === key ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i));
  const eliminar = (key: string) => setItems(prev => prev.filter(i => i.key !== key));
  const ponerNota = (key: string, notas: string) =>
    setItems(prev => {
      const it = prev.find(i => i.key === key);
      if (!it) return prev;
      // Si al poner la nota queda igual a otra línea, se fusionan
      const resto = prev.filter(i => i.key !== key);
      return agregarItem(resto, it.producto, it.cantidad, notas, it.opcionIds);
    });

  const motivoBloqueo = !mesa
    ? 'Elegí la mesa o habitación antes de enviar.'
    : esConsumoInterno && !opcionConsumoInternoId
      ? 'Elegí a qué dueño corresponde el consumo interno.'
      : undefined;

  const enviar = async () => {
    if (!mesa || !items.length) return;
    if (esConsumoInterno && !opcionConsumoInternoId) {
      mostrar({ tipo: 'bad', texto: 'Elegí a qué dueño corresponde el consumo interno.' });
      return;
    }
    setEnviando(true);
    try {
      if (!turno) {
        try {
          const t = await api.abrirTurno();
          setTurno(t);
        } catch { /* continuar si el backend auto-abre */ }
      }
      const c = await api.crearComanda(
        mesa.id,
        items.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad, notas: i.notas || undefined, opcionIds: i.opcionIds.length ? i.opcionIds : undefined })),
        observaciones.trim() || undefined,
        esConsumoInterno,
        esConsumoInterno ? opcionConsumoInternoId : null
      );
      vibrar([30, 40, 30]);
      setVerCarrito(false);
      setItems([]);
      setObservaciones('');
      setEsConsumoInterno(false);
      setOpcionConsumoInternoId(null);
      setComandas(prev => [c, ...prev.filter(x => x.id !== c.id)]);
      setExito({ numero: c.numero, mesa: c.mesaCodigo });
      window.setTimeout(() => setExito(null), 2600);
      api.getProductos().then(setProductos).catch(() => { });
    } catch (e) {
      vibrar([80, 50, 80]);
      mostrar({ tipo: 'bad', texto: (e as Error).message }, 5000);
    } finally {
      setEnviando(false);
    }
  };

  const resolverQr = async (id: number, aprobar: boolean, motivo?: string) => {
    try {
      await api.resolverPedidoQr(id, aprobar, motivo);
      setPedidosQr(prev => prev.filter(p => p.id !== id));
      mostrar({ tipo: aprobar ? 'ok' : 'info', texto: aprobar ? 'Pedido confirmado y enviado' : 'Pedido rechazado' });
      if (aprobar) { cargarComandas(); api.getProductos().then(setProductos).catch(() => { }); }
    } catch (e) {
      mostrar({ tipo: 'bad', texto: (e as Error).message });
    }
  };

  const marcarEntregado = async (comandaId: number, sector: string) => {
    const key = `${comandaId}-${sector}`;
    setMarcandoKey(key);
    try {
      await api.marcarSectorEntregado(sector, comandaId);
      vibrar([30, 40, 30]);
      setComandas(prev => prev.map(c => {
        if (c.id !== comandaId) return c;
        const nuevosSectores = (c.sectores ?? []).map(s =>
          s.sector === sector ? { ...s, estado: 'Entregado' } : s
        );
        const todosEntregados = nuevosSectores.length > 0 && nuevosSectores.every(s => s.estado === 'Entregado' || s.estado === 'Anulado');
        return {
          ...c,
          estado: c.estado === 'Cobrado' ? 'Cobrado' : (todosEntregados ? 'Entregada' : 'EnCurso'),
          sectores: nuevosSectores
        };
      }));
      mostrar({ tipo: 'ok', texto: '¡Pedido marcado como entregado!' }, 2500);
    } catch (e) {
      mostrar({ tipo: 'bad', texto: (e as Error).message });
    } finally {
      setMarcandoKey(null);
    }
  };

  const alertasListas = useMemo(() => {
    const res: { comanda: Comanda; sector: string }[] = [];
    for (const c of comandas) {
      if (c.estado === 'Anulada') continue;
      for (const s of c.sectores ?? []) {
        if (s.estado === 'Listo') {
          res.push({ comanda: c, sector: s.sector });
        }
      }
    }
    return res;
  }, [comandas]);

  const iniciales = usuario.nombre.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-row">
          <img className="appbar-logo" src="/logo.png" alt="" />
          <div className="appbar-title" onClick={() => turno ? setVerCerrarTurno(true) : setVerTurno(true)} style={{ cursor: 'pointer' }}>
            <b>Ceferino</b>
            <small style={{ color: turno ? '#a3e4d7' : '#d5d8dc', display: 'flex', alignItems: 'center', gap: 4 }}>
              {turno ? (
                <>● En turno ({formatearHoraArgentina(turno.fechaApertura)} hs)</>
              ) : (
                'Sin turno activo · Iniciar'
              )}
            </small>
          </div>
          <button className="avatar" onClick={() => setVerPerfil(true)} aria-label="Perfil">{iniciales}</button>
        </div>
      </header>

      <main className="content">
        {!cargando && !turno && (
          <div className="banner warn" style={{ alignItems: 'center' }}>
            <AlertTriangle size={20} />
            <span className="grow">No tenés un turno iniciado para registrar tus horarios y comandas.</span>
            <button className="btn btn-gold btn-sm" onClick={() => setVerTurno(true)}>Iniciar turno</button>
          </div>
        )}

        {/* Alertas de pedidos listos en Cocina / Barra para retirar y entregar */}
        {alertasListas.length > 0 && (
          <div className="ready-alerts-wrap">
            {alertasListas.map(({ comanda: c, sector }) => {
              const itemsSector = c.items.filter(i => (i.sector ?? 'Cocina') === sector);
              const itemsMostrar = itemsSector.length > 0 ? itemsSector : c.items;
              const key = `${c.id}-${sector}`;
              return (
                <div key={key} className="ready-alert-card">
                  <div className="ready-alert-top">
                    <div className="ready-alert-icon">
                      <Bell size={20} />
                    </div>
                    <div className="grow">
                      <div className="ready-alert-title">
                        ¡Pedido listo en {sector === 'Cocina' ? 'Cocina' : 'Barra'}!
                      </div>
                      <div className="ready-alert-sub">
                        <b>{c.mesaCodigo}</b> · Comanda #{c.numero.toString().padStart(4, '0')}
                      </div>
                    </div>
                  </div>
                  <div className="ready-alert-items">
                    {itemsMostrar.map(i => `${i.cantidad}× ${i.productoNombre}`).join(' · ')}
                  </div>
                  <button
                    className="btn btn-ok btn-sm btn-block"
                    disabled={marcandoKey === key}
                    onClick={() => marcarEntregado(c.id, sector)}
                  >
                    {marcandoKey === key ? <span className="spinner" /> : <CheckCircle2 size={17} />}
                    Marcar como entregado
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {cargando ? (
          <div className="center-load"><span className="spinner" style={{ width: 32, height: 32 }} /></div>
        ) : tab === 'nueva' ? (
          <NuevaComanda
            mesa={mesa}
            categorias={categorias}
            productos={productos}
            items={items}
            opcionesConsumoInterno={opcionesConsumoInterno}
            esConsumoInterno={esConsumoInterno}
            opcionConsumoInternoId={opcionConsumoInternoId}
            onToggleConsumoInterno={val => {
              setEsConsumoInterno(val);
              if (!val) setOpcionConsumoInternoId(null);
            }}
            onSelectOpcionConsumoInterno={setOpcionConsumoInternoId}
            onAbrirMesas={() => setVerMesas(true)}
            onAgregar={agregar}
            onCantidad={cambiarCantidad}
            onEliminar={eliminar}
          />
        ) : tab === 'comandas' ? (
          <MisComandas
            comandas={comandas}
            cargando={cargandoComandas}
            onRefrescar={() => cargarComandas()}
            onMarcarEntregado={marcarEntregado}
            marcandoKey={marcandoKey}
          />
        ) : (
          <PedidosQr pedidos={pedidosQr} onResolver={resolverQr} />
        )}
      </main>

      {tab === 'nueva' && totalItems > 0 && !verCarrito && (
        <button className="cart-bar" onClick={() => setVerCarrito(true)}>
          <span className="qty">{totalItems}</span>
          <span className="txt">
            Ver comanda
            <small>{mesa ? mesa.codigo : 'Falta elegir mesa'} · {items.length} {items.length === 1 ? 'producto' : 'productos'}</small>
          </span>
          <span className="go">Revisar <ChevronRight size={18} /></span>
        </button>
      )}

      <nav className="bottom-nav">
        <button className={`nav-item${tab === 'nueva' ? ' active' : ''}`} onClick={() => { vibrar(6); setTab('nueva'); }}>
          <ClipboardPlus size={23} /> Tomar pedido
          {totalItems > 0 && tab !== 'nueva' && <span className="nav-badge">{totalItems}</span>}
        </button>
        <button className={`nav-item${tab === 'comandas' ? ' active' : ''}`} onClick={() => { vibrar(6); setTab('comandas'); }}>
          <ClipboardList size={23} /> Mis comandas
          {alertasListas.length > 0 ? (
            <span className="nav-badge pulse-ok" title="Pedidos listos para retirar">
              {alertasListas.length}
            </span>
          ) : comandas.filter(c => c.estado !== 'Entregada' && c.estado !== 'Cobrado' && c.estado !== 'Anulada').length > 0 ? (
            <span className="nav-badge" style={{ background: 'var(--surface-3)', color: 'var(--gold-light)' }}>
              {comandas.filter(c => c.estado !== 'Entregada' && c.estado !== 'Cobrado' && c.estado !== 'Anulada').length}
            </span>
          ) : null}
        </button>
        <button className={`nav-item${tab === 'qr' ? ' active' : ''}`} onClick={() => { vibrar(6); setTab('qr'); }}>
          <QrCode size={23} /> Pedidos QR
          {pedidosQr.length > 0 && <span className="nav-badge">{pedidosQr.length}</span>}
        </button>
      </nav>

      {/* ── Hojas ── */}
      {verMesas && (
        <MesaPicker
          mesas={mesas}
          seleccionada={mesa}
          mesasConPedido={mesasConPedido}
          tieneComandaAbierta={tieneComandaAbierta}
          cantidadItemsAbiertos={totalItems}
          onElegir={intentarElegirMesa}
          onClose={() => setVerMesas(false)}
        />
      )}

      {mesaPendienteCambio && mesa && (
        <>
          <div className="alert-backdrop" onClick={() => setMesaPendienteCambio(null)} />
          <div className="alert-dialog" role="alertdialog" aria-modal="true" aria-labelledby="alerta-comanda-abierta-titulo">
            <div className="alert-dialog-head">
              <div className="alert-dialog-icon">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 id="alerta-comanda-abierta-titulo">Comanda abierta en {mesa.codigo}</h3>
                <p>No confirmaste el pedido antes de pasar a {mesaPendienteCambio.codigo}</p>
              </div>
            </div>

            <div className="alert-dialog-body">
              <p className="alert-dialog-msg">
                Tenés una comanda con datos cargados en <b>{mesa.codigo}</b> sin confirmar. Si cambiás a <b>{mesaPendienteCambio.codigo}</b> ahora, podés olvidarte de enviarla o mezclar los pedidos.
              </p>

              <div className="alert-summary-box">
                <div className="alert-summary-title">
                  Pedido sin confirmar en {mesa.codigo}:
                </div>
                {items.length > 0 ? (
                  <ul className="alert-summary-list">
                    {items.map(i => (
                      <li key={i.key}>
                        <b>{i.cantidad}×</b> {i.producto.nombre}
                        {i.opcionesTexto.length > 0 ? ` (${i.opcionesTexto.join(', ')})` : ''}
                        {i.notas ? ` · “${i.notas}”` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted" style={{ fontSize: 13 }}>Sin productos agregados (con observaciones o consumo interno cargado).</div>
                )}
                {observaciones.trim() && (
                  <div className="alert-summary-meta">Obs.: “{observaciones.trim()}”</div>
                )}
                {esConsumoInterno && (
                  <div className="alert-summary-meta">
                    Consumo interno{opcionConsumoInternoId ? `: ${opcionesConsumoInterno.find(o => o.id === opcionConsumoInternoId)?.nombre ?? ''}` : ''}
                  </div>
                )}
              </div>
            </div>

            <div className="alert-dialog-actions">
              {items.length > 0 && (
                <button
                  className="btn btn-gold btn-block"
                  onClick={() => {
                    vibrar(12);
                    setMesaPendienteCambio(null);
                    setVerMesas(false);
                    window.setTimeout(() => setVerCarrito(true), 320);
                  }}
                >
                  Revisar y confirmar {mesa.codigo}
                </button>
              )}
              <button
                className="btn btn-ghost btn-block"
                onClick={() => {
                  vibrar(8);
                  setMesaPendienteCambio(null);
                  setVerMesas(false);
                }}
              >
                Seguir cargando en {mesa.codigo}
              </button>
              <button
                className="btn btn-ghost btn-sm btn-block"
                onClick={() => {
                  const destino = mesaPendienteCambio;
                  vibrar(12);
                  setMesaId(destino.id);
                  setMesaPendienteCambio(null);
                  setVerMesas(false);
                  mostrar({ tipo: 'info', texto: `Pedido trasladado a ${destino.codigo}` }, 2600);
                }}
              >
                Mover este pedido a {mesaPendienteCambio.codigo}
              </button>
              <button
                className="btn btn-danger btn-sm btn-block"
                onClick={() => {
                  const destino = mesaPendienteCambio;
                  vibrar(15);
                  setItems([]);
                  setObservaciones('');
                  setEsConsumoInterno(false);
                  setOpcionConsumoInternoId(null);
                  setMesaId(destino.id);
                  setMesaPendienteCambio(null);
                  setVerMesas(false);
                  mostrar({ tipo: 'info', texto: `Comanda anterior descartada · Ahora en ${destino.codigo}` }, 2800);
                }}
              >
                Descartar {mesa.codigo} y comandar {mesaPendienteCambio.codigo}
              </button>
            </div>
          </div>
        </>
      )}

      {productoOpciones && (
        <OpcionesSheet
          producto={productoOpciones}
          onClose={() => setProductoOpciones(null)}
          onConfirmar={(cant, notas, ids) => {
            setItems(prev => agregarItem(prev, productoOpciones, cant, notas, ids));
            setProductoOpciones(null);
            mostrar({ tipo: 'ok', texto: `${cant}× ${productoOpciones.nombre} agregado` }, 1600);
          }}
        />
      )}

      {verCarrito && (
        <CartSheet
          mesa={mesa}
          items={items}
          observaciones={observaciones}
          opcionesConsumoInterno={opcionesConsumoInterno}
          esConsumoInterno={esConsumoInterno}
          opcionConsumoInternoId={opcionConsumoInternoId}
          onToggleConsumoInterno={val => {
            setEsConsumoInterno(val);
            if (!val) setOpcionConsumoInternoId(null);
          }}
          onSelectOpcionConsumoInterno={setOpcionConsumoInternoId}
          enviando={enviando}
          puedeEnviar={!motivoBloqueo && items.length > 0}
          motivoBloqueo={motivoBloqueo}
          onCantidad={cambiarCantidad}
          onNota={ponerNota}
          onEliminar={key => { eliminar(key); if (items.length === 1) setVerCarrito(false); }}
          onObservaciones={setObservaciones}
          onVaciar={() => {
            setItems([]);
            setObservaciones('');
            setEsConsumoInterno(false);
            setOpcionConsumoInternoId(null);
            setVerCarrito(false);
          }}
          onCambiarMesa={() => { setVerCarrito(false); setTimeout(() => setVerMesas(true), 350); }}
          onEnviar={enviar}
          onClose={() => setVerCarrito(false)}
        />
      )}

      {verTurno && (
        <AbrirTurnoSheet
          usuario={usuario}
          onClose={() => setVerTurno(false)}
          onAbierto={t => {
            setTurno(t);
            setVerTurno(false);
            cargarComandas(t);
            mostrar({ tipo: 'ok', texto: `¡Turno iniciado con éxito!` });
          }}
          onError={msg => mostrar({ tipo: 'bad', texto: msg })}
        />
      )}

      {verCerrarTurno && turno && (
        <CerrarTurnoSheet
          turno={turno}
          comandasCount={comandas.filter(c => c.estado !== 'Anulada').length}
          onClose={() => setVerCerrarTurno(false)}
          onCerrado={() => {
            setTurno(null);
            setVerCerrarTurno(false);
            setComandas([]);
            mostrar({ tipo: 'ok', texto: 'Turno cerrado correctamente' });
          }}
          onError={msg => mostrar({ tipo: 'bad', texto: msg })}
        />
      )}

      {verPerfil && (
        <Sheet titulo={usuario.nombre} subtitulo={`Rol: ${usuario.rol}`} onClose={() => setVerPerfil(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 'var(--safe-b)' }}>
            <div className="muted" style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Clock size={16} /> {turno ? `En turno desde: ${formatearHoraArgentina(turno.fechaApertura)} hs` : 'Sin turno activo'}
            </div>
            {turno ? (
              <>
                <div className="muted" style={{ fontSize: 14 }}>
                  Comandas tomadas en este turno: <b className="gold">{comandas.filter(c => c.estado !== 'Anulada').length}</b>
                </div>
                <button
                  className="btn btn-outline btn-block"
                  style={{ borderColor: 'var(--gold)', color: 'var(--gold-light)' }}
                  onClick={() => { setVerPerfil(false); setVerCerrarTurno(true); }}
                >
                  <Clock size={16} /> Cerrar mi turno
                </button>
              </>
            ) : (
              <button
                className="btn btn-gold btn-block"
                onClick={() => { setVerPerfil(false); setVerTurno(true); }}
              >
                <Clock size={16} /> Iniciar mi turno
              </button>
            )}
            <button className="btn btn-danger btn-block" style={{ marginTop: 10 }} onClick={async () => {
              if (items.length && !confirm('Tenés una comanda sin enviar. ¿Salir igual? (se conserva en este celular)')) return;
              if (turno && confirm('Tenés un turno de trabajo en curso. ¿Deseas finalizar tu turno al cerrar sesión?')) {
                try {
                  await api.cerrarTurno(turno.id, 'Cierre de turno al salir de la app');
                } catch {
                  // continuar con logout
                }
              }
              onLogout();
            }}>
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </Sheet>
      )}

      {toast && (
        <div className={`toast ${toast.tipo}`} onClick={() => setToast(null)}>
          {toast.tipo === 'bad' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.texto}</span>
        </div>
      )}

      {exito && (
        <div className="success" onClick={() => setExito(null)}>
          <div className="ring"><CheckCircle2 size={52} /></div>
          <div className="serif gold" style={{ fontSize: 22, marginTop: 8 }}>¡Comanda enviada!</div>
          <div className="num">#{exito.numero.toString().padStart(6, '0')}</div>
          <p>{exito.mesa} · ya está en cocina y barra</p>
        </div>
      )}
    </div>
  );
}

function AbrirTurnoSheet({ usuario, onClose, onAbierto, onError }: {
  usuario: Usuario; onClose: () => void; onAbierto: (t: Turno) => void; onError: (m: string) => void;
}) {
  const [observaciones, setObservaciones] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  const abrir = async () => {
    setAbriendo(true);
    try {
      const nuevo = await api.abrirTurno(observaciones.trim() || undefined);
      onAbierto(nuevo);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <Sheet
      titulo="Iniciar mi turno"
      subtitulo={`Mozo: ${usuario.nombre}`}
      onClose={onClose}
      footer={
        <button className="btn btn-gold btn-xl btn-block" disabled={abriendo} onClick={abrir}>
          {abriendo ? <span className="spinner" /> : <Clock size={19} />} Empezar turno ahora
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          Al iniciar tu turno, tus comandas y el horario de trabajo quedarán registrados a tu nombre para el control diario administrativo.
        </p>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--gold-light)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
            OBSERVACIONES (OPCIONAL)
          </label>
          <input
            type="text"
            className="input"
            style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: '#fff', fontSize: '0.95rem' }}
            placeholder="Ej: Sector Salón / Asignación de mesas..."
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}

function CerrarTurnoSheet({ turno, comandasCount, onClose, onCerrado, onError }: {
  turno: Turno; comandasCount: number; onClose: () => void; onCerrado: () => void; onError: (m: string) => void;
}) {
  const [observaciones, setObservaciones] = useState('');
  const [cerrando, setCerrando] = useState(false);

  const cerrar = async () => {
    setCerrando(true);
    try {
      await api.cerrarTurno(turno.id, observaciones.trim() || undefined);
      onCerrado();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setCerrando(false);
    }
  };

  const horaInicio = formatearHoraArgentina(turno.fechaApertura);

  return (
    <Sheet
      titulo="Cerrar mi turno"
      subtitulo={`Iniciado a las ${horaInicio} hs`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose} disabled={cerrando}>
            Volver
          </button>
          <button className="btn btn-danger" style={{ flex: 2 }} disabled={cerrando} onClick={cerrar}>
            {cerrando ? <span className="spinner" /> : <LogOut size={18} />} Confirmar cierre
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Comandas emitidas en tu turno:</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--gold-light)' }}>{comandasCount}</div>
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--gold-light)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
            OBSERVACIONES DE CIERRE (OPCIONAL)
          </label>
          <input
            type="text"
            className="input"
            style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: '#fff', fontSize: '0.95rem' }}
            placeholder="Ej: Rendición completa, mesas entregadas..."
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}
