import { Router } from 'express';
import { consultarContribuyente } from '../utils/consultarContribuyente.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:ruc', verificarToken, async (req, res) => {
  const { ruc } = req.params;
  const contribuyente = await consultarContribuyente(ruc);
  res.json({ status: 'ok', contribuyente });
});

export default router;
