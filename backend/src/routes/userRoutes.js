import { Router } from 'express';
import { crearUsuario } from '../controllers/userController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

// Solo superadmin o admin_local pueden crear usuarios
router.post('/', verificarToken, verificarRol('superadmin', 'admin_local'), crearUsuario);

export default router;
