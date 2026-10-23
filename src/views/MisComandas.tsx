import { useState } from 'react';
import { RefreshCw, ChefHat, Wine, ChevronDown, ChevronUp, ClipboardList, CheckCircle2, Bell, UserCheck } from 'lucide-react';
import type { Comanda, SectorResumen } from '../api';
import { formatearHoraArgentina } from '../fechas';

interface Props {
  comandas: Comanda[];
  cargando: boolean;
  onRefrescar: () => void;
  onMarcarEntregado: (comandaId: number, sector: string) => void;
  marcandoKey: string | null;
}

const hora = (iso: string) => formatearHoraArgentina(iso);

function SectorChip({ s }: { s: SectorResumen }) {
  const esCocina = s.sector === 'Cocina';
  const map: Record<string, [string, string]> = {
    Pendiente: ['warn', 'Pendiente'],
    EnPreparacion: ['gold', 'En preparación'],
    Listo: ['listo', '¡Listo para retirar!'],
    Entregado: ['ok', 'Entregado'],
    Anulado: ['bad', 'Anulado']
  };
  const [cls, txt] = map[s.estado] ?? ['', s.estado];
  return (
    <span className={`tag ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', fontSize: 12 }}>
      {s.estado === 'Listo' ? <Bell size={13} /> : esCocina ? <ChefHat size={13} /> : <Wine size={13} />}
      {esCocina ? 'Cocina' : 'Barra'} · {txt}
    </span>
  );
}

export function MisComandas({ comandas, cargando, onRefrescar, onMarcarEntregado, marcandoKey }: Props) {
  const [filtro, setFiltro] = useState<'todas' | 'activas' | 'entregadas'>('todas');
  const [abierta, setAbierta] = useState<number | null>(null);

  const activa = (c: Comanda) => c.estado !== 'Entregada' && c.estado !== 'Cobrado' && c.estado !== 'Anulada';
  const entregada = (c: Comanda) => c.estado === 'Entregada' || c.estado === 'Cobrado';

  const lista = [...comandas]
    .filter(c => {
      if (filtro === 'activas') return activa(c);
      if (filtro === 'entregadas') return entregada(c);
      return true;
    })
    .sort((a, b) => b.numero - a.numero);

  return (
    <>
      <div className="list-head">
        <h2>Mis comandas</h2>
        <button className="icon-btn" onClick={onRefrescar} aria-label="Actualizar">
          <RefreshCw size={20} className={cargando ? 'spin' : ''} style={cargando ? { animation: 'spin 0.8s linear infinite' } : undefined} />
        </button>
      </div>
      <div className="filter-row">
        <button className={`chip${filtro === 'todas' ? ' active' : ''}`} onClick={() => setFiltro('todas')}>
          Todas del turno · {comandas.length}
        </button>
        <button className={`chip${filtro === 'entregadas' ? ' active' : ''}`} onClick={() => setFiltro('entregadas')}>
          Cumplidas · {comandas.filter(entregada).length}
        </button>
        <button className={`chip${filtro === 'activas' ? ' active' : ''}`} onClick={() => setFiltro('activas')}>
          En curso · {comandas.filter(activa).length}
        </button>
      </div>

      {lista.length === 0 && !cargando && (
        <div className="empty-state">
          <ClipboardList size={40} />
          <p>
            {filtro === 'activas'
              ? 'No tenés comandas en curso.'
              : filtro === 'entregadas'
              ? 'No hay comandas cumplidas aún en este turno.'
              : 'Todavía no tomaste comandas en este turno.'}
          </p>
        </div>
      )}

      {lista.map(c => {
        const exp = abierta === c.id;
        const sectoresListos = c.estado !== 'Anulada'
          ? (c.sectores ?? []).filter(s => s.estado === 'Listo')
          : [];
        return (
          <div key={c.id} className={`cmd-card${c.estado === 'Anulada' ? ' anulada' : ''}${sectoresListos.length > 0 ? ' is-ready' : ''}`}>
            <button className="cmd-top" onClick={() => setAbierta(exp ? null : c.id)}>
              <div className="grow">
                <div className="cmd-num">#{c.numero.toString().padStart(6, '0')}</div>
                <div className="cmd-mesa">{c.mesaCodigo}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="cmd-time">{hora(c.fechaHora)}</div>
                <div className="cmd-time">{(() => { const n = c.items.reduce((a, i) => a + i.cantidad, 0); return `${n} ${n === 1 ? 'ítem' : 'ítems'}`; })()}</div>
              </div>
              {exp ? <ChevronUp size={20} color="var(--muted)" /> : <ChevronDown size={20} color="var(--muted)" />}
            </button>
            <div className="cmd-sectors">
              {c.esConsumoInterno && (
                <span className="tag gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', fontSize: 12 }}>
                  <UserCheck size={13} /> Consumo interno{c.consumoInternoNombre ? ` · ${c.consumoInternoNombre}` : ''}
                </span>
              )}
              {c.estado === 'Anulada'
                ? <span className="tag bad" style={{ padding: '5px 9px', fontSize: 12 }}>Comanda anulada</span>
                : (c.sectores ?? []).map(s => <SectorChip key={s.sector} s={s} />)}
              {c.estado === 'Entregada' && <span className="tag ok" style={{ padding: '5px 9px', fontSize: 12 }}>Cumplida / Entregada</span>}
              {c.estado === 'Cobrado' && <span className="tag gold" style={{ padding: '5px 9px', fontSize: 12 }}>Cobrada</span>}
            </div>
            {sectoresListos.length > 0 && (
              <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sectoresListos.map(s => {
                  const key = `${c.id}-${s.sector}`;
                  return (
                    <button
                      key={s.sector}
                      className="btn btn-ok btn-sm btn-block"
                      disabled={marcandoKey === key}
                      onClick={() => onMarcarEntregado(c.id, s.sector)}
                    >
                      {marcandoKey === key ? <span className="spinner" /> : <CheckCircle2 size={16} />}
                      Marcar {s.sector === 'Cocina' ? 'Cocina' : 'Barra'} como entregado
                    </button>
                  );
                })}
              </div>
            )}
            {exp && (
              <ul className="cmd-items">
                {c.items.map(i => (
                  <li key={i.id}>
                    <b>{i.cantidad}×</b>{i.productoNombre}
                    {(i.opciones?.length ?? 0) > 0 && <span className="muted"> · {i.opciones!.map(o => o.opcionNombre).join(', ')}</span>}
                    {i.notas && <div className="muted" style={{ fontSize: 12.5, fontStyle: 'italic', marginLeft: 22 }}>“{i.notas}”</div>}
                  </li>
                ))}
                {c.observaciones && <li className="muted" style={{ marginTop: 6 }}>Obs.: {c.observaciones}</li>}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
