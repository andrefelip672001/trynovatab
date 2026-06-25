    import { Router } from 'express';
import { crearMesa, listarMesas, actualizarMesa } from '../controllers/tableController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

// Ver mesas: cualquier rol del local (admin, cajero, mesero)
router.get('/', verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), listarMesas);

// Crear mesas: solo admin_local (configuración del local)
router.post('/', verificarToken, verificarRol('admin_local'), crearMesa);

// Actualizar mesa: admin_local, cajero y mesero (cambiar estado libre/ocupada es operativo diario)
router.put('/:id', verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), actualizarMesa);

export default router;