import forge from 'node-forge';
import { readFileSync } from 'fs';
import { C14nCanonicalization } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

const DS_NS    = 'http://www.w3.org/2000/09/xmldsig#';
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';

/**
 * Firma un comprobante XML con XAdES-BES para el SRI de Ecuador.
 * Usa C14N (xml-crypto) + RSA-SHA1 (node-forge).
 *
 * @param {string} xmlStr   - XML del comprobante (de generarFacturaXML)
 * @param {string} p12Path  - Ruta al archivo .p12
 * @param {string} p12Pass  - Contraseña del .p12
 * @returns {string} XML firmado con ds:Signature embebido
 */
export function firmarXML(xmlStr, p12Path, p12Pass) {
  const parser = new DOMParser();
  const c14n   = new C14nCanonicalization();

  // ── 1. Cargar P12 ──────────────────────────────────────────────────────────
  const p12Der = forge.util.createBuffer(readFileSync(p12Path).toString('binary'));
  const p12    = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), p12Pass);

  const privateKey = p12
    .getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    [forge.pki.oids.pkcs8ShroudedKeyBag][0].key;

  const cert = p12
    .getBags({ bagType: forge.pki.oids.certBag })
    [forge.pki.oids.certBag][0].cert;

  // ── 2. Datos del certificado ────────────────────────────────────────────────
  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64   = forge.util.encode64(certDerBytes);
  // SHA1 del DER del certificado (bytes binarios directos, sin re-encode)
  const certDigest64 = sha1b64bin(certDerBytes);
  const issuerName   = buildDN(cert.issuer.attributes);
  const serialDec    = BigInt('0x' + cert.serialNumber).toString();

  // ── 3. IDs de los nodos de firma ────────────────────────────────────────────
  const SIG_ID         = 'Signature';
  const SIGINFO_ID     = 'Signature-SignedInfo';
  const SIGVAL_ID      = 'SignatureValue';
  const KEYINFO_ID     = 'Certificate1';
  const OBJECT_ID      = 'Signature-Object';
  const SIGNEDPROPS_ID = 'Signature-SignedProperties';
  const DOC_REF_ID     = 'Reference-ID-comprobante';
  const PROPS_REF_ID   = 'Reference-ID-SignedProperties';

  // ── 4. Digest del documento: URI="" + enveloped-signature + C14N ───────────
  // La firma aún no está en el documento, así que enveloped-signature no elimina nada.
  // C14N del elemento raíz <factura id="comprobante">
  const xmlDoc      = parser.parseFromString(xmlStr, 'text/xml');
  const docC14n     = c14n.process(xmlDoc.documentElement, {});
  const docDigest64 = sha1b64utf8(docC14n);

  // ── 5. Construir SignedProperties con xmlns:ds y xmlns:xades explícitos ────
  // Test confirmado: standalone C14N con ambos ns declarados en el elemento
  // produce exactamente el mismo output que in-context C14N del verifier del SRI.
  const signingTime    = formatISO8601Ecuador(new Date());
  const signedPropsXML = buildSignedProperties({
    id: SIGNEDPROPS_ID,
    signingTime,
    certDigest64,
    issuerName,
    serialDec,
    docRefId: DOC_REF_ID,
  });

  const spDoc      = parser.parseFromString(signedPropsXML, 'text/xml');
  const spC14n     = c14n.process(spDoc.documentElement, {});
  const spDigest64 = sha1b64utf8(spC14n);

  // ── 6. Construir SignedInfo ────────────────────────────────────────────────
  const signedInfoXML = buildSignedInfo({
    id:            SIGINFO_ID,
    docRefId:      DOC_REF_ID,
    docDigest64,
    propsRefId:    PROPS_REF_ID,
    signedPropsId: SIGNEDPROPS_ID,
    spDigest64,
  });

  // ── 7. Firmar el SignedInfo canonicalizado ─────────────────────────────────
  // SignedInfo no lleva xmlns:ds propio; se pasa como ancestor para que C14N
  // lo incluya igual que lo haría el verifier del SRI en contexto de ds:Signature.
  const siDoc  = parser.parseFromString(signedInfoXML, 'text/xml');
  const siC14n = c14n.process(siDoc.documentElement, {
    ancestorNamespaces: [{ prefix: 'ds', namespaceURI: DS_NS }],
  });

  // SHA1 sobre bytes UTF-8 del C14N, luego firma RSA
  const md = forge.md.sha1.create();
  md.update(Buffer.from(siC14n, 'utf8').toString('binary'));
  const sigValueBase64 = forge.util.encode64(privateKey.sign(md));

  // ── 8. Ensamblar ds:Signature completo ────────────────────────────────────
  const signatureBlock = buildSignatureBlock({
    sigId:          SIG_ID,
    signedInfoXML,
    sigValId:       SIGVAL_ID,
    sigValueBase64,
    keyInfoId:      KEYINFO_ID,
    certBase64,
    objectId:       OBJECT_ID,
    signedPropsXML,
  });

  // ── 9. Inyectar antes del cierre del elemento raíz ─────────────────────────
  return injectSignature(xmlStr, signatureBlock);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-1 base64 sobre bytes binarios de forge (certDer). */
