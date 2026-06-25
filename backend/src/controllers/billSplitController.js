import pool from '../config/db.js';

// Crear un "split" (una persona) dentro de una orden
export const crearSplit = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { nombre_persona, cedula, email, tipo_identificacion } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!nombre_persona) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'nombre_persona es requerido'
      });
    }

    // Verificar que la orden existe, es de este tenant, y sigue abierta
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

    if (ordenResult.rows[0].estado !== 'abierto') {
      return res.status(409).json({
        status: 'error',
        mensaje: 'Solo se pueden crear divisiones en una orden abierta'
      });
    }

    const result = await pool.query(
      `INSERT INTO bill_splits (order_id, nombre_persona, cedula, email, tipo_identificacion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [order_id, nombre_persona, cedula || null, email || null, tipo_identificacion || 'cedula']
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'División creada exitosamente',
      split: result.rows[0]
    });

  } catch (error) {
    console.error('Error creando split:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Listar los splits (personas) de una orden, con sus asignaciones de items
export const listarSplits = async (req, res) => {
  try {
    const { order_id } = req.params;
    const tenant_id = req.usuario.tenant_id;

    const ordenResult = await pool.query(
      'SELECT id FROM orders WHERE id = $1 AND tenant_id = $2',
      [order_id, tenant_id]
    );

    if (ordenResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Orden no encontrada o no pertenece a tu local'
      });
    }

    const splitsResult = await pool.query(
      'SELECT * FROM bill_splits WHERE order_id = $1 ORDER BY created_at ASC',
      [order_id]
    );

    // Para cada split, traemos también sus asignaciones (qué order_item_id y cuánta cantidad)
    const splitsConItems = await Promise.all(
      splitsResult.rows.map(async (split) => {
        const itemsResult = await pool.query(
          'SELECT order_item_id, cantidad FROM bill_split_items WHERE bill_split_id = $1',
          [split.id]
        );
        return {
          ...split,
          itemsAsignados: itemsResult.rows
        };
      })
    );

    res.json({
      status: 'ok',
      total: splitsConItems.length,
      splits: splitsConItems
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};
// Asignar una cantidad de un order_item a un split (persona) específica
export const asignarItemASplit = async (req, res) => {
  try {
    const { split_id } = req.params;
    const { order_item_id, cantidad } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!order_item_id || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'order_item_id y cantidad (mayor a 0) son requeridos'
      });
    }

    // 1. Verificar que el split existe y pertenece a una orden de este tenant
    const splitResult = await pool.query(
      `SELECT bs.* FROM bill_splits bs
       JOIN orders o ON bs.order_id = o.id
       WHERE bs.id = $1 AND o.tenant_id = $2`,
      [split_id, tenant_id]
    );

    if (splitResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'División no encontrada o no pertenece a tu local'
      });
    }

    const split = splitResult.rows[0];

    // 2. Verificar que el order_item existe y pertenece a LA MISMA orden que el split
    const itemResult = await pool.query(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2',
      [order_item_id, split.order_id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'El producto no pertenece a la misma orden que esta división'
      });
    }

    const item = itemResult.rows[0];

    // 3. Calcular cuánto ya se ha asignado de este item a CUALQUIER persona
    const yaAsignadoResult = await pool.query(
      `SELECT COALESCE(SUM(cantidad), 0) as total_asignado
       FROM bill_split_items
       WHERE order_item_id = $1`,
      [order_item_id]
    );

    const yaAsignado = parseInt(yaAsignadoResult.rows[0].total_asignado);
    const disponible = item.cantidad - yaAsignado;

    if (cantidad > disponible) {
      return res.status(409).json({
        status: 'error',
        mensaje: `No puedes asignar ${cantidad} unidades. Solo quedan ${disponible} disponibles de "${item.nombre_producto}" (pedido: ${item.cantidad}, ya asignado: ${yaAsignado})`
      });
    }

    // 4. Todo correcto, registrar la asignación
    const result = await pool.query(
      `INSERT INTO bill_split_items (bill_split_id, order_item_id, cantidad)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [split_id, order_item_id, cantidad]
    );

    res.status(201).json({
      status: 'ok',
      mensaje: 'Item asignado exitosamente',
      asignacion: result.rows[0]
    });

  } catch (error) {
    console.error('Error asignando item:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};

// Ver el resumen completo de un split: qué le toca y cuánto debe pagar
export const verSplit = async (req, res) => {
  try {
    const { split_id } = req.params;
    const tenant_id = req.usuario.tenant_id;

    const splitResult = await pool.query(
      `SELECT bs.* FROM bill_splits bs
       JOIN orders o ON bs.order_id = o.id
       WHERE bs.id = $1 AND o.tenant_id = $2`,
      [split_id, tenant_id]
    );

    if (splitResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'División no encontrada o no pertenece a tu local'
      });
    }

    const itemsResult = await pool.query(
      `SELECT bsi.id, bsi.cantidad, oi.nombre_producto, oi.precio_unitario,
              (bsi.cantidad * oi.precio_unitario) as subtotal
       FROM bill_split_items bsi
       JOIN order_items oi ON bsi.order_item_id = oi.id
       WHERE bsi.bill_split_id = $1
       ORDER BY oi.created_at ASC`,
      [split_id]
    );

    const total = itemsResult.rows.reduce(
      (suma, item) => suma + parseFloat(item.subtotal),
      0
    );

    res.json({
      status: 'ok',
      split: splitResult.rows[0],
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

// Ver el resumen de TODOS los splits de una orden, con totales y validación de cobertura
export const verResumenOrden = async (req, res) => {
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

    const totalOrdenResult = await pool.query(
      `SELECT COALESCE(SUM(cantidad * precio_unitario), 0) as total
       FROM order_items WHERE order_id = $1`,
      [order_id]
    );
    const totalOrden = parseFloat(totalOrdenResult.rows[0].total);

    const totalAsignadoResult = await pool.query(
      `SELECT COALESCE(SUM(bsi.cantidad * oi.precio_unitario), 0) as total
       FROM bill_split_items bsi
       JOIN order_items oi ON bsi.order_item_id = oi.id
       WHERE oi.order_id = $1`,
      [order_id]
    );
    const totalAsignado = parseFloat(totalAsignadoResult.rows[0].total);

    res.json({
      status: 'ok',
      total_orden: totalOrden.toFixed(2),
      total_asignado: totalAsignado.toFixed(2),
      total_sin_asignar: (totalOrden - totalAsignado).toFixed(2),
      completamente_dividida: totalOrden === totalAsignado
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};