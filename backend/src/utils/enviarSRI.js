import axios from 'axios';

// Endpoints SRI — sólo cambia la URL para producción
const ENDPOINTS = {
  pruebas:    'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
  produccion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
};

/**
 * Envía un XML firmado al webservice SOAP de Recepción del SRI.
 *
 * @param {string} xmlFirmado  - XML firmado como string (UTF-8)
 * @param {'pruebas'|'produccion'} ambiente
 * @returns {Promise<{ estado: string, mensajes: Array<{ id, tipo, mensaje, info }> }>}
 * @throws  Error con mensaje descriptivo si la red o el SRI falla
 */
export async function enviarAlSRI(xmlFirmado, ambiente = 'pruebas') {
  const url = ENDPOINTS[ambiente];
  if (!url) throw new Error(`Ambiente inválido: "${ambiente}". Use "pruebas" o "produccion".`);

  // El SRI exige el XML en Base64 dentro del elemento <xml>
  const xmlBase64 = Buffer.from(xmlFirmado, 'utf-8').toString('base64');

  const soapBody = buildSoapEnvelope(xmlBase64);

  let respuestaRaw;
  try {
    const response = await axios.post(url, soapBody, {
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction':   '""',
      },
      timeout: 30_000, // 30 s — el SRI puede ser lento
    });
    respuestaRaw = response.data;
  } catch (err) {
    // axios lanza un error con response cuando el servidor responde con 4xx/5xx
    if (err.response) {
      throw new Error(
        `SRI respondió con HTTP ${err.response.status}: ${err.response.statusText}\n${err.response.data}`
      );
    }
    // Sin respuesta: timeout, DNS, SSL, etc.
    throw new Error(`Error de red al contactar el SRI: ${err.message}`);
  }

  return parseSoapResponse(respuestaRaw);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSoapEnvelope(xmlBase64) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope` +
    ` xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"` +
    ` xmlns:ec="http://ec.gob.sri.ws.recepcion">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>` +
        `<ec:validarComprobante>` +
          `<xml>${xmlBase64}</xml>` +
        `</ec:validarComprobante>` +
      `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

/**
 * Parsea la respuesta SOAP del SRI con expresiones regulares.
 * No se usa un parser XML para evitar dependencias extra.
 */
function parseSoapResponse(soapXml) {
  // Estado principal: RECIBIDA | DEVUELTA
  const estadoMatch = soapXml.match(/<estado>\s*([^<]+)\s*<\/estado>/i);
  const estado = estadoMatch ? estadoMatch[1].trim() : 'DESCONOCIDO';

  // La estructura SRI usa el mismo nombre para el contenedor y el campo de texto:
  //   <mensaje>                           ← contenedor
  //     <identificador>35</identificador>
  //     <mensaje>TEXTO DEL ERROR</mensaje> ← campo (solo texto)
  //     <tipo>ERROR</tipo>
  //     <informacionAdicional>...</informacionAdicional>
  //   </mensaje>
  // Usar [^<]* extrae solo los campos de texto plano sin confundir contenedor y campo.
  const bloque = soapXml;
  const ids    = matchAll(bloque, 'identificador', '[^<]*');
  const msgs   = matchAll(bloque, 'mensaje',        '[^<]*');
  const tipos  = matchAll(bloque, 'tipo',           '[^<]*');
  const infos  = matchAllMultiline(bloque, 'informacionAdicional');

  const mensajes = ids.map((id, i) => ({
    id,
    tipo:    tipos[i] ?? '',
    mensaje: msgs[i]  ?? '',
    info:    infos[i] ?? '',
  }));

  return { estado, mensajes };
}

function matchAll(str, tag, contentPattern) {
  const re = new RegExp(`<${tag}>(${contentPattern})</${tag}>`, 'gi');
  return [...str.matchAll(re)].map(m => m[1].trim());
}

function matchAllMultiline(str, tag) {
  const re = new RegExp(`<${tag}>([^]*?)</${tag}>`, 'gi');
  return [...str.matchAll(re)].map(m => m[1].trim());
}
