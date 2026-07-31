import { Worker } from "bullmq";
import axios from "axios";
import fs from "fs";
import path from "path";
import * as tar from "tar";
import dotenv from "dotenv";
import { connection } from "./connection";
import Repository from "../models/Repository";
import { connectDB } from "../config/db";
import { chunkFile } from "../utils/codeChunker";
import { generateEmbedding } from "../utils/embeddings";
import CodeChunk from "../models/CodeChunk";

dotenv.config();
connectDB();

const TEMP_DIR = path.join(__dirname, "..", "temp");

// File extensions we actually care about (skip images, fonts, lockfiles, etc.)
const CODE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rb",
  ".php", ".c", ".cpp", ".h", ".cs", ".rs", ".md",
];

// Folders we never want to look inside
const IGNORED_FOLDERS = [
  "node_modules", ".git", "dist", "build", "vendor", ".next", "coverage",
];

function getAllCodeFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_FOLDERS.includes(entry.name)) {
        getAllCodeFiles(fullPath, fileList);
      }
    } else {
      const ext = path.extname(entry.name);
      if (CODE_EXTENSIONS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

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

    const repoInfo = await axios.get(
      `https://api.github.com/repos/${repository.owner}/${repository.name}`
    );
    const defaultBranch = repoInfo.data.default_branch;

    const extractPath = path.join(TEMP_DIR, repositoryId);
    fs.mkdirSync(extractPath, { recursive: true });

    const tarballUrl = `https://codeload.github.com/${repository.owner}/${repository.name}/tar.gz/${defaultBranch}`;

    console.log("Downloading repository archive...");
    const response = await axios.get(tarballUrl, { responseType: "stream" });

    await new Promise((resolve, reject) => {
      response.data
        .pipe(tar.extract({ cwd: extractPath }))
        .on("finish", resolve)
        .on("error", reject);
    });

    console.log("Extraction complete. Scanning for code files...");

    const codeFiles = getAllCodeFiles(extractPath);
    console.log(`Found ${codeFiles.length} relevant code files`);

    if (codeFiles.length === 0) {
      fs.rmSync(extractPath, { recursive: true, force: true });
      repository.status = "failed";
      repository.errorMessage = "No supported code files found in this repository.";
      await repository.save();
      return { fileCount: 0 };
    }

    console.log("Chunking files...");
    let allChunks: ReturnType<typeof chunkFile> = [];

    for (const filePath of codeFiles) {
      const relativePath = path.relative(extractPath, filePath);
      const chunks = chunkFile(filePath).map((chunk) => ({
        ...chunk,
        filePath: relativePath, // store the clean relative path, not the temp folder path
      }));
      allChunks = allChunks.concat(chunks);
    }

    console.log(`Generated ${allChunks.length} total chunks`);

    // Clean up: delete the downloaded files now that we've extracted what we need
    fs.rmSync(extractPath, { recursive: true, force: true });

    console.log("Generating embeddings and saving to database...");

    // Delete any old chunks from a previous run of this repo, to avoid duplicates
    await CodeChunk.deleteMany({ repositoryId });

    const BATCH_SIZE = 20;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);

      const docsToInsert = await Promise.all(
        batch.map(async (chunk) => ({
          repositoryId,
          filePath: chunk.filePath.replace(/\\/g, "/"), // normalize Windows backslashes
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          type: chunk.type,
          embedding: await generateEmbedding(chunk.content),
        }))
      );

      await CodeChunk.insertMany(docsToInsert);
      console.log(`Embedded and saved ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length} chunks`);
    }

    console.log("All chunks embedded and saved.");

    repository.fileCount = codeFiles.length;
    repository.status = "ready";
    await repository.save();

    return { fileCount: codeFiles.length, chunkCount: allChunks.length };
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