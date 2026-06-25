import pool from '../config/db.js';

// Crear un nuevo tenant (local/negocio) - solo superadmin
export const crearTenant = async (req, res) => {
  try {
    const { nombre, ruc, direccion, telefono, email, plan } = req.body;

    if (!nombre || !ruc) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Nombre y RUC son requeridos'
      });
    }

    const result = await pool.query(
      `INSERT INTO tenants (nombre, ruc, direccion, telefono, email, plan, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [nombre, ruc, direccion || null, telefono || null, email || null, plan || 'Basic']
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Tenant creado exitosamente',
      tenant: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando tenant:', error);

    // Si el RUC ya existe (asumiendo que hay una restricción unique)
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        mensaje: 'Ya existe un tenant con ese RUC'
      });
    }

    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Listar todos los tenants - solo superadmin
export const listarTenants = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tenants ORDER BY created_at DESC'
    );

    res.json({
      status: 'ok',
      total: result.rows.length,
      tenants: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};