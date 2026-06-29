import pool from '../config/db.js';
import PDFDocument from 'pdfkit';

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

// Agregar stock a un insumo
export const agregarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;
    const tenant_id = req.usuario.tenant_id;

    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({
        status: 'error',
        mensaje: 'La cantidad debe ser mayor a 0'
      });
    }

    const result = await pool.query(
      `UPDATE inventory
       SET stock = stock + $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [cantidad, id, tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        mensaje: 'Insumo no encontrado'
      });
    }

    res.json({
      status: 'ok',
      mensaje: 'Stock actualizado correctamente',
      insumo: result.rows[0]
    });
  } catch (error) {
    console.error('Error agregando stock:', error);
    res.status(500).json({ status: 'error', mensaje: error.message });
  }
};

// Reporte PDF de inventario
export const reporteInventario = async (req, res) => {
  try {
    const tenant_id = req.usuario.tenant_id;

    const [invResult, tenantResult] = await Promise.all([
      pool.query('SELECT * FROM inventory WHERE tenant_id = $1 ORDER BY nombre ASC', [tenant_id]),
      pool.query('SELECT nombre FROM tenants WHERE id = $1', [tenant_id]),
    ]);

    const insumos   = invResult.rows;
    const tenNombre = tenantResult.rows[0]?.nombre || 'Local';
    const bajoStock = insumos.filter(i => parseFloat(i.stock) <= parseFloat(i.stock_minimo));

    const doc    = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    const pdfReady = new Promise((resolve, reject) => {
      doc.on('end',   resolve);
      doc.on('error', reject);
    });

    const M    = 40;
    const W    = doc.page.width - M * 2;
    const BLUE = '#1e3a5f';
    const GRAY = '#666';

    doc.fontSize(16).font('Helvetica-Bold').fillColor(BLUE)
       .text('Reporte de Inventario', M, M, { width: W });
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text(tenNombre,                                    M, doc.y + 4)
       .text(`Generado: ${new Date().toLocaleString('es-EC')}`, M, doc.y + 2);
    doc.moveTo(M, doc.y + 8).lineTo(M + W, doc.y + 8).stroke(BLUE);

    const resY = doc.y + 16;
    doc.rect(M, resY, W, 40).fill('#dce8fb');
    doc.fontSize(9).font('Helvetica').fillColor('#333')
       .text(`Total de insumos: ${insumos.length}`,   M + 12, resY + 8)
       .text(`Con stock bajo: ${bajoStock.length}`,   M + 12, resY + 22);

    const tblY  = resY + 55;
    const cNom  = W * 0.36;
    const cUnid = W * 0.14;
    const cSto  = W * 0.17;
    const cMin  = W * 0.17;
    const cEst  = W * 0.16;

    doc.rect(M, tblY, W, 16).fill(BLUE);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');
    doc.text('INSUMO',       M + 4,                  tblY + 4, { width: cNom - 4 });
    doc.text('UNIDAD',       M + cNom,               tblY + 4, { width: cUnid,  align: 'center' });
    doc.text('STOCK ACTUAL', M + cNom + cUnid,        tblY + 4, { width: cSto,  align: 'right' });
    doc.text('STOCK MÍN.',   M + cNom + cUnid + cSto, tblY + 4, { width: cMin,  align: 'right' });
    doc.text('ESTADO',       M + cNom + cUnid + cSto + cMin, tblY + 4, { width: cEst, align: 'center' });

    let rowY = tblY + 16;
    insumos.forEach((ins, i) => {
      const bajo = parseFloat(ins.stock) <= parseFloat(ins.stock_minimo);
      doc.rect(M, rowY, W, 14).fill(bajo ? '#fff7ed' : (i % 2 === 0 ? '#fff' : '#f8f8f8')).stroke('#eee');
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      doc.text(ins.nombre,                              M + 4,                   rowY + 3, { width: cNom - 4, ellipsis: true });
      doc.text(ins.unidad,                              M + cNom,                rowY + 3, { width: cUnid, align: 'center' });
      doc.text(parseFloat(ins.stock).toFixed(2),        M + cNom + cUnid,        rowY + 3, { width: cSto,  align: 'right' });
      doc.text(parseFloat(ins.stock_minimo).toFixed(2), M + cNom + cUnid + cSto, rowY + 3, { width: cMin,  align: 'right' });
      doc.fillColor(bajo ? '#b45309' : '#15803d').font('Helvetica-Bold')
         .text(bajo ? 'BAJO' : 'OK', M + cNom + cUnid + cSto + cMin, rowY + 3, { width: cEst, align: 'center' });
      rowY += 14;
    });
    doc.rect(M, tblY, W, rowY - tblY).stroke('#bbb');

    doc.fontSize(7).font('Helvetica').fillColor(GRAY)
       .text('Trynova Tab — reporte generado automáticamente', M, doc.page.height - 30, {
         width: W, align: 'center',
       });

    doc.end();
    await pdfReady;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="reporte-inventario.pdf"');
    res.send(Buffer.concat(chunks));
  } catch (error) {
    console.error('Error generando reporte inventario:', error);
    res.status(500).json({ status: 'error', mensaje: 'Error al generar reporte', detalle: error.message });
  }
};