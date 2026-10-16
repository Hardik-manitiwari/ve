import express from 'express';
import { getMethods, getOptions } from '../controllers/payoutController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/methods', getMethods);
router.get('/options/:method', getOptions);

export default router;
