"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
interface ConversationDetail {
  id: string;
  [key: string]: any;
}

=======
>>>>>>> main
interface Reply {
  id: string;
  text: string;
  model: string;
  createdAt: string;
}

<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
export default function ConversationPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReply, setLoadingReply] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
=======
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
>>>>>>> main

  useEffect(() => {
    fetch(`/api/conversations/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setDetail(data);
        }
      })
      .catch((err) => setError(err.message));
<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具

    fetch(`/api/conversations/${params.id}/replies`)
      .then((res) => res.json())
      .then((data) => setReplies(data.replies || []))
      .catch(() => {});
  }, [params.id]);

  const generateReply = async () => {
    if (!detail) return;
    setLoadingReply(true);
=======
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
>>>>>>> main
    try {
      const res = await fetch(`/api/conversations/${params.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
        body: JSON.stringify({ messages: detail.data?.messages || [] }),
      });
      const data = await res.json();
      if (data.reply) {
        setReplies((r) => [...r, data.reply]);
      }
    } finally {
      setLoadingReply(false);
    }
  };

  const sendReply = async (reply: Reply) => {
    const content = window.prompt("Edit reply before sending", reply.text);
    if (content === null) return;
    setSendingId(reply.id);
    try {
      await fetch(`/api/conversations/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId: reply.id, content }),
      });
      alert("Sent");
    } finally {
      setSendingId(null);
    }
  };
=======
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

  async function sendReply(replyId: string) {
    setStatus("Sending...");
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId }),
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
      setTimeout(() => setStatus(null), 2000);
    }
  }
>>>>>>> main

  return (
    <main className="min-h-screen p-4 space-y-4">
      <Link href="/" className="text-blue-600 underline">
        Back
      </Link>
      {error && <p className="text-red-600">{error}</p>}
      {detail ? (
<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
        <>
          <h2 className="font-semibold">Conversation Detail</h2>
          <pre className="whitespace-pre-wrap text-sm border p-2 rounded">
            {JSON.stringify(detail, null, 2)}
          </pre>

          <button
            onClick={generateReply}
            className="px-3 py-1 rounded bg-blue-600 text-white"
            disabled={loadingReply}
          >
            {loadingReply ? "Generating..." : "Generate Reply"}
          </button>

          <h3 className="font-semibold">Replies</h3>
          <ul className="space-y-2">
            {replies.map((r) => (
              <li key={r.id} className="border p-2 rounded">
                <p className="whitespace-pre-wrap text-sm mb-2">{r.text}</p>
                <button
                  onClick={() => sendReply(r)}
                  className="text-blue-600 underline"
                  disabled={sendingId === r.id}
                >
                  {sendingId === r.id ? "Sending..." : "Send"}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Loading...</p>
      )}
=======
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
                onClick={() => sendReply(r.id)}
                className="rounded bg-green-600 px-2 py-1 text-white"
              >
                Send
              </button>
            </li>
          ))}
        </ul>
        {status && <p>{status}</p>}
      </section>
>>>>>>> main
    </main>
  );
}
