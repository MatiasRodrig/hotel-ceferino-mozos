import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Sheet } from './Sheet';
import type { Mesa } from '../api';

interface Props {
  mesas: Mesa[];
  seleccionada: Mesa | null;
  mesasConPedido: Set<number>;
  tieneComandaAbierta?: boolean;
  cantidadItemsAbiertos?: number;
  onElegir: (m: Mesa) => void;
  onClose: () => void;
}

/** Etiqueta corta para la grilla: "Mesa 04" → "04", "Habitación 101" → "101". */
function corto(codigo: string) {
  const m = codigo.match(/(\d+)\s*$/);
  return m ? m[1] : codigo;
}

export function MesaPicker({
  mesas,
  seleccionada,
  mesasConPedido,
  tieneComandaAbierta,
  cantidadItemsAbiertos = 0,
  onElegir,
  onClose
}: Props) {
  const esHab = (m: Mesa) => m.tipo.toLowerCase().startsWith('hab');
  const [tab, setTab] = useState<'salon' | 'hab'>(seleccionada && esHab(seleccionada) ? 'hab' : 'salon');
  const lista = mesas.filter(m => (tab === 'hab') === esHab(m));

  return (
    <Sheet titulo="¿Dónde es el pedido?" subtitulo="Elegí la mesa o habitación" onClose={onClose} full>
      {tieneComandaAbierta && seleccionada && (
        <div className="banner warn" style={{ margin: '0 0 14px 0', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <div className="grow" style={{ fontSize: 13 }}>
            Tenés una comanda abierta sin confirmar en <b>{seleccionada.codigo}</b>
            {cantidadItemsAbiertos > 0 ? ` (${cantidadItemsAbiertos} ${cantidadItemsAbiertos === 1 ? 'ítem' : 'ítems'})` : ''}.
          </div>
        </div>
      )}

      <div className="segmented">
        <button className={tab === 'salon' ? 'active' : ''} onClick={() => setTab('salon')}>
          Salón · {mesas.filter(m => !esHab(m)).length}
        </button>
        <button className={tab === 'hab' ? 'active' : ''} onClick={() => setTab('hab')}>
          Habitaciones · {mesas.filter(esHab).length}
        </button>
      </div>

      <div className="mesa-grid">
        {lista.map(m => (
          <button
            key={m.id}
            className={`mesa-tile${seleccionada?.id === m.id ? ' active' : ''}`}
            onClick={() => onElegir(m)}
          >
            <small>{esHab(m) ? 'Hab.' : 'Mesa'}</small>
            <b>{corto(m.codigo)}</b>
            {mesasConPedido.has(m.id) ? <span className="dot" title="Con comandas en el turno" /> : <small>{m.capacidad} pers.</small>}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
        Mesas donde ya tomaste comandas en este turno
      </p>
    </Sheet>
  );
}
