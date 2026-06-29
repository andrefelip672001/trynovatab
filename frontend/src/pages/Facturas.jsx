import { useState, useEffect } from 'react';
import { invoiceService } from '../services/api';
import Layout from '../components/Layout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function abrirDocumento(path) {
  const token = localStorage.getItem('trynova_token');
  window.open(`${API_BASE}${path}?token=${token}`, '_blank');
}

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => { cargarFacturas(); }, []);

  async function cargarFacturas() {
    try {
      setCargando(true);
      setError('');
      const resp = await invoiceService.listar();
      setFacturas(resp.facturas || []);
    } catch (err) {
      setError(err.message || 'Error al cargar facturas');
    } finally {
      setCargando(false);
    }
  }

  function formatFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-EC', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <Layout titulo="Facturas">
      <div className="max-w-6xl mx-auto space-y-5">

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Cargando facturas...
            </div>
          ) : facturas.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No hay facturas emitidas aún.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f, idx) => (
                  <tr key={f.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-3 font-mono text-gray-900 text-xs">{f.numero_factura}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(f.emitido_en)}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{f.nombre_persona || 'CONSUMIDOR FINAL'}</p>
                      <p className="text-xs text-gray-400">{f.cedula}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ${parseFloat(f.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        f.estado === 'autorizada'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => abrirDocumento(`/invoices/${f.id}/ride`)}
                          className="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
                        >
                          RIDE PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirDocumento(`/invoices/${f.id}/ticket`)}
                          className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors"
                        >
                          Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
