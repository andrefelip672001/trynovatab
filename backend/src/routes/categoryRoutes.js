import { Router } from 'express';
import { crearCategoria, listarCategorias } from '../controllers/categoryController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), listarCategorias);
router.post('/', verificarToken, verificarRol('admin_local'), crearCategoria);

export default router;