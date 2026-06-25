import { Router } from 'express';
import { emitirFactura } from '../controllers/invoiceController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

router.post(
  '/emitir',
  verificarToken,
  verificarRol('admin_local', 'cajero'),
  emitirFactura
);

export default router;
