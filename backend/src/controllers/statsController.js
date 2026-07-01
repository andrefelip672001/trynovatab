import pool from '../config/db.js';
import PDFDocument from 'pdfkit';

// ── Helper: datos de cierre de caja ──────────────────────────────────────────
async function datosCierreCaja(tenant_id, fechaConsulta) {
  const [ventas, porCategoria, topProductos, facturas] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(DISTINCT o.id) as total_ordenes,
         COALESCE(SUM(oi.cantidad * oi.precio_unitario), 0) as total_ventas,
         COUNT(DISTINCT CASE WHEN i.id IS NOT NULL THEN o.id END) as ordenes_facturadas
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN bill_splits bs ON bs.order_id = o.id
       LEFT JOIN invoices i ON i.bill_split_id = bs.id
       WHERE o.tenant_id = $1 AND o.abierto_en::date = $2`,
      [tenant_id, fechaConsulta]
    ),
    pool.query(
      `SELECT
         COALESCE(c.nombre, 'Sin categoría') as categoria,
         SUM(oi.cantidad) as cantidad,
         SUM(oi.cantidad * oi.precio_unitario) as total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON oi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE o.tenant_id = $1 AND o.abierto_en::date = $2
       GROUP BY c.nombre ORDER BY total DESC`,
      [tenant_id, fechaConsulta]
    ),
    pool.query(
      `SELECT
         oi.nombre_producto,
         SUM(oi.cantidad) as cantidad,
         SUM(oi.cantidad * oi.precio_unitario) as total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.tenant_id = $1 AND o.abierto_en::date = $2
       GROUP BY oi.nombre_producto ORDER BY cantidad DESC LIMIT 10`,
      [tenant_id, fechaConsulta]
    ),
    pool.query(
      `SELECT COUNT(*) as total_facturas, COALESCE(SUM(i.total), 0) as total_facturado
       FROM invoices i WHERE i.tenant_id = $1 AND i.emitido_en::date = $2`,
      [tenant_id, fechaConsulta]
    ),
  ]);

  return {
    resumen: {
      total_ordenes:      parseInt(ventas.rows[0].total_ordenes),
      total_ventas:       parseFloat(ventas.rows[0].total_ventas).toFixed(2),
      ordenes_facturadas: parseInt(ventas.rows[0].ordenes_facturadas),
      total_facturas:     parseInt(facturas.rows[0].total_facturas),
      total_facturado:    parseFloat(facturas.rows[0].total_facturado).toFixed(2),
    },
    por_categoria: porCategoria.rows.map(r => ({
      categoria: r.categoria,
      cantidad:  parseInt(r.cantidad),
      total:     parseFloat(r.total).toFixed(2),
    })),
    top_productos: topProductos.rows.map(r => ({
      nombre:   r.nombre_producto,
      cantidad: parseInt(r.cantidad),
      total:    parseFloat(r.total).toFixed(2),
    })),
  };
}

export const cierreCaja = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;
    const fechaConsulta = req.query.fecha || new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    ).toISOString().split('T')[0];

    const datos = await datosCierreCaja(tenant_id, fechaConsulta);
    res.json({ status: 'ok', fecha: fechaConsulta, ...datos });
  } catch (error) {
    console.error('Error cierre caja:', error);
    res.status(500).json({ status: 'error', mensaje: error.message });
  }
};

export const cierreCajaPDF = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;
    const fechaConsulta = req.query.fecha || new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    ).toISOString().split('T')[0];

    const [tenantResult, datos] = await Promise.all([
      pool.query('SELECT nombre, ruc FROM tenants WHERE id = $1', [tenant_id]),
      datosCierreCaja(tenant_id, fechaConsulta),
    ]);
    const tenant = tenantResult.rows[0] || {};
    const { resumen, por_categoria, top_productos } = datos;

    const doc    = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    const pdfReady = new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });

    const M    = 40;
    const W    = doc.page.width - M * 2;
    const BLUE = '#1e3a5f';
    const GRAY = '#666';

    // Encabezado
    doc.fontSize(16).font('Helvetica-Bold').fillColor(BLUE)
       .text('CIERRE DE CAJA', M, M, { width: W });
    doc.fontSize(11).font('Helvetica').fillColor(GRAY)
       .text(`Fecha: ${fechaConsulta}`, M, doc.y + 4);
    if (tenant.nombre) {
      doc.text(`${tenant.nombre}${tenant.ruc ? '  ·  RUC: ' + tenant.ruc : ''}`, M, doc.y + 2);
    }
    doc.moveTo(M, doc.y + 8).lineTo(M + W, doc.y + 8).stroke(BLUE);

    // Resumen
    const resY = doc.y + 14;
    doc.rect(M, resY, W, 56).fill('#dce8fb');
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    const col = W / 3;
    const items = [
      ['Total ventas', `$${resumen.total_ventas}`],
      ['Órdenes atendidas', resumen.total_ordenes],
      ['Total facturado', `$${resumen.total_facturado}`],
    ];
    items.forEach(([label, val], i) => {
      const x = M + i * col + 8;
      doc.font('Helvetica').fillColor(GRAY).text(label, x, resY + 8, { width: col - 10 });
      doc.font('Helvetica-Bold').fillColor(BLUE).fontSize(14)
         .text(String(val), x, resY + 22, { width: col - 10 });
      doc.fontSize(9);
    });

    // Tabla helper
    const drawTable = (headers, rows, startY, colWidths) => {
      let y = startY;
      doc.rect(M, y, W, 16).fill(BLUE);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
      let x = M + 4;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 4, { width: colWidths[i] - 4, align: i === 0 ? 'left' : 'right' });
        x += colWidths[i];
      });
      y += 16;
      rows.forEach((row, ri) => {
        doc.rect(M, y, W, 14).fill(ri % 2 === 0 ? '#fff' : '#f8f8f8').stroke('#eee');
        doc.font('Helvetica').fontSize(8).fillColor('#333');
        x = M + 4;
        row.forEach((cell, i) => {
          doc.text(String(cell), x, y + 3, { width: colWidths[i] - 4, align: i === 0 ? 'left' : 'right' });
          x += colWidths[i];
        });
        y += 14;
      });
      doc.rect(M, startY, W, y - startY).stroke('#bbb');
      return y;
    };

    // Ventas por categoría
    let curY = resY + 70;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLUE).text('Ventas por categoría', M, curY);
    curY += 14;
    const wCat = [W * 0.55, W * 0.22, W * 0.23];
    curY = drawTable(
      ['Categoría', 'Cantidad', 'Total'],
      por_categoria.map(r => [r.categoria, r.cantidad, `$${r.total}`]),
      curY, wCat
    );

    // Top productos
    curY += 18;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLUE).text('Top productos del día', M, curY);
    curY += 14;
    const wProd = [W * 0.55, W * 0.22, W * 0.23];
    drawTable(
      ['Producto', 'Cantidad', 'Total'],
      top_productos.map(r => [r.nombre, r.cantidad, `$${r.total}`]),
      curY, wProd
    );

    // Pie
    doc.fontSize(7).font('Helvetica').fillColor(GRAY)
       .text(`Generado: ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}  ·  Trynova Tab`,
         M, doc.page.height - 30, { width: W, align: 'center' });

    doc.end();
    await pdfReady;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cierre-caja-${fechaConsulta}.pdf"`);
    res.send(Buffer.concat(chunks));
  } catch (error) {
    console.error('Error PDF cierre caja:', error);
    res.status(500).json({ status: 'error', mensaje: error.message });
  }
};

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