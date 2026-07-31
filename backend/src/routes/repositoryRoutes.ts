import { Router } from "express";
import { addRepository, getRepositories, deleteRepository } from "../controllers/repositoryController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/", protect, addRepository);
router.get("/", protect, getRepositories);
router.delete("/:id", protect, deleteRepository);

export default router;