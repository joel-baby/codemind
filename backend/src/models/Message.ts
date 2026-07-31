import mongoose from "mongoose";

const citationSchema = new mongoose.Schema(
  {
    filePath: String,
    startLine: Number,
    endLine: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    citations: [citationSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);