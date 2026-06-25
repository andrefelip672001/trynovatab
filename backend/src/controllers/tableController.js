import pool from '../config/db.js';

// Crear una mesa nueva - dentro del tenant del usuario logueado
export const crearMesa = async (req, res) => {
  try {
    const { nombre, capacidad } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Tu usuario no tiene un local (tenant) asignado'
      });
    }

    if (!nombre) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'El nombre de la mesa es requerido'
      });
    }

    const result = await pool.query(
      `INSERT INTO tables (tenant_id, nombre, capacidad, estado)
       VALUES ($1, $2, $3, 'libre')
       RETURNING *`,
      [tenant_id, nombre, capacidad || 4]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Mesa creada exitosamente',
      mesa: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando mesa:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Listar todas las mesas - SOLO del tenant del usuario logueado
export const listarMesas = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Tu usuario no tiene un local (tenant) asignado'
      });
    }

    const result = await pool.query(
      'SELECT * FROM tables WHERE tenant_id = $1 ORDER BY nombre ASC',
      [tenant_id]
    );

    res.json({
      status: 'ok',
      total: result.rows.length,
      mesas: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Actualizar una mesa (nombre, capacidad, estado)
export const actualizarMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, capacidad, estado } = req.body;
    const tenant_id = req.usuario.tenant_id;

    const estadosValidos = ['libre', 'ocupada', 'reservada'];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({
        status: 'error',
        mensaje: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`
      });
    }

    // El "AND tenant_id = $X" es la línea más importante de seguridad acá:
    // evita que alguien edite una mesa de OTRO local cambiando el :id en la URL
    const result = await pool.query(
      `UPDATE tables 
       SET nombre = COALESCE($1, nombre),
           capacidad = COALESCE($2, capacidad),
           estado = COALESCE($3, estado),
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [nombre, capacidad, estado, id, tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Mesa no encontrada o no pertenece a tu local'
      });
    }

    res.json({
      status: 'ok',
      mensaje: 'Mesa actualizada exitosamente',
      mesa: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};