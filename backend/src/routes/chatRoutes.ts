import { Router } from "express";
import { sendMessage, getConversations, getMessages } from "../controllers/chatController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/message", protect, sendMessage);
router.get("/conversations/:repositoryId", protect, getConversations);
router.get("/messages/:conversationId", protect, getMessages);

export default router;