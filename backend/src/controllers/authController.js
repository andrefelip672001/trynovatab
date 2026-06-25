import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Email y password son requeridos'
      });
    }

    // Buscar el usuario por email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND activo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        mensaje: 'Credenciales inválidas'
      });
    }

    const user = result.rows[0];

    // Comparar la contraseña enviada contra el hash guardado
    const passwordValida = await bcrypt.compare(password, user.password_hash);

    if (!passwordValida) {
      return res.status(401).json({
        status: 'error',
        mensaje: 'Credenciales inválidas'
      });
    }

    // Generar el token JWT con la info esencial del usuario
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol,
        tenant_id: user.tenant_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Respondemos sin exponer el password_hash
    res.json({
      status: 'ok',
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        tenant_id: user.tenant_id
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

export const me = async (req, res) => {
  // req.usuario viene del middleware verificarToken
  res.json({
    status: 'ok',
    usuario: req.usuario
  });
};