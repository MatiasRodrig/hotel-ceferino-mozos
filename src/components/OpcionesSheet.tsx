import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Sheet } from './Sheet';
import { vibrar, type GrupoOpcion, type Producto } from '../api';

interface Props {
  producto: Producto;
  onConfirmar: (cantidad: number, notas: string, opcionIds: number[]) => void;
  onClose: () => void;
}

export function OpcionesSheet({ producto, onConfirmar, onClose }: Props) {
  const grupos = [...(producto.gruposOpcion ?? [])].sort((a, b) => a.orden - b.orden);
  const [sel, setSel] = useState<Record<number, number[]>>({});
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState('');
  const [faltantes, setFaltantes] = useState<number[]>([]);

  const maxStock = producto.controlaStock ? producto.stockActual : 99;

  const toggle = (g: GrupoOpcion, opcionId: number) => {
    vibrar(8);
    setFaltantes(f => f.filter(id => id !== g.id));
    setSel(prev => {
      const act = prev[g.id] ?? [];
      if (g.seleccionMultiple)
        return { ...prev, [g.id]: act.includes(opcionId) ? act.filter(i => i !== opcionId) : [...act, opcionId] };
      return { ...prev, [g.id]: act[0] === opcionId && !g.obligatorio ? [] : [opcionId] };
    });
  };

  const confirmar = () => {
    const sinElegir = grupos.filter(g => g.obligatorio && !(sel[g.id]?.length)).map(g => g.id);
    if (sinElegir.length) {
      setFaltantes(sinElegir);
      vibrar([50, 30, 50]);
      return;
    }
    vibrar(15);
    onConfirmar(cantidad, notas.trim(), Object.values(sel).flat());
  };

  return (
    <Sheet
      titulo={producto.nombre}
      subtitulo={producto.descripcion || producto.categoriaNombre}
      onClose={onClose}
      footer={
        <>
          {faltantes.length > 0 && (
            <div className="banner bad" style={{ margin: 0 }}>Elegí las opciones obligatorias marcadas</div>
          )}
          <button className="btn btn-gold btn-xl btn-block" onClick={confirmar}>
            Agregar {cantidad > 1 ? `${cantidad} ` : ''}a la comanda
          </button>
        </>
      }
    >
      {grupos.map(g => {
        const elegidas = sel[g.id] ?? [];
        return (
          <div key={g.id} className={`opt-group${faltantes.includes(g.id) ? ' error' : ''}`}>
            <div className="opt-group-head">
              <b>{g.nombre}</b>
              <span className={`tag ${g.obligatorio ? (faltantes.includes(g.id) ? 'bad' : 'gold') : ''}`}>
                {g.obligatorio ? 'Obligatorio' : 'Opcional'}{g.seleccionMultiple ? ' · varias' : ''}
              </span>
            </div>
            <div className="opt-list">
              {[...g.opciones].sort((a, b) => a.orden - b.orden).map(o => {
                const activa = elegidas.includes(o.id);
                return (
                  <button key={o.id} className={`opt${activa ? ' active' : ''}`} onClick={() => toggle(g, o.id)}>
                    <span className={`mark ${g.seleccionMultiple ? 'check' : 'radio'}`}>
                      {activa && <Check size={14} strokeWidth={3.5} />}
                    </span>
                    {o.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <span className="field-label">Cantidad</span>
      <div className="qty-row">
        <span className="muted" style={{ fontSize: 14 }}>
          {producto.controlaStock ? `Quedan ${producto.stockActual} en stock` : 'Sin control de stock'}
        </span>
        <div className="stepper">
          <button onClick={() => setCantidad(c => Math.max(1, c - 1))} disabled={cantidad <= 1} aria-label="Restar"><Minus size={18} /></button>
          <span>{cantidad}</span>
          <button onClick={() => setCantidad(c => Math.min(maxStock, c + 1))} disabled={cantidad >= maxStock} aria-label="Sumar"><Plus size={18} /></button>
        </div>
      </div>

      <span className="field-label">Nota para cocina / barra</span>
      <input
        value={notas}
        onChange={e => setNotas(e.target.value)}
        placeholder="Ej: sin sal, salsa aparte…"
        maxLength={200}
        enterKeyHint="done"
      />
    </Sheet>
  );
}
