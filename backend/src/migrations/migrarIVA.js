import pool from '../config/db.js';

async function migrar() {
  await pool.query(
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS tiene_iva BOOLEAN DEFAULT true`
  );
  console.log('OK: columna tiene_iva agregada a products (default true)');
  await pool.end();
}

migrar().catch(err => { console.error('Error en migración:', err.message); process.exit(1); });
