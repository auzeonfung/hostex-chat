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
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [updates, setUpdates] = useState<Record<string, boolean>>({});

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

  function orderMessages(messages?: { created_at?: string }[]) {
    if (!Array.isArray(messages)) return messages;
    return [...messages].sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return ta - tb;
    });
  }

  async function fetchDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to load");
        setDetail(null);
      } else {
        const d = data.data ?? data;
        const ordered = orderMessages(d.messages);
        setDetail({ ...d, messages: ordered });
        if (ordered) {
          generateReply(ordered);
        }
        console.log('Loaded conversation detail', { id, messages: ordered?.length });
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

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const id = data.conversationId || data.conversation_id;
        if (!id) return;
        if (id === selectedId) {
          fetchDetail(id);
          console.log('SSE update for conversation', id, data);
        } else {
          setUpdates((u) => ({ ...u, [id]: true }));
        }
      } catch {
        // ignore JSON parse errors
      }
    };
    return () => {
      es.close();
    };
  }, [selectedId]);

  async function generateReply(msgs: { sender_role?: string; content: string }[]) {
    const settings = JSON.parse(localStorage.getItem("settings") || "{}");
    const apiKey = settings.apiKey;
    const model = settings.model || "gpt-3.5-turbo";
    const prompt = settings.prompt;
    const payload = msgs.map((m) => ({
      role: m.sender_role === "host" ? "assistant" : "user",
      content: m.content,
    }));
    if (prompt) {
      payload.unshift({ role: "system", content: prompt });
    }
    console.log('Generating reply for conversation', selectedId, 'with', msgs.length, 'messages');
    setGenerating(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, model, apiKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to generate");
      } else {
        setMessage(data.reply.text);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

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
        console.log('Message sent', { id: selectedId, content: message });
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
        <div className="p-4 border-b flex justify-between items-center">
          <h1 className="text-2xl font-bold">Hostex Chat</h1>
          <a href="/settings" className="text-blue-600 underline text-sm">Settings</a>
        </div>
        {error && <p className="p-4 text-red-600">{error}</p>}
        <ul className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                className={`w-full text-left rounded border p-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  selectedId === conv.id ? "bg-gray-100 dark:bg-gray-800" : "dark:bg-gray-700"
                } ${updates[conv.id] ? "border-blue-500" : ""}`}
                onClick={() => {
                  setSelectedId(conv.id);
                  setUpdates((u) => {
                    const { [conv.id]: _removed, ...rest } = u;
                    return rest;
                  });
                }}
              >
                <span className="flex items-center justify-between">
                  <span>{conv.subject || conv.id}</span>
                  {updates[conv.id] && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </span>
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
                            ? "bg-blue-500 text-white dark:bg-blue-600"
                            : "bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
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
              <div className="p-4 border-t dark:bg-gray-900">
                <div className="flex items-end space-x-2">
                  <input
                    className="flex-1 rounded border p-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Type a reply..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button
                    onClick={() => detail?.messages && generateReply(detail.messages)}
                    disabled={generating}
                    className="rounded bg-gray-600 px-3 py-1 text-white"
                  >
                    {generating ? '...' : 'AI'}
                  </button>
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
