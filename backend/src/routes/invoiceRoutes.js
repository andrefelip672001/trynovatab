import { Router } from 'express';
import { emitirFactura, listarFacturas, emitirFacturaDirecta, getRIDE, getTicket } from '../controllers/invoiceController.js';
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

router.get(
  '/:id/ride',
  verificarToken,
  verificarRol('admin_local', 'cajero'),
  getRIDE
);

router.get(
  '/:id/ticket',
  verificarToken,
  verificarRol('admin_local', 'cajero'),
  getTicket
);

export default router;
