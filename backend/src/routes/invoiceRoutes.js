import { Router } from 'express';
import { emitirFactura, listarFacturas, emitirFacturaDirecta } from '../controllers/invoiceController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

router.get(
  '/',
  verificarToken,
  verificarRol('admin_local', 'cajero'),
  listarFacturas
);

router.post(
  '/emitir',
  verificarToken,
  verificarRol('admin_local', 'cajero'),
  emitirFactura
);

router.post(
  '/emitir-directa',
  verificarToken,
  verificarRol('admin_local', 'cajero', 'mesero'),
  emitirFacturaDirecta
);

export default router;
