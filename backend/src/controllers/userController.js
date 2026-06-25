import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

// Crear un nuevo usuario (admin_local, cajero o mesero) - solo superadmin o admin_local
export const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol, tenant_id } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Nombre, email, password y rol son requeridos'
      });
    }

    const rolesValidos = ['admin_local', 'cajero', 'mesero'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        status: 'error',
        mensaje: `Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}`
      });
    }

    // Si quien crea es admin_local, el usuario nuevo hereda su mismo tenant_id automáticamente
    // Si quien crea es superadmin, debe especificar a qué tenant_id pertenece
    let tenantIdFinal = tenant_id;
    if (req.usuario.rol === 'admin_local') {
      tenantIdFinal = req.usuario.tenant_id;
    }

    if (!tenantIdFinal) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'tenant_id es requerido'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (tenant_id, nombre, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, tenant_id, nombre, email, rol, activo, created_at`,
      [tenantIdFinal, nombre, email, passwordHash, rol]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Usuario creado exitosamente',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando usuario:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        mensaje: 'Ya existe un usuario con ese email'
      });
    }

    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};