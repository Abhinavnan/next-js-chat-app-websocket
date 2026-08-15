import { Router } from 'express';
import { authMiddleware } from '@/lib/middleware/apiMiddleware';
import { updateUserContacts } from '@/lib/controllers/contactControllers';

const route = Router();
route.use(authMiddleware);
route.patch('/update-user-contacts', updateUserContacts);

export default route;