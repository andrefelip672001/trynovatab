import { Router } from 'express';
import { crearTenant, listarTenants } from '../controllers/tenantController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

// Todas las rutas de tenants requieren ser superadmin
router.post('/', verificarToken, verificarRol('superadmin'), crearTenant);
router.get('/', verificarToken, verificarRol('superadmin'), listarTenants);

export default router;
