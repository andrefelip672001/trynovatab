import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderService, splitService } from '../services/api';
import Layout from '../components/Layout';

export default function SplitBill() {
  const { orderId } = useParams();
  const navigate    = useNavigate();

  const [orden, setOrden]                         = useState(null);
  const [items, setItems]                         = useState([]);
  const [splits, setSplits]                       = useState([]);
  const [resumen, setResumen]                     = useState(null);
  const [splitSeleccionado, setSplitSeleccionado] = useState(null);

  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState('');
  const [cerrandoOrden, setCerrandoOrden] = useState(false);

  const [mostrarFormPersona, setMostrarFormPersona] = useState(false);
  const [nombrePersona, setNombrePersona]           = useState('');
  const [esConsumidorFinal, setEsConsumidorFinal]   = useState(true);
  const [cedula, setCedula]                         = useState('');
  const [guardandoPersona, setGuardandoPersona]     = useState(false);

  const [carritoAsignacion, setCarritoAsignacion]         = useState({});
  const [confirmandoAsignacion, setConfirmandoAsignacion] = useState(false);

  useEffect(() => { cargarTodo(); }, [orderId]);

  async function cargarTodo() {
    try {
      setCargando(true);
      setError('');
      const [ordenResp, splitsResp, resumenResp] = await Promise.all([
        orderService.ver(orderId),
        splitService.listar(orderId),
        splitService.resumenOrden(orderId),
      ]);
      setOrden(ordenResp.orden);
      setItems(ordenResp.items);
      setSplits(splitsResp.splits);
      setResumen(resumenResp);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la información');
    } finally {
      setCargando(false);
    }
  }

  async function handleCrearPersona(e) {
    e.preventDefault();
    try {
      setGuardandoPersona(true);
      setError('');
      await splitService.crear(orderId, {
        nombre_persona:      nombrePersona,
        cedula:              esConsumidorFinal ? null : cedula,
        tipo_identificacion: 'ci',
      });
      setNombrePersona('');
      setCedula('');
      setEsConsumidorFinal(true);
      setMostrarFormPersona(false);
      await cargarTodo();
    } catch (err) {
      setError(err.message || 'No se pudo crear la división');
    } finally {
      setGuardandoPersona(false);
    }
  }

  function yaAsignadoConfirmado(itemId) {
    return splits.reduce((suma, split) => {
      const asignaciones = split.itemsAsignados || [];
      return suma + asignaciones
        .filter(a => a.order_item_id === itemId)
        .reduce((s, a) => s + a.cantidad, 0);
    }, 0);
  }

  function disponibleDeItem(item) {
    return item.cantidad - yaAsignadoConfirmado(item.id) - (carritoAsignacion[item.id] || 0);
  }

  function ajustarCarritoAsignacion(itemId, delta) {
    setCarritoAsignacion(prev => {
      const nuevo = Math.max(0, (prev[itemId] || 0) + delta);
      if (nuevo === 0) {
        const { [itemId]: _, ...resto } = prev;
        return resto;
      }
      return { ...prev, [itemId]: nuevo };
    });
  }

  const totalItemsCarritoAsignacion = Object.values(carritoAsignacion).reduce((s, c) => s + c, 0);

  async function handleConfirmarAsignacion() {
    try {
      setConfirmandoAsignacion(true);
      setError('');
      await Promise.all(
        Object.entries(carritoAsignacion).map(([itemId, cantidad]) =>
          splitService.asignarItem(splitSeleccionado.id, itemId, cantidad)
        )
      );
      setCarritoAsignacion({});
      await cargarTodo();
      const splitActualizado = await splitService.ver(splitSeleccionado.id);
      setSplitSeleccionado({
        ...splitActualizado.split,
        items: splitActualizado.items,
        total: splitActualizado.total,
      });
    } catch (err) {
      setError(err.message || 'No se pudo confirmar la asignación');
    } finally {
      setConfirmandoAsignacion(false);
    }
  }

  async function abrirDetalleSplit(split) {
    try {
      setCarritoAsignacion({});
      const detalle = await splitService.ver(split.id);
      setSplitSeleccionado({ ...detalle.split, items: detalle.items, total: detalle.total });
    } catch (err) {
      setError(err.message || 'No se pudo abrir esta división');
    }
  }

  async function handleCerrarOrden() {
    try {
      setCerrandoOrden(true);
      setError('');
      await orderService.cerrar(orderId);
      navigate('/mesas');
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la cuenta');
    } finally {
      setCerrandoOrden(false);
    }
  }

  return (
    <Layout titulo="Dividir cuenta">
      {cargando ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Cargando...
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-5">

          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
          >
            ← Volver
          </button>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {resumen && (
            <div className={`rounded-xl px-5 py-4 flex items-center justify-between border ${
              resumen.completamente_dividida
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <span className={`text-sm font-medium ${
                resumen.completamente_dividida ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {resumen.completamente_dividida
                  ? '✓ Toda la cuenta está repartida'
                  : `Falta repartir $${resumen.total_sin_asignar}`}
              </span>
              <button
                onClick={handleCerrarOrden}
                disabled={!resumen.completamente_dividida || cerrandoOrden}
                className="text-sm bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 transition"
              >
                {cerrandoOrden ? 'Cerrando...' : 'Cobrar y cerrar cuenta'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Personas */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Personas</p>
                <button
                  onClick={() => setMostrarFormPersona(!mostrarFormPersona)}
                  className="text-xs font-medium transition"
                  style={{ color: '#4f9cf9' }}
                >
                  {mostrarFormPersona ? 'Cancelar' : '+ Agregar persona'}
                </button>
              </div>

              {mostrarFormPersona && (
                <form onSubmit={handleCrearPersona} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <input
                    type="text"
                    value={nombrePersona}
                    onChange={e => setNombrePersona(e.target.value)}
                    required
                    placeholder="Nombre"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-white"
                  />
                  <div className="flex gap-4 text-xs text-gray-500">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={esConsumidorFinal}
                        onChange={() => setEsConsumidorFinal(true)}
                      />
                      Consumidor final
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!esConsumidorFinal}
                        onChange={() => setEsConsumidorFinal(false)}
                      />
                      Con identificación
                    </label>
                  </div>
                  {!esConsumidorFinal && (
                    <input
                      type="text"
                      value={cedula}
                      onChange={e => setCedula(e.target.value)}
                      placeholder="Cédula"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-white"
                    />
                  )}
                  <button
                    type="submit"
                    disabled={guardandoPersona}
                    className="w-full text-white text-sm font-medium rounded-lg px-3 py-2 transition disabled:opacity-50"
                    style={{ background: '#4f9cf9' }}
                  >
                    {guardandoPersona ? 'Guardando...' : 'Agregar'}
                  </button>
                </form>
              )}

              {splits.length === 0 ? (
                <p className="text-sm text-gray-400">Todavía no hay personas agregadas.</p>
              ) : (
                <div className="space-y-2">
                  {splits.map(split => (
                    <button
                      key={split.id}
                      onClick={() => abrirDetalleSplit(split)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                        splitSeleccionado?.id === split.id
                          ? 'border-[#4f9cf9] bg-blue-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{split.nombre_persona}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {split.cedula || 'Consumidor final'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Asignación */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                {splitSeleccionado ? splitSeleccionado.nombre_persona : 'Selecciona una persona'}
              </p>

              {!splitSeleccionado ? (
                <p className="text-sm text-gray-400">
                  Haz clic en una persona para asignarle productos.
                </p>
              ) : (
                <div className="space-y-4">

                  {splitSeleccionado.items?.length > 0 && (
                    <div className="space-y-2 pb-3 border-b border-gray-100">
                      {splitSeleccionado.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-900">{item.cantidad}× {item.nombre_producto}</span>
                          <span className="text-gray-500">${parseFloat(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-1">
                        <span className="text-gray-700">Total confirmado</span>
                        <span style={{ color: '#4f9cf9' }}>${splitSeleccionado.total}</span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-400 uppercase tracking-wide">Asignar de la cuenta</p>
                  <div className="space-y-2">
                    {items.map(item => {
                      const disponible = disponibleDeItem(item);
                      const enCarrito  = carritoAsignacion[item.id] || 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-sm text-gray-900">{item.nombre_producto}</p>
                            <p className="text-xs text-gray-400">{disponible} disponibles</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => ajustarCarritoAsignacion(item.id, -1)}
                              disabled={enCarrito === 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              style={{ fontSize: '16px' }}
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm text-gray-900">{enCarrito}</span>
                            <button
                              onClick={() => ajustarCarritoAsignacion(item.id, 1)}
                              disabled={disponible === 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                              style={{ background: '#4f9cf9', fontSize: '16px' }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalItemsCarritoAsignacion > 0 && (
                    <button
                      onClick={handleConfirmarAsignacion}
                      disabled={confirmandoAsignacion}
                      className="w-full text-white text-sm font-medium rounded-lg px-4 py-2.5 transition disabled:opacity-50"
                      style={{ background: '#4f9cf9' }}
                    >
                      {confirmandoAsignacion
                        ? 'Confirmando...'
                        : `Confirmar asignación (${totalItemsCarritoAsignacion})`}
                    </button>
                  )}

                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}
