import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import billSplitRoutes from './routes/billSplitRoutes.js';
import { generarClaveAcceso } from './utils/claveAcceso.js';
import { generarFacturaXML } from './utils/generarFacturaXML.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import recipeRoutes from './routes/recipeRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import importRoutes        from './routes/importRoutes.js';
import superadminRoutes   from './routes/superadminRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


// Middlewares básicos - SIEMPRE primero, antes de cualquier ruta
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://trynovatab-bhvgnp5pj-andres-trujillo.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Rutas de la aplicación
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', billSplitRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/import',        importRoutes);
app.use('/api/superadmin',    superadminRoutes);


// Ruta de salud - para confirmar que el servidor está vivo
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Trynova Tab',
    version: '1.0.0'
  });
});

// Ruta de prueba - confirma que la conexión a la base de datos funciona
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as hora_actual');
    res.json({
      status: 'ok',
      mensaje: 'Conexión a la base de datos exitosa',
      hora_servidor_db: result.rows[0].hora_actual
    });
  } catch (error) {
    console.error('Error conectando a la BD:', error);
    res.status(500).json({
      status: 'error',
      mensaje: 'No se pudo conectar a la base de datos',
      detalle: error.message
    });
  }
});

// Ruta temporal de diagnóstico - ver qué tablas existen
app.get('/api/db-tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({
      status: 'ok',
      total_tablas: result.rows.length,
      tablas: result.rows.map(r => r.table_name)
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal de diagnóstico - ver columnas de una tabla
app.get('/api/db-columns/:tabla', async (req, res) => {
  try {
    const { tabla } = req.params;
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tabla]);
    res.json({
      status: 'ok',
      tabla,
      columnas: result.rows
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal - ver contenido de una tabla (BORRAR antes de producción)
app.get('/api/db-data/:tabla', async (req, res) => {
  try {
    const { tabla } = req.params;
    const tablasPermitidas = ['tenants', 'users', 'tables', 'orders', 'products', 'categories', 'order_items'];
    if (!tablasPermitidas.includes(tabla)) {
      return res.status(400).json({ status: 'error', mensaje: 'Tabla no permitida' });
    }
    const result = await pool.query(`SELECT * FROM ${tabla} LIMIT 20`);
    res.json({
      status: 'ok',
      tabla,
      total: result.rows.length,
      datos: result.rows
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Ruta temporal - borrar un registro por ID (BORRAR antes de producción)
app.delete('/api/db-data/:tabla/:id', async (req, res) => {
  try {
    const { tabla, id } = req.params;
    const tablasPermitidas = ['tenants', 'users', 'tables', 'orders', 'products', 'categories', 'order_items'];
    if (!tablasPermitidas.includes(tabla)) {
      return res.status(400).json({ status: 'error', mensaje: 'Tabla no permitida' });
    }
    const result = await pool.query(`DELETE FROM ${tabla} WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', mensaje: 'No se encontró el registro' });
    }
    res.json({ status: 'ok', mensaje: 'Registro eliminado', eliminado: result.rows[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal - ver detalle de constraints de una tabla
app.get('/api/db-constraints/:tabla', async (req, res) => {
  try {
    const { tabla } = req.params;
    const result = await pool.query(`
      SELECT con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS definicion
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = $1
    `, [tabla]);
    res.json({
      status: 'ok',
      tabla,
      constraints: result.rows
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal - ver longitudes máximas de columnas varchar
app.get('/api/db-lengths/:tabla', async (req, res) => {
  try {
    const { tabla } = req.params;
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tabla]);
    res.json({
      status: 'ok',
      tabla,
      columnas: result.rows
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal - ejecutar migración de columnas SRI (USAR UNA VEZ Y BORRAR)
app.post('/api/db-migrate-sri', async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS establecimiento VARCHAR(3) DEFAULT '001',
      ADD COLUMN IF NOT EXISTS punto_emision VARCHAR(3) DEFAULT '001',
      ADD COLUMN IF NOT EXISTS secuencial_actual INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ambiente_sri VARCHAR(1) DEFAULT '1',
      ADD COLUMN IF NOT EXISTS certificado_path TEXT,
      ADD COLUMN IF NOT EXISTS certificado_password TEXT
    `);
    res.json({
      status: 'ok',
      mensaje: 'Migración SRI ejecutada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal - probar el cálculo de clave de acceso
app.get('/api/test-clave-acceso', (req, res) => {
  try {
    const clave = generarClaveAcceso({
      fechaEmision: new Date(),
      tipoComprobante: '01',
      ruc: '1792146739001',
      ambiente: '1',
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: 1,
      tipoEmision: '1'
    });
    res.json({
      status: 'ok',
      clave_acceso: clave,
      longitud: clave.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});

// Ruta temporal - generar XML de prueba para un split existente
app.get('/api/test-generar-xml/:split_id', async (req, res) => {
  try {
    const { split_id } = req.params;

    // Traemos el split (la persona) con su orden y tenant
    const splitResult = await pool.query(
      `SELECT bs.*, o.tenant_id FROM bill_splits bs
       JOIN orders o ON bs.order_id = o.id
       WHERE bs.id = $1`,
      [split_id]
    );

    if (splitResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', mensaje: 'Split no encontrado' });
    }

    const cliente = splitResult.rows[0];

    // Traemos el tenant
    const tenantResult = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [cliente.tenant_id]
    );
    const tenant = tenantResult.rows[0];

    // Traemos los items asignados a este split
    const itemsResult = await pool.query(
      `SELECT bsi.cantidad, oi.nombre_producto, oi.precio_unitario
       FROM bill_split_items bsi
       JOIN order_items oi ON bsi.order_item_id = oi.id
       WHERE bsi.bill_split_id = $1`,
      [split_id]
    );

    // Usamos secuencial_actual + 1 como el número de esta factura
    const siguienteSecuencial = tenant.secuencial_actual + 1;

    const resultado = generarFacturaXML({
      tenant,
      cliente,
      items: itemsResult.rows,
      secuencial: siguienteSecuencial
    });

    res.json({
      status: 'ok',
      clave_acceso: resultado.claveAcceso,
      totales: {
        sin_impuestos: resultado.totalSinImpuestos,
        iva: resultado.valorIVA,
        total: resultado.importeTotal
      },
      xml: resultado.xml
    });

  } catch (error) {
    console.error('Error generando XML:', error);
    res.status(500).json({ status: 'error', detalle: error.message });
  }
});