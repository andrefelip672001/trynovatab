import pool from '../config/db.js';

export const obtenerDashboard = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'Tu usuario no tiene un local (tenant) asignado'
      });
    }

    // Ventas de hoy: suma de todos los order_items de órdenes (de cualquier estado) creadas hoy
    const ventasHoyResult = await pool.query(
      `SELECT COALESCE(SUM(oi.cantidad * oi.precio_unitario), 0) as total,
              COUNT(DISTINCT o.id) as ordenes
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.tenant_id = $1 AND o.abierto_en::date = CURRENT_DATE`,
      [tenant_id]
    );

    // Ventas de los últimos 7 días, agrupadas por día (para la gráfica)
    const ventasSemanaResult = await pool.query(
      `SELECT o.abierto_en::date as dia,
              COALESCE(SUM(oi.cantidad * oi.precio_unitario), 0) as total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.tenant_id = $1 AND o.abierto_en >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY o.abierto_en::date
       ORDER BY dia ASC`,
      [tenant_id]
    );

    // Total de la semana (suma de los 7 días)
    const totalSemana = ventasSemanaResult.rows.reduce(
      (suma, dia) => suma + parseFloat(dia.total),
      0
    );

    // Productos más vendidos (por cantidad), de todos los tiempos
    const topProductosResult = await pool.query(
      `SELECT oi.nombre_producto,
              SUM(oi.cantidad) as cantidad_vendida,
              SUM(oi.cantidad * oi.precio_unitario) as total_generado
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.tenant_id = $1
       GROUP BY oi.nombre_producto
       ORDER BY cantidad_vendida DESC
       LIMIT 5`,
      [tenant_id]
    );

    // Estado de mesas
    const mesasResult = await pool.query(
      `SELECT estado, COUNT(*) as total
       FROM tables
       WHERE tenant_id = $1
       GROUP BY estado`,
      [tenant_id]
    );

    // Órdenes abiertas ahora mismo
    const ordenesAbiertasResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders WHERE tenant_id = $1 AND estado = 'abierto'`,
      [tenant_id]
    );

    // Insumos con stock crítico
    const stockCriticoResult = await pool.query(
      `SELECT nombre, stock, stock_minimo, unidad
       FROM inventory
       WHERE tenant_id = $1 AND stock <= stock_minimo
       ORDER BY nombre ASC`,
      [tenant_id]
    );

    res.json({
      status: 'ok',
      ventas_hoy: {
        total: parseFloat(ventasHoyResult.rows[0].total).toFixed(2),
        ordenes: parseInt(ventasHoyResult.rows[0].ordenes)
      },
      ventas_semana: {
        total: totalSemana.toFixed(2),
        por_dia: ventasSemanaResult.rows.map(d => ({
          dia: d.dia,
          total: parseFloat(d.total).toFixed(2)
        }))
      },
      top_productos: topProductosResult.rows.map(p => ({
        nombre: p.nombre_producto,
        cantidad: parseInt(p.cantidad_vendida),
        total: parseFloat(p.total_generado).toFixed(2)
      })),
      mesas: mesasResult.rows.reduce((acc, m) => {
        acc[m.estado] = parseInt(m.total);
        return acc;
      }, {}),
      ordenes_abiertas: parseInt(ordenesAbiertasResult.rows[0].total),
      stock_critico: stockCriticoResult.rows
    });

  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'Error en el servidor',
      detalle: error.message
    });
  }
};