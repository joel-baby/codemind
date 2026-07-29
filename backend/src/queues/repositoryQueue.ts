import { Queue } from "bullmq";
import { connection } from "./connection";

export const repositoryQueue = new Queue("repository-processing", {
  connection,
});