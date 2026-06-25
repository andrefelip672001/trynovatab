import { generarClaveAcceso } from './claveAcceso.js';

export function generarFacturaXML({
  tenant,        // datos del local: nombre, ruc, direccion, establecimiento, puntoEmision, secuencial, ambiente
  cliente,       // datos de la persona (bill_split): nombre_persona, cedula, tipo_identificacion, email
  items,         // array de items con: nombre_producto, cantidad, precio_unitario
  secuencial     // número de secuencial para ESTA factura específica
}) {
  const fechaEmision = new Date();

  // 1. Generamos la clave de acceso única de esta factura
  const claveAcceso = generarClaveAcceso({
    fechaEmision,
    tipoComprobante: '01',
    ruc: tenant.ruc,
    ambiente: tenant.ambiente_sri,
    establecimiento: tenant.establecimiento,
    puntoEmision: tenant.punto_emision,
    secuencial,
    tipoEmision: '1'
  });

  // 2. Calculamos los totales sumando todos los items
  const totalSinImpuestos = items.reduce(
    (suma, item) => suma + (item.cantidad * parseFloat(item.precio_unitario)),
    0
  );

  // En Ecuador, el IVA actual es 15% (ajustar si tu producto necesita otra tarifa)
  const tarifaIVA = 15;
  const valorIVA = totalSinImpuestos * (tarifaIVA / 100);
  const importeTotal = totalSinImpuestos + valorIVA;

  // 3. Mapeamos el tipo de identificación a los códigos que exige el SRI
  const tiposIdentificacionSRI = {
    'ci': '05',     // cédula
    'ruc': '04',    // RUC
    'pasap': '06'   // pasaporte
  };
  const codigoTipoIdentificacion = tiposIdentificacionSRI[cliente.tipo_identificacion] || '05';

  // 4. Formato de fecha que exige el SRI: dd/mm/aaaa
  const dia = String(fechaEmision.getDate()).padStart(2, '0');
  const mes = String(fechaEmision.getMonth() + 1).padStart(2, '0');
  const anio = fechaEmision.getFullYear();
  const fechaEmisionStr = `${dia}/${mes}/${anio}`;

  // 5. Construimos el bloque de detalles (uno por cada item)
  const detallesXML = items.map(item => {
    const precioTotalSinImpuesto = (item.cantidad * parseFloat(item.precio_unitario)).toFixed(2);
    const ivaItem = (precioTotalSinImpuesto * (tarifaIVA / 100)).toFixed(2);

    return `
    <detalle>
      <descripcion>${escaparXML(item.nombre_producto)}</descripcion>
      <cantidad>${item.cantidad}</cantidad>
      <precioUnitario>${parseFloat(item.precio_unitario).toFixed(2)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${precioTotalSinImpuesto}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>${tarifaIVA}</tarifa>
          <baseImponible>${precioTotalSinImpuesto}</baseImponible>
          <valor>${ivaItem}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join('');

  // 6. Armamos el XML completo
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
    <tipoIdentificacionComprador>${codigoTipoIdentificacion}</tipoIdentificacionComprador>
    <razonSocialComprador>${escaparXML(cliente.nombre_persona)}</razonSocialComprador>
    <identificacionComprador>${cliente.cedula || '9999999999999'}</identificacionComprador>
    <totalSinImpuestos>${totalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>${totalSinImpuestos.toFixed(2)}</baseImponible>
        <valor>${valorIVA.toFixed(2)}</valor>
      </totalImpuesto>
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
    valorIVA: valorIVA.toFixed(2),
    importeTotal: importeTotal.toFixed(2)
  };
}

// Escapa caracteres especiales que romperían el XML (&, <, >, etc.)
function escaparXML(texto) {
  if (!texto) return '';
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}