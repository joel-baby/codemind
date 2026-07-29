import mongoose from "mongoose";

export const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI as string;
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
};