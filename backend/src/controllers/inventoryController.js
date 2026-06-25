import pool from '../config/db.js';

// Crear un insumo nuevo
export const crearInsumo = async (req, res) => {
  try {
    const { nombre, unidad, stock, stock_minimo, costo_unitario } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Tu usuario no tiene un local (tenant) asignado'
      });
    }

    if (!nombre || !unidad) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Nombre y unidad son requeridos'
      });
    }

    const result = await pool.query(
      `INSERT INTO inventory (tenant_id, nombre, unidad, stock, stock_minimo, costo_unitario)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, nombre, unidad, stock || 0, stock_minimo || 0, costo_unitario || null]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Insumo creado exitosamente',
      insumo: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando insumo:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Listar insumos del tenant
export const listarInsumos = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;

    const result = await pool.query(
      'SELECT * FROM inventory WHERE tenant_id = $1 ORDER BY nombre ASC',
      [tenant_id]
    );

    res.json({
      status: 'ok',
      total: result.rows.length,
      insumos: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Listar insumos con stock por debajo del mínimo (alerta)
export const listarStockBajo = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;

    const result = await pool.query(
      `SELECT * FROM inventory 
       WHERE tenant_id = $1 AND stock <= stock_minimo
       ORDER BY nombre ASC`,
      [tenant_id]
    );

    res.json({
      status: 'ok',
      total: result.rows.length,
      insumos: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};