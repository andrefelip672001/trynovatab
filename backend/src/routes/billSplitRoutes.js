import { Router } from 'express';
import {
  crearSplit,
  listarSplits,
  asignarItemASplit,
  verSplit,
  verResumenOrden
} from '../controllers/billSplitController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

const rolesPermitidos = verificarRol('admin_local', 'cajero', 'mesero');

// Rutas anidadas bajo una orden: /api/orders/:order_id/splits
router.post('/orders/:order_id/splits', verificarToken, rolesPermitidos, crearSplit);
router.get('/orders/:order_id/splits', verificarToken, rolesPermitidos, listarSplits);
router.get('/orders/:order_id/resumen', verificarToken, rolesPermitidos, verResumenOrden);

// Rutas sobre un split específico: /api/splits/:split_id
router.get('/splits/:split_id', verificarToken, rolesPermitidos, verSplit);
router.post('/splits/:split_id/items', verificarToken, rolesPermitidos, asignarItemASplit);

export default router;