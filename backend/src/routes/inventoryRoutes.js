import { Router } from 'express';
import { crearInsumo, listarInsumos, listarStockBajo } from '../controllers/inventoryController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

const rolesPermitidos = verificarRol('admin_local', 'cajero', 'mesero');

router.get('/', verificarToken, rolesPermitidos, listarInsumos);
router.get('/stock-bajo', verificarToken, rolesPermitidos, listarStockBajo);
router.post('/', verificarToken, verificarRol('admin_local'), crearInsumo);

export default router;