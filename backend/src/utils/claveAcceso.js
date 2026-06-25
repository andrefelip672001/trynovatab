// Calcula el dígito verificador usando el algoritmo Módulo 11 (exigido por el SRI)
function calcularDigitoVerificador(claveAcceso48) {
  const factores = [2, 3, 4, 5, 6, 7];
  let suma = 0;
  let factorIndex = 0;

  // Se recorre la clave de derecha a izquierda, multiplicando cada dígito
  // por un factor que cicla entre 2 y 7
  for (let i = claveAcceso48.length - 1; i >= 0; i--) {
    const digito = parseInt(claveAcceso48[i]);
    suma += digito * factores[factorIndex];
    factorIndex = (factorIndex + 1) % factores.length;
  }

  const residuo = suma % 11;
  let digitoVerificador = 11 - residuo;

  // Casos especiales que exige la norma del SRI
  if (digitoVerificador === 11) digitoVerificador = 0;
  if (digitoVerificador === 10) digitoVerificador = 1;

  return digitoVerificador.toString();
}

// Construye la clave de acceso completa de 49 dígitos (48 + verificador)
export function generarClaveAcceso({
  fechaEmision,      // Date object
  tipoComprobante,   // ej: '01' para factura
  ruc,               // RUC del emisor, 13 dígitos
  ambiente,          // '1' pruebas, '2' producción
  establecimiento,   // 3 dígitos, ej: '001'
  puntoEmision,      // 3 dígitos, ej: '001'
  secuencial,        // 9 dígitos, ej: '000000001'
  tipoEmision        // '1' = normal
}) {
  // 1. Fecha en formato ddmmaaaa
  const dia = String(fechaEmision.getDate()).padStart(2, '0');
  const mes = String(fechaEmision.getMonth() + 1).padStart(2, '0');
  const anio = fechaEmision.getFullYear();
  const fechaStr = `${dia}${mes}${anio}`;

  // 2. Código numérico aleatorio de 8 dígitos
  const codigoNumerico = Math.floor(10000000 + Math.random() * 90000000).toString();

  // 3. Serie = establecimiento (3) + puntoEmision (3) = 6 dígitos
  const serie = `${establecimiento}${puntoEmision}`;

  // 4. Secuencial debe tener 9 dígitos, rellenado con ceros a la izquierda
  const secuencialStr = String(secuencial).padStart(9, '0');

  // 5. Concatenamos todo en el orden exacto que exige el SRI (48 caracteres)
  const clave48 = `${fechaStr}${tipoComprobante}${ruc}${ambiente}${serie}${secuencialStr}${codigoNumerico}${tipoEmision}`;

  if (clave48.length !== 48) {
    throw new Error(`La clave de acceso debe tener 48 dígitos antes del verificador, tiene ${clave48.length}`);
  }

  // 6. Calculamos y agregamos el dígito verificador
  const digitoVerificador = calcularDigitoVerificador(clave48);

  return `${clave48}${digitoVerificador}`;
}
