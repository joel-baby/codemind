import { Worker } from "bullmq";
import axios from "axios";
import { connection } from "./connection";
import Repository from "../models/Repository";
import dotenv from "dotenv";
import { connectDB } from "../config/db";

dotenv.config();
connectDB();

const worker = new Worker(
  "repository-processing",
  async (job) => {
    const { repositoryId } = job.data;

    const repository = await Repository.findById(repositoryId);
    if (!repository) {
      throw new Error("Repository not found");
    }

    repository.status = "processing";
    await repository.save();

    console.log(`Processing repo: ${repository.owner}/${repository.name}`);

    // Step 1: Get the default branch name
    const repoInfo = await axios.get(
      `https://api.github.com/repos/${repository.owner}/${repository.name}`
    );
    const defaultBranch = repoInfo.data.default_branch;

    // Step 2: Get the full file tree of that branch
    const treeResponse = await axios.get(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${defaultBranch}?recursive=1`
    );

    const files = treeResponse.data.tree.filter(
      (item: any) => item.type === "blob"
    );

    console.log(`Found ${files.length} files in ${repository.owner}/${repository.name}`);

    repository.fileCount = files.length;
    repository.status = "ready";
    await repository.save();

    return { fileCount: files.length };
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);

  if (job) {
    const { repositoryId } = job.data;
    await Repository.findByIdAndUpdate(repositoryId, {
      status: "failed",
      errorMessage: err.message,
    });
  }
});

console.log("Repository worker started, waiting for jobs...");

export default worker;