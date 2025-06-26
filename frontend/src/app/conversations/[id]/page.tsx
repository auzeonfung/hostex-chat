"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Reply {
  id: string;
  text: string;
  model: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  [key: string]: any;
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [prompt, setPrompt] = useState<string>("Write a helpful reply.");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/conversations/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setDetail(data.data ?? data);
        }
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  useEffect(() => {
    fetch(`/api/conversations/${params.id}/replies`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setReplies(data.replies || []);
        }
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  async function generateReply() {
    setStatus("Generating...");
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${params.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to generate");
      } else if (data.reply) {
        setReplies([...replies, data.reply]);
        setPrompt("Write a helpful reply.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStatus(null);
    }
  }

  async function sendReply(reply: Reply) {
    const content = window.prompt("Edit reply before sending", reply.text);
    if (content === null) return;
    setStatus("Sending...");
    setSendingId(reply.id);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId: reply.id, content }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to send");
      } else {
        setStatus("Sent!");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingId(null);
      setTimeout(() => setStatus(null), 2000);
    }
  }

  return (
    <main className="min-h-screen p-4 space-y-4">
      <Link href="/" className="text-blue-600 underline">
        Back
      </Link>
      {error && <p className="text-red-600">{error}</p>}
      {detail ? (
        <pre className="whitespace-pre-wrap text-sm border p-2 rounded">
          {JSON.stringify(detail, null, 2)}
        </pre>
      ) : (
        <p>Loading...</p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">AI Replies</h2>
        <div className="space-y-2">
          <textarea
            className="w-full rounded border p-2"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            onClick={generateReply}
            className="rounded bg-blue-600 px-3 py-1 text-white"
          >
            Generate Reply
          </button>
        </div>
        <ul className="space-y-2">
          {replies.map((r) => (
            <li key={r.id} className="rounded border p-2">
              <p className="whitespace-pre-wrap text-sm mb-2">{r.text}</p>
              <button
                onClick={() => sendReply(r)}
                className="rounded bg-green-600 px-2 py-1 text-white"
                disabled={sendingId === r.id}
              >
                Send
              </button>
            </li>
          ))}
        </ul>
        {status && <p>{status}</p>}
      </section>
    </main>
  );
}
