import { generarClaveAcceso } from './claveAcceso.js';

export function generarFacturaXML({
  tenant,    // nombre, ruc, direccion, establecimiento, punto_emision, ambiente_sri
  cliente,   // cedula, nombre_persona, tipo_identificacion, email
  items,     // { nombre_producto, cantidad, precio_unitario, tiene_iva }
  secuencial
}) {
  const fechaEmision = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));

  const claveAcceso = generarClaveAcceso({
    fechaEmision,
    tipoComprobante: '01',
    ruc:             tenant.ruc,
    ambiente:        tenant.ambiente_sri,
    establecimiento: tenant.establecimiento,
    puntoEmision:    tenant.punto_emision,
    secuencial,
    tipoEmision:     '1'
  });

  // ── IVA por item ─────────────────────────────────────────────────────────
  // El precio almacenado YA incluye IVA cuando tiene_iva=true.
  // Fórmula: precioSinIVA = precio / 1.15  →  ivaItem = precio - precioSinIVA
  const TARIFA_IVA = 15;

  const detallesXML = items.map(item => {
    const tieneIVA   = item.tiene_iva !== false; // default true
    const precio     = parseFloat(item.precio_unitario);
    const cant       = Number(item.cantidad);

    let precioUnitSinIVA, precioTotalSinIVA, ivaItem, codigoPorcentaje, tarifa;

    if (tieneIVA) {
      precioUnitSinIVA  = precio / 1.15;
      precioTotalSinIVA = cant * precioUnitSinIVA;
      ivaItem           = cant * precio - precioTotalSinIVA;
      codigoPorcentaje  = 4;   // SRI: 4 = 15%
      tarifa            = TARIFA_IVA;
    } else {
      precioUnitSinIVA  = precio;
      precioTotalSinIVA = cant * precio;
      ivaItem           = 0;
      codigoPorcentaje  = 0;   // SRI: 0 = 0%
      tarifa            = 0;
    }

    return `
    <detalle>
      <descripcion>${escaparXML(item.nombre_producto)}</descripcion>
      <cantidad>${cant}</cantidad>
      <precioUnitario>${precioUnitSinIVA.toFixed(6)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${precioTotalSinIVA.toFixed(2)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
          <tarifa>${tarifa}</tarifa>
          <baseImponible>${precioTotalSinIVA.toFixed(2)}</baseImponible>
          <valor>${ivaItem.toFixed(2)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  // ── Totales agrupados ─────────────────────────────────────────────────────
  let base15 = 0, iva15 = 0, base0 = 0;
  items.forEach(item => {
    const tieneIVA = item.tiene_iva !== false;
    const precio   = parseFloat(item.precio_unitario);
    const cant     = Number(item.cantidad);
    if (tieneIVA) {
      const b = cant * precio / 1.15;
      base15 += b;
      iva15  += cant * precio - b;
    } else {
      base0 += cant * precio;
    }
  });

  const totalSinImpuestos = base15 + base0;
  const valorIVA          = iva15;
  const importeTotal      = totalSinImpuestos + valorIVA;

  // Bloques totalConImpuestos (solo incluir si base > 0)
  let totalImpuestosXML = '';
  if (base15 > 0) {
    totalImpuestosXML += `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>${base15.toFixed(2)}</baseImponible>
        <valor>${iva15.toFixed(2)}</valor>
      </totalImpuesto>`;
  }
  if (base0 > 0) {
    totalImpuestosXML += `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${base0.toFixed(2)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>`;
  }

  // ── Tipo de identificación (acepta códigos SRI directos o alias legacy) ──
  const mapaId = {
    '04': '04', '05': '05', '06': '06', '07': '07',
    'ruc': '04', 'ci': '05', 'pasap': '06',
  };
  const codigoTipoId = mapaId[cliente.tipo_identificacion] || '07';

  // ── Fecha ─────────────────────────────────────────────────────────────────
  const d = fechaEmision;
  const fechaEmisionStr = [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');

  // ── XML completo ──────────────────────────────────────────────────────────
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${tenant.ambiente_sri}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escaparXML(tenant.nombre)}</razonSocial>
    <ruc>${tenant.ruc}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${tenant.establecimiento}</estab>
    <ptoEmi>${tenant.punto_emision}</ptoEmi>
    <secuencial>${String(secuencial).padStart(9, '0')}</secuencial>
    <dirMatriz>${escaparXML(tenant.direccion || 'N/A')}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaEmisionStr}</fechaEmision>
    <dirEstablecimiento>${escaparXML(tenant.direccion || 'N/A')}</dirEstablecimiento>
    <obligadoContabilidad>NO</obligadoContabilidad>
    <tipoIdentificacionComprador>${codigoTipoId}</tipoIdentificacionComprador>
    <razonSocialComprador>${escaparXML(cliente.nombre_persona || 'CONSUMIDOR FINAL')}</razonSocialComprador>
    <identificacionComprador>${cliente.cedula || '9999999999999'}</identificacionComprador>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>${totalImpuestosXML}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${importeTotal.toFixed(2)}</importeTotal>
    <moneda>DOLAR</moneda>
  </infoFactura>
  <detalles>${detallesXML}
  </detalles>
  ${cliente.email ? `<infoAdicional><campoAdicional nombre="Email">${escaparXML(cliente.email)}</campoAdicional></infoAdicional>` : ''}
</factura>`;

  return {
    xml,
    claveAcceso,
    totalSinImpuestos: totalSinImpuestos.toFixed(2),
    valorIVA:          valorIVA.toFixed(2),
    importeTotal:      importeTotal.toFixed(2),
  };
}

function escaparXML(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}
