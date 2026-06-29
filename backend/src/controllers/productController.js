import pool from '../config/db.js';

// Crear un producto nuevo
export const crearProducto = async (req, res) => {
  try {
    const { nombre, descripcion, precio, category_id,
            codigo_barras, es_directo, stock_directo, stock_minimo_directo,
            tiene_iva } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Tu usuario no tiene un local (tenant) asignado'
      });
    }

    if (!nombre || precio === undefined || precio === null) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Nombre y precio son requeridos'
      });
    }

    if (precio < 0) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'El precio no puede ser negativo'
      });
    }

    // Si mandan category_id, confirmamos que esa categoría sea del MISMO tenant
    // (evita que un producto quede ligado a la categoría de otro local)
    if (category_id) {
      const categoriaCheck = await pool.query(
        'SELECT id FROM categories WHERE id = $1 AND tenant_id = $2',
        [category_id, tenant_id]
      );
      if (categoriaCheck.rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          mensaje: 'La categoría especificada no existe o no pertenece a tu local'
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO products
         (tenant_id, category_id, nombre, descripcion, precio, activo,
          codigo_barras, es_directo, stock_directo, stock_minimo_directo, tiene_iva)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenant_id, category_id || null, nombre, descripcion || null, precio,
       codigo_barras || null, es_directo || false,
       stock_directo || 0, stock_minimo_directo || 0,
       tiene_iva !== false]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Producto creado exitosamente',
      producto: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Listar productos del tenant (con el nombre de su categoría incluido)
export const listarProductos = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;
    const { soloActivos } = req.query; // ?soloActivos=true en la URL, opcional

    let query = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = $1
    `;
    const params = [tenant_id];

    if (soloActivos === 'true') {
      query += ' AND p.activo = true';
    }

    query += ' ORDER BY c.orden ASC NULLS LAST, p.nombre ASC';

    const result = await pool.query(query, params);

    res.json({
      status: 'ok',
      total: result.rows.length,
      productos: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Buscar productos por nombre o código de barras
export const buscarProductos = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        status: 'error',
        mensaje: 'El parámetro q es requerido'
      });
    }

    const result = await pool.query(
      `SELECT p.id, p.nombre, p.precio, p.codigo_barras, p.es_directo, p.stock_directo,
              c.nombre as categoria_nombre
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = $1
         AND p.activo = true
         AND (p.nombre ILIKE $2 OR p.codigo_barras = $3)
       ORDER BY p.nombre ASC
       LIMIT 10`,
      [tenant_id, `%${q.trim()}%`, q.trim()]
    );

    res.json({
      status: 'ok',
      productos: result.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Actualizar un producto (nombre, precio, descripcion, categoria, activo)
export const actualizarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, category_id, activo } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (precio !== undefined && precio < 0) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'El precio no puede ser negativo'
      });
    }

    const result = await pool.query(
      `UPDATE products
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           precio = COALESCE($3, precio),
           category_id = COALESCE($4, category_id),
           activo = COALESCE($5, activo),
           updated_at = NOW()
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [nombre, descripcion, precio, category_id, activo, id, tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Producto no encontrado o no pertenece a tu local'
      });
    }

    res.json({
      status: 'ok',
      mensaje: 'Producto actualizado exitosamente',
      producto: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};