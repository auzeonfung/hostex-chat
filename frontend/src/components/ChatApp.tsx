'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from './Header'
import ConversationItem from './ConversationItem'
import MessageBubble, { Message } from './MessageBubble'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Sparkles, Send as SendIcon, FileText } from 'lucide-react'

interface Conversation {
  id: string
  [key: string]: any
}

interface ConversationDetail {
  id: string
  messages?: (Message & { id?: string })[]
  [key: string]: any
}

export default function ChatApp() {
  const router = useRouter()
  const params = useParams()
  const routeId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(routeId)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [updates, setUpdates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setSelectedId(routeId ?? null)
  }, [routeId])

  useEffect(() => {
    setLoadingList(true)
    fetch('/api/conversations')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          const list =
            data.conversations ||
            data.items ||
            data.data?.conversations ||
            data.data?.items ||
            data.data ||
            data
          setConversations(Array.isArray(list) ? list : [])
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingList(false))
  }, [])

  const orderMessages = useCallback((messages?: Message[]) => {
    if (!Array.isArray(messages)) return messages
    return [...messages].sort((a, b) => {
      const ta = new Date((a as any).created_at ?? 0).getTime()
      const tb = new Date((b as any).created_at ?? 0).getTime()
      return ta - tb
    })
  }, [])

  const generateReply = useCallback(
    async (msgs: { sender_role?: string; content: string }[]) => {
      const settings = JSON.parse(localStorage.getItem('settings') || '{}')
      const apiKey = settings.apiKey
      const model = settings.model || 'gpt-3.5-turbo'
      const prompt = settings.prompt
      const payload = msgs.map((m) => ({
        role: m.sender_role === 'host' ? 'assistant' : 'user',
        content: m.content,
      }))
      if (prompt) {
        payload.unshift({ role: 'system', content: prompt })
      }
      console.log(
        'Generating reply for conversation',
        selectedId,
        'with',
        msgs.length,
        'messages'
      )
      setGenerating(true)
      try {
        const res = await fetch(`/api/conversations/${selectedId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: payload, model, apiKey }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error || 'Failed to generate')
        } else {
          setMessage(data.reply.text)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setGenerating(false)
      }
    },
    [selectedId]
  )

  const fetchDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/conversations/${id}`)
        const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load')
        setDetail(null)
      } else {
        const d = data.data ?? data

        const activity = Array.isArray(d.activities)
          ? d.activities.find((a: any) => a.property)
          : null

        const property = d.property || activity?.property || null
        const checkIn =
          d.check_in_date || activity?.check_in_date || null
        const checkOut =
          d.check_out_date || activity?.check_out_date || null

        const ordered = orderMessages(d.messages)

        setDetail({
          ...d,
          property,
          customer: d.customer || d.guest,
          check_in_date: checkIn,
          check_out_date: checkOut,
          messages: ordered,
        })

        if (ordered) {
          generateReply(ordered)
        }
        console.log('Loaded conversation detail', {
          id,
          messages: ordered?.length,
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingDetail(false)
    }
  },
    [orderMessages, generateReply]
  )

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, fetchDetail])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages?.length])

  useEffect(() => {
    // start websocket server and connect
    fetch('/api/events').catch(() => {})
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/events`)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string)
        const id = data.conversationId || data.conversation_id
        if (!id) return
        if (id === selectedId) {
          fetchDetail(id)
          console.log('WS update for conversation', id, data)
        } else {
          setUpdates((u) => ({ ...u, [id]: true }))
        }
      } catch {
        // ignore JSON parse errors
      }
    }
    return () => {
      ws.close()
    }
  }, [selectedId, fetchDetail])

  async function sendMessage() {
    if (!selectedId || !message.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${selectedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send')
      } else {
        setMessage('')
        await fetchDetail(selectedId)
        console.log('Message sent', { id: selectedId, content: message })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function openLogs() {
    if (!selectedId) return
    setShowLogs(true)
    setLoadingLogs(true)
    try {
      const res = await fetch(`/api/conversations/${selectedId}/openai-logs`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.logs)) {
        setLogs(data.logs)
      } else {
        setLogs([])
      }
    } catch {
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full h-full">
      <Header />
      <main className="flex flex-1 divide-x overflow-hidden h-full">
        <aside className="w-72 flex flex-col border-r overflow-hidden">
          {loadingList ? (
            <p className="p-4">Loading...</p>
          ) : error ? (
            <p className="p-4 text-red-600">{error}</p>
          ) : (
            <ul className="flex-1 overflow-y-auto p-4 space-y-2">
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  selected={selectedId === conv.id}
                  hasUpdate={updates[conv.id]}
                  onClick={() => {
                    router.push(`/chat/${conv.id}`)
                    setSelectedId(conv.id)
                    setUpdates((u) => {
                      const { [conv.id]: _removed, ...rest } = u
                      return rest
                    })
                  }}
                />
              ))}
            </ul>
          )}
        </aside>
        <section className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
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
                        <MessageBubble key={(m as any).id ?? idx} message={m} />
                      ))
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(detail, null, 2)}
                      </pre>
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
                      <Button onClick={sendMessage} disabled={sending} size="icon" aria-label="Send">
                        <SendIcon className="w-4 h-4" />
                      </Button>
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
                  {detail.check_in_date && detail.check_out_date && (
                    <div className="text-xs text-gray-500">
                      {detail.check_in_date} - {detail.check_out_date}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(detail.property, null, 2)}</pre>
                </div>
              )}
            </aside>
          )}
        </section>
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
  )
}

