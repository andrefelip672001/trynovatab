import { Router } from 'express';
import { obtenerDashboard, cierreCaja, cierreCajaPDF } from '../controllers/statsController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/dashboard',        verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), obtenerDashboard);
router.get('/cierre-caja',     verificarToken, verificarRol('admin_local', 'cajero'), cierreCaja);
router.get('/cierre-caja/pdf', verificarToken, verificarRol('admin_local', 'cajero'), cierreCajaPDF);

export default router;