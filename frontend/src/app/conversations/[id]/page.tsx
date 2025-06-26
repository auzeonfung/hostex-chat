"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ConversationDetail {
  id: string;
  [key: string]: any;
}

interface Reply {
  id: string;
  text: string;
  model: string;
  createdAt: string;
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReply, setLoadingReply] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

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

    fetch(`/api/conversations/${params.id}/replies`)
      .then((res) => res.json())
      .then((data) => setReplies(data.replies || []))
      .catch(() => {});
  }, [params.id]);

  const generateReply = async () => {
    if (!detail) return;
    setLoadingReply(true);
    try {
      const res = await fetch(`/api/conversations/${params.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <main className="min-h-screen p-4 space-y-4">
      <Link href="/" className="text-blue-600 underline">
        Back
      </Link>
      {error && <p className="text-red-600">{error}</p>}
      {detail ? (
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
    </main>
  );
}
