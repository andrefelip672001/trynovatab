import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  // El token viene en el header: Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      mensaje: 'No se proporcionó token de acceso'
    });
  }

  const token = authHeader.split(' ')[1]; // separa "Bearer" del token real

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // guardamos los datos del usuario para usarlos en las siguientes funciones
    next(); // todo bien, deja pasar la petición
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      mensaje: 'Token inválido o expirado'
    });
  }
};

export const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        status: 'error',
        mensaje: 'No autenticado'
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        status: 'error',
        mensaje: 'No tienes permiso para realizar esta acción'
      });
    }

    next();
  };
};