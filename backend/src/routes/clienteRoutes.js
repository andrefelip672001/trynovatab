import { Router } from 'express';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';
import {
  listarClientes,
  buscarCliente,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} from '../controllers/clienteController.js';

const router = Router();
const auth = [verificarToken, verificarRol('admin_local', 'cajero', 'mesero')];

router.get('/',        ...auth, listarClientes);
router.get('/buscar',  ...auth, buscarCliente);
router.post('/',       ...auth, crearCliente);
router.put('/:id',     ...auth, actualizarCliente);
router.delete('/:id',  ...auth, eliminarCliente);

export default router;
