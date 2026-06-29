import { useState, useEffect } from 'react';
import { tableService, categoryService, productService, inventoryService, recipeService } from '../services/api';
import Layout from '../components/Layout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
function descargarPDF(path) {
  const token = localStorage.getItem('trynova_token');
  window.open(`${API_BASE}${path}?token=${token}`, '_blank');
}

export default function Administracion() {

  const [tab, setTab] = useState('mesas');

  const [mesas, setMesas]         = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos]     = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [exito, setExito]       = useState('');

  // Mesas
  const [nombreMesa, setNombreMesa]       = useState('');
  const [capacidadMesa, setCapacidadMesa] = useState(4);
  const [guardandoMesa, setGuardandoMesa] = useState(false);

  // Categorías
  const [nombreCategoria, setNombreCategoria]       = useState('');
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  // Producto (creación)
  const [nombreProducto, setNombreProducto]           = useState('');
  const [descripcionProducto, setDescripcionProducto] = useState('');
  const [precioProducto, setPrecioProducto]           = useState('');
  const [categoriaProducto, setCategoriaProducto]     = useState('');
  const [tieneIVA, setTieneIVA]                       = useState(true);
  const [guardandoProducto, setGuardandoProducto]     = useState(false);

  // Producto (edición)
  const [productoEditando, setProductoEditando] = useState(null);
  const [editNombre, setEditNombre]             = useState('');
  const [editDescripcion, setEditDescripcion]   = useState('');
  const [editPrecio, setEditPrecio]             = useState('');
  const [editCategoria, setEditCategoria]       = useState('');
  const [editTieneIVA, setEditTieneIVA]         = useState(true);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Insumo
  const [nombreInsumo, setNombreInsumo]           = useState('');
  const [unidadInsumo, setUnidadInsumo]           = useState('');
  const [stockInsumo, setStockInsumo]             = useState('');
  const [stockMinimoInsumo, setStockMinimoInsumo] = useState('');
  const [costoInsumo, setCostoInsumo]             = useState('');
  const [guardandoInsumo, setGuardandoInsumo]     = useState(false);

  // Producto directo
  const [nombreDirecto, setNombreDirecto]                   = useState('');
  const [codigoBarrasDirecto, setCodigoBarrasDirecto]       = useState('');
  const [precioDirecto, setPrecioDirecto]                   = useState('');
  const [stockDirecto, setStockDirecto]                     = useState('');
  const [stockMinimoDirecto, setStockMinimoDirecto]         = useState('');
  const [categoriaDirecto, setCategoriaDirecto]             = useState('');
  const [guardandoDirecto, setGuardandoDirecto]             = useState(false);

  // Receta
  const [productoReceta, setProductoReceta]           = useState('');
  const [insumoReceta, setInsumoReceta]               = useState('');
  const [cantidadReceta, setCantidadReceta]           = useState('');
  const [guardandoReceta, setGuardandoReceta]         = useState(false);
  const [recetaSeleccionada, setRecetaSeleccionada]   = useState(null);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    try {
      setCargando(true);
      const [mesasResp, categoriasResp, productosResp, insumosResp] = await Promise.all([
        tableService.listar(),
        categoryService.listar(),
        productService.listar(false),
        inventoryService.listar(),
      ]);
      setMesas(mesasResp.mesas);
      setCategorias(categoriasResp.categorias);
      setProductos(productosResp.productos);
      setInsumos(insumosResp.insumos);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la información');
    } finally {
      setCargando(false);
    }
  }

  function mostrarExito(mensaje) {
    setExito(mensaje);
    setTimeout(() => setExito(''), 2500);
  }

  async function handleCrearMesa(e) {
    e.preventDefault();
    try {
      setGuardandoMesa(true);
      setError('');
      await tableService.crear({ nombre: nombreMesa, capacidad: Number(capacidadMesa) });
      setNombreMesa('');
      setCapacidadMesa(4);
      await cargarTodo();
      mostrarExito('Mesa creada');
    } catch (err) {
      setError(err.message || 'No se pudo crear la mesa');
    } finally {
      setGuardandoMesa(false);
    }
  }

  async function handleCrearCategoria(e) {
    e.preventDefault();
    try {
      setGuardandoCategoria(true);
      setError('');
      await categoryService.crear({ nombre: nombreCategoria, orden: categorias.length + 1 });
      setNombreCategoria('');
      await cargarTodo();
      mostrarExito('Categoría creada');
    } catch (err) {
      setError(err.message || 'No se pudo crear la categoría');
    } finally {
      setGuardandoCategoria(false);
    }
  }

  async function handleCrearProducto(e) {
    e.preventDefault();
    try {
      setGuardandoProducto(true);
      setError('');
      await productService.crear({
        nombre:      nombreProducto,
        descripcion: descripcionProducto || null,
        precio:      Number(precioProducto),
        category_id: categoriaProducto || null,
        tiene_iva:   tieneIVA,
      });
      setNombreProducto('');
      setDescripcionProducto('');
      setPrecioProducto('');
      setCategoriaProducto('');
      setTieneIVA(true);
      await cargarTodo();
      mostrarExito('Producto creado');
    } catch (err) {
      setError(err.message || 'No se pudo crear el producto');
    } finally {
      setGuardandoProducto(false);
    }
  }

  function abrirEdicion(producto) {
    setProductoEditando(producto);
    setEditNombre(producto.nombre);
    setEditDescripcion(producto.descripcion || '');
    setEditPrecio(producto.precio);
    setEditCategoria(producto.category_id || '');
    setEditTieneIVA(producto.tiene_iva !== false);
  }

  function cerrarEdicion() { setProductoEditando(null); }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    try {
      setGuardandoEdicion(true);
      setError('');
      await productService.actualizar(productoEditando.id, {
        nombre:      editNombre,
        descripcion: editDescripcion || null,
        precio:      Number(editPrecio),
        category_id: editCategoria || null,
        tiene_iva:   editTieneIVA,
      });
      setProductoEditando(null);
      await cargarTodo();
      mostrarExito('Producto actualizado');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el producto');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function handleToggleActivo(producto) {
    try {
      setError('');
      await productService.actualizar(producto.id, { activo: !producto.activo });
      await cargarTodo();
      mostrarExito(producto.activo ? 'Producto desactivado' : 'Producto activado');
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado del producto');
    }
  }

  async function handleCrearInsumo(e) {
    e.preventDefault();
    try {
      setGuardandoInsumo(true);
      setError('');
      await inventoryService.crear({
        nombre:         nombreInsumo,
        unidad:         unidadInsumo,
        stock:          Number(stockInsumo) || 0,
        stock_minimo:   Number(stockMinimoInsumo) || 0,
        costo_unitario: costoInsumo ? Number(costoInsumo) : null,
      });
      setNombreInsumo('');
      setUnidadInsumo('');
      setStockInsumo('');
      setStockMinimoInsumo('');
      setCostoInsumo('');
      await cargarTodo();
      mostrarExito('Insumo creado');
    } catch (err) {
      setError(err.message || 'No se pudo crear el insumo');
    } finally {
      setGuardandoInsumo(false);
    }
  }

  async function handleAgregarIngrediente(e) {
    e.preventDefault();
    try {
      setGuardandoReceta(true);
      setError('');
      await recipeService.agregarIngrediente(productoReceta, insumoReceta, Number(cantidadReceta));
      setInsumoReceta('');
      setCantidadReceta('');
      await cargarRecetaDe(productoReceta);
      mostrarExito('Ingrediente agregado a la receta');
    } catch (err) {
      setError(err.message || 'No se pudo agregar el ingrediente');
    } finally {
      setGuardandoReceta(false);
    }
  }

  async function handleCrearProductoDirecto(e) {
    e.preventDefault();
    try {
      setGuardandoDirecto(true);
      setError('');
      await productService.crear({
        nombre:               nombreDirecto,
        precio:               Number(precioDirecto),
        codigo_barras:        codigoBarrasDirecto || null,
        es_directo:           true,
        stock_directo:        Number(stockDirecto) || 0,
        stock_minimo_directo: Number(stockMinimoDirecto) || 0,
        category_id:          categoriaDirecto || null,
      });
      setNombreDirecto('');
      setCodigoBarrasDirecto('');
      setPrecioDirecto('');
      setStockDirecto('');
      setStockMinimoDirecto('');
      setCategoriaDirecto('');
      await cargarTodo();
      mostrarExito('Producto directo creado');
    } catch (err) {
      setError(err.message || 'No se pudo crear el producto directo');
    } finally {
      setGuardandoDirecto(false);
    }
  }

  async function cargarRecetaDe(productId) {
    if (!productId) { setRecetaSeleccionada(null); return; }
    try {
      const detalle = await recipeService.ver(productId);
      setRecetaSeleccionada(detalle.receta);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la receta');
    }
  }

  // ── Estilos de input reutilizables ────────────────────────────────────────────

  const inputCls = `border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-white`;
  const btnPrimary = 'text-white text-sm font-medium rounded-lg px-5 py-2 transition disabled:opacity-50';
  const btnSecondary = 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg px-5 py-2 transition disabled:opacity-50';

  return (
    <Layout titulo="Administración">
      {cargando ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Cargando...
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-5">

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          {exito && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              {exito}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {['mesas', 'menu', 'inventario'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 capitalize transition ${
                  tab === t
                    ? 'border-[#4f9cf9] text-[#4f9cf9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'menu' ? 'Menú' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Tab Mesas ── */}
          {tab === 'mesas' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCrearMesa}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex gap-3 items-end"
              >
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
                    Nombre de la mesa
                  </label>
                  <input
                    type="text"
                    value={nombreMesa}
                    onChange={e => setNombreMesa(e.target.value)}
                    required
                    placeholder="Ej: Mesa 5"
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
                    Capacidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={capacidadMesa}
                    onChange={e => setCapacidadMesa(e.target.value)}
                    required
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoMesa}
                  className={btnPrimary}
                  style={{ background: '#4f9cf9' }}
                >
                  {guardandoMesa ? 'Creando...' : 'Crear mesa'}
                </button>
              </form>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                  Mesas existentes ({mesas.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mesas.map(mesa => (
                    <div key={mesa.id} className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                      <p className="font-medium text-gray-900">{mesa.nombre}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{mesa.capacidad} personas · {mesa.estado}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Menú ── */}
          {tab === 'menu' && (
            <div className="space-y-5">

              {/* Nueva categoría */}
              <form
                onSubmit={handleCrearCategoria}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex gap-3 items-end"
              >
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
                    Nueva categoría
                  </label>
                  <input
                    type="text"
                    value={nombreCategoria}
                    onChange={e => setNombreCategoria(e.target.value)}
                    required
                    placeholder="Ej: Postres"
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoCategoria}
                  className={btnSecondary}
                >
                  {guardandoCategoria ? 'Creando...' : 'Crear categoría'}
                </button>
              </form>

              {/* Nuevo producto */}
              {!productoEditando && (
                <form
                  onSubmit={handleCrearProducto}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3"
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
                    Nuevo producto
                  </p>
                  <input
                    type="text"
                    value={nombreProducto}
                    onChange={e => setNombreProducto(e.target.value)}
                    required
                    placeholder="Nombre del producto"
                    className={`w-full ${inputCls}`}
                  />
                  <input
                    type="text"
                    value={descripcionProducto}
                    onChange={e => setDescripcionProducto(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className={`w-full ${inputCls}`}
                  />
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioProducto}
                      onChange={e => setPrecioProducto(e.target.value)}
                      required
                      placeholder="Precio (IVA incluido si aplica)"
                      className={`flex-1 ${inputCls}`}
                    />
                    <select
                      value={categoriaProducto}
                      onChange={e => setCategoriaProducto(e.target.value)}
                      className={`flex-1 ${inputCls}`}
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tieneIVA}
                      onChange={e => setTieneIVA(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    Precio incluye IVA 15%
                  </label>
                  <button
                    type="submit"
                    disabled={guardandoProducto}
                    className={`w-full ${btnPrimary}`}
                    style={{ background: '#4f9cf9' }}
                  >
                    {guardandoProducto ? 'Creando...' : 'Crear producto'}
                  </button>
                </form>
              )}

              {/* Editar producto */}
              {productoEditando && (
                <form
                  onSubmit={handleGuardarEdicion}
                  className="bg-blue-50 rounded-xl border border-[#4f9cf9]/30 p-6 space-y-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4f9cf9' }}>
                      Editando: {productoEditando.nombre}
                    </p>
                    <button
                      type="button"
                      onClick={cerrarEdicion}
                      className="text-xs text-gray-400 hover:text-gray-600 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    required
                    placeholder="Nombre del producto"
                    className={`w-full ${inputCls}`}
                  />
                  <input
                    type="text"
                    value={editDescripcion}
                    onChange={e => setEditDescripcion(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className={`w-full ${inputCls}`}
                  />
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPrecio}
                      onChange={e => setEditPrecio(e.target.value)}
                      required
                      placeholder="Precio (IVA incluido si aplica)"
                      className={`flex-1 ${inputCls}`}
                    />
                    <select
                      value={editCategoria}
                      onChange={e => setEditCategoria(e.target.value)}
                      className={`flex-1 ${inputCls}`}
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editTieneIVA}
                      onChange={e => setEditTieneIVA(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    Precio incluye IVA 15%
                  </label>
                  <button
                    type="submit"
                    disabled={guardandoEdicion}
                    className={`w-full ${btnPrimary}`}
                    style={{ background: '#4f9cf9' }}
                  >
                    {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </form>
              )}

              {/* Lista de productos */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                  Productos existentes ({productos.length})
                </p>
                <div className="space-y-2">
                  {productos.map(producto => (
                    <div
                      key={producto.id}
                      className={`flex justify-between items-center rounded-lg px-4 py-2.5 text-sm ${
                        producto.activo ? 'bg-gray-50' : 'bg-gray-50 opacity-50'
                      }`}
                    >
                      <button
                        onClick={() => abrirEdicion(producto)}
                        className="flex-1 text-left hover:opacity-80 transition"
                      >
                        <p className="text-gray-900">
                          {producto.nombre}
                          {!producto.activo && (
                            <span className="text-gray-400 text-xs ml-2">(desactivado)</span>
                          )}
                        </p>
                        <p className="text-gray-400 text-xs">{producto.categoria_nombre || 'Sin categoría'}</p>
                      </button>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm">${parseFloat(producto.precio).toFixed(2)}</span>
                        <button
                          onClick={() => handleToggleActivo(producto)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition border ${
                            producto.activo
                              ? 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600'
                              : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {producto.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Inventario ── */}
          {tab === 'inventario' && (
            <div className="space-y-5">

              {/* Botón reporte */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => descargarPDF('/inventory/reporte')}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Descargar reporte PDF
                </button>
              </div>

              {/* Nuevo insumo */}
              <form
                onSubmit={handleCrearInsumo}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
                  Nuevo insumo
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={nombreInsumo}
                    onChange={e => setNombreInsumo(e.target.value)}
                    required
                    placeholder="Ej: Ron"
                    className={`flex-1 ${inputCls}`}
                  />
                  <input
                    type="text"
                    value={unidadInsumo}
                    onChange={e => setUnidadInsumo(e.target.value)}
                    required
                    placeholder="Unidad (oz, kg, lt...)"
                    className={`w-40 ${inputCls}`}
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={stockInsumo}
                    onChange={e => setStockInsumo(e.target.value)}
                    placeholder="Stock inicial"
                    className={`flex-1 ${inputCls}`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={stockMinimoInsumo}
                    onChange={e => setStockMinimoInsumo(e.target.value)}
                    placeholder="Stock mínimo"
                    className={`flex-1 ${inputCls}`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoInsumo}
                    onChange={e => setCostoInsumo(e.target.value)}
                    placeholder="Costo unitario"
                    className={`flex-1 ${inputCls}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoInsumo}
                  className={`w-full ${btnPrimary}`}
                  style={{ background: '#4f9cf9' }}
                >
                  {guardandoInsumo ? 'Creando...' : 'Crear insumo'}
                </button>
              </form>

              {/* Lista de insumos */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                  Insumos existentes ({insumos.length})
                </p>
                <div className="space-y-2">
                  {insumos.map(insumo => {
                    const stockBajo = parseFloat(insumo.stock) <= parseFloat(insumo.stock_minimo);
                    return (
                      <div
                        key={insumo.id}
                        className={`flex justify-between items-center rounded-lg px-4 py-2.5 text-sm ${
                          stockBajo
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div>
                          <p className="text-gray-900">{insumo.nombre}</p>
                          <p className="text-gray-400 text-xs mt-0.5">
                            Mínimo: {insumo.stock_minimo} {insumo.unidad}
                          </p>
                        </div>
                        <span className={`font-medium text-sm ${stockBajo ? 'text-amber-600' : 'text-gray-500'}`}>
                          {parseFloat(insumo.stock).toFixed(2)} {insumo.unidad}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Productos directos */}
              <form
                onSubmit={handleCrearProductoDirecto}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
                  Nuevo producto directo
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={nombreDirecto}
                    onChange={e => setNombreDirecto(e.target.value)}
                    required
                    placeholder="Nombre (ej: Cerveza Club)"
                    className={`flex-1 ${inputCls}`}
                  />
                  <input
                    type="text"
                    value={codigoBarrasDirecto}
                    onChange={e => setCodigoBarrasDirecto(e.target.value)}
                    placeholder="Código de barras"
                    className={`w-44 ${inputCls}`}
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioDirecto}
                    onChange={e => setPrecioDirecto(e.target.value)}
                    required
                    placeholder="Precio de venta"
                    className={`flex-1 ${inputCls}`}
                  />
                  <select
                    value={categoriaDirecto}
                    onChange={e => setCategoriaDirecto(e.target.value)}
                    className={`flex-1 ${inputCls}`}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={stockDirecto}
                    onChange={e => setStockDirecto(e.target.value)}
                    placeholder="Stock inicial"
                    className={`flex-1 ${inputCls}`}
                  />
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={stockMinimoDirecto}
                    onChange={e => setStockMinimoDirecto(e.target.value)}
                    placeholder="Stock mínimo"
                    className={`flex-1 ${inputCls}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoDirecto}
                  className={`w-full ${btnPrimary}`}
                  style={{ background: '#4f9cf9' }}
                >
                  {guardandoDirecto ? 'Creando...' : 'Crear producto directo'}
                </button>
              </form>

              {/* Lista de productos directos */}
              {(() => {
                const productosDirectos = productos.filter(p => p.es_directo);
                if (productosDirectos.length === 0) return null;
                return (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                      Productos directos ({productosDirectos.length})
                    </p>
                    <div className="space-y-2">
                      {productosDirectos.map(p => {
                        const stockBajo = parseFloat(p.stock_directo) <= parseFloat(p.stock_minimo_directo);
                        return (
                          <div
                            key={p.id}
                            className={`flex justify-between items-center rounded-lg px-4 py-2.5 text-sm ${
                              stockBajo ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                            }`}
                          >
                            <div>
                              <p className="text-gray-900">{p.nombre}</p>
                              <p className="text-gray-400 text-xs mt-0.5">
                                {p.codigo_barras || 'Sin código'} · {p.categoria_nombre || 'Sin categoría'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-700">${parseFloat(p.precio).toFixed(2)}</p>
                              <p className={`text-xs font-medium ${stockBajo ? 'text-amber-600' : 'text-gray-400'}`}>
                                Stock: {parseFloat(p.stock_directo).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Asignar receta */}
              <form
                onSubmit={handleAgregarIngrediente}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
                  Asignar receta a un producto
                </p>
                <select
                  value={productoReceta}
                  onChange={e => { setProductoReceta(e.target.value); cargarRecetaDe(e.target.value); }}
                  required
                  className={`w-full ${inputCls}`}
                >
                  <option value="">Selecciona un producto</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>

                {recetaSeleccionada && recetaSeleccionada.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-gray-400 mb-1">Receta actual:</p>
                    {recetaSeleccionada.map(ing => (
                      <p key={ing.id} className="text-sm text-gray-700">
                        {parseFloat(ing.cantidad)} {ing.unidad} de {ing.insumo_nombre}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <select
                    value={insumoReceta}
                    onChange={e => setInsumoReceta(e.target.value)}
                    required
                    className={`flex-1 ${inputCls}`}
                  >
                    <option value="">Selecciona un insumo</option>
                    {insumos.map(i => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cantidadReceta}
                    onChange={e => setCantidadReceta(e.target.value)}
                    required
                    placeholder="Cantidad"
                    className={`w-32 ${inputCls}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoReceta || !productoReceta}
                  className={`w-full ${btnSecondary}`}
                >
                  {guardandoReceta ? 'Agregando...' : 'Agregar a la receta'}
                </button>
              </form>
            </div>
          )}

        </div>
      )}
    </Layout>
  );
}
