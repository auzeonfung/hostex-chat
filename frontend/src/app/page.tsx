"use client";

import { useEffect, useState } from "react";

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
    <main className="min-h-screen flex divide-x">
      <aside className="w-1/3 max-w-sm p-4 space-y-2 overflow-y-auto">
        <h1 className="mb-4 text-2xl font-bold">Hostex Chat</h1>
        {error && <p className="text-red-600">{error}</p>}
        <ul className="space-y-2">
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
      <section className="flex-1 p-4 flex flex-col">
        {selectedId ? (
          loadingDetail ? (
            <p>Loading...</p>
          ) : detail ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {detail.messages ? (
                  detail.messages.map((m, idx) => (
                    <div key={idx} className="rounded border p-2">
                      <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                    </div>
                  ))
                ) : (
                  <pre className="whitespace-pre-wrap text-sm">
                    {JSON.stringify(detail, null, 2)}
                  </pre>
                )}
              </div>
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
            </>
          ) : (
            <p>No detail</p>
          )
        ) : (
          <p className="text-gray-500">Select a conversation</p>
        )}
      </section>
    </main>
  );
}
