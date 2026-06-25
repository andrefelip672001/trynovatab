import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al cargar la app, revisamos si ya había una sesión guardada
  useEffect(() => {
    async function verificarSesion() {
      const token = localStorage.getItem('trynova_token');

      if (!token) {
        setCargando(false);
        return;
      }

      try {
        const respuesta = await authService.me();
        setUsuario(respuesta.usuario);
      } catch (error) {
        // El token expiró o es inválido, limpiamos todo
        localStorage.removeItem('trynova_token');
      } finally {
        setCargando(false);
      }
    }

    verificarSesion();
  }, []);

  async function login(email, password) {
    const respuesta = await authService.login(email, password);
    localStorage.setItem('trynova_token', respuesta.token);
    setUsuario(respuesta.usuario);
    return respuesta;
  }

  function logout() {
    localStorage.removeItem('trynova_token');
    setUsuario(null);
  }

  const value = {
    usuario,
    cargando,
    login,
    logout,
    estaAutenticado: !!usuario
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personalizado para usar el contexto fácilmente en cualquier componente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}