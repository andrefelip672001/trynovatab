import pool from '../config/db.js';

export const listarClientes = async (req, res) => {
  const { tenant_id } = req.usuario;
  try {
    const result = await pool.query(
      `SELECT id, nombre, cedula_ruc, email, telefono, created_at
       FROM clientes WHERE tenant_id = $1 ORDER BY nombre ASC`,
      [tenant_id]
    );
    res.json({ status: 'ok', clientes: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', mensaje: err.message });
  }
};

export const buscarCliente = async (req, res) => {
  const { tenant_id } = req.usuario;
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ status: 'ok', clientes: [] });
  }
  try {
    const result = await pool.query(
      `SELECT id, nombre, cedula_ruc, email, telefono
       FROM clientes
       WHERE tenant_id = $1
         AND (nombre ILIKE $2 OR cedula_ruc ILIKE $2)
       ORDER BY nombre ASC LIMIT 10`,
      [tenant_id, `%${q.trim()}%`]
    );
    res.json({ status: 'ok', clientes: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', mensaje: err.message });
  }
};

export const crearCliente = async (req, res) => {
  const { tenant_id } = req.usuario;
  const { nombre, cedula_ruc, email, telefono } = req.body;
  if (!nombre || !cedula_ruc) {
    return res.status(400).json({ status: 'error', mensaje: 'Nombre y cédula/RUC son obligatorios' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO clientes (tenant_id, nombre, cedula_ruc, email, telefono)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, cedula_ruc)
       DO UPDATE SET nombre    = EXCLUDED.nombre,
                     email     = EXCLUDED.email,
                     telefono  = EXCLUDED.telefono,
                     updated_at = NOW()
       RETURNING *`,
      [tenant_id, nombre.trim(), cedula_ruc.trim(), email || null, telefono || null]
    );
    res.status(201).json({ status: 'ok', cliente: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', mensaje: err.message });
  }
};

export const actualizarCliente = async (req, res) => {
  const { tenant_id } = req.usuario;
  const { id } = req.params;
  const { nombre, cedula_ruc, email, telefono } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clientes
       SET nombre = $1, cedula_ruc = $2, email = $3, telefono = $4, updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [nombre, cedula_ruc, email || null, telefono || null, id, tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', mensaje: 'Cliente no encontrado' });
    }
    res.json({ status: 'ok', cliente: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', mensaje: err.message });
  }
};

export const eliminarCliente = async (req, res) => {
  const { tenant_id } = req.usuario;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM clientes WHERE id = $1 AND tenant_id = $2 RETURNING nombre`,
      [id, tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', mensaje: 'Cliente no encontrado' });
    }
    res.json({ status: 'ok', mensaje: `Cliente "${result.rows[0].nombre}" eliminado` });
  } catch (err) {
    res.status(500).json({ status: 'error', mensaje: err.message });
  }
};
