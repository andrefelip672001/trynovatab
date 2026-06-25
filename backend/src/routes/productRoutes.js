import { Router } from 'express';
import { crearProducto, listarProductos, actualizarProducto, buscarProductos } from '../controllers/productController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router = Router();

// IMPORTANTE: /buscar debe ir antes de /:id para que Express no lo interprete como parámetro
router.get('/buscar', verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), buscarProductos);
router.get('/', verificarToken, verificarRol('admin_local', 'cajero', 'mesero'), listarProductos);
router.post('/', verificarToken, verificarRol('admin_local'), crearProducto);
router.put('/:id', verificarToken, verificarRol('admin_local'), actualizarProducto);

export default router;
