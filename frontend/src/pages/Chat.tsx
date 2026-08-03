import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuthStore } from "../store/authStore";

interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface ConversationSummary {
  _id: string;
  title: string;
  updatedAt: string;
}

function Chat() {
  const { repositoryId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [limitError, setLimitError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/chat/conversations/${repositoryId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setConversations(response.data.conversations);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setLimitError("");
  };

  const loadConversation = async (id: string) => {
    setConversationId(id);
    setLimitError("");
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL}/api/chat/messages/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    setMessages(response.data.messages);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const question = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setStreaming(true);
    setLimitError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/chat/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ repositoryId, conversationId, question }),
        },
      );

      if (response.status === 403) {
        const data = await response.json();
        setLimitError(data.message);
        setMessages((prev) => prev.slice(0, -2)); // remove the empty user+assistant messages we optimistically added
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.replace("data: ", ""));

          if (data.token) {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + data.token,
              };
              return updated;
            });
          }

          if (data.done) {
            setConversationId(data.conversationId);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                citations: data.citations,
              };
              return updated;
            });
            fetchConversations();
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-screen bg-ink">
      <div className="w-60 border-r border-border p-4 overflow-y-auto flex flex-col">
        <button
          onClick={() => navigate("/dashboard")}
          className="font-mono text-xs text-text-muted hover:text-accent mb-6 text-left transition-colors"
        >
          ← Dashboard
        </button>

        <button
          onClick={startNewChat}
          className="w-full bg-accent text-ink font-mono text-xs font-semibold py-2 rounded mb-6 hover:opacity-90 transition-opacity"
        >
          + New chat
        </button>

        <p className="text-xs font-mono text-text-muted uppercase tracking-wide mb-2">
          History
        </p>
        <div className="space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => loadConversation(c._id)}
              className={`w-full text-left text-xs font-mono p-2 rounded truncate transition-colors ${
                conversationId === c._id
                  ? "bg-ink-raised text-text border border-border"
                  : "text-text-muted hover:bg-ink-raised"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 max-w-3xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-8 text-center mt-10">
              <p className="text-text-muted font-mono text-sm">
                Ask a question about this repository to get started.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${
                msg.role === "user" ? "ml-auto max-w-[75%]" : "max-w-[85%]"
              }`}
            >
              <div
                className={`px-4 py-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-accent text-ink font-medium"
                    : "bg-ink-raised border border-border"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">
                  {msg.content || "..."}
                </p>
              </div>

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.citations.map((c, j) => (
                    <div
                      key={j}
                      className="font-mono text-xs bg-amber-dim border border-amber/20 rounded px-3 py-1.5 text-amber"
                    >
                      @@ {c.filePath} lines {c.startLine}-{c.endLine} @@
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {limitError && (
          <div className="bg-danger-dim border border-danger/30 text-danger text-sm px-3 py-2 rounded mb-2 font-mono">
            {limitError}
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this codebase..."
            className="flex-1 bg-ink-raised border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming}
            className="bg-accent text-ink font-mono text-sm font-semibold px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {streaming ? "Thinking..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
