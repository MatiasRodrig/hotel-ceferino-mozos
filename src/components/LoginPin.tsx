import { useState } from 'react';
import { Delete } from 'lucide-react';
import { api, vibrar, type Usuario } from '../api';

const LARGO_PIN = 4;

export function LoginPin({ onLogin }: { onLogin: (u: Usuario) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [cargando, setCargando] = useState(false);

  const enviar = async (valor: string) => {
    setCargando(true);
    try {
      const u = await api.loginPin(valor);
      vibrar(20);
      onLogin(u);
    } catch (e) {
      setError((e as Error).message);
      setShake(true);
      vibrar([60, 40, 60]);
      setTimeout(() => { setShake(false); setPin(''); }, 420);
    } finally {
      setCargando(false);
    }
  };

  const tecla = (d: string) => {
    if (cargando || pin.length >= LARGO_PIN) return;
    vibrar(8);
    setError('');
    const nuevo = pin + d;
    setPin(nuevo);
    if (nuevo.length === LARGO_PIN) enviar(nuevo);
  };

  const borrar = () => { vibrar(8); setPin(p => p.slice(0, -1)); setError(''); };

  return (
    <div className="login">
      <img src="/logo.png" alt="Hotel Ceferino" />
      <h1>Hotel Ceferino</h1>
      <div className="sub">Salón · Mozos</div>

      <div className={`pin-dots${shake ? ' shake' : ''}`} aria-label={`${pin.length} de ${LARGO_PIN} dígitos`}>
        {Array.from({ length: LARGO_PIN }).map((_, i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="pin-error">{cargando ? <span className="muted">Verificando…</span> : error}</div>

      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} className="key" onClick={() => tecla(d)}>{d}</button>
        ))}
        <span />
        <button className="key" onClick={() => tecla('0')}>0</button>
        <button className="key ghost" onClick={borrar} aria-label="Borrar"><Delete size={26} /></button>
      </div>
      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>Ingresá tu PIN personal de 4 dígitos</p>
    </div>
  );
}
