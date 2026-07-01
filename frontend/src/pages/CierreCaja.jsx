import { useState, useEffect } from 'react';
import { statsService } from '../services/api';
import Layout from '../components/Layout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function fechaHoyEC() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
  ).toISOString().split('T')[0];
}

function Card({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CierreCaja() {
  const [fecha, setFecha]         = useState(fechaHoyEC());
  const [datos, setDatos]         = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => { cargar(); }, [fecha]);

  async function cargar() {
    try {
      setCargando(true);
      setError('');
      const resp = await statsService.cierreCaja(fecha);
      setDatos(resp);
    } catch (err) {
      setError(err.message || 'Error al cargar cierre de caja');
    } finally {
      setCargando(false);
    }
  }

  function abrirPDF() {
    const token = localStorage.getItem('trynova_token');
    window.open(`${API_BASE}/stats/cierre-caja/pdf?fecha=${fecha}&token=${token}`, '_blank');
  }

  return (
    <Layout titulo="Cierre de caja">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={() => setFecha(fechaHoyEC())}
            className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={abrirPDF}
            className="text-sm px-4 py-2 rounded-lg text-white font-medium transition-colors ml-auto"
            style={{ background: '#4f9cf9' }}
          >
            Descargar PDF
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Cargando...
          </div>
        ) : datos && (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card
                label="Total ventas"
                value={`$${datos.resumen.total_ventas}`}
                sub="todos los pedidos"
              />
              <Card
                label="Órdenes atendidas"
                value={datos.resumen.total_ordenes}
              />
              <Card
                label="Órdenes facturadas"
                value={datos.resumen.ordenes_facturadas}
              />
              <Card
                label="Total facturado SRI"
                value={`$${datos.resumen.total_facturado}`}
                sub={`${datos.resumen.total_facturas} facturas`}
              />
            </div>

            {/* Ventas por categoría */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Ventas por categoría
                </p>
              </div>
              {datos.por_categoria.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin ventas en esta fecha</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidades</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.por_categoria.map((r, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-5 py-2.5 text-gray-900">{r.categoria}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{r.cantidad}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-gray-900">${r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top productos */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Top 10 productos del día
                </p>
              </div>
              {datos.top_productos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin ventas en esta fecha</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidades</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.top_productos.map((r, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-5 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-2.5 text-gray-900">{r.nombre}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{r.cantidad}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-gray-900">${r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
