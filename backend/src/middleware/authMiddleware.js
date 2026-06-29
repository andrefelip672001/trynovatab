import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;

  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  } else {
    return res.status(401).json({
      status: 'error',
      mensaje: 'No se proporcionó token de acceso'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
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