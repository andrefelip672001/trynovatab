import { Router } from 'express';
import multer from 'multer';
import { importarProductos, descargarPlantilla } from '../controllers/importController.js';
import { verificarToken, verificarRol } from '../middleware/authMiddleware.js';

const router  = Router();
const upload  = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB máx
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Solo se aceptan archivos .xlsx, .xls o .csv'), ok);
  }
});

router.get(  '/plantilla',  verificarToken, verificarRol('admin_local'), descargarPlantilla);
router.post( '/productos',  verificarToken, verificarRol('admin_local'), upload.single('archivo'), importarProductos);

export default router;
