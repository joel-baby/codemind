import mongoose from "mongoose";
import CodeChunk from "../models/CodeChunk";
import { generateEmbedding } from "./embeddings";

export async function searchCodeChunks(
  query: string,
  repositoryId: string,
  topK: number = 5
) {
  const queryEmbedding = await generateEmbedding(query);

  const results = await CodeChunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: topK,
        filter: {
          repositoryId: new mongoose.Types.ObjectId(repositoryId),
        },
      },
    },
    {
      $project: {
        content: 1,
        filePath: 1,
        startLine: 1,
        endLine: 1,
        type: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
}