import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';

const router : Router = Router();

router.post('/chat', chatController.chat.bind(chatController));

export default router;