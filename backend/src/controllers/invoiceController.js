import pool from '../config/db.js';
import { generarFacturaXML }    from '../utils/generarFacturaXML.js';
import { firmarXML }            from '../utils/firmarXML.js';
import { enviarAlSRI }          from '../utils/enviarSRI.js';
import { consultarAutorizacion } from '../utils/consultarAutorizacion.js';

// La BD guarda ambiente como '1' (pruebas) o '2' (producción)
const AMBIENTE_MAP = { '1': 'pruebas', '2': 'produccion' };

export const emitirFactura = async (req, res) => {
  const { split_id } = req.body;   // UUID del bill_split
  const tenant_id    = req.usuario.tenant_id;

  if (!split_id) {
    return res.status(400).json({ status: 'error', mensaje: 'split_id es requerido' });
  }

  // ── a. Obtener split con tenant_id y order_id ───────────────────────────────
  const splitResult = await pool.query(
    `SELECT bs.*, o.tenant_id, o.id AS order_id
     FROM bill_splits bs
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

  // ── b. Obtener tenant completo ─────────────────────────────────────────────
  const tenantResult = await pool.query(
    `SELECT id, nombre, ruc, direccion, establecimiento, punto_emision,
            ambiente_sri, secuencial_actual
     FROM tenants WHERE id = $1`,
    [tenant_id]
  );

  if (tenantResult.rows.length === 0) {
    return res.status(404).json({ status: 'error', mensaje: 'Tenant no encontrado' });
  }

  const tenant = tenantResult.rows[0];

  // ── c. Obtener items del split ─────────────────────────────────────────────
  const itemsResult = await pool.query(
    `SELECT oi.nombre_producto, bsi.cantidad, oi.precio_unitario
     FROM bill_split_items bsi
     JOIN order_items oi ON bsi.order_item_id = oi.id
     WHERE bsi.bill_split_id = $1`,
    [split_id]
  );

  if (itemsResult.rows.length === 0) {
    return res.status(400).json({
      status: 'error',
      mensaje: 'La división no tiene items asignados'
    });
  }

  const items = itemsResult.rows;

  // ── d–j. Transacción: incrementar secuencial + guardar invoice ─────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // d. Incrementar secuencial con bloqueo para evitar duplicados concurrentes
    const seqResult = await client.query(
      `UPDATE tenants
       SET secuencial_actual = secuencial_actual + 1
       WHERE id = $1
       RETURNING secuencial_actual`,
      [tenant_id]
    );
    const secuencial = seqResult.rows[0].secuencial_actual;

    // e. Generar XML (también retorna los totales calculados)
    const { xml, claveAcceso, totalSinImpuestos, valorIVA, importeTotal } = generarFacturaXML({
      tenant,
      cliente: {
        nombre_persona:      split.nombre_persona,
        cedula:              split.cedula,
        tipo_identificacion: split.tipo_identificacion,
        email:               split.email,
      },
      items,
      secuencial,
    });

    // f. Firmar XML
    const certPath     = tenant.certificado_path     || process.env.CERT_PATH;
    const certPassword = tenant.certificado_password || process.env.CERT_PASSWORD;
    const xmlFirmado   = firmarXML(xml, certPath, certPassword);

    // g. Enviar al SRI
    const ambienteClave  = String(tenant.ambiente_sri);
    const ambienteNombre = AMBIENTE_MAP[ambienteClave] ?? 'pruebas';

    const recepcion = await enviarAlSRI(xmlFirmado, ambienteNombre);

    if (recepcion.estado !== 'RECIBIDA') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        mensaje: 'El SRI devolvió el comprobante sin recibirlo',
        estado_sri: recepcion.estado,
        mensajes:   recepcion.mensajes,
      });
    }

    // h. Esperar 3 s para que el SRI procese la autorización
    await sleep(3000);

    // i. Consultar autorización
    const autorizacion = await consultarAutorizacion(claveAcceso, ambienteNombre);

    if (!autorizacion.autorizado) {
      // No revertimos el secuencial para no dejar huecos en la serie;
      // el comprobante quedará pendiente de reintento externo.
      await client.query('ROLLBACK');
      return res.status(409).json({
        status:     'error',
        mensaje:    'El SRI no autorizó el comprobante aún',
        estado_sri: autorizacion.estado,
        mensajes:   autorizacion.mensajes,
      });
    }

    // numero_factura en formato estándar: 001-001-000000001
    const numeroFactura = [
      tenant.establecimiento,
      tenant.punto_emision,
      String(secuencial).padStart(9, '0'),
    ].join('-');

    // j. Guardar factura autorizada con esquema real de la tabla
    await client.query(
      `INSERT INTO invoices
         (tenant_id, bill_split_id, clave_acceso, numero_factura,
          subtotal, iva, total, estado, emitido_en,
          numero_autorizacion, fecha_autorizacion, xml_autorizado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'autorizada', NOW(), $8, $9, $10)`,
      [
        tenant_id,
        split_id,
        claveAcceso,
        numeroFactura,
        totalSinImpuestos,
        valorIVA,
        importeTotal,
        autorizacion.numeroAutorizacion,
        autorizacion.fechaAutorizacion,
        autorizacion.xml,
      ]
    );

    await client.query('COMMIT');

    // k. Respuesta exitosa
    return res.status(201).json({
      status:               'ok',
      numero_factura:       numeroFactura,
      numero_autorizacion:  autorizacion.numeroAutorizacion,
      fecha_autorizacion:   autorizacion.fechaAutorizacion,
      clave_acceso:         claveAcceso,
      subtotal:             totalSinImpuestos,
      iva:                  valorIVA,
      total:                importeTotal,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error emitiendo factura:', error);
    return res.status(500).json({
      status:  'error',
      mensaje: 'Error interno al emitir la factura',
      detalle: error.message,
    });
  } finally {
    client.release();
  }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
