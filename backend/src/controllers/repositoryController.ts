import { Response } from "express";
import axios from "axios";
import Repository from "../models/Repository";
import { AuthRequest } from "../middleware/authMiddleware";
import { repositoryQueue } from "../queues/repositoryQueue";
import CodeChunk from "../models/CodeChunk";
import Conversation from "../models/Conversation";
import User from "../models/User";
import { PLAN_LIMITS } from "../config/plans";

export const addRepository = async (req: AuthRequest, res: Response) => {
  try {

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const limits = PLAN_LIMITS[user.plan as "free" | "pro"];
    const currentRepoCount = await Repository.countDocuments({ userId: req.userId });

    if (currentRepoCount >= limits.maxRepositories) {
      return res.status(403).json({
        message: `You've reached your plan's limit of ${limits.maxRepositories} repositories. Upgrade to add more.`,
      });
    }
    
    const { githubUrl } = req.body;

    if (!githubUrl) {
      return res.status(400).json({ message: "GitHub URL is required" });
    }

    // Extract owner and repo name from the URL
    // Example: https://github.com/facebook/react -> owner: facebook, name: react
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);

    if (!match) {
      return res.status(400).json({ message: "Invalid GitHub URL" });
    }

    const owner = match[1];
    const name = match[2].replace(".git", "");

    // Check the repo actually exists using GitHub's public API
    const githubResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${name}`
    );

    if (githubResponse.status !== 200) {
      return res.status(404).json({ message: "Repository not found" });
    }

    const repository = await Repository.create({
      userId: req.userId,
      githubUrl,
      owner,
      name,
      status: "pending",
    });

    await repositoryQueue.add("process-repository", {
      repositoryId: repository._id.toString(),
    });

    res.status(201).json({ repository });
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: "Repository not found or is private" });
    }
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
};

export const getRepositories = async (req: AuthRequest, res: Response) => {
  try {
    const repositories = await Repository.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ repositories });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

export const deleteRepository = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const repository = await Repository.findOne({ _id: id, userId: req.userId });
    if (!repository) {
      return res.status(404).json({ message: "Repository not found" });
    }

    await CodeChunk.deleteMany({ repositoryId: id });
    await Conversation.deleteMany({ repositoryId: id });
    await Repository.findByIdAndDelete(id);

    res.status(200).json({ message: "Repository deleted" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};