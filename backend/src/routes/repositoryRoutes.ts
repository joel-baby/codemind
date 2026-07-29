import { Router } from "express";
import { addRepository, getRepositories } from "../controllers/repositoryController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/", protect, addRepository);
router.get("/", protect, getRepositories);

export default router;