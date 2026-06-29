import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const BLUE  = '#1e3a5f';
const GRAY  = '#666666';
const LIGHT = '#f8f8f8';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function tipoLabel(codigo) {
  return { '04': 'RUC', '05': 'CÉDULA', '07': 'CONSUMIDOR FINAL' }[codigo] || codigo || '—';
}

export async function generarRIDE({ tenant, invoice, cliente, items }) {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 40;
    const W = doc.page.width - M * 2;

    // ── HEADER ───────────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor(BLUE)
       .text(tenant.nombre || 'Emisor', M, M, { width: W * 0.55 });
    doc.fontSize(8).font('Helvetica').fillColor(GRAY)
       .text(`RUC: ${tenant.ruc || ''}`,                 M, doc.y + 3, { width: W * 0.55 })
       .text(tenant.direccion || '',                      M, doc.y + 2, { width: W * 0.55 })
       .text(`Est: ${tenant.establecimiento || '001'}  Pto. Emisión: ${tenant.punto_emision || '001'}`,
                                                          M, doc.y + 2, { width: W * 0.55 });

    // Caja FACTURA (esquina derecha)
    const rX = M + W * 0.62;
    const rW = W * 0.38;
    doc.rect(rX, M, rW, 78).lineWidth(1).stroke(BLUE);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BLUE)
       .text('F A C T U R A', rX, M + 8, { width: rW, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#333')
       .text(`No. ${invoice.numero_factura}`, rX, M + 26, { width: rW, align: 'center' })
       .text('NÚMERO DE AUTORIZACIÓN',        rX, M + 40, { width: rW, align: 'center' });
    doc.fontSize(6.5)
       .text(invoice.numero_autorizacion || '—', rX + 4, M + 52, { width: rW - 8, align: 'center' });

    // ── CLAVE DE ACCESO ──────────────────────────────────────────────────────
    const claveY = M + 88;
    doc.rect(M, claveY, W, 18).fill(LIGHT);
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY)
       .text('CLAVE DE ACCESO:', M + 5, claveY + 5);
    doc.font('Helvetica-Bold').fillColor('#333')
       .text(invoice.clave_acceso || '—', M + 110, claveY + 5, { width: W - 115 });

    // ── DATOS DEL COMPRADOR ──────────────────────────────────────────────────
    const cmpY = claveY + 28;
    doc.rect(M, cmpY, W, 15).fill(BLUE);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff')
       .text('DATOS DEL COMPRADOR', M + 5, cmpY + 4);

    const cmpY2 = cmpY + 15;
    doc.rect(M, cmpY2, W, 44).stroke('#ddd');
    const lbl = (text, x, y) => doc.fontSize(7.5).font('Helvetica').fillColor(GRAY).text(text, x, y);
    const val = (text, x, y, w = 200) => doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#333').text(text, x, y, { width: w });

    lbl('Razón Social / Nombres:', M + 5, cmpY2 + 5);
    val(cliente.nombre_persona || 'CONSUMIDOR FINAL', M + 130, cmpY2 + 5);

    lbl('Identificación:', M + 5, cmpY2 + 19);
    val(`${cliente.cedula || '—'}  (${tipoLabel(cliente.tipo_identificacion)})`, M + 130, cmpY2 + 19);

    lbl('Fecha emisión:', M + 5, cmpY2 + 33);
    val(fmt(invoice.emitido_en), M + 130, cmpY2 + 33);
    lbl('Fecha autorización:', M + W * 0.5, cmpY2 + 33);
    val(fmt(invoice.fecha_autorizacion), M + W * 0.5 + 100, cmpY2 + 33);

    // ── TABLA DE PRODUCTOS ───────────────────────────────────────────────────
    const tblY  = cmpY2 + 56;
    const cDesc  = W * 0.39;
    const cCant  = W * 0.10;
    const cPUnit = W * 0.17;
    const cDes0  = W * 0.16;
    const cSub   = W * 0.18;

    doc.rect(M, tblY, W, 15).fill(BLUE);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#fff');
    doc.text('DESCRIPCIÓN', M + 4,          tblY + 4, { width: cDesc - 4 });
    doc.text('CANT.',        M + cDesc,      tblY + 4, { width: cCant,  align: 'right' });
    doc.text('P. UNITARIO',  M + cDesc + cCant, tblY + 4, { width: cPUnit, align: 'right' });
    doc.text('DESCUENTO',    M + cDesc + cCant + cPUnit, tblY + 4, { width: cDes0, align: 'right' });
    doc.text('SUBTOTAL',     M + cDesc + cCant + cPUnit + cDes0, tblY + 4, { width: cSub - 4, align: 'right' });

    let rowY = tblY + 15;
    items.forEach((item, i) => {
      const rowH = 13;
      doc.rect(M, rowY, W, rowH).fill(i % 2 === 0 ? '#fff' : LIGHT).stroke('#eee');
      doc.fontSize(7.5).font('Helvetica').fillColor('#333');
      const sub = Number(item.cantidad) * parseFloat(item.precio_unitario);
      doc.text(item.nombre_producto, M + 4, rowY + 3, { width: cDesc - 4, ellipsis: true });
      doc.text(String(item.cantidad),                M + cDesc,                    rowY + 3, { width: cCant,  align: 'right' });
      doc.text(`$${parseFloat(item.precio_unitario).toFixed(2)}`, M + cDesc + cCant, rowY + 3, { width: cPUnit, align: 'right' });
      doc.text('$0.00',                              M + cDesc + cCant + cPUnit,   rowY + 3, { width: cDes0,  align: 'right' });
      doc.text(`$${sub.toFixed(2)}`,                M + cDesc + cCant + cPUnit + cDes0, rowY + 3, { width: cSub - 4, align: 'right' });
      rowY += rowH;
    });
    doc.rect(M, tblY, W, rowY - tblY).stroke('#bbb');

    // ── TOTALES ──────────────────────────────────────────────────────────────
    const totY = rowY + 12;
    const lX   = M + W - 230;
    const vX   = M + W - 75;

    [
      ['Subtotal sin impuestos:', `$${parseFloat(invoice.subtotal || 0).toFixed(2)}`],
      ['IVA 15%:',               `$${parseFloat(invoice.iva     || 0).toFixed(2)}`],
    ].forEach(([label, v], i) => {
      doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(label, lX, totY + i * 15, { width: 150 });
      doc.font('Helvetica-Bold').fillColor('#333').text(v, vX, totY + i * 15, { width: 80, align: 'right' });
    });

    const totalLineY = totY + 33;
    doc.rect(lX - 5, totalLineY, 240, 18).fill('#dce8fb');
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLUE)
       .text('VALOR TOTAL:', lX, totalLineY + 4, { width: 150 })
       .text(`$${parseFloat(invoice.total).toFixed(2)}`, vX, totalLineY + 4, { width: 80, align: 'right' });

    // ── QR CODE ──────────────────────────────────────────────────────────────
    const qrY = totalLineY + 35;
    if (invoice.clave_acceso) {
      try {
        const dataURL = await QRCode.toDataURL(invoice.clave_acceso, { type: 'png', width: 90 });
        const qrBuf  = Buffer.from(dataURL.split(',')[1], 'base64');
        doc.image(qrBuf, M, qrY, { width: 80, height: 80 });
        doc.fontSize(6.5).font('Helvetica').fillColor(GRAY)
           .text('Verificar en el SRI', M, qrY + 83, { width: 80, align: 'center' });
      } catch (_) { /* QR falla silenciosamente */ }
    }

    doc.fontSize(7).font('Helvetica').fillColor(GRAY)
       .text('Documento generado electrónicamente — Trynova Tab', M, doc.page.height - 30, {
         width: W, align: 'center',
       });

    doc.end();
  });
}
