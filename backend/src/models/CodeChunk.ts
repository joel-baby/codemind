import mongoose from "mongoose";

const codeChunkSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Repository",
    required: true,
  },
  filePath: { type: String, required: true },
  content: { type: String, required: true },
  startLine: { type: Number, required: true },
  endLine: { type: Number, required: true },
  type: { type: String, required: true },
  embedding: {
    type: [Number],
    required: true,
  },
});

const CodeChunk = mongoose.model("CodeChunk", codeChunkSchema);

export default CodeChunk;