"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Message {
  id: string;
  sender_role?: string;
  content: string;
  created_at?: string;
}

interface ConversationDetail {
  id: string;
  messages?: Message[];
  [key: string]: any;
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function generateReply(msgs: Message[]) {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    const apiKey = settings.apiKey;
    const model = settings.model || 'gpt-3.5-turbo';
    const prompt = settings.prompt;
    const payload = msgs.map((m) => ({
      role: m.sender_role === 'host' ? 'assistant' : 'user',
      content: m.content,
    }));
    if (prompt) {
      payload.unshift({ role: 'system', content: prompt });
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/conversations/${params.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload, model, apiKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to generate');
      } else {
        setMessage(data.reply.text);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function orderMessages(messages?: Message[]) {
    if (!Array.isArray(messages)) return messages;
    return [...messages].sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return ta - tb;
    });
  }

  async function fetchDetail() {
    try {
      const res = await fetch(`/api/conversations/${params.id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to load");
      } else {
        const d = data.data ?? data;
        const ordered = orderMessages(d.messages) as Message[] | undefined;
        setDetail({ ...d, messages: ordered });
        if (ordered) {
          generateReply(ordered);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const id = data.conversationId || data.conversation_id;
        if (id === params.id) {
          fetchDetail();
        }
      } catch {
        // ignore JSON parse errors
      }
    };
    return () => {
      es.close();
    };
  }, [params.id]);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to send");
      } else {
        setMessage("");
        await fetchDetail();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex flex-col h-screen">
      <div className="p-4 border-b flex justify-between items-center">
        <Link href="/" className="text-blue-600 underline">
          Back
        </Link>
        <a href="/settings" className="text-blue-600 underline text-sm">Settings</a>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
        {error && <p className="text-red-600">{error}</p>}
        {detail ? (
          detail.messages?.length ? (
            detail.messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.sender_role === "host" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs rounded p-2 text-sm whitespace-pre-wrap ${
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
            <p>No messages</p>
          )
        ) : (
          <p>Loading...</p>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t fixed bottom-0 left-0 right-0 bg-white">
        <div className="flex items-end space-x-2">
          <input
            className="flex-1 rounded border p-2"
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
            onClick={send}
            disabled={sending}
            className="rounded bg-blue-600 px-3 py-1 text-white"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
