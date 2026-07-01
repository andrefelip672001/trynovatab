import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

export const estadisticasGlobales = async (req, res) => {
  try {
    const [tenantsRes, facturasRes, ventasRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE activo = true)  AS tenants_activos,
          COUNT(*)                                 AS total_tenants
        FROM tenants
      `),
      pool.query(`SELECT COUNT(*) AS total_facturas FROM invoices`),
      pool.query(`
        SELECT COALESCE(SUM(oi.cantidad * oi.precio_unitario), 0) AS ventas_mes
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.abierto_en >= DATE_TRUNC('month', NOW())
      `),
    ]);

    res.json({
      status:          'ok',
      tenants_activos: parseInt(tenantsRes.rows[0].tenants_activos),
      total_tenants:   parseInt(tenantsRes.rows[0].total_tenants),
      total_facturas:  parseInt(facturasRes.rows[0].total_facturas),
      ventas_mes:      parseFloat(ventasRes.rows[0].ventas_mes).toFixed(2),
    });
  } catch (error) {
    console.error('superadmin stats:', error);
    res.status(500).json({ status: 'error', mensaje: error.message });
  }
};

export const listarTenants = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.nombre,
        t.ruc,
        COALESCE(t.plan, 'Básico')       AS plan,
        COALESCE(t.activo, true)         AS activo,
        t.created_at,
        COUNT(DISTINCT u.id)             AS total_usuarios,
        COUNT(DISTINCT p.id)             AS total_productos,
        COUNT(DISTINCT o.id) FILTER (
          WHERE o.abierto_en >= DATE_TRUNC('month', NOW())
        )                                AS total_ordenes_mes
      FROM tenants t
      LEFT JOIN users    u ON u.tenant_id = t.id AND u.activo = true
      LEFT JOIN products p ON p.tenant_id = t.id
      LEFT JOIN orders   o ON o.tenant_id = t.id
      GROUP BY t.id, t.nombre, t.ruc, t.plan, t.activo, t.created_at
      ORDER BY t.created_at DESC
    `);

    res.json({ status: 'ok', tenants: result.rows });
  } catch (error) {
    console.error('superadmin listarTenants:', error);
    res.status(500).json({ status: 'error', mensaje: error.message });
  }
};

export const crearTenant = async (req, res) => {
  const { nombre_local, ruc, direccion, email_admin, password_admin, plan } = req.body;

  if (!nombre_local || !ruc || !email_admin || !password_admin) {
    return res.status(400).json({
      status: 'error',
      mensaje: 'nombre_local, ruc, email_admin y password_admin son obligatorios',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenantRes = await client.query(
      `INSERT INTO tenants (nombre, ruc, direccion, plan, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [nombre_local, ruc, direccion || null, plan || 'Básico']
    );
    const tenant_id = tenantRes.rows[0].id;

    const hash = await bcrypt.hash(password_admin, 10);
    await client.query(
      `INSERT INTO users (tenant_id, nombre, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, 'admin_local', true)`,
      [tenant_id, `Admin ${nombre_local}`, email_admin, hash]
    );

    await client.query('COMMIT');
    res.status(201).json({
      status: 'ok',
      mensaje: `Local "${nombre_local}" creado exitosamente`,
      tenant_id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('superadmin crearTenant:', error);
    const unicidad = error.code === '23505';
    res.status(unicidad ? 409 : 500).json({
      status: 'error',
      mensaje: unicidad ? 'Ya existe un local con ese RUC o email' : error.message,
    });
  } finally {
    client.release();
  }
};

export const toggleTenant = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE tenants SET activo = NOT COALESCE(activo, true) WHERE id = $1
       RETURNING id, nombre, activo`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', mensaje: 'Local no encontrado' });
    }
    const { nombre, activo } = result.rows[0];
    res.json({
      status: 'ok',
      mensaje: `"${nombre}" ${activo ? 'activado' : 'desactivado'}`,
      activo,
    });
  } catch (error) {
    console.error('superadmin toggleTenant:', error);
    res.status(500).json({ status: 'error', mensaje: error.message });
  }
};
