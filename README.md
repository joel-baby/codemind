# CodeMind

**Chat with any GitHub repository in plain English — grounded in the actual code, with exact file and line citations.**

🔗 **Live app:** [codemind-thefirst.vercel.app](https://codemind-thefirst.vercel.app/)
📦 **Source:** [github.com/joel-baby/codemind](https://github.com/joel-baby/codemind)

> Note: the backend runs on Render's free tier, which spins down after 15 minutes of inactivity. The first request after a period of inactivity may take 30–60 seconds to respond while it wakes up.

---

## What it does

Paste a public GitHub repo URL, and CodeMind:

1. Downloads and parses the codebase using **tree-sitter** (real AST-based parsing — functions and classes, not blind text splitting)
2. Generates embeddings for every meaningful code chunk, locally, for free, using `all-MiniLM-L6-v2`
3. Stores them in **MongoDB Atlas Vector Search**
4. Lets you ask natural-language questions about the codebase, answered via **RAG** (retrieval-augmented generation) — grounded only in the actual retrieved code, with the AI's answer streamed live and every claim backed by a citation showing the exact file and line range it came from

It's built to feel like a real product: authentication, usage limits tied to a plan system, conversation history, graceful error handling, and a multi-provider LLM fallback — not just a working demo.

---

## Why I built it this way

Most "chat with your docs" portfolio projects wrap an LLM API around plain text chunking. CodeMind is aimed specifically at *developers reading code*, so the whole pipeline is built around that:

- **AST-based chunking**, not fixed-line splitting — a function or class is retrieved whole, not cut mid-body
- **Citations styled like Git diff hunks** (`@@ file.js lines 60-73 @@`) — the UI's visual language matches what the product actually does
- **Background job processing** (BullMQ + Redis) so a large repo doesn't block the API while it's being parsed and embedded
- **A Groq → Gemini fallback** — if the primary LLM provider fails or hits a rate limit, the app automatically retries with a different provider mid-stream, invisibly to the user

---

## Tech stack

**Frontend**
React · TypeScript · Vite · Tailwind CSS v4 · Zustand · React Router · Axios

**Backend**
Node.js · Express · TypeScript · MongoDB Atlas (+ Vector Search) · BullMQ · Redis (Upstash)

**AI / RAG**
Tree-sitter (AST code parsing) · `@huggingface/transformers` (local embeddings, `all-MiniLM-L6-v2`) · Groq (primary LLM, Llama 3.3 70B) · Gemini (fallback LLM)

**DevOps**
Docker · Docker Compose · GitHub Actions (CI: lint + build on every push) · Render (backend + worker) · Vercel (frontend) · Sentry (error tracking)

---

## Architecture

```
User (Browser)
    │
    ▼
React Frontend (Vercel)
    │
    ▼
Express API (Render) ──────► BullMQ Queue (Redis)
    │                              │
    │                              ▼
    │                       Background Worker (Render)
    │                       • Downloads repo archive
    │                       • Parses code with tree-sitter
    │                       • Generates embeddings locally
    │                       • Stores chunks + vectors
    │                              │
    ▼                              ▼
MongoDB Atlas (users, repos, conversations, code chunks + vector index)
    │
    ▼
On a chat message: vector search retrieves relevant chunks
    → sent to Groq (fallback: Gemini) with the question
    → answer streamed back to the frontend token-by-token
    → citations (file + line range) attached to the response
```

---

## Core features

- **Auth** — JWT-based signup/login, protected routes, bcrypt password hashing
- **Repo ingestion** — paste a GitHub URL, background-processed with live status updates (pending → processing → ready)
- **RAG-based chat** — streamed responses grounded in retrieved code, with source citations
- **Conversation history** — multiple saved conversations per repository
- **Plan-based usage limits** — free vs. pro tiers gating repository count and daily message limits (demo toggle included, no real billing)
- **Graceful failure handling** — invalid URLs, private repos, empty search results, and processing failures all surface clear, honest messages instead of silent failures
- **LLM provider fallback** — automatic failover from Groq to Gemini if the primary provider errors out
- **Light/dark theme toggle**

---

## Running it locally

```bash
# Backend
cd backend
npm install
npm run dev        # API server
npm run worker      # background worker (separate terminal)

# Frontend
cd frontend
npm install
npm run dev
```

You'll need your own MongoDB Atlas cluster (with a vector search index), a Redis instance (e.g. Upstash), and free API keys for Groq and Gemini. See `.env.example` in `backend/` for the required environment variables.

---

## What I'd improve with more time

- Move embedding generation to a dedicated worker with more CPU — free-tier hosting genuinely struggles with CPU-bound embedding generation on larger repositories (100+ files)
- Add automated tests to the CI pipeline (currently lint + build only)
- Expand tree-sitter language support beyond JS/TS/Python (Java, Go, Rust)
- Real billing integration instead of the demo plan toggle

---

## License

Personal portfolio project — feel free to explore the code.