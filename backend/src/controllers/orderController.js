import pool from '../config/db.js';

// Abrir una orden nueva en una mesa
export const abrirOrden = async (req, res) => {
  const client = await pool.connect();
  try {
    const { table_id, notas } = req.body;
    const tenant_id = req.usuario.tenant_id;
    const created_by = req.usuario.id;

    if (!table_id) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'table_id es requerido'
      });
    }

    await client.query('BEGIN');

    const mesaResult = await client.query(
      'SELECT * FROM tables WHERE id = $1 AND tenant_id = $2',
      [table_id, tenant_id]
    );

    if (mesaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        mensaje: 'Mesa no encontrada o no pertenece a tu local'
      });
    }

    const mesa = mesaResult.rows[0];
    if (mesa.estado === 'ocupada') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        mensaje: 'Esta mesa ya está ocupada con otra orden'
      });
    }

    const ordenResult = await client.query(
      `INSERT INTO orders (tenant_id, table_id, estado, notas, abierto_en, created_by)
       VALUES ($1, $2, 'abierto', $3, NOW(), $4)
       RETURNING *`,
      [tenant_id, table_id, notas || null, created_by]
    );

    await client.query(
      `UPDATE tables SET estado = 'ocupada', updated_at = NOW() WHERE id = $1`,
      [table_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      status: 'ok',
      mensaje: 'Orden abierta exitosamente',
      orden: ordenResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error abriendo orden:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  } finally {
    client.release();
  }
};

// Agregar un producto a una orden existente (se puede llamar muchas veces)
// También descuenta automáticamente el inventario según la receta del producto
export const agregarItemOrden = async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id } = req.params;
    const { product_id, cantidad, notas } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!product_id || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'product_id y cantidad (mayor a 0) son requeridos'
      });
    }

    await client.query('BEGIN');

    const ordenResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [order_id, tenant_id]
    );

    if (ordenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        mensaje: 'Orden no encontrada o no pertenece a tu local'
      });
    }

    if (ordenResult.rows[0].estado !== 'abierto') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        mensaje: 'No se pueden agregar productos a una orden que no está abierta'
      });
    }

    const productoResult = await client.query(
      'SELECT * FROM products WHERE id = $1 AND tenant_id = $2 AND activo = true',
      [product_id, tenant_id]
    );

    if (productoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        mensaje: 'Producto no encontrado, no pertenece a tu local, o está inactivo'
      });
    }

    const producto = productoResult.rows[0];

    // Producto directo: descontar stock_directo en lugar de usar recetas
    if (producto.es_directo) {
      if (parseFloat(producto.stock_directo) < cantidad) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          status: 'error',
          mensaje: `Stock insuficiente de "${producto.nombre}". Disponible: ${producto.stock_directo}, necesario: ${cantidad}`
        });
      }
      await client.query(
        'UPDATE products SET stock_directo = stock_directo - $1, updated_at = NOW() WHERE id = $2',
        [cantidad, product_id]
      );
    }

    // Traemos la receta del producto (qué insumos usa y cuánto de cada uno)
    const recetaResult = await client.query(
      'SELECT inventory_id, cantidad as cantidad_por_unidad FROM recipes WHERE product_id = $1',
      [product_id]
    );

    // Si tiene receta, descontamos el inventario correspondiente
    for (const ingrediente of recetaResult.rows) {
      const cantidadADescontar = ingrediente.cantidad_por_unidad * cantidad;

      const insumoResult = await client.query(
        'SELECT * FROM inventory WHERE id = $1 AND tenant_id = $2',
        [ingrediente.inventory_id, tenant_id]
      );

      if (insumoResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          status: 'error',
          mensaje: 'Uno de los insumos de la receta ya no existe'
        });
      }

      const insumo = insumoResult.rows[0];

      if (parseFloat(insumo.stock) < cantidadADescontar) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          status: 'error',
          mensaje: `Stock insuficiente de "${insumo.nombre}". Disponible: ${insumo.stock} ${insumo.unidad}, necesario: ${cantidadADescontar} ${insumo.unidad}`
        });
      }

      await client.query(
        'UPDATE inventory SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
        [cantidadADescontar, ingrediente.inventory_id]
      );
    }

    // Si el producto ya existe en la orden, sumar cantidad en vez de crear fila nueva
    const itemExistente = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2',
      [order_id, product_id]
    );

    if (itemExistente.rows.length > 0) {
      const itemActualizado = await client.query(
        `UPDATE order_items SET cantidad = cantidad + $1 WHERE order_id = $2 AND product_id = $3 RETURNING *`,
        [cantidad, order_id, product_id]
      );
      await client.query('COMMIT');
      return res.status(200).json({
        status: 'ok',
        mensaje: 'Cantidad actualizada en la orden',
        item: itemActualizado.rows[0]
      });
    }

    const itemResult = await client.query(
      `INSERT INTO order_items (order_id, product_id, nombre_producto, cantidad, precio_unitario, estado, notas)
       VALUES ($1, $2, $3, $4, $5, 'pendiente', $6)
       RETURNING *`,
      [order_id, product_id, producto.nombre, cantidad, producto.precio, notas || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      status: 'ok',
      mensaje: 'Producto agregado a la orden',
      item: itemResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error agregando item a la orden:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  } finally {
    client.release();
  }
};

// Ver el detalle completo de una orden: sus items y el total
export const verOrden = async (req, res) => {
  try {
    const { order_id } = req.params;
    const tenant_id = req.usuario.tenant_id;

    const ordenResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [order_id, tenant_id]
    );

    if (ordenResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Orden no encontrada o no pertenece a tu local'
      });
    }

    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC',
      [order_id]
    );

    const total = itemsResult.rows.reduce(
      (suma, item) => suma + (item.cantidad * parseFloat(item.precio_unitario)),
      0
    );

    res.json({
      status: 'ok',
      orden: ordenResult.rows[0],
      items: itemsResult.rows,
      total: total.toFixed(2)
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Cerrar una orden (al cobrar la cuenta) - libera la mesa
export const cerrarOrden = async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id } = req.params;
    const tenant_id = req.usuario.tenant_id;

    await client.query('BEGIN');

    const ordenResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [order_id, tenant_id]
    );

    if (ordenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        mensaje: 'Orden no encontrada o no pertenece a tu local'
      });
    }

    const orden = ordenResult.rows[0];

    if (orden.estado !== 'abierto') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        mensaje: 'Esta orden ya está cerrada'
      });
    }

    const cerradaResult = await client.query(
      `UPDATE orders SET estado = 'cerrado', cerrado_en = NOW() WHERE id = $1 RETURNING *`,
      [order_id]
    );

    await client.query(
      `UPDATE tables SET estado = 'libre', updated_at = NOW() WHERE id = $1`,
      [orden.table_id]
    );

    await client.query('COMMIT');

    res.json({
      status: 'ok',
      mensaje: 'Orden cerrada exitosamente, mesa liberada',
      orden: cerradaResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  } finally {
    client.release();
  }
};

// Buscar la orden ABIERTA de una mesa específica
export const verOrdenPorMesa = async (req, res) => {
  try {
    const { table_id } = req.params;
    const tenant_id = req.usuario.tenant_id;

    const result = await pool.query(
      `SELECT * FROM orders WHERE table_id = $1 AND tenant_id = $2 AND estado = 'abierto'
       ORDER BY abierto_en DESC LIMIT 1`,
      [table_id, tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'No hay una orden abierta para esta mesa'
      });
    }

    res.json({
      status: 'ok',
      orden: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};