import { useState } from 'react';
import { Minus, Plus, Trash2, PencilLine, Send, ChefHat, Wine, UserCheck } from 'lucide-react';
import { Sheet } from './Sheet';
import { esBebida, type ItemCarrito } from '../carrito';
import { vibrar, type Mesa, type OpcionConsumoInterno } from '../api';

interface Props {
  mesa: Mesa | null;
  items: ItemCarrito[];
  observaciones: string;
  opcionesConsumoInterno: OpcionConsumoInterno[];
  esConsumoInterno: boolean;
  opcionConsumoInternoId: number | null;
  onToggleConsumoInterno: (val: boolean) => void;
  onSelectOpcionConsumoInterno: (id: number | null) => void;
  enviando: boolean;
  puedeEnviar: boolean;
  motivoBloqueo?: string;
  onCantidad: (key: string, delta: number) => void;
  onNota: (key: string, nota: string) => void;
  onEliminar: (key: string) => void;
  onObservaciones: (v: string) => void;
  onVaciar: () => void;
  onCambiarMesa: () => void;
  onEnviar: () => void;
  onClose: () => void;
}

export function CartSheet(p: Props) {
  const [editandoNota, setEditandoNota] = useState<string | null>(null);
  const total = p.items.reduce((a, i) => a + i.cantidad, 0);
  const cocina = p.items.filter(i => !esBebida(i.producto)).reduce((a, i) => a + i.cantidad, 0);
  const barra = total - cocina;

  return (
    <Sheet
      full
      titulo="Revisar comanda"
      subtitulo={
        <button onClick={p.onCambiarMesa} style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, padding: '2px 0' }}>
          {p.mesa ? `${p.mesa.codigo} · cambiar` : 'Elegir mesa o habitación'}
        </button>
      }
      onClose={p.onClose}
      footer={
        <>
          {!p.puedeEnviar && p.motivoBloqueo && <div className="banner warn" style={{ margin: 0 }}>{p.motivoBloqueo}</div>}
          <button
            className="btn btn-gold btn-xl btn-block"
            disabled={!p.puedeEnviar || p.enviando}
            onClick={() => { vibrar(20); p.onEnviar(); }}
          >
            {p.enviando ? <span className="spinner" /> : <Send size={19} />}
            {p.enviando ? 'Enviando…' : `Enviar comanda · ${total} ${total === 1 ? 'ítem' : 'ítems'}`}
          </button>
        </>
      }
    >
      <div className="sector-split" style={{ marginBottom: 6 }}>
        {cocina > 0 && <span className="tag gold" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '5px 9px', fontSize: 12 }}><ChefHat size={14} /> Cocina · {cocina}</span>}
        {barra > 0 && <span className="tag gold" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '5px 9px', fontSize: 12 }}><Wine size={14} /> Barra / Almacén · {barra}</span>}
      </div>

      {p.items.map(i => (
        <div key={i.key} className="cart-item">
          <div className="cart-item-row">
            <div className="grow">
              <div className="cart-item-name">{i.producto.nombre}</div>
              {i.opcionesTexto.length > 0 && (
                <div className="opts-inline">{i.opcionesTexto.map(t => <span key={t} className="tag gold">{t}</span>)}</div>
              )}
            </div>
            <div className="stepper">
              <button onClick={() => { vibrar(8); i.cantidad === 1 ? p.onEliminar(i.key) : p.onCantidad(i.key, -1); }} aria-label="Restar">
                {i.cantidad === 1 ? <Trash2 size={17} /> : <Minus size={18} />}
              </button>
              <span>{i.cantidad}</span>
              <button
                onClick={() => { vibrar(8); p.onCantidad(i.key, 1); }}
                disabled={i.producto.controlaStock && i.cantidad >= i.producto.stockActual}
                aria-label="Sumar"
              ><Plus size={18} /></button>
            </div>
          </div>

          {editandoNota === i.key ? (
            <input
              autoFocus
              style={{ marginTop: 8 }}
              defaultValue={i.notas}
              placeholder="Nota (ej: sin cebolla)"
              maxLength={200}
              enterKeyHint="done"
              onBlur={e => { p.onNota(i.key, e.target.value.trim()); setEditandoNota(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          ) : i.notas ? (
            <button className="note-text" onClick={() => setEditandoNota(i.key)}>“{i.notas}” <PencilLine size={12} /></button>
          ) : (
            <button className="note-btn" onClick={() => setEditandoNota(i.key)}><PencilLine size={14} /> Agregar nota</button>
          )}
        </div>
      ))}

      <span className="field-label">Observaciones de la comanda</span>
      <textarea
        rows={2}
        value={p.observaciones}
        onChange={e => p.onObservaciones(e.target.value)}
        placeholder="Ej: alérgico a frutos secos, traer entrada primero…"
        maxLength={300}
      />

      <div
        style={{
          marginTop: 14,
          padding: '11px 12px',
          borderRadius: 12,
          background: p.esConsumoInterno ? 'rgba(202, 163, 92, 0.14)' : 'var(--surface-1)',
          border: p.esConsumoInterno ? '1px solid var(--gold)' : '1px solid var(--border)'
        }}
      >
        <div
          onClick={() => { vibrar(8); p.onToggleConsumoInterno(!p.esConsumoInterno); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={p.esConsumoInterno}
            onChange={e => p.onToggleConsumoInterno(e.target.checked)}
            onClick={e => e.stopPropagation()}
            style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
          />
          <UserCheck size={18} color={p.esConsumoInterno ? 'var(--gold-light)' : 'var(--muted)'} />
          <div className="grow">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: p.esConsumoInterno ? 'var(--gold-light)' : '#fff' }}>
              Consumo interno (Dueños)
            </div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              {p.esConsumoInterno
                ? (p.opcionesConsumoInterno.find(o => o.id === p.opcionConsumoInternoId)?.nombre || 'Elegí a qué dueño corresponde')
                : 'La comanda funcionará igual que las demás, dejando registro del consumo'}
            </div>
          </div>
        </div>

        {p.esConsumoInterno && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.opcionesConsumoInterno.map(op => {
              const sel = p.opcionConsumoInternoId === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => { vibrar(8); p.onSelectOpcionConsumoInterno(op.id); }}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: sel ? '1px solid var(--gold)' : '1px solid var(--border)',
                    background: sel ? 'var(--gold)' : 'var(--surface-2)',
                    color: sel ? '#0d1610' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {op.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        className="btn btn-danger btn-sm"
        style={{ marginTop: 18 }}
        onClick={() => { if (confirm('¿Vaciar toda la comanda?')) p.onVaciar(); }}
      >
        <Trash2 size={15} /> Vaciar comanda
      </button>
    </Sheet>
  );
}
