"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Conversation {
  id: string;
  [key: string]: any;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          const list = data.conversations || data.items || data;
          setConversations(Array.isArray(list) ? list : []);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen p-4">
      <h1 className="mb-4 text-2xl font-bold">Hostex Chat</h1>
      {error && <p className="text-red-600">{error}</p>}
      <ul className="space-y-2">
        {conversations.map((conv) => (
          <li key={conv.id} className="rounded border p-2 hover:bg-gray-50">
            <Link href={`/conversations/${conv.id}`}
              className="block">
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(conv, null, 2)}
              </pre>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
