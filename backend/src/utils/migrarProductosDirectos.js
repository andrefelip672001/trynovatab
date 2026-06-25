import pool from '../config/db.js';

async function migrar() {
  const client = await pool.connect();
  try {
    console.log('Ejecutando migración: productos directos...');

    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS codigo_barras    VARCHAR(100),
        ADD COLUMN IF NOT EXISTS es_directo       BOOLEAN       DEFAULT false,
        ADD COLUMN IF NOT EXISTS stock_directo    NUMERIC(10,3) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stock_minimo_directo NUMERIC(10,3) DEFAULT 0
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_codigo_barras
        ON products(codigo_barras) WHERE codigo_barras IS NOT NULL
    `);

    console.log('Migración completada.');

    const result = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);

    console.log('\nEstructura actual de la tabla products:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} default: ${col.column_default ?? 'null'}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

migrar().catch(err => {
  console.error('Error en migración:', err.message);
  process.exit(1);
});
