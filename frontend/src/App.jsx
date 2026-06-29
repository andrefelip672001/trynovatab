import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mesas from './pages/Mesas';
import DetalleOrden from './pages/DetalleOrden';
import SplitBill from './pages/SplitBill';
import Administracion from './pages/Administracion';
import Facturas from './pages/Facturas';

// Protege rutas que requieren estar logueado
function RutaProtegida({ children }) {
  const { estaAutenticado, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400" style={{ background: '#f5f6fa' }}>
        Cargando...
      </div>
    );
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <RutaProtegida>
            <Dashboard />
          </RutaProtegida>
        }
      />
      <Route
        path="/mesas"
        element={
          <RutaProtegida>
            <Mesas />
          </RutaProtegida>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/mesa/:tableId"
        element={
          <RutaProtegida>
            <DetalleOrden />
          </RutaProtegida>
        }
      />
      <Route
        path="/administracion"
        element={
          <RutaProtegida>
            <Administracion />
          </RutaProtegida>
        }
      />
      <Route
        path="/orden/:orderId/dividir"
        element={
          <RutaProtegida>
            <SplitBill />
          </RutaProtegida>
        }
      />
      <Route
        path="/facturas"
        element={
          <RutaProtegida>
            <Facturas />
          </RutaProtegida>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}