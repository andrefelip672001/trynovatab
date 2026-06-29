import XLSX from 'xlsx';
import pool from '../config/db.js';

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes';
}

export const descargarPlantilla = (req, res) => {
  const wb = XLSX.utils.book_new();
  const data = [
    ['nombre', 'precio', 'categoria', 'codigo_barras', 'tiene_iva', 'es_directo', 'stock_directo', 'stock_minimo_directo'],
    ['Mojito Clásico', 7.00, 'Cócteles', '', true, false, 0, 0],
    ['Cerveza Club', 2.35, 'Cervezas', '7500001', true, true, 48, 12],
    ['Agua sin gas', 1.00, 'Bebidas', '7501059211401', false, true, 24, 6],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-productos.xlsx"');
  res.send(buf);
};

export const importarProductos = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', mensaje: 'No se recibió ningún archivo' });
  }

  const tenant_id = req.usuario.tenant_id;
  let creados = 0, actualizados = 0;
  const errores = [];

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ status: 'error', mensaje: 'El archivo está vacío o no tiene filas de datos' });
    }

    for (let i = 0; i < rows.length; i++) {
      const fila = i + 2; // +2 porque fila 1 es cabecera
      const row  = rows[i];

      const nombre = String(row.nombre || '').trim();
      const precio = parseFloat(row.precio);

      if (!nombre) {
        errores.push(`Fila ${fila}: nombre vacío, omitida`);
        continue;
      }
      if (isNaN(precio) || precio < 0) {
        errores.push(`Fila ${fila} (${nombre}): precio inválido`);
        continue;
      }

      const tieneIVA      = row.tiene_iva  !== '' ? parseBool(row.tiene_iva)  : true;
      const esDirecto     = row.es_directo !== '' ? parseBool(row.es_directo) : false;
      const stockDirecto  = parseInt(row.stock_directo)          || 0;
      const stockMin      = parseInt(row.stock_minimo_directo)   || 0;
      const codigoBarras  = String(row.codigo_barras || '').trim() || null;
      const nombreCat     = String(row.categoria     || '').trim();

      try {
        // Buscar o crear categoría
        let category_id = null;
        if (nombreCat) {
          const catRes = await pool.query(
            'SELECT id FROM categories WHERE LOWER(nombre) = LOWER($1) AND tenant_id = $2',
            [nombreCat, tenant_id]
          );
          if (catRes.rows.length > 0) {
            category_id = catRes.rows[0].id;
          } else {
            const newCat = await pool.query(
              'INSERT INTO categories (tenant_id, nombre) VALUES ($1, $2) RETURNING id',
              [tenant_id, nombreCat]
            );
            category_id = newCat.rows[0].id;
          }
        }

        // Upsert producto (buscar por nombre exacto case-insensitive)
        const existing = await pool.query(
          'SELECT id FROM products WHERE LOWER(nombre) = LOWER($1) AND tenant_id = $2',
          [nombre, tenant_id]
        );

        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE products
             SET precio = $1, category_id = $2, codigo_barras = $3,
                 tiene_iva = $4, es_directo = $5,
                 stock_directo = $6, stock_minimo_directo = $7,
                 updated_at = NOW()
             WHERE id = $8`,
            [precio, category_id, codigoBarras, tieneIVA, esDirecto, stockDirecto, stockMin, existing.rows[0].id]
          );
          actualizados++;
        } else {
          await pool.query(
            `INSERT INTO products
               (tenant_id, nombre, precio, category_id, codigo_barras,
                tiene_iva, es_directo, stock_directo, stock_minimo_directo, activo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
            [tenant_id, nombre, precio, category_id, codigoBarras, tieneIVA, esDirecto, stockDirecto, stockMin]
          );
          creados++;
        }
      } catch (rowErr) {
        errores.push(`Fila ${fila} (${nombre}): ${rowErr.message}`);
      }
    }

    res.json({ status: 'ok', creados, actualizados, errores });
  } catch (err) {
    console.error('Error importando productos:', err);
    res.status(500).json({ status: 'error', mensaje: 'Error procesando archivo: ' + err.message });
  }
};
