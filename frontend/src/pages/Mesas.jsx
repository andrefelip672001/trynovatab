import { useState, useEffect } from 'react';
import { tableService, orderService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const ESTADO_ESTILOS = {
  libre:     { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#22c55e' },
  ocupada:   { bg: '#eff6ff', border: '#bfdbfe', text: '#4f9cf9', dot: '#4f9cf9' },
  reservada: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#f59e0b' },
};

const ESTADO_LABEL = {
  libre:     'Libre',
  ocupada:   'Ocupada',
  reservada: 'Reservada',
};

export default function Mesas() {
  const [mesas, setMesas]           = useState([]);
  const [notasPorMesa, setNotasPorMesa] = useState({});
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');
  const [actualizando, setActualizando] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    cargarMesas();
  }, []);

  async function cargarMesas() {
    try {
      setCargando(true);
      setError('');
      const respuesta = await tableService.listar();
      const mesas = respuesta.mesas;
      setMesas(mesas);

      // Cargar notas de órdenes activas para mesas ocupadas (en paralelo, silenciosamente)
      const mesasOcupadas = mesas.filter(m => m.estado === 'ocupada');
      const resultados = await Promise.allSettled(
        mesasOcupadas.map(m => orderService.verPorMesa(m.id))
      );
      const notas = {};
      mesasOcupadas.forEach((m, i) => {
        if (resultados[i].status === 'fulfilled') {
          notas[m.id] = resultados[i].value?.orden?.notas || null;
        }
      });
      setNotasPorMesa(notas);
      console.log('notas por mesa:', notas);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las mesas');
    } finally {
      setCargando(false);
    }
  }

  async function handleCambiarEstado(mesa, nuevoEstado) {
    try {
      setActualizando(mesa.id);
      await tableService.actualizar(mesa.id, { estado: nuevoEstado });
      setMesas(prev =>
        prev.map(m => m.id === mesa.id ? { ...m, estado: nuevoEstado } : m)
      );
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado');
    } finally {
      setActualizando(null);
    }
  }

  return (
    <Layout titulo="Mesas">
      {cargando ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Cargando...
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {mesas.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No hay mesas configuradas todavía.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {mesas.map(mesa => {
                const estilos = ESTADO_ESTILOS[mesa.estado] || ESTADO_ESTILOS.libre;
                return (
                  <div
                    key={mesa.id}
                    className="rounded-xl border p-4 cursor-pointer transition-shadow hover:shadow-md"
                    style={{ background: estilos.bg, borderColor: estilos.border }}
                    onClick={() => navigate(`/mesa/${mesa.id}`)}
                  >
                    <div className="flex justify-end mb-3">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: estilos.dot }}
                      />
                    </div>

                    {mesa.estado === 'ocupada' && notasPorMesa[mesa.id] && (
                      <p className="text-xs mb-1 truncate font-medium" style={{ color: '#4f9cf9' }}>
                        {notasPorMesa[mesa.id]}
                      </p>
                    )}
                    <p className="text-lg font-bold text-gray-900 mb-1">{mesa.nombre}</p>
                    <p className="text-xs text-gray-400 mb-3">{mesa.capacidad} personas</p>

                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium"
                        style={{ color: estilos.text }}
                      >
                        {ESTADO_LABEL[mesa.estado] || mesa.estado}
                      </span>

                      {mesa.estado === 'libre' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleCambiarEstado(mesa, 'reservada'); }}
                          disabled={actualizando === mesa.id}
                          className="text-xs text-gray-400 hover:text-gray-600 transition disabled:opacity-40"
                        >
                          Reservar
                        </button>
                      )}
                      {mesa.estado === 'reservada' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleCambiarEstado(mesa, 'libre'); }}
                          disabled={actualizando === mesa.id}
                          className="text-xs text-gray-400 hover:text-gray-600 transition disabled:opacity-40"
                        >
                          Liberar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
