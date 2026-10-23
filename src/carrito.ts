import type { Producto } from './api';

export interface ItemCarrito {
  key: string;
  producto: Producto;
  cantidad: number;
  notas: string;
  opcionIds: number[];
  opcionesTexto: string[];
}

export interface Borrador {
  mesaId: number | null;
  items: ItemCarrito[];
  observaciones: string;
  esConsumoInterno?: boolean;
  opcionConsumoInternoId?: number | null;
}

const KEY = 'ceferino_mozo_borrador';

/** El borrador se guarda localmente: si el celular se bloquea o recarga, el pedido no se pierde. */
export function cargarBorrador(): Borrador {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupto */ }
  return { mesaId: null, items: [], observaciones: '', esConsumoInterno: false, opcionConsumoInternoId: null };
}

export function guardarBorrador(b: Borrador) {
  localStorage.setItem(KEY, JSON.stringify(b));
}

export function textoOpciones(p: Producto, ids: number[]): string[] {
  const out: string[] = [];
  for (const g of p.gruposOpcion ?? [])
    for (const o of g.opciones)
      if (ids.includes(o.id)) out.push(o.nombre);
  return out;
}

/** Agrega fusionando con un ítem idéntico (mismo producto, opciones y nota). */
export function agregarItem(items: ItemCarrito[], p: Producto, cantidad: number, notas: string, opcionIds: number[]): ItemCarrito[] {
  const ids = [...opcionIds].sort((a, b) => a - b);
  const igual = items.find(i => i.producto.id === p.id && i.notas === notas && i.opcionIds.join() === ids.join());
  if (igual) return items.map(i => i === igual ? { ...i, cantidad: i.cantidad + cantidad } : i);
  return [...items, {
    key: `${p.id}-${ids.join('_')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    producto: p, cantidad, notas, opcionIds: ids, opcionesTexto: textoOpciones(p, ids)
  }];
}

export function esBebida(p: Producto) {
  return (p.sector ?? '').toLowerCase() === 'almacen';
}
