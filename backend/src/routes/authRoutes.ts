import { Router } from "express";
import { signup, login } from "../controllers/authController";
import { protect, AuthRequest } from "../middleware/authMiddleware";
import { Response } from "express";
import User from "../models/User";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

router.get("/me", protect, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId).select("-password");
  res.status(200).json({ user });
});

export default router;