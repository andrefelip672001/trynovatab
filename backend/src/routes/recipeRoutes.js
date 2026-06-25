import { Router } from 'express';
import { agregarIngrediente, verReceta } from '../controllers/recipeController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

const rolesPermitidos = verificarRol('admin_local', 'cajero', 'mesero');

router.get('/:product_id', verificarToken, rolesPermitidos, verReceta);
router.post('/:product_id', verificarToken, verificarRol('admin_local'), agregarIngrediente);

export default router;