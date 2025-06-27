"use client";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import MessageBubble, { Message } from "@/components/MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send as SendIcon, FileText } from "lucide-react";

interface ChatMessage extends Message {
  id: string;
}

interface ConversationDetail {
  id: string;
  messages?: ChatMessage[];
  [key: string]: any;
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
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
    console.log('Generating reply for conversation', params.id, 'with', msgs.length, 'messages');
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
        console.log('Loaded conversation detail', { id: params.id, messages: ordered?.length });
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  async function openLogs() {
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/conversations/${params.id}/openai-logs`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

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
          console.log('SSE update for conversation', id, data);
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
        console.log('Message sent', { id: params.id, content: message });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header backHref="/" />
      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
            {error && <p className="text-red-600">{error}</p>}
            {detail ? (
              detail.messages?.length ? (
                detail.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))
              ) : (
                <p>No messages</p>
              )
            ) : (
              <p>Loading...</p>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t dark:bg-gray-900 sticky bottom-0">
            <div className="flex items-end space-x-2">
              <Textarea
                className="flex-1 resize-y min-h-[40px]"
                placeholder="Type a reply..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={1}
              />
              <Button
                onClick={() => detail?.messages && generateReply(detail.messages)}
                disabled={generating}
                variant="secondary"
                size="icon"
                aria-label="Generate"
              >
                {generating ? '...' : <Sparkles className="w-4 h-4" />}
              </Button>
              <Button
                onClick={openLogs}
                variant="secondary"
                size="icon"
                aria-label="Logs"
              >
                <FileText className="w-4 h-4" />
              </Button>
              <Button onClick={send} disabled={sending} size="icon" aria-label="Send">
                <SendIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        {detail && (
          <aside className="hidden w-60 shrink-0 border-l p-4 space-y-4 overflow-y-auto md:block">
            {detail.customer && (
              <div>
                <h2 className="font-semibold mb-1">Customer</h2>
                <div className="text-sm">{detail.customer.name || detail.customer.full_name}</div>
                <pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(detail.customer, null, 2)}</pre>
              </div>
            )}
            {detail.property && (
              <div>
                <h2 className="font-semibold mb-1">Property</h2>
                <div className="text-sm">{detail.property.name || detail.property.title}</div>
                <pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(detail.property, null, 2)}</pre>
              </div>
            )}
          </aside>
        )}
      </main>
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded max-h-[80vh] overflow-y-auto w-[90%] max-w-lg">
            <h2 className="text-lg font-semibold mb-2">OpenAI Logs</h2>
            {loadingLogs ? (
              <p>Loading...</p>
            ) : logs.length ? (
              logs.map((log) => (
                <pre key={log.id} className="mb-4 whitespace-pre-wrap text-xs border p-2 rounded">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              ))
            ) : (
              <p>No logs</p>
            )}
            <div className="text-right mt-2">
              <Button onClick={() => setShowLogs(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
