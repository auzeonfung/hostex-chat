'use client';

import type { Message } from '../types'

import { useCallback, useState } from 'react'
import { Button } from './ui/button'
import { Download, Clipboard, Loader2, AlertCircle } from 'lucide-react'

export default function MessageBubble({ message }: { message: Message }) {
  const isHost = message.sender_role === 'host'
  const [expanded, setExpanded] = useState(false)
  const MAX_CHARS = 400
  const content = message.content || ''
  const isLong = content.length > MAX_CHARS
  const displayed = !expanded && isLong ? content.slice(0, MAX_CHARS) + '…' : content

  const copyImage = useCallback(async (url: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const clipboard: any = (window as any).ClipboardItem
      if (navigator.clipboard && clipboard) {
        const item = new clipboard({ [blob.type]: blob })
        await (navigator as any).clipboard.write([item])
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
    } catch (err) {
      console.error('Failed to copy image', err)
    }
  }, [])

  const statusIcon = message.error ? (
    <AlertCircle className="w-4 h-4 text-red-500" />
  ) : message.pending ? (
    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
  ) : null

  return (
    <div className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
      <div className="flex items-end gap-1">
        {!isHost && statusIcon}
        <div
          className={`max-w-md rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${isHost ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-100'} ${message.error ? 'border border-red-500' : ''}`}
        >
        {message.display_type === 'FileAttachment' && message.attachment?.fullback_url ? (
          <div className="space-y-1">
            <img src={message.attachment.fullback_url} alt="attachment" className="max-w-full h-auto rounded" />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyImage(message.attachment!.fullback_url!)}
                aria-label="Copy to clipboard"
              >
                <Clipboard className="w-4 h-4" />
              </Button>
              <Button asChild variant="secondary" size="sm" aria-label="Download">
                <a href={message.attachment.fullback_url} download>
                  <Download className="w-4 h-4" />
                </a>
              </Button>
            </div>
            {content && (
              <div>
                {displayed}
                {isLong && (
                  <button
                    className="block text-xs underline text-blue-700 ml-1"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {displayed}
            {isLong && (
              <button
                className="block text-xs underline text-blue-700 ml-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}
        {message.created_at && (
          <div className="mt-1 text-xs opacity-70 text-right">
            {new Date(message.created_at).toLocaleString()}
          </div>
        )}
        </div>
        {isHost && statusIcon}
      </div>
    </div>
  )
}
