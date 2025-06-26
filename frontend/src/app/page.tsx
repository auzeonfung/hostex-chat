"use client";

import { useEffect, useRef, useState } from "react";

interface Conversation {
  id: string;
  [key: string]: any;
}

interface ConversationDetail {
  id: string;
  messages?: { content: string; [key: string]: any }[];
  [key: string]: any;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          const list =
            data.conversations ||
            data.items ||
            data.data?.conversations ||
            data.data?.items ||
            data.data ||
            data;
          setConversations(Array.isArray(list) ? list : []);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  async function fetchDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to load");
        setDetail(null);
      } else {
        setDetail(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  async function sendMessage() {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to send");
      } else {
        setMessage("");
        await fetchDetail(selectedId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="h-screen flex divide-x">
      <aside className="w-72 flex flex-col border-r">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold">Hostex Chat</h1>
        </div>
        {error && <p className="p-4 text-red-600">{error}</p>}
        <ul className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                className={`w-full text-left rounded border p-2 hover:bg-gray-50 ${
                  selectedId === conv.id ? "bg-gray-100" : ""
                }`}
                onClick={() => setSelectedId(conv.id)}
              >
                {conv.subject || conv.id}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex-1 flex flex-col">
        {selectedId ? (
          loadingDetail ? (
            <p className="p-4">Loading...</p>
          ) : detail ? (
            <>
              <div className="p-4 border-b font-semibold">
                {detail.subject || detail.id}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {detail.messages ? (
                  detail.messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        m.sender_role === "host" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-md rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.sender_role === "host"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                ) : (
                  <pre className="whitespace-pre-wrap text-sm">
                    {JSON.stringify(detail, null, 2)}
                  </pre>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 border-t">
                <div className="flex items-end space-x-2">
                  <input
                    className="flex-1 rounded border p-2"
                    placeholder="Type a reply..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending}
                    className="rounded bg-blue-600 px-3 py-1 text-white"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="p-4">No detail</p>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation
          </div>
        )}
      </section>
    </main>
  );
}
