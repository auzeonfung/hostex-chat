'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from './Header'
import ConversationItem from './ConversationItem'
import MessageBubble, { Message } from './MessageBubble'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Separator } from './ui/separator'
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
  const [readState, setReadState] = useState<Record<string, boolean>>({})
  const [config, setConfig] = useState<any>(null)
  const readRef = useRef(readState)
  const updateServerRead = useCallback(async (id: string, val: boolean) => {
    try {
      await fetch('/api/read-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id, read: val }),
      })
    } catch {}
  }, [])
  useEffect(() => {
    readRef.current = readState
  }, [readState])
  const updatesRef = useRef(updates)
  useEffect(() => {
    updatesRef.current = updates
  }, [updates])

  useEffect(() => {
    setSelectedId(routeId ?? null)
  }, [routeId])

  useEffect(() => {
    const id = localStorage.getItem('activeSettingId')
    if (id) {
      fetch(`/api/settings/${id}`)
        .then((res) => res.json())
        .then((d) => setConfig(d.setting))
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const theme = config?.data?.theme || 'system'
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [config])

  // readState is initialized from the server response when loading
  // conversations. Local updates are kept in memory and persisted via
  // `/api/read-state` so the state is shared across devices.

  useEffect(() => {
    async function load() {
      setLoadingList(true)
      try {
        const res = await fetch('/api/conversations')
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error || 'Failed to load')
          return
        }
        const list =
          data.conversations ||
          data.items ||
          data.data?.conversations ||
          data.data?.items ||
          data.data ||
          data

        setConversations((prev) => {
          const oldMap = Object.fromEntries(prev.map((c) => [c.id, c]))
          const newReads = { ...readRef.current }
          const newUpdates = { ...updatesRef.current }
          const arr = Array.isArray(list) ? list : []
          arr.forEach((conv: any) => {
            if (typeof conv.isRead === 'boolean') {
              newReads[conv.id] = conv.isRead
            }
            const old = oldMap[conv.id]
            const newLast = (conv.last_message || conv.lastMessage || {}).created_at
            const oldLast = old ? (old.last_message || old.lastMessage || {}).created_at : undefined
            if (!old) {
              newUpdates[conv.id] = true
            } else if (newLast && oldLast && new Date(newLast).getTime() > new Date(oldLast).getTime()) {
              if (conv.id !== selectedId) {
                newReads[conv.id] = false
                newUpdates[conv.id] = true
              }
            }
          })
          arr.sort((a: any, b: any) => {
            const ta = new Date((a.last_message || a.lastMessage || {}).created_at || 0).getTime()
            const tb = new Date((b.last_message || b.lastMessage || {}).created_at || 0).getTime()
            return tb - ta
          })
          setReadState(newReads)
          setUpdates(newUpdates)
          return arr
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoadingList(false)
      }
    }

    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
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
      const settings = config?.data || {}
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

        setReadState((r) => ({ ...r, [id]: true }))
        updateServerRead(id, true)

        if (ordered && config?.data?.autoReply) {
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
          setReadState((r) => ({ ...r, [id]: true }))
          updateServerRead(id, true)
          console.log('WS update for conversation', id, data)
        } else {
          setUpdates((u) => ({ ...u, [id]: true }))
          setReadState((r) => ({ ...r, [id]: false }))
          updateServerRead(id, false)
        }
      } catch {
        // ignore JSON parse errors
      }
    }
    return () => {
      ws.close()
    }
  }, [selectedId, fetchDetail])

  useEffect(() => {
    fetch('/api/read-state-events').catch(() => {})
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/read-state-events`)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string)
        const id = data.conversationId
        if (!id) return
        setReadState((r) => ({ ...r, [id]: !!data.read }))
        if (data.read) {
          setUpdates((u) => {
            const { [id]: _removed, ...rest } = u
            return rest
          })
        } else {
          setUpdates((u) => ({ ...u, [id]: true }))
        }
      } catch {}
    }
    return () => {
      ws.close()
    }
  }, [])

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
      <main className="flex flex-1 overflow-hidden h-full">
        <aside
          className="w-72 flex flex-col overflow-hidden resize-x"
          style={{ minWidth: '200px', maxWidth: '600px' }}
        >
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
                  unread={!readState[conv.id]}
                  onClick={() => {
                    router.push(`/chat/${conv.id}`)
                    setSelectedId(conv.id)
                    setReadState((r) => ({ ...r, [conv.id]: true }))
                    updateServerRead(conv.id, true)
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
        <Separator orientation="vertical" />
        <section className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedId ? (
              detail ? (
                <div className="relative flex-1 flex flex-col overflow-hidden">
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
                  <div className="p-4 border-t dark:bg-gray-900 sticky bottom-0 resize-y overflow-auto" style={{ minHeight: '60px' }}>
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
                  {loadingDetail && (
                    <div className="absolute top-2 right-2 text-xs text-gray-500">
                      Loading...
                    </div>
                  )}
                </div>
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
            <>
              <Separator orientation="vertical" />
              <aside
                className="hidden w-60 shrink-0 p-4 space-y-4 overflow-y-auto md:block resize-x"
                style={{ minWidth: '180px', maxWidth: '400px' }}
              >
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
            </>
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

