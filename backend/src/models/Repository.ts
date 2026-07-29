import mongoose from "mongoose";

const repositorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    githubUrl: {
      type: String,
      required: true,
    },
    owner: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
    },
    fileCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

const Repository = mongoose.model("Repository", repositorySchema);

export default Repository;