import { pipeline } from "@huggingface/transformers";

let embedder: any = null;
let loadingPromise: Promise<any> | null = null;

async function getEmbedder() {
  if (embedder) return embedder;

  if (!loadingPromise) {
    console.log("Loading embedding model (first time only)...");
    loadingPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2").then(
      (model) => {
        embedder = model;
        console.log("Embedding model loaded.");
        return model;
      }
    );
  }

  return loadingPromise;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await getEmbedder();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}