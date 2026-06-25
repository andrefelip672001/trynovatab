import { Router } from 'express';
import { login, me } from '../controllers/authController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.get('/me', verificarToken, me);

export default router;