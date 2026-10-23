import { useState } from 'react';
import { Check, X, QrCode } from 'lucide-react';
import { vibrar, type PedidoQr } from '../api';
import { parsearFechaUtc } from '../fechas';

interface Props {
  pedidos: PedidoQr[];
  onResolver: (id: number, aprobar: boolean, motivo?: string) => Promise<void>;
}

const hace = (iso: string) => {
  const d = parsearFechaUtc(iso);
  const min = d ? Math.max(0, Math.round((Date.now() - d.getTime()) / 60000)) : 0;
  return min < 1 ? 'recién' : `hace ${min} min`;
};

export function PedidosQr({ pedidos, onResolver }: Props) {
  const [procesando, setProcesando] = useState<number | null>(null);

  const resolver = async (id: number, aprobar: boolean) => {
    let motivo: string | undefined;
    if (!aprobar) {
      const r = prompt('Motivo del rechazo (opcional):');
      if (r === null) return;
      motivo = r || undefined;
    }
    vibrar(15);
    setProcesando(id);
    try { await onResolver(id, aprobar, motivo); } finally { setProcesando(null); }
  };

  return (
    <>
      <div className="list-head"><h2>Pedidos por QR</h2></div>
      <p className="muted" style={{ padding: '0 14px', fontSize: 13 }}>
        Pedidos de huéspedes desde su celular. Al confirmar se genera la comanda y va a cocina/barra.
      </p>

      {pedidos.length === 0 && (
        <div className="empty-state">
          <QrCode size={40} />
          <p>No hay pedidos QR pendientes.</p>
        </div>
      )}

      {pedidos.map(p => (
        <div key={p.id} className="qr-card">
          <div className="qr-card-head">
            <b>{p.mesaTipo === 'Delivery' ? '🛵 ' : p.mesaTipo === 'Habitacion' ? '🏨 ' : '🍽️ '}{p.mesaCodigo}</b>
            <span className="muted" style={{ fontSize: 12 }}>{hace(p.fechaCreacion)}</span>
          </div>
          {p.nombreHuesped && <div className="gold" style={{ fontSize: 13, marginBottom: 4 }}>{p.nombreHuesped}</div>}
          {p.direccionEntrega && <div style={{ fontSize: 13, color: '#6ee7b7', marginBottom: 4 }}>📍 {p.direccionEntrega}</div>}
          {p.telefonoContacto && <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>📞 {p.telefonoContacto}</div>}
          {p.metodoPago && <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>💳 {p.metodoPago}</div>}
          <ul className="qr-items">
            {p.items.map(i => (
              <li key={i.id}>
                <b className="gold">{i.cantidad}×</b> {i.productoNombre}
                {i.opcionesTexto && <span className="muted"> · {i.opcionesTexto}</span>}
                {i.notas && <div className="muted" style={{ fontSize: 12.5, fontStyle: 'italic' }}>“{i.notas}”</div>}
              </li>
            ))}
          </ul>
          {p.observaciones && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Obs.: {p.observaciones}</div>}
          <div className="qr-actions">
            <button className="btn btn-gold" disabled={procesando === p.id} onClick={() => resolver(p.id, true)}>
              {procesando === p.id ? <span className="spinner" /> : <Check size={19} />} Confirmar y enviar
            </button>
            <button className="btn btn-danger" disabled={procesando === p.id} onClick={() => resolver(p.id, false)} aria-label="Rechazar">
              <X size={19} />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
