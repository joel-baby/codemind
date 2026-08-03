import dotenv from "dotenv";
dotenv.config();

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import repositoryRoutes from "./routes/repositoryRoutes";
import { connectDB } from "./config/db";
import chatRoutes from "./routes/chatRoutes";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/repositories", repositoryRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("CodeMind backend is running!");
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI as string;

connectDB()
  .then(() => {
    Sentry.setupExpressErrorHandler(app);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message);
  });
