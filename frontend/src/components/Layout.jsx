import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Iconos SVG inline (equivalentes a Tabler Icons) ──────────────────────────

function IconDashboard() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconMesas() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11a2 2 0 0 1 2 2v2h10v-2a2 2 0 1 1 4 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" />
      <path d="M7 11V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v4" />
      <line x1="7" y1="19" x2="7" y2="21" />
      <line x1="17" y1="19" x2="17" y2="21" />
    </svg>
  );
}

function IconFacturas() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconCierre() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { path: '/dashboard',      label: 'Dashboard',      Icon: IconDashboard },
  { path: '/mesas',          label: 'Mesas',          Icon: IconMesas     },
  { path: '/facturas',       label: 'Facturas',       Icon: IconFacturas  },
  { path: '/cierre-caja',   label: 'Cierre de caja', Icon: IconCierre    },
  { path: '/administracion', label: 'Administración', Icon: IconAdmin     },
];

// ── Componente Layout ──────────────────────────────────────────────────────────

export default function Layout({ children, titulo = '' }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { usuario, logout } = useAuth();

  function isActive(path) {
    if (path === '/mesas') {
      return (
        location.pathname === '/mesas' ||
        location.pathname.startsWith('/mesa/') ||
        location.pathname.startsWith('/orden/')
      );
    }
    return location.pathname === path;
  }

  const hoy = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: '220px', minWidth: '220px',
        background: '#1e2a3a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: '22px 20px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <h1 style={{
            fontSize: '16px', fontWeight: 700,
            color: '#fff', margin: 0,
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '-0.3px',
          }}>
            Trynova <span style={{ color: '#4f9cf9' }}>Tab</span>
          </h1>
          <p style={{ fontSize: '11px', color: '#8899aa', marginTop: '2px' }}>
            Gestión de local
          </p>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '10px 10px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ path, label, Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={!active ? 'hover:bg-white/5' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  width: '100%', padding: '9px 12px',
                  borderRadius: '8px', border: 'none',
                  background: active ? 'rgba(79,156,249,0.14)' : 'transparent',
                  color: active ? '#4f9cf9' : '#8899aa',
                  fontSize: '13.5px', fontWeight: active ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                  marginBottom: '2px',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Perfil usuario */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{
            fontSize: '12.5px', fontWeight: 500,
            color: '#d4dde8', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {usuario?.nombre}
          </p>
          <p style={{
            fontSize: '11px', color: '#8899aa',
            marginTop: '2px', textTransform: 'capitalize',
          }}>
            {usuario?.rol}
          </p>
          <button
            onClick={logout}
            className="hover:text-red-400"
            style={{
              marginTop: '8px', fontSize: '11.5px',
              color: '#8899aa', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'color 0.15s',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Área de contenido ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: '#f5f6fa',
      }}>

        {/* Header superior */}
        <header style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '13px 28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {titulo}
            </h2>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '1px', textTransform: 'capitalize' }}>
              {hoy}
            </p>
          </div>
        </header>

        {/* Contenido scrollable */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
