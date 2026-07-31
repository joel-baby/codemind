import { Response } from "express";
import Groq from "groq-sdk";
import { AuthRequest } from "../middleware/authMiddleware";
import { searchCodeChunks } from "../utils/vectorSearch";
import Conversation from "../models/Conversation";
import Message from "../models/Message";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { repositoryId, conversationId, question } = req.body;

    if (!repositoryId || !question) {
      return res.status(400).json({ message: "repositoryId and question are required" });
    }

    // Find or create the conversation
    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : null;

    if (!conversation) {
      conversation = await Conversation.create({
        userId: req.userId,
        repositoryId,
        title: question.slice(0, 50),
      });
    }

    // Save the user's message
    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: question,
    });

    // Search for relevant code chunks
    const chunks = await searchCodeChunks(question, repositoryId, 5);

    const context = chunks
      .map(
        (c: any) =>
          `File: ${c.filePath} (lines ${c.startLine}-${c.endLine})\n${c.content}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are a helpful assistant that explains code from a specific repository.
Answer the user's question using ONLY the code context provided below.
If the context doesn't contain enough information to answer, say so honestly.
Always mention which file(s) your answer is based on.

Code context:
${context}`;

    // Set up streaming response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      stream: true,
    });

    let fullAnswer = "";

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      fullAnswer += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    // Save the assistant's full answer, with citations, once streaming is done
    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: fullAnswer,
      citations: chunks.map((c: any) => ({
        filePath: c.filePath,
        startLine: c.startLine,
        endLine: c.endLine,
      })),
    });

    res.write(
      `data: ${JSON.stringify({
        done: true,
        conversationId: conversation._id,
        citations: chunks.map((c: any) => ({
          filePath: c.filePath,
          startLine: c.startLine,
          endLine: c.endLine,
        })),
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    console.error("Chat error:", error);
    res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
    res.end();
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const { repositoryId } = req.params;
    const conversations = await Conversation.find({
      userId: req.userId,
      repositoryId,
    }).sort({ updatedAt: -1 });

    res.status(200).json({ conversations });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error });
  }
};