function sha1b64bin(binaryStr) {
  const md = forge.md.sha1.create();
  md.update(binaryStr);
  return forge.util.encode64(md.digest().getBytes());
}

/** SHA-1 base64 sobre una string UTF-8 (salida de C14N). */
function sha1b64utf8(str) {
  const md = forge.md.sha1.create();
  md.update(Buffer.from(str, 'utf8').toString('binary'));
  return forge.util.encode64(md.digest().getBytes());
}

/** Formato ISO 8601 con offset UTC-5 (Ecuador). */
function formatISO8601Ecuador(date) {
  const local = new Date(date.getTime() - 5 * 3600 * 1000);
  const p     = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}-05:00`
  );
}

/** Distinguished Name en el orden del certificado. */
function buildDN(attributes) {
  return attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
}

function buildSignedProperties({ id, signingTime, certDigest64, issuerName, serialDec, docRefId }) {
  // xmlns:ds y xmlns:xades se declaran aquí para que la C14N standalone
  // produzca el mismo resultado que la C14N in-context del verifier SRI.
  return (
    `<xades:SignedProperties` +
    ` xmlns:ds="${DS_NS}"` +
    ` xmlns:xades="${XADES_NS}"` +
    ` Id="${id}">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        `<xades:SigningCertificate>` +
          `<xades:Cert>` +
            `<xades:CertDigest>` +
              `<ds:DigestMethod Algorithm="${DS_NS}sha1"/>` +
              `<ds:DigestValue>${certDigest64}</ds:DigestValue>` +
            `</xades:CertDigest>` +
            `<xades:IssuerSerial>` +
              `<ds:X509IssuerName>${issuerName}</ds:X509IssuerName>` +
              `<ds:X509SerialNumber>${serialDec}</ds:X509SerialNumber>` +
            `</xades:IssuerSerial>` +
          `</xades:Cert>` +
        `</xades:SigningCertificate>` +
      `</xades:SignedSignatureProperties>` +
      `<xades:SignedDataObjectProperties>` +
        `<xades:DataObjectFormat ObjectReference="#${docRefId}">` +
          `<xades:MimeType>text/xml</xades:MimeType>` +
          `<xades:Encoding>UTF-8</xades:Encoding>` +
        `</xades:DataObjectFormat>` +
      `</xades:SignedDataObjectProperties>` +
    `</xades:SignedProperties>`
  );
}

function buildSignedInfo({ id, docRefId, docDigest64, propsRefId, signedPropsId, spDigest64 }) {
  return (
    `<ds:SignedInfo Id="${id}">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<ds:SignatureMethod Algorithm="${DS_NS}rsa-sha1"/>` +
      // Referencia 1: documento completo con enveloped-signature + C14N
      `<ds:Reference Id="${docRefId}" URI="#comprobante">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="${DS_NS}enveloped-signature"/>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="${DS_NS}sha1"/>` +
        `<ds:DigestValue>${docDigest64}</ds:DigestValue>` +
      `</ds:Reference>` +
      // Referencia 2: SignedProperties (XAdES)
      `<ds:Reference Id="${propsRefId}" URI="#${signedPropsId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="${DS_NS}sha1"/>` +
        `<ds:DigestValue>${spDigest64}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`
  );
}

function buildSignatureBlock({ sigId, signedInfoXML, sigValId, sigValueBase64, keyInfoId, certBase64, objectId, signedPropsXML }) {
  return (
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}">` +
      signedInfoXML +
      `<ds:SignatureValue Id="${sigValId}">${sigValueBase64}</ds:SignatureValue>` +
      `<ds:KeyInfo Id="${keyInfoId}">` +
        `<ds:X509Data>` +
          `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
        `</ds:X509Data>` +
      `</ds:KeyInfo>` +
      `<ds:Object Id="${objectId}">` +
        `<xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${sigId}">` +
          signedPropsXML +
        `</xades:QualifyingProperties>` +
      `</ds:Object>` +
    `</ds:Signature>`
  );
}

/** Inserta la firma justo antes del cierre del elemento raíz. */
function injectSignature(xmlStr, signatureBlock) {
  const closeTagMatch = xmlStr.match(/<\/(\w+)\s*>\s*$/);
  if (!closeTagMatch) {
    throw new Error('firmarXML: no se encontró la etiqueta de cierre del elemento raíz');
  }
  const closeTag = closeTagMatch[0].trimEnd();
  const insertAt = xmlStr.lastIndexOf(closeTag);
  return xmlStr.slice(0, insertAt) + signatureBlock + closeTag;
}
