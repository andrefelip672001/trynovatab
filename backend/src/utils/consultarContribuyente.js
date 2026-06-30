import axios from 'axios';

export async function consultarContribuyente(ruc) {
  try {
    const url = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumeroruc?numeroRuc=${ruc}`;
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    if (!data || (!data.nombreComercial && !data.razonSocial)) {
      return null;
    }

    return {
      razon_social:      data.razonSocial      || data.nombreComercial || null,
      nombre_comercial:  data.nombreComercial   || null,
      direccion:         data.calles            || null,
      telefono:          data.telefonos?.[0]?.numero || null,
      email:             data.correos?.[0]?.correo   || null,
      estado:            data.estadoContribuyenteRuc  || null,
    };
  } catch (error) {
    console.error('Error consultando SRI contribuyente:', error.message);
    return null;
  }
}
