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
      `http://localhost:5000/api/chat/conversations/${repositoryId}`,
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
      `http://localhost:5000/api/chat/messages/${id}`,
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
      const response = await fetch("http://localhost:5000/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repositoryId, conversationId, question }),
      });

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
    <div className="flex h-screen">
      <div className="w-64 border-r p-4 overflow-y-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-blue-600 text-sm mb-4 block"
        >
          ← Back to Dashboard
        </button>

        <button
          onClick={startNewChat}
          className="w-full bg-blue-600 text-white py-2 rounded mb-4 text-sm"
        >
          + New Chat
        </button>

        <p className="text-xs text-gray-400 uppercase mb-2">History</p>
        <div className="space-y-1">
          {conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => loadConversation(c._id)}
              className={`w-full text-left text-sm p-2 rounded truncate ${
                conversationId === c._id ? "bg-gray-200" : "hover:bg-gray-100"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 max-w-3xl mx-auto">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <p className="text-gray-500 text-center mt-10">
              Ask a question about this repository to get started.
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg max-w-[85%] ${
                msg.role === "user"
                  ? "bg-blue-600 text-white ml-auto"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content || "..."}</p>

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs space-y-1">
                  {msg.citations.map((c, j) => (
                    <p key={j} className="text-gray-600">
                      📄 {c.filePath} (lines {c.startLine}-{c.endLine})
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {limitError && (
          <p className="bg-red-100 text-red-600 text-sm p-2 rounded mb-2">
            {limitError}
          </p>
        )}

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this codebase..."
            className="flex-1 border p-2 rounded"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {streaming ? "Thinking..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
