import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import fs from "fs";
import path from "path";

export interface CodeChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  type: string; // "function", "class", "file" (fallback)
}

// Node types we consider "meaningful" chunks, per language
const CHUNK_NODE_TYPES = [
  "function_declaration",
  "method_definition",
  "class_declaration",
  "arrow_function",
  "function_definition", // Python
];

function getParserForFile(filePath: string): Parser | null {
  const ext = path.extname(filePath);
  const parser = new Parser();

  if (ext === ".js" || ext === ".jsx") {
    parser.setLanguage(JavaScript);
  } else if (ext === ".ts") {
    parser.setLanguage(TypeScript.typescript);
  } else if (ext === ".tsx") {
    parser.setLanguage(TypeScript.tsx);
  } else if (ext === ".py") {
    parser.setLanguage(Python);
  } else {
    return null; // Unsupported language for parsing
  }

  return parser;
}

function chunkWithTreeSitter(
  content: string,
  filePath: string,
  parser: Parser
): CodeChunk[] {
  const tree = parser.parse(content);
  const chunks: CodeChunk[] = [];
  const lines = content.split("\n");

  function walk(node: Parser.SyntaxNode) {
    if (CHUNK_NODE_TYPES.includes(node.type)) {
      const startLine = node.startPosition.row;
      const endLine = node.endPosition.row;

      chunks.push({
        content: lines.slice(startLine, endLine + 1).join("\n"),
        filePath,
        startLine: startLine + 1,
        endLine: endLine + 1,
        type: node.type,
      });
      return; // Don't descend further into this node's children
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return chunks;
}

// Fallback for languages we haven't set up tree-sitter for yet:
// just split by fixed line count with overlap
function chunkByLines(
  content: string,
  filePath: string,
  linesPerChunk = 60,
  overlap = 10
): CodeChunk[] {
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];

  for (let i = 0; i < lines.length; i += linesPerChunk - overlap) {
    const chunkLines = lines.slice(i, i + linesPerChunk);
    if (chunkLines.length === 0) break;

    chunks.push({
      content: chunkLines.join("\n"),
      filePath,
      startLine: i + 1,
      endLine: i + chunkLines.length,
      type: "file",
    });

    if (i + linesPerChunk >= lines.length) break;
  }

  return chunks;
}

export function chunkFile(filePath: string): CodeChunk[] {
  const content = fs.readFileSync(filePath, "utf-8");

  // Skip empty or huge files (avoid processing junk or bloated generated files)
  if (!content.trim() || content.length > 200_000) {
    return [];
  }

  const parser = getParserForFile(filePath);

  if (parser) {
    const chunks = chunkWithTreeSitter(content, filePath, parser);
    // If tree-sitter found no functions/classes (e.g. a config file), fall back
    if (chunks.length > 0) return chunks;
  }

  return chunkByLines(content, filePath);
}