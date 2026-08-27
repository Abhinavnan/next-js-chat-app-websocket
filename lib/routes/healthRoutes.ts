import { Router } from 'express';
import { checkHealth, getAnalytics } from '@/lib/controllers/healthController.js';
import { authMiddleware } from '@/lib/middleware/apiMiddleware.js';

const route = Router();
route.get('/', checkHealth);
route.use(authMiddleware);
route.get('/analytics', getAnalytics);

export default route;