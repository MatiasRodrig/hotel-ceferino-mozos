import { useMemo, useState } from 'react';
import { Search, X, Plus, Minus, SlidersHorizontal, MapPin, ChevronDown, PackageOpen, RotateCcw, UserCheck } from 'lucide-react';
import { vibrar, type Categoria, type Mesa, type Producto, type OpcionConsumoInterno } from '../api';
import type { ItemCarrito } from '../carrito';

interface Props {
  mesa: Mesa | null;
  categorias: Categoria[];
  productos: Producto[];
  items: ItemCarrito[];
  opcionesConsumoInterno: OpcionConsumoInterno[];
  esConsumoInterno: boolean;
  opcionConsumoInternoId: number | null;
  onToggleConsumoInterno: (val: boolean) => void;
  onSelectOpcionConsumoInterno: (id: number | null) => void;
  onAbrirMesas: () => void;
  onAgregar: (p: Producto) => void;     // abre opciones si corresponde
  onCantidad: (key: string, delta: number) => void;
  onEliminar: (key: string) => void;
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Categorías principales base solicitadas:
// Entradas, Platos Principales, Postres, Bebidas
const CATEGORIAS_PRINCIPALES_BASE = ['Entradas', 'Platos Principales', 'Postres', 'Bebidas'] as const;

export function clasificarProducto(p: Producto): { principal: string; sub: string } {
  const catNom = (p.categoriaNombre || '').trim();
  const nomNorm = normalizar(catNom);

  let principal = 'Otros';

  if (nomNorm.includes('entrada') || nomNorm.includes('minuta')) {
    principal = 'Entradas';
  } else if (nomNorm.includes('plato') || nomNorm.includes('principal')) {
    principal = 'Platos Principales';
  } else if (nomNorm.includes('postre')) {
    principal = 'Postres';
  } else if (nomNorm.includes('bebida') || nomNorm.includes('vino') || nomNorm.includes('cerveza') || nomNorm.includes('cafe')) {
    principal = 'Bebidas';
  } else if (catNom) {
    principal = catNom;
  }

  // Subcategoría: si ya viene definida en la base de datos se respeta
  let sub = p.subcategoria?.trim() || '';

  if (!sub) {
    const pNom = normalizar(p.nombre);
    if (principal === 'Bebidas') {
      if (pNom.includes('coca') || pNom.includes('sprite') || pNom.includes('gaseosa')) sub = 'Gaseosas';
      else if (pNom.includes('agua')) sub = 'Aguas';
      else if (pNom.includes('jugo')) sub = 'Jugos';
      else if (pNom.includes('cerveza') || pNom.includes('heineken') || pNom.includes('patagonia') || pNom.includes('stella')) sub = 'Cervezas';
      else if (pNom.includes('vino') || pNom.includes('malbec') || pNom.includes('trumpeter') || pNom.includes('perro')) sub = 'Vinos';
      else if (pNom.includes('cafe') || pNom.includes('capuccino') || pNom.includes('medialuna')) sub = 'Cafetería';
      else sub = 'Otras Bebidas';
    } else if (principal === 'Platos Principales') {
      if (pNom.includes('fettuccini') || pNom.includes('ravioles') || pNom.includes('pasta')) sub = 'Pastas';
      else if (pNom.includes('pacu') || pNom.includes('pescado')) sub = 'Pescados';
      else if (pNom.includes('hamburguesa')) sub = 'Minutas';
      else if (pNom.includes('ensalada')) sub = 'Ensaladas';
      else if (pNom.includes('menu ejecutivo')) sub = 'Menú Ejecutivo';
      else if (pNom.includes('milanesa') || pNom.includes('bife') || pNom.includes('lomo') || pNom.includes('costeleta') || pNom.includes('carne')) sub = 'Carnes';
      else sub = 'Platos';
    } else if (principal === 'Postres') {
      if (pNom.includes('flan')) sub = 'Flanes';
      else if (pNom.includes('helado') || pNom.includes('bocha')) sub = 'Helados';
      else sub = 'Postres';
    } else if (principal === 'Entradas') {
      if (pNom.includes('empanada')) sub = 'Empanadas';
      else sub = 'Entradas';
    } else {
      sub = 'General';
    }
  }

  return { principal, sub };
}

export function NuevaComanda({
  mesa,
  categorias,
  productos,
  items,
  opcionesConsumoInterno,
  esConsumoInterno,
  opcionConsumoInternoId,
  onToggleConsumoInterno,
  onSelectOpcionConsumoInterno,
  onAbrirMesas,
  onAgregar,
  onCantidad,
  onEliminar
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [catPrincipalActiva, setCatPrincipalActiva] = useState<string | null>(null);
  const [subcatActiva, setSubcatActiva] = useState<string | null>(null);

  // Clasificación de todos los productos
  const productosClasificados = useMemo(() => {
    return productos.map(p => {
      const { principal, sub } = clasificarProducto(p);
      return { producto: p, principal, sub };
    });
  }, [productos]);

  // Lista ordenada de Categorías Principales con conteo de carrito
  const categoriasPrincipales = useMemo(() => {
    const encontradas = new Set(productosClasificados.map(x => x.principal));
    const ordenadas: string[] = CATEGORIAS_PRINCIPALES_BASE.filter(c => encontradas.has(c));

    for (const c of encontradas) {
      if (!ordenadas.includes(c)) ordenadas.push(c);
    }

    for (const c of CATEGORIAS_PRINCIPALES_BASE) {
      if (!ordenadas.includes(c) && categorias.some(cat => normalizar(cat.nombre).includes(normalizar(c)))) {
        ordenadas.push(c);
      }
    }

    return ordenadas.map(nombre => {
      const cantCarrito = items
        .filter(i => {
          const clas = productosClasificados.find(x => x.producto.id === i.producto.id);
          return clas?.principal === nombre;
        })
        .reduce((sum, it) => sum + it.cantidad, 0);

      return { nombre, cantCarrito };
    });
  }, [productosClasificados, categorias, items]);

  // Subcategorías disponibles para la categoría principal activa
  const subcategoriasDisponibles = useMemo(() => {
    if (!catPrincipalActiva) return [];
    const deEstaCat = productosClasificados.filter(x => x.principal === catPrincipalActiva);
    const subMap = new Map<string, number>();

    for (const item of deEstaCat) {
      if (!subMap.has(item.sub)) subMap.set(item.sub, 0);
    }

    for (const it of items) {
      const clas = deEstaCat.find(x => x.producto.id === it.producto.id);
      if (clas) {
        subMap.set(clas.sub, (subMap.get(clas.sub) || 0) + it.cantidad);
      }
    }

    const ordenPref: Record<string, string[]> = {
      'Bebidas': ['Gaseosas', 'Aguas', 'Jugos', 'Cervezas', 'Vinos', 'Cafetería'],
      'Platos Principales': ['Carnes', 'Pastas', 'Pescados', 'Minutas', 'Ensaladas', 'Menú Ejecutivo'],
      'Postres': ['Flanes', 'Helados'],
      'Entradas': ['Empanadas', 'Minutas', 'Entradas']
    };

    const lista = [...subMap.keys()];
    const pref = ordenPref[catPrincipalActiva] || [];

    lista.sort((a, b) => {
      const idxA = pref.indexOf(a);
      const idxB = pref.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return lista.map(nombre => ({
      nombre,
      cantCarrito: subMap.get(nombre) || 0
    }));
  }, [catPrincipalActiva, productosClasificados, items]);

  // Total de unidades en carrito para el chip "Todo"
  const totalEnCarritoGlobal = useMemo(() => {
    return items.reduce((sum, i) => sum + i.cantidad, 0);
  }, [items]);

  // Filtrado de productos por Categoría Principal, Subcategoría y Búsqueda
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return productosClasificados.filter(x => {
      if (catPrincipalActiva !== null && x.principal !== catPrincipalActiva) return false;
      if (subcatActiva !== null && x.sub !== subcatActiva) return false;
      if (!q) return true;
      return (
        normalizar(x.producto.nombre).includes(q) ||
        normalizar(x.producto.codigo).includes(q) ||
        normalizar(x.sub).includes(q) ||
        normalizar(x.principal).includes(q) ||
        (x.producto.descripcion && normalizar(x.producto.descripcion).includes(q))
      );
    });
  }, [productosClasificados, busqueda, catPrincipalActiva, subcatActiva]);

  // Agrupado en secciones
  const secciones = useMemo(() => {
    if (catPrincipalActiva !== null) {
      // Categoría principal seleccionada: agrupar por subcategoría
      const porSub = new Map<string, Producto[]>();
      for (const item of filtrados) {
        if (!porSub.has(item.sub)) porSub.set(item.sub, []);
        porSub.get(item.sub)!.push(item.producto);
      }
      return [...porSub.entries()].map(([sub, prods]) => ({
        key: sub,
        grupoPrincipal: catPrincipalActiva,
        titulo: sub,
        mostrarGrupoHeader: false,
        prods
      }));
    }

    // Modo "Todo": Agrupar por Categoría Principal -> Subcategoría
    const grupos = new Map<string, Map<string, Producto[]>>();
    for (const item of filtrados) {
      if (!grupos.has(item.principal)) grupos.set(item.principal, new Map());
      const subMap = grupos.get(item.principal)!;
      if (!subMap.has(item.sub)) subMap.set(item.sub, []);
      subMap.get(item.sub)!.push(item.producto);
    }

    const resultado: {
      key: string;
      grupoPrincipal: string;
      titulo: string;
      mostrarGrupoHeader: boolean;
      prods: Producto[];
    }[] = [];

    const catsOrden = [...grupos.keys()].sort((a, b) => {
      const idxA = CATEGORIAS_PRINCIPALES_BASE.indexOf(a as any);
      const idxB = CATEGORIAS_PRINCIPALES_BASE.indexOf(b as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const cat of catsOrden) {
      const subMap = grupos.get(cat)!;
      let primerSub = true;
      for (const [sub, prods] of subMap.entries()) {
        resultado.push({
          key: `${cat}-${sub}`,
          grupoPrincipal: cat,
          titulo: sub,
          mostrarGrupoHeader: primerSub,
          prods
        });
        primerSub = false;
      }
    }

    return resultado;
  }, [filtrados, catPrincipalActiva]);

  const seleccionarCatPrincipal = (cat: string | null) => {
    vibrar(6);
    setCatPrincipalActiva(cat);
    setSubcatActiva(null);
  };

  const seleccionarSubcat = (sub: string | null) => {
    vibrar(6);
    setSubcatActiva(sub);
  };

  const limpiarFiltros = () => {
    vibrar(6);
    setBusqueda('');
    setCatPrincipalActiva(null);
    setSubcatActiva(null);
  };

  return (
    <>
      <button className={`mesa-card${mesa ? '' : ' empty'}`} onClick={onAbrirMesas}>
        <span className="ico"><MapPin size={22} /></span>
        <span className="grow">
          <span className="lbl" style={{ display: 'block' }}>{mesa ? (mesa.tipo.toLowerCase().startsWith('hab') ? 'Habitación' : 'Mesa') : 'Paso 1'}</span>
          <span className="val" style={{ display: 'block' }}>{mesa ? mesa.codigo : 'Elegí mesa o habitación'}</span>
        </span>
        <ChevronDown size={22} color="var(--gold)" />
      </button>

      {/* Selector de Consumo Interno (Dueños) */}
      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 12,
          background: esConsumoInterno ? 'rgba(202, 163, 92, 0.14)' : 'var(--surface-1)',
          border: esConsumoInterno ? '1px solid var(--gold)' : '1px solid var(--border)',
          transition: 'all 0.2s ease'
        }}
      >
        <div
          onClick={() => { vibrar(8); onToggleConsumoInterno(!esConsumoInterno); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={esConsumoInterno}
            onChange={e => onToggleConsumoInterno(e.target.checked)}
            onClick={e => e.stopPropagation()}
            style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
          />
          <UserCheck size={18} color={esConsumoInterno ? 'var(--gold-light)' : 'var(--muted)'} />
          <div className="grow">
            <div style={{ fontSize: 13.5, fontWeight: 700, color: esConsumoInterno ? 'var(--gold-light)' : '#fff' }}>
              Consumo interno (Dueños)
            </div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              {esConsumoInterno
                ? (opcionesConsumoInterno.find(o => o.id === opcionConsumoInternoId)?.nombre || 'Seleccioná a qué dueño corresponde')
                : 'Marcar para registrar consumo de alguno de los dueños'}
            </div>
          </div>
        </div>

        {esConsumoInterno && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {opcionesConsumoInterno.length === 0 ? (
              <span className="muted" style={{ fontSize: 12 }}>No hay opciones configuradas por Administración.</span>
            ) : (
              opcionesConsumoInterno.map(op => {
                const sel = opcionConsumoInternoId === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => { vibrar(8); onSelectOpcionConsumoInterno(op.id); }}
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
              })
            )}
          </div>
        )}
      </div>

      <div className="catalog-head" style={{ marginTop: 12 }}>
        <div className="search">
          <Search size={18} />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Buscar por plato, bebida, subcategoría…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="icon-btn clear" onClick={() => setBusqueda('')} aria-label="Limpiar"><X size={18} /></button>
          )}
        </div>

        {/* Nivel 1: Categorías Principales */}
        <div className="chips">
          <button
            className={`chip${catPrincipalActiva === null ? ' active' : ''}`}
            onClick={() => seleccionarCatPrincipal(null)}
          >
            Todo
            {totalEnCarritoGlobal > 0 && <span className="chip-badge">{totalEnCarritoGlobal}</span>}
          </button>
          {categoriasPrincipales.map(c => (
            <button
              key={c.nombre}
              className={`chip${catPrincipalActiva === c.nombre ? ' active' : ''}`}
              onClick={() => seleccionarCatPrincipal(c.nombre)}
            >
              {c.nombre}
              {c.cantCarrito > 0 && <span className="chip-badge">{c.cantCarrito}</span>}
            </button>
          ))}
        </div>

        {/* Nivel 2: Subcategorías (visible cuando se selecciona una Categoría Principal) */}
        {catPrincipalActiva !== null && subcategoriasDisponibles.length > 0 && (
          <div className="subchips-wrap">
            <div className="subchips">
              <button
                className={`subchip${subcatActiva === null ? ' active' : ''}`}
                onClick={() => seleccionarSubcat(null)}
              >
                Todas
              </button>
              {subcategoriasDisponibles.map(sub => (
                <button
                  key={sub.nombre}
                  className={`subchip${subcatActiva === sub.nombre ? ' active' : ''}`}
                  onClick={() => seleccionarSubcat(sub.nombre)}
                >
                  {sub.nombre}
                  {sub.cantCarrito > 0 && <span className="subchip-badge">{sub.cantCarrito}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {secciones.length === 0 && (
        <div className="empty-state">
          <PackageOpen size={40} />
          <p>
            {busqueda
              ? `No hay productos que coincidan con “${busqueda}”.`
              : 'No hay productos en esta selección.'}
          </p>
          {(busqueda || catPrincipalActiva !== null || subcatActiva !== null) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={limpiarFiltros}
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={14} /> Ver todo el catálogo
            </button>
          )}
        </div>
      )}

      {secciones.map(sec => {
        return (
          <section key={sec.key}>
            {sec.mostrarGrupoHeader && (
              <div className="section-group-title">
                {sec.grupoPrincipal}
              </div>
            )}
            <div className="section-title">{sec.titulo}</div>
            {sec.prods.map(p => {
              const lineas = items.filter(i => i.producto.id === p.id);
              const total = lineas.reduce((a, i) => a + i.cantidad, 0);
              const conOpciones = (p.gruposOpcion?.length ?? 0) > 0;
              const base = lineas.find(i => !i.notas && i.opcionIds.length === 0);
              const agotado = p.controlaStock && p.stockActual <= 0;
              const bajo = p.controlaStock && !agotado && p.stockActual <= p.stockMinimo;
              const topeStock = p.controlaStock && total >= p.stockActual;
              const subNombre = clasificarProducto(p).sub;

              return (
                <div key={p.id} className={`prod${total > 0 ? ' in-cart' : ''}${agotado ? ' agotado' : ''}`}>
                  <div className="prod-main" onClick={() => !agotado && !topeStock && onAgregar(p)}>
                    <div className="prod-name">{p.nombre}</div>
                    {p.descripcion && <div className="prod-desc">{p.descripcion}</div>}
                    <div className="prod-meta">
                      <span className="price">${p.precio.toLocaleString('es-AR')}</span>
                      {subNombre && <span className="tag">{subNombre}</span>}
                      {conOpciones && <span className="tag gold">Con opciones</span>}
                      {agotado && <span className="tag bad">Agotado</span>}
                      {bajo && <span className="tag warn">Quedan {p.stockActual}</span>}
                    </div>
                  </div>

                  {conOpciones || (total > 0 && !base) ? (
                    <button className="add-btn outline" disabled={agotado || topeStock} onClick={() => onAgregar(p)} aria-label={`Agregar ${p.nombre}`}>
                      {conOpciones ? <SlidersHorizontal size={19} /> : <Plus size={22} />}
                      {total > 0 && <span className="count">{total}</span>}
                    </button>
                  ) : base ? (
                    <div className="stepper">
                      <button
                        onClick={() => { vibrar(8); base.cantidad === 1 ? onEliminar(base.key) : onCantidad(base.key, -1); }}
                        aria-label="Restar"
                      ><Minus size={18} /></button>
                      <span>{total}</span>
                      <button onClick={() => { vibrar(8); onCantidad(base.key, 1); }} disabled={topeStock} aria-label="Sumar"><Plus size={18} /></button>
                    </div>
                  ) : (
                    <button className="add-btn" disabled={agotado} onClick={() => onAgregar(p)} aria-label={`Agregar ${p.nombre}`}>
                      <Plus size={24} strokeWidth={2.6} />
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
