import pool from '../config/db.js';

// Agregar un insumo a la receta de un producto
export const agregarIngrediente = async (req, res) => {
  try {
    const { product_id } = req.params;
    const { inventory_id, cantidad } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!inventory_id || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'inventory_id y cantidad (mayor a 0) son requeridos'
      });
    }

    // Verificamos que el producto pertenezca a este tenant
    const productoResult = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenant_id]
    );
    if (productoResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Producto no encontrado o no pertenece a tu local'
      });
    }

    // Verificamos que el insumo pertenezca a este tenant
    const insumoResult = await pool.query(
      'SELECT id FROM inventory WHERE id = $1 AND tenant_id = $2',
      [inventory_id, tenant_id]
    );
    if (insumoResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Insumo no encontrado o no pertenece a tu local'
      });
    }

    const result = await pool.query(
      `INSERT INTO recipes (product_id, inventory_id, cantidad)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [product_id, inventory_id, cantidad]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Ingrediente agregado a la receta',
      ingrediente: result.rows[0]
    });

  } catch (error) {
    console.error('Error agregando ingrediente:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Ver la receta completa de un producto (con nombres de insumos)
export const verReceta = async (req, res) => {
  try {
    const { product_id } = req.params;
    const tenant_id = req.usuario.tenant_id;

    const productoResult = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND tenant_id = $2',
      [product_id, tenant_id]
    );
    if (productoResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Producto no encontrado o no pertenece a tu local'
      });
    }

    const result = await pool.query(
      `SELECT r.id, r.cantidad, i.nombre as insumo_nombre, i.unidad, i.stock
       FROM recipes r
       JOIN inventory i ON r.inventory_id = i.id
       WHERE r.product_id = $1
       ORDER BY i.nombre ASC`,
      [product_id]
    );

    res.json({
      status: 'ok',
      total: result.rows.length,
      receta: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};