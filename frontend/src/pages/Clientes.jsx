import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { clienteService } from '../services/api';

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-white w-full';

export default function Clientes() {
  const [clientes, setClientes]       = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState('');
  const [exito, setExito]             = useState('');
  const [busqueda, setBusqueda]       = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando]       = useState(null);

  // Formulario
  const [nombre, setNombre]       = useState('');
  const [cedulaRuc, setCedulaRuc] = useState('');
  const [email, setEmail]         = useState('');
  const [telefono, setTelefono]   = useState('');
  const [guardando, setGuardando] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      setCargando(true);
      const resp = await clienteService.listar();
      setClientes(resp.clientes);
    } catch (err) {
      setError(err.message || 'Error al cargar clientes');
    } finally {
      setCargando(false);
    }
  }

  function handleBusqueda(e) {
    const q = e.target.value;
    setBusqueda(q);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { cargar(); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await clienteService.buscar(q.trim());
        setClientes(resp.clientes);
      } catch { /* mantener lista actual */ }
    }, 300);
  }

  function abrirForm() {
    setNombre(''); setCedulaRuc(''); setEmail(''); setTelefono('');
    setEditando(null);
    setMostrarForm(true);
    setError('');
  }

  function abrirEdicion(c) {
    setNombre(c.nombre);
    setCedulaRuc(c.cedula_ruc);
    setEmail(c.email || '');
    setTelefono(c.telefono || '');
    setEditando(c);
    setMostrarForm(true);
    setError('');
  }

  function cerrarForm() {
    setMostrarForm(false);
    setEditando(null);
    setError('');
  }

  async function handleGuardar(e) {
    e.preventDefault();
    try {
      setGuardando(true);
      setError('');
      const datos = { nombre, cedula_ruc: cedulaRuc, email: email || null, telefono: telefono || null };
      if (editando) {
        await clienteService.actualizar(editando.id, datos);
        mostrarExito('Cliente actualizado');
      } else {
        await clienteService.crear(datos);
        mostrarExito('Cliente creado');
      }
      cerrarForm();
      await cargar();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(c) {
    if (!window.confirm(`¿Eliminar a "${c.nombre}"?`)) return;
    try {
      setError('');
      await clienteService.eliminar(c.id);
      mostrarExito(`"${c.nombre}" eliminado`);
      await cargar();
    } catch (err) {
      setError(err.message || 'Error al eliminar');
    }
  }

  function mostrarExito(msg) {
    setExito(msg);
    setTimeout(() => setExito(''), 2500);
  }

  return (
    <Layout titulo="Clientes">
      <div className="max-w-3xl mx-auto space-y-5 overflow-x-hidden">

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
        )}
        {exito && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{exito}</div>
        )}

        {/* Barra superior */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={busqueda}
            onChange={handleBusqueda}
            placeholder="Buscar por nombre o cédula/RUC..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-white"
          />
          <button
            type="button"
            onClick={mostrarForm && !editando ? cerrarForm : abrirForm}
            className="shrink-0 text-sm px-4 py-2.5 rounded-lg text-white font-medium transition-colors"
            style={{ background: '#4f9cf9' }}
          >
            {mostrarForm && !editando ? 'Cancelar' : '+ Nuevo cliente'}
          </button>
        </div>

        {/* Formulario crear / editar */}
        {mostrarForm && (
          <form
            onSubmit={handleGuardar}
            className={`rounded-xl border p-5 space-y-3 ${
              editando
                ? 'bg-blue-50 border-[#4f9cf9]/30'
                : 'bg-white border-gray-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4f9cf9' }}>
                {editando ? `Editando: ${editando.nombre}` : 'Nuevo cliente'}
              </p>
              <button type="button" onClick={cerrarForm} className="text-xs text-gray-400 hover:text-gray-600 transition">
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                placeholder="Nombre completo"
                className={inputCls}
              />
              <input
                type="text"
                value={cedulaRuc}
                onChange={e => setCedulaRuc(e.target.value)}
                required
                placeholder="Cédula o RUC"
                maxLength={13}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (opcional)"
                className={inputCls}
              />
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Teléfono (opcional)"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={guardando}
              className="w-full text-white font-medium rounded-lg py-2.5 text-sm disabled:opacity-50 transition-colors"
              style={{ background: '#4f9cf9' }}
            >
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </form>
        )}

        {/* Lista */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              {cargando ? 'Cargando...' : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {cargando ? (
            <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
          ) : clientes.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay clientes registrados aún'}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {clientes.map(c => (
                <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.cedula_ruc}
                      {c.email && ` · ${c.email}`}
                      {c.telefono && ` · ${c.telefono}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(c)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminar(c)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
