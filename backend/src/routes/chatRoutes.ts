import { Router } from "express";
import { sendMessage } from "../controllers/chatController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/message", protect, sendMessage);

export default router;