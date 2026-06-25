import pool from '../config/db.js';

export const crearCategoria = async (req, res) => {
  try {
    const { nombre, orden } = req.body;
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
        mensaje: 'El nombre de la categoría es requerido'
      });
    }

    const result = await pool.query(
      `INSERT INTO categories (tenant_id, nombre, orden)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenant_id, nombre, orden || 0]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Categoría creada exitosamente',
      categoria: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

export const listarCategorias = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;

    const result = await pool.query(
      'SELECT * FROM categories WHERE tenant_id = $1 ORDER BY orden ASC, nombre ASC',
      [tenant_id]
    );

    res.json({
      status: 'ok',
      total: result.rows.length,
      categorias: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};