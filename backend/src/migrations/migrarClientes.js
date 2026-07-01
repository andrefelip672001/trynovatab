import pool from '../config/db.js';

async function migrar() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id  UUID NOT NULL REFERENCES tenants(id),
        nombre     VARCHAR(200) NOT NULL,
        cedula_ruc VARCHAR(13)  NOT NULL,
        email      VARCHAR(200),
        telefono   VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, cedula_ruc)
      )
    `);
    console.log('✅ Tabla clientes creada/verificada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  }
}

migrar();
