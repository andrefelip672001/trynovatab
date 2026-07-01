import { Router } from 'express';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';
import {
  estadisticasGlobales,
  listarTenants,
  crearTenant,
  toggleTenant,
} from '../controllers/superadminController.js';

const router = Router();
const auth = [verificarToken, verificarRol('superadmin')];

router.get('/stats',              ...auth, estadisticasGlobales);
router.get('/tenants',            ...auth, listarTenants);
router.post('/tenants',           ...auth, crearTenant);
router.put('/tenants/:id/toggle', ...auth, toggleTenant);

export default router;
