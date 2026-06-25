import { Router } from 'express';
import { abrirOrden, agregarItemOrden, verOrden, cerrarOrden, verOrdenPorMesa } from '../controllers/orderController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

const rolesPermitidos = verificarRol('admin_local', 'cajero', 'mesero');

router.post('/', verificarToken, rolesPermitidos, abrirOrden);

// IMPORTANTE: esta ruta específica debe ir ANTES que '/:order_id'
router.get('/por-mesa/:table_id', verificarToken, rolesPermitidos, verOrdenPorMesa);

router.get('/:order_id', verificarToken, rolesPermitidos, verOrden);
router.post('/:order_id/items', verificarToken, rolesPermitidos, agregarItemOrden);
router.put('/:order_id/cerrar', verificarToken, verificarRol('admin_local', 'cajero'), cerrarOrden);

export default router;