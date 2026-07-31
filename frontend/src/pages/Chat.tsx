import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

function Chat() {
  const { repositoryId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const question = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const response = await fetch("http://localhost:5000/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repositoryId,
          conversationId,
          question,
        }),
      });

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
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-blue-600 text-sm"
        >
          ← Back to Dashboard
        </button>
      </div>

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
  );
}

export default Chat;