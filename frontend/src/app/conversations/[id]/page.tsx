"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ConversationDetail {
  id: string;
  [key: string]: any;
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [params.id]);

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
    </main>
  );
}
