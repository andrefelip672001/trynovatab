import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { statsService } from '../services/api';

function BarraVentas({ datos }) {
  const maxVal = Math.max(...datos.map(d => d.total), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px' }}>
      {datos.map(item => {
        const barH = Math.max((item.total / maxVal) * 120, item.total > 0 ? 4 : 0);
        return (
          <div key={item.dia} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end', gap: '6px',
          }}>
            <span style={{ fontSize: '10px', color: '#6b7280', minHeight: '14px' }}>
              {item.total > 0 ? `$${Math.round(item.total)}` : ''}
            </span>
            <div style={{
              width: '100%', height: `${barH}px`,
              backgroundColor: '#4f9cf9',
              borderRadius: '4px 4px 0 0',
            }} />
            <span style={{ fontSize: '11px', color: '#6b7280' }}>{item.dia}</span>
          </div>
        );
      })}
    </div>
  );
}

function Metrica({ label, valor, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent || '#111827' }}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]       = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    statsService.dashboard()
      .then(data => setStats(data))
      .catch(err => setError(err.message || 'Error al cargar estadísticas'))
      .finally(() => setCargando(false));
  }, []);

  function formatearGrafica(porDia) {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (porDia || []).map(d => ({
      dia:   dias[new Date(d.fecha + 'T12:00:00').getDay()],
      total: parseFloat(d.total) || 0,
    }));
  }

  return (
    <Layout titulo="Dashboard">
      {cargando ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Cargando...
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      ) : stats && (
        <div className="space-y-6">

          {stats.stock_critico?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-700">
                  {stats.stock_critico.length} producto{stats.stock_critico.length > 1 ? 's' : ''} con stock bajo
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {stats.stock_critico.map(p => p.nombre).join(', ')}
                </p>
              </div>
              <span className="text-amber-400 text-lg font-bold">!</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metrica
              label="Ventas hoy"
              valor={`$${parseFloat(stats.ventas_hoy?.total || 0).toFixed(2)}`}
              sub={`${stats.ventas_hoy?.ordenes || 0} órdenes`}
              accent="#4f9cf9"
            />
            <Metrica
              label="Ventas semana"
              valor={`$${parseFloat(stats.ventas_semana?.total || 0).toFixed(2)}`}
            />
            <Metrica
              label="Órdenes abiertas"
              valor={stats.ordenes_abiertas || 0}
            />
            <Metrica
              label="Mesas ocupadas"
              valor={stats.mesas?.ocupada || 0}
              sub={`${stats.mesas?.libre || 0} libres · ${stats.mesas?.reservada || 0} reservadas`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-5">
                Ventas esta semana
              </p>
              <BarraVentas datos={formatearGrafica(stats.ventas_semana?.por_dia)} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-4">
                Productos más vendidos
              </p>
              {(!stats.top_productos || stats.top_productos.length === 0) ? (
                <p className="text-sm text-gray-400">Sin datos todavía.</p>
              ) : (
                <div className="space-y-3">
                  {stats.top_productos.slice(0, 5).map((p, i) => (
                    <div key={p.nombre} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center font-semibold text-white"
                          style={{ background: '#4f9cf9', fontSize: '10px' }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-800">{p.nombre}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500">
                        {p.total_vendido} uds
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </Layout>
  );
}
