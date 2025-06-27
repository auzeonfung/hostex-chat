'use client';

export interface Message {
  sender_role?: string;
  content: string;
  created_at?: string;
}

export default function MessageBubble({ message }: { message: Message }) {
  const isHost = message.sender_role === 'host';
  return (
    <div className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-md rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${isHost ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-100'}`}>
        {message.content}
        {message.created_at && (
          <div className="mt-1 text-xs opacity-70 text-right">
            {new Date(message.created_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
