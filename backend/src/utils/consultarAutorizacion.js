import axios from 'axios';

const ENDPOINTS = {
  pruebas:    'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
  produccion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
};

/**
 * Consulta el estado de autorización de un comprobante en el SRI.
 *
 * @param {string} claveAcceso - Clave de acceso de 49 dígitos
 * @param {'pruebas'|'produccion'} ambiente
 * @returns {Promise<{
 *   autorizado: boolean,
 *   numeroAutorizacion: string,
 *   fechaAutorizacion: string,
 *   ambiente: string,
 *   estado: string,
 *   xml: string,
 *   mensajes: Array<{ id, tipo, mensaje, info }>
 * }>}
 */
export async function consultarAutorizacion(claveAcceso, ambiente = 'pruebas') {
  if (!claveAcceso || claveAcceso.length !== 49) {
    throw new Error(`Clave de acceso inválida: debe tener 49 dígitos (recibidos: ${claveAcceso?.length ?? 0})`);
  }

  const url = ENDPOINTS[ambiente];
  if (!url) throw new Error(`Ambiente inválido: "${ambiente}". Use "pruebas" o "produccion".`);

  let respuestaRaw;
  try {
    const response = await axios.post(url, buildSoapEnvelope(claveAcceso), {
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction':   '""',
      },
      timeout: 30_000,
    });
    respuestaRaw = response.data;
  } catch (err) {
    if (err.response) {
      throw new Error(
        `SRI respondió con HTTP ${err.response.status}: ${err.response.statusText}\n${err.response.data}`
      );
    }
    throw new Error(`Error de red al consultar autorización en el SRI: ${err.message}`);
  }

  return parseSoapResponse(respuestaRaw);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSoapEnvelope(claveAcceso) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope` +
    ` xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"` +
    ` xmlns:ec="http://ec.gob.sri.ws.autorizacion">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>` +
        `<ec:autorizacionComprobante>` +
          `<claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>` +
        `</ec:autorizacionComprobante>` +
      `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

function parseSoapResponse(soapXml) {
  // El bloque <autorizacion> contiene todos los datos que necesitamos
  const autorizacionBlock = extractTag(soapXml, 'autorizacion');

  if (!autorizacionBlock) {
    // El SRI a veces retorna la clave como no registrada fuera del bloque autorizacion
    return {
      autorizado:          false,
      numeroAutorizacion:  '',
      fechaAutorizacion:   '',
      ambiente:            '',
      estado:              'NO REGISTRADA',
      xml:                 '',
      mensajes:            [],
    };
  }

  const estado = extractTag(autorizacionBlock, 'estado') ?? '';

  // Extraer el XML autorizado (viene dentro de CDATA o texto plano)
  const xmlAutorizado = extractCdata(autorizacionBlock, 'comprobante')
                     ?? extractTag(autorizacionBlock, 'comprobante')
                     ?? '';

  // Mensajes de error o informativos
  const mensajes = parseMensajes(autorizacionBlock);

  return {
    autorizado:         estado === 'AUTORIZADO',
    numeroAutorizacion: extractTag(autorizacionBlock, 'numeroAutorizacion') ?? '',
    fechaAutorizacion:  extractTag(autorizacionBlock, 'fechaAutorizacion')  ?? '',
    ambiente:           extractTag(autorizacionBlock, 'ambiente')           ?? '',
    estado,
    xml:                xmlAutorizado,
    mensajes,
  };
}

function parseMensajes(xml) {
  // La estructura SRI tiene el mismo nombre para el contenedor y el campo de texto:
  //   <mensaje>          ← contenedor (tiene hijos)
  //     <identificador>35</identificador>
  //     <mensaje>TEXTO</mensaje>   ← campo (solo texto, sin hijos)
  //     <tipo>ERROR</tipo>
  //     <informacionAdicional>...</informacionAdicional>
  //   </mensaje>
  // Usar [^<]* para los campos de texto plano evita que el regex no-greedy
  // capture el contenedor en lugar del campo.
  const bloque = extractTag(xml, 'mensajes') ?? xml;

  const ids   = matchAll(bloque, 'identificador', '[^<]*');
  const msgs  = matchAll(bloque, 'mensaje',        '[^<]*');
  const tipos = matchAll(bloque, 'tipo',           '[^<]*');
  const infos = matchAllMultiline(bloque, 'informacionAdicional');

  return ids.map((id, i) => ({
    id,
    tipo:    tipos[i] ?? '',
    mensaje: msgs[i]  ?? '',
    info:    infos[i] ?? '',
  }));
}

function matchAll(str, tag, contentPattern) {
  const re = new RegExp(`<${tag}>(${contentPattern})</${tag}>`, 'gi');
  return [...str.matchAll(re)].map(m => m[1].trim());
}

function matchAllMultiline(str, tag) {
  const re = new RegExp(`<${tag}>([^]*?)</${tag}>`, 'gi');
  return [...str.matchAll(re)].map(m => m[1].trim());
}

/** Extrae el contenido de la primera ocurrencia de <tag>...</tag>. */
function extractTag(str, tag) {
  const m = str.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

/** Extrae el contenido de un elemento con CDATA: <tag><![CDATA[...]]></tag>. */
function extractCdata(str, tag) {
  const m = str.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}
