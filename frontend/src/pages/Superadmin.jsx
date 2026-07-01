import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { superadminService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const PLANES = [
  { key: 'Básico',    precio: '$25' },
  { key: 'Estándar',  precio: '$40' },
  { key: 'Completo',  precio: '$60' },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-white w-full';

export default function Superadmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats]       = useState(null);
  const [tenants, setTenants]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [exito, setExito]       = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [toggling, setToggling] = useState(null);

  // Nuevo local
  const [nombreLocal, setNombreLocal]     = useState('');
  const [ruc, setRuc]                     = useState('');
  const [direccion, setDireccion]         = useState('');
  const [emailAdmin, setEmailAdmin]       = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [plan, setPlan]                   = useState('Básico');
  const [guardando, setGuardando]         = useState(false);

  useEffect(() => {
    if (usuario?.rol !== 'superadmin') { navigate('/dashboard'); return; }
    cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      setError('');
      const [statsResp, tenantsResp] = await Promise.all([
        superadminService.stats(),
        superadminService.listarTenants(),
      ]);
      setStats(statsResp);
      setTenants(tenantsResp.tenants);
    } catch (err) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setCargando(false);
    }
  }

  async function handleToggle(id) {
    try {
      setToggling(id);
      setError('');
      const resp = await superadminService.toggleTenant(id);
      mostrarExito(resp.mensaje);
      setTenants(prev => prev.map(t => t.id === id ? { ...t, activo: resp.activo } : t));
    } catch (err) {
      setError(err.message || 'Error al cambiar estado');
    } finally {
      setToggling(null);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    try {
      setGuardando(true);
      setError('');
      await superadminService.crearTenant({
        nombre_local: nombreLocal,
        ruc,
        direccion,
        email_admin:    emailAdmin,
        password_admin: passwordAdmin,
        plan,
      });
      setNombreLocal(''); setRuc(''); setDireccion('');
      setEmailAdmin(''); setPasswordAdmin(''); setPlan('Básico');
      setMostrarForm(false);
      mostrarExito('Local creado exitosamente');
      await cargar();
    } catch (err) {
      setError(err.message || 'Error al crear local');
    } finally {
      setGuardando(false);
    }
  }

  function mostrarExito(msg) {
    setExito(msg);
    setTimeout(() => setExito(''), 3000);
  }

  return (
    <Layout titulo="Panel Superadmin">
      <div className="max-w-4xl mx-auto space-y-6 overflow-x-hidden">

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

        {/* ── Stats globales ── */}
        {cargando ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
        ) : stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Locales activos"   value={stats.tenants_activos} sub={`de ${stats.total_tenants} total`} />
            <StatCard label="Total locales"     value={stats.total_tenants} />
            <StatCard label="Facturas emitidas" value={stats.total_facturas} sub="todos los locales" />
            <StatCard label="Ventas del mes"    value={`$${stats.ventas_mes}`} sub="todos los locales" />
          </div>
        )}

        {/* ── Lista de locales ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Locales registrados
            </p>
            <button
              type="button"
              onClick={() => { setMostrarForm(f => !f); setError(''); }}
              className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition-colors"
              style={{ background: '#4f9cf9' }}
            >
              {mostrarForm ? 'Cancelar' : '+ Nuevo local'}
            </button>
          </div>

          {/* ── Formulario nuevo local ── */}
          {mostrarForm && (
            <form
              onSubmit={handleCrear}
              className="border-b border-gray-100 px-5 py-5 space-y-3 bg-blue-50"
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4f9cf9' }}>
                Nuevo local
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={nombreLocal}
                  onChange={e => setNombreLocal(e.target.value)}
                  required
                  placeholder="Nombre del local"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={ruc}
                  onChange={e => setRuc(e.target.value)}
                  required
                  placeholder="RUC (13 dígitos)"
                  maxLength={13}
                  className={inputCls}
                />
              </div>

              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Dirección (opcional)"
                className={inputCls}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={emailAdmin}
                  onChange={e => setEmailAdmin(e.target.value)}
                  required
                  placeholder="Email del admin del local"
                  className={inputCls}
                />
                <input
                  type="password"
                  value={passwordAdmin}
                  onChange={e => setPasswordAdmin(e.target.value)}
                  required
                  placeholder="Contraseña del admin"
                  className={inputCls}
                />
              </div>

              {/* Selector de plan */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
                {PLANES.map(({ key, precio }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlan(key)}
                    className="flex-1 py-2 font-medium transition-colors border-r border-gray-200 last:border-0"
                    style={plan === key
                      ? { background: '#4f9cf9', color: '#fff' }
                      : { background: '#f3f4f6', color: '#6b7280' }}
                  >
                    {key} <span className="opacity-75 text-xs">{precio}</span>
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={guardando}
                className="w-full text-white font-medium rounded-lg py-2.5 text-sm disabled:opacity-50 transition-colors"
                style={{ background: '#4f9cf9' }}
              >
                {guardando ? 'Creando local...' : 'Crear local y admin'}
              </button>
            </form>
          )}

          {/* ── Tabla de locales ── */}
          {cargando ? (
            <div className="py-10 text-center text-sm text-gray-400">Cargando...</div>
          ) : tenants.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No hay locales registrados</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tenants.map(t => (
                <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{t.nombre}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.activo
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                        {t.plan || 'Básico'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      RUC: {t.ruc}
                      {' · '}
                      {parseInt(t.total_usuarios)} usuario{parseInt(t.total_usuarios) !== 1 ? 's' : ''}
                      {' · '}
                      {parseInt(t.total_productos)} producto{parseInt(t.total_productos) !== 1 ? 's' : ''}
                      {' · '}
                      {parseInt(t.total_ordenes_mes)} órdenes este mes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(t.id)}
                    disabled={toggling === t.id}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors disabled:opacity-50 ${
                      t.activo
                        ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {toggling === t.id ? '...' : (t.activo ? 'Desactivar' : 'Activar')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
