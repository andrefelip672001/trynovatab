// v2 - consulta contribuyente SRI
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderService, productService, tableService, invoiceService, clienteService } from '../services/api';
import Layout from '../components/Layout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function DetalleOrden() {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const [mesa, setMesa] = useState(null);
  const [orden, setOrden] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState('0.00');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [notasMesa, setNotasMesa] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [carrito, setCarrito] = useState({});
  const [carritoInfo, setCarritoInfo] = useState({});
  const [modalCerrar, setModalCerrar] = useState(false);
  const [identificacionComprador, setIdentificacionComprador] = useState('');
  const [emitiendoFactura, setEmitiendoFactura] = useState(false);
  const [facturaEmitida, setFacturaEmitida] = useState(null);
  const [contribuyente, setContribuyente] = useState(null);
  const [buscandoContribuyente, setBuscandoContribuyente] = useState(false);
  const [clientesEncontrados, setClientesEncontrados] = useState([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [nombreNuevoCliente, setNombreNuevoCliente] = useState('');
  const [mostrarGuardarCliente, setMostrarGuardarCliente] = useState(false);

  const debounceRef = useRef(null);
  const contribuyenteRef = useRef(null);
  const buscarClienteRef = useRef(null);
  const enviandoRef = useRef(false);

  useEffect(() => {
    cargarTodo();
  }, [tableId]);

  async function cargarTodo() {
    try {
      setCargando(true);
      setError('');
      const mesasResp = await tableService.listar();
      const mesaActual = mesasResp.mesas.find(m => m.id === tableId);
      setMesa(mesaActual);
      if (mesaActual?.estado === 'ocupada') {
        const { orden: ordenActiva } = await orderService.verPorMesa(tableId);
        const detalle = await orderService.ver(ordenActiva.id);
        setOrden(detalle.orden);
        setItems(detalle.items || []);
        setTotal(detalle.total || '0.00');
      }
    } catch (err) {
      setError(err.message || 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }

  async function handleAbrirOrden() {
    try {
      setError('');
      const resp = await orderService.abrir(tableId, notasMesa.trim() || null);
      setOrden(resp.orden);
      setItems([]);
      setTotal('0.00');
      setMesa(prev => ({ ...prev, estado: 'ocupada' }));
      setNotasMesa('');
    } catch (err) {
      setError(err.message || 'Error al abrir orden');
    }
  }

  function handleBusquedaChange(e) {
    const q = e.target.value;
    setBusqueda(q);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const resp = await productService.buscar(q.trim());
        setResultados(resp.productos || []);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 300);
  }

  async function handleEnter(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(debounceRef.current);
    if (busqueda.trim().length < 2) return;
    setBuscando(true);
    try {
      const resp = await productService.buscar(busqueda.trim());
      const lista = resp.productos || [];
      setResultados(lista);
      if (lista.length === 1) agregarAlCarrito(lista[0]);
    } catch { setResultados([]); }
    finally { setBuscando(false); }
  }

  function agregarAlCarrito(producto) {
    setCarrito(prev => ({ ...prev, [producto.id]: (prev[producto.id] || 0) + 1 }));
    setCarritoInfo(prev => ({ ...prev, [producto.id]: { nombre: producto.nombre, precio: parseFloat(producto.precio) } }));
    setBusqueda('');
    setResultados([]);
  }

  function ajustarCarrito(id, delta) {
    setCarrito(prev => {
      const nueva = (prev[id] || 0) + delta;
      if (nueva <= 0) { const { [id]: _, ...resto } = prev; return resto; }
      return { ...prev, [id]: nueva };
    });
  }

  async function handleEnviarPedido() {
    if (enviandoRef.current) return;
    const entradas = Object.entries(carrito);
    if (entradas.length === 0) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError('');
    try {
      await Promise.all(
        entradas.map(([productId, cantidad]) =>
          orderService.agregarItem(orden.id, productId, cantidad)
        )
      );
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Error al enviar pedido');
      setEnviando(false);
      enviandoRef.current = false;
    }
  }

  async function handleCerrarSinFactura() {
    try {
      setError('');
      await orderService.cerrar(orden.id);
      navigate('/mesas');
    } catch (err) {
      setError(err.message || 'Error al cerrar orden');
      setModalCerrar(false);
    }
  }

  async function handleEmitirYCerrar() {
    try {
      setEmitiendoFactura(true);
      setError('');
      const data = await invoiceService.emitirDirecta({
        order_id:                 orden.id,
        identificacion_comprador: identificacionComprador.trim(),
        razon_social:             clienteSeleccionado?.nombre || contribuyente?.razon_social || null,
      });
      setFacturaEmitida({
        numero_factura:      data.numero_factura,
        numero_autorizacion: data.numero_autorizacion,
        total:               data.total,
        invoice_id:          data.invoice_id,
      });
    } catch (err) {
      setError(err.message || 'Error al emitir factura');
      setEmitiendoFactura(false);
    }
  }

  function abrirTicket() {
    const token = localStorage.getItem('trynova_token');
    window.open(`${API_BASE}/invoices/${facturaEmitida.invoice_id}/ticket?token=${token}`, '_blank');
  }

  function handleIdentificacionChange(valor) {
    setIdentificacionComprador(valor);
    setContribuyente(null);
    setClienteSeleccionado(null);
    setClientesEncontrados([]);
    setMostrarGuardarCliente(false);
    clearTimeout(contribuyenteRef.current);
    clearTimeout(buscarClienteRef.current);

    const id = valor.trim();

    // Buscar en clientes locales (300ms, 2+ caracteres)
    if (id.length >= 2) {
      setBuscandoCliente(true);
      buscarClienteRef.current = setTimeout(async () => {
        try {
          const resp = await clienteService.buscar(id);
          setClientesEncontrados(resp.clientes || []);
        } catch { setClientesEncontrados([]); }
        finally  { setBuscandoCliente(false); }
      }, 300);
    }

    // Consultar SRI (500ms, solo 10 o 13 dígitos)
    if (id.length === 10 || id.length === 13) {
      setBuscandoContribuyente(true);
      contribuyenteRef.current = setTimeout(async () => {
        try {
          const url = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumeroruc?numeroRuc=${id}`;
          const response = await fetch(url);
          const data = await response.json();
          if (data && (data.razonSocial || data.nombreComercial)) {
            setContribuyente({
              razon_social: data.razonSocial || data.nombreComercial,
              estado:       data.estadoContribuyenteRuc || 'ACTIVO',
            });
            setMostrarGuardarCliente(false);
          } else {
            setContribuyente(false);
            setMostrarGuardarCliente(true);
          }
        } catch {
          setContribuyente(false);
        } finally {
          setBuscandoContribuyente(false);
        }
      }, 500);
    } else {
      setBuscandoContribuyente(false);
    }
  }

  function handleSeleccionarCliente(cliente) {
    setIdentificacionComprador(cliente.cedula_ruc);
    setClienteSeleccionado(cliente);
    setClientesEncontrados([]);
    setContribuyente({ razon_social: cliente.nombre, estado: null });
    setBuscandoCliente(false);
    setBuscandoContribuyente(false);
    setMostrarGuardarCliente(false);
    clearTimeout(contribuyenteRef.current);
    clearTimeout(buscarClienteRef.current);
  }

  async function handleGuardarNuevoCliente() {
    if (!nombreNuevoCliente.trim()) return;
    try {
      const resp = await clienteService.crear({
        nombre:     nombreNuevoCliente.trim(),
        cedula_ruc: identificacionComprador.trim(),
      });
      handleSeleccionarCliente(resp.cliente);
      setNombreNuevoCliente('');
    } catch { /* continuar sin guardar */ }
  }

  const totalCarrito = Object.entries(carrito).reduce(
    (sum, [id, cant]) => sum + cant * (carritoInfo[id]?.precio || 0), 0
  );
  const totalGeneral = (parseFloat(total) + totalCarrito).toFixed(2);
  const cantidadCarrito = Object.values(carrito).reduce((s, c) => s + c, 0);

  if (cargando) {
    return (
      <Layout titulo={mesa?.nombre || 'Mesa'}>
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout titulo={mesa?.nombre || 'Mesa'}>
      <div className={`max-w-2xl mx-auto space-y-5${cantidadCarrito > 0 ? ' pb-24 md:pb-0' : ''}`}>
        <button onClick={() => navigate('/mesas')} className="text-sm text-gray-400 hover:text-gray-600 transition">
          ← Volver a Mesas
        </button>

        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-gray-900">{mesa?.nombre}</h3>
          <span className="text-sm text-gray-400">{mesa?.capacidad} personas</span>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
        )}

        {!orden ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <p className="text-gray-400 mb-5 text-sm text-center">Esta mesa está libre.</p>
            <div className="max-w-sm mx-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Nombre del cliente (opcional)
                </label>
                <input
                  type="text"
                  value={notasMesa}
                  onChange={e => setNotasMesa(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAbrirOrden()}
                  placeholder="Ej: Juan y María..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAbrirOrden}
                className="w-full text-white font-medium rounded-lg py-2.5 text-sm"
                style={{ background: '#4f9cf9' }}
              >
                Abrir orden
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Cuenta actual</p>
              {orden.notas && <p className="text-sm font-medium text-gray-800 mb-3">{orden.notas}</p>}

              {items.length === 0 && cantidadCarrito === 0 ? (
                <p className="text-sm text-gray-400">Todavía no se ha pedido nada.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {items.map((item, idx) => (
                    <div key={item.id || idx} className="flex justify-between text-sm">
                      <span className="text-gray-900">{item.cantidad}× {item.nombre_producto}</span>
                      <span className="text-gray-500">${(Number(item.cantidad) * parseFloat(item.precio_unitario)).toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.entries(carrito).map(([id, cant]) => {
                    const info = carritoInfo[id] || {};
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{cant}× {info.nombre || '—'}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">pendiente</span>
                        </div>
                        <span className="text-gray-400">${(cant * (info.precio || 0)).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="font-bold text-lg" style={{ color: '#4f9cf9' }}>${totalGeneral}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">Agregar al pedido</p>
              <div className="relative">
                <input
                  type="text"
                  value={busqueda}
                  onChange={handleBusquedaChange}
                  onKeyDown={handleEnter}
                  placeholder="Buscar producto o escanear código..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none"
                  autoComplete="off"
                />
                {buscando && <span className="absolute right-3 top-3.5 text-xs text-gray-400">Buscando...</span>}
              </div>

              {resultados.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  {resultados.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregarAlCarrito(p)}
                      className="w-full flex justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm text-gray-900">{p.nombre}</p>
                        <p className="text-xs text-gray-400">{p.categoria_nombre || 'Sin categoría'}{p.codigo_barras && ` · ${p.codigo_barras}`}</p>
                      </div>
                      <span className="text-sm text-gray-500 ml-4">${parseFloat(p.precio).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}

              {busqueda.trim().length >= 2 && !buscando && resultados.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">Sin resultados para "{busqueda}"</p>
              )}

              {cantidadCarrito > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Pendiente de enviar</p>
                  {Object.entries(carrito).map(([id, cant]) => {
                    const info = carritoInfo[id] || {};
                    return (
                      <div key={id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{info.nombre || '—'}</p>
                          <p className="text-xs text-gray-400">${(info.precio || 0).toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button type="button" onClick={() => ajustarCarrito(id, -1)} className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-lg">−</button>
                          <span className="w-7 text-center text-sm font-medium">{cant}</span>
                          <button type="button" onClick={() => ajustarCarrito(id, 1)} className="w-11 h-11 flex items-center justify-center rounded-lg text-white text-lg" style={{ background: '#4f9cf9' }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="fixed bottom-0 left-0 right-0 md:static p-3 md:p-0 bg-white md:bg-transparent border-t border-gray-200 md:border-0 z-30 md:mt-2">
                    <button
                      type="button"
                      onClick={handleEnviarPedido}
                      disabled={enviando}
                      className="w-full text-white font-medium rounded-lg px-4 py-3.5 md:py-2.5 text-sm disabled:opacity-50"
                      style={{ background: '#4f9cf9' }}
                    >
                      {enviando ? 'Enviando...' : `Enviar pedido (${cantidadCarrito} ${cantidadCarrito === 1 ? 'producto' : 'productos'})`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => navigate(`/orden/${orden.id}/dividir`)} className="flex-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-3.5 md:py-2.5 text-base md:text-sm transition">
                Dividir cuenta
              </button>
              <button type="button" onClick={() => setModalCerrar(true)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg px-4 py-3.5 md:py-2.5 text-base md:text-sm transition">
                Cerrar cuenta
              </button>
            </div>

            {/* ── Modal cerrar cuenta ──────────────────────────────────── */}
            {modalCerrar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-sm mx-4">

                  {facturaEmitida ? (
                    /* ── Modal de éxito ── */
                    <>
                      <div className="flex items-center gap-3 mb-5">
                        <span className="text-2xl">✅</span>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Factura emitida exitosamente</h3>
                          <p className="text-xs text-gray-400 mt-0.5">La mesa ha sido liberada</p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Número</span>
                          <span className="font-mono font-medium text-gray-900">{facturaEmitida.numero_factura}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total</span>
                          <span className="font-semibold text-gray-900">${parseFloat(facturaEmitida.total).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-gray-500 shrink-0">Autorización</span>
                          <span className="font-mono text-xs text-gray-400 text-right break-all">{facturaEmitida.numero_autorizacion || '—'}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={abrirTicket}
                          className="w-full text-white font-medium rounded-lg py-2.5 text-sm transition"
                          style={{ background: '#4f9cf9' }}
                        >
                          🖨️ Imprimir ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/mesas')}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg py-2.5 text-sm transition"
                        >
                          Cerrar
                        </button>
                      </div>
                    </>
                  ) : (
                    /* ── Modal de cédula ── */
                    <>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">Cerrar cuenta</h3>
                      <p className="text-sm text-gray-400 mb-5">¿Deseas emitir una factura antes de cerrar?</p>

                      <div className="mb-5 relative">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                          Cédula o RUC del cliente (opcional)
                        </label>
                        <input
                          type="text"
                          value={identificacionComprador}
                          onChange={e => handleIdentificacionChange(e.target.value)}
                          placeholder="Buscar cliente o escribir cédula/RUC..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                          onKeyDown={e => e.key === 'Enter' && !clientesEncontrados.length && handleEmitirYCerrar()}
                          autoComplete="off"
                        />

                        {/* Dropdown de clientes de la BD */}
                        {clientesEncontrados.length > 0 && !clienteSeleccionado && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                            {clientesEncontrados.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSeleccionarCliente(c)}
                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition"
                              >
                                <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                                <p className="text-xs text-gray-400">{c.cedula_ruc}{c.email && ` · ${c.email}`}</p>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Estados de búsqueda */}
                        {(buscandoCliente || buscandoContribuyente) && !clienteSeleccionado && (
                          <p className="text-xs text-gray-400 mt-1.5">
                            {buscandoCliente ? 'Buscando clientes...' : 'Consultando SRI...'}
                          </p>
                        )}

                        {/* Cliente seleccionado */}
                        {clienteSeleccionado && (
                          <div className="mt-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex justify-between items-start gap-2">
                            <div>
                              <p className="font-medium text-emerald-800">{clienteSeleccionado.nombre}</p>
                              <p className="text-emerald-600">Cliente registrado</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setClienteSeleccionado(null);
                                setContribuyente(null);
                                setIdentificacionComprador('');
                                setClientesEncontrados([]);
                                setMostrarGuardarCliente(false);
                              }}
                              className="text-gray-400 hover:text-gray-600 shrink-0"
                            >✕</button>
                          </div>
                        )}

                        {/* Contribuyente del SRI (sin cliente seleccionado) */}
                        {!clienteSeleccionado && !buscandoContribuyente && contribuyente && contribuyente !== false && (
                          <div className="mt-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                            <p className="font-medium text-emerald-800">{contribuyente.razon_social}</p>
                            {contribuyente.estado && <p className="text-emerald-600">Estado: {contribuyente.estado}</p>}
                          </div>
                        )}

                        {/* Guardar como nuevo cliente */}
                        {mostrarGuardarCliente && !clienteSeleccionado && (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                            <p className="text-xs text-blue-700 font-medium">¿Guardar como nuevo cliente?</p>
                            <input
                              type="text"
                              value={nombreNuevoCliente}
                              onChange={e => setNombreNuevoCliente(e.target.value)}
                              placeholder="Nombre del cliente"
                              className="w-full border border-blue-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={handleGuardarNuevoCliente}
                              disabled={!nombreNuevoCliente.trim()}
                              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                            >
                              Guardar cliente
                            </button>
                          </div>
                        )}
                      </div>

                      {error && (
                        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
                      )}

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handleEmitirYCerrar}
                          disabled={emitiendoFactura}
                          className="w-full text-white font-medium rounded-lg py-2.5 text-sm disabled:opacity-50 transition"
                          style={{ background: '#4f9cf9' }}
                        >
                          {emitiendoFactura ? 'Emitiendo factura...' : 'Emitir factura y cerrar'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCerrarSinFactura}
                          disabled={emitiendoFactura}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg py-2.5 text-sm transition"
                        >
                          Cerrar sin factura
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalCerrar(false); setError('');
                            setIdentificacionComprador('');
                            setClienteSeleccionado(null); setClientesEncontrados([]);
                            setMostrarGuardarCliente(false); setNombreNuevoCliente('');
                          }}
                          disabled={emitiendoFactura}
                          className="w-full text-gray-400 hover:text-gray-600 text-sm py-1.5 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}

                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
