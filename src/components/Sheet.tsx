import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}

/**
 * Bottom sheet mobile. Bloquea el scroll de fondo y se cierra con:
 * tap en el fondo, botón X o el botón "Atrás" del celular (Android).
 */
export function Sheet({ titulo, subtitulo, onClose, children, footer, full }: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Integración con el botón Atrás: apilamos un estado y lo consumimos al cerrar.
    const montadoEn = Date.now();
    let cerradoPorAtras = false;
    window.history.pushState({ ceferinoSheet: true }, '');
    const onPop = () => {
      if (Date.now() - montadoEn < 300) return; // evita cierres por popstate de una hoja anterior
      cerradoPorAtras = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('popstate', onPop);
      if (!cerradoPorAtras && window.history.state?.ceferinoSheet) window.history.back();
    };
  }, []);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${full ? ' full' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="grow">
            <h3>{titulo}</h3>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}
