import { Router } from 'express';
import { obtenerDashboard } from '../controllers/statsController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/dashboard', verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), obtenerDashboard);

export default router;