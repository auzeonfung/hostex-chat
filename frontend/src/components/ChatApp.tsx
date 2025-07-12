'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '@/lib/useTheme'
import { useRouter, useParams } from 'next/navigation'
import Header from './Header'
import ConversationItem from './ConversationItem'
import MessageBubble from './MessageBubble'
import type { Message, Conversation, ConversationDetail, OpenAILog, Setting } from '@/types'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Separator } from './ui/separator'
import { Sparkles, Send as SendIcon, FileText } from 'lucide-react'


const backend = process.env.NEXT_PUBLIC_BACKEND_URL || ''

async function safeJSON(res: Response) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
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
  const [logs, setLogs] = useState<OpenAILog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [updates, setUpdates] = useState<Record<string, boolean>>({})
  const [readState, setReadState] = useState<Record<string, boolean>>({})
  const [pendingMap, setPendingMap] = useState<Record<string, { id: string; content: string; created_at: string }[]>>({})
  const [config, setConfig] = useState<Setting | null>(null)
  const [sortDesc, setSortDesc] = useState(true)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isLoadingReadState, setIsLoadingReadState] = useState(true)

  // load persisted filter settings
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('chatFilters')
      if (saved) {
        const f = JSON.parse(saved)
        if (typeof f.showUnreadOnly === 'boolean') setShowUnreadOnly(f.showUnreadOnly)
        if (typeof f.sortDesc === 'boolean') setSortDesc(f.sortDesc)
      }
    } catch {}
  }, [])

  // persist filter settings
  useEffect(() => {
    try {
      sessionStorage.setItem('chatFilters', JSON.stringify({ showUnreadOnly, sortDesc }))
    } catch {}
  }, [showUnreadOnly, sortDesc])
  const readRef = useRef(readState)
  const pendingRef = useRef(pendingMap)
  const updateServerRead = useCallback(async (id: string, val: boolean) => {
    try {
      await fetch(`${backend}/api/read-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id, read: val }),
      })
    } catch {}
  }, [])

  const updateReadState = useCallback((id: string, read: boolean) => {
    setReadState((prev) => {
      const next = { ...prev, [id]: read }
      readRef.current = next
      return next
    })
  }, [])
  useEffect(() => {
    readRef.current = readState
  }, [readState])
  useEffect(() => {
    pendingRef.current = pendingMap
  }, [pendingMap])
  const updatesRef = useRef(updates)
  useEffect(() => {
    updatesRef.current = updates
  }, [updates])

  // readState is initialized from the server so that refreshing the page keeps
  // read/unread status in sync across devices. We delay rendering until the
  // initial state is fetched to avoid conversations flashing as unread.
  useEffect(() => {
    async function loadReads() {
      setIsLoadingReadState(true)
      try {
        const res = await fetch(`${backend}/api/read-state`)
        const data = await safeJSON(res)
        if (res.ok && data.readState) {
          setReadState(data.readState)
        }
      } catch {
        // ignore failures
      } finally {
        setIsLoadingReadState(false)
      }
    }
    loadReads()
  }, [])

  useEffect(() => {
    setSelectedId(routeId ?? null)
  }, [routeId])

  useEffect(() => {
    const id = localStorage.getItem('activeSettingId')
    if (id) {
      fetch(`/api/settings/${id}`)
        .then((res) => safeJSON(res))
        .then((d) => setConfig(d.setting))
        .catch(() => {})
    }
  }, [])

  useTheme(config?.data?.theme || 'system')

  useEffect(() => {
    if (config && config.pollInterval === 0 && config.data?.pollOnRefresh) {
      fetch('/api/poll-now', { method: 'POST' }).catch(() => {})
    }
  }, [config])

  // readState is initialized from the server response when loading
  // conversations. Local updates are kept in memory and persisted via
  // `/api/read-state` so the state is shared across devices.

  const loadConversations = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch(`${backend}/api/conversations`)
      const data = await safeJSON(res)
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
        arr.forEach((conv: Conversation) => {
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
        arr.sort((a: Conversation, b: Conversation) => {
          const ta = new Date((a.last_message || a.lastMessage || {}).created_at || 0).getTime()
          const tb = new Date((b.last_message || b.lastMessage || {}).created_at || 0).getTime()
          return tb - ta
        })
        setReadState(newReads)
        setUpdates(newUpdates)
        return arr
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingList(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadConversations()
    const id = setInterval(loadConversations, 30000)
    return () => clearInterval(id)
  }, [loadConversations])

  const orderMessages = useCallback((messages?: Message[]) => {
    if (!Array.isArray(messages)) return messages
    return [...messages].sort((a, b) => {
      const ta = new Date((a as Message).created_at ?? 0).getTime()
      const tb = new Date((b as Message).created_at ?? 0).getTime()
      return ta - tb
    })
  }, [])

  const mergePending = useCallback(
    (id: string, msgs: Message[] = []) => {
      const pend = pendingRef.current[id] || []
      const serverMsgs = [...msgs]
      const remaining: typeof pend = []
      for (const p of pend) {
        const match = serverMsgs.find(
          (m) =>
            m.sender_role === 'host' &&
            m.content === p.content &&
            new Date(m.created_at || 0).getTime() >= new Date(p.created_at).getTime()
        )
        if (!match) {
          remaining.push(p)
          serverMsgs.push({
            id: p.id,
            local_id: p.id,
            sender_role: 'host',
            content: p.content,
            created_at: p.created_at,
            pending: true,
          })
        }
      }
      if (remaining.length !== pend.length) {
        setPendingMap((prev) => ({ ...prev, [id]: remaining }))
      }
      return orderMessages(serverMsgs)
    },
    [orderMessages]
  )

  const generateReply = useCallback(
    async (msgs: { sender_role?: string; content: string }[]) => {
      const settings = config?.data || {}
      const apiKey = settings.apiKey
      const endpoint = settings.endpoint || 'https://api.openai.com/v1'
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
          body: JSON.stringify({ messages: payload, model, apiKey, endpoint }),
        })
        const data = await safeJSON(res)
        if (!res.ok || data.error) {
          setError(data.error || 'Failed to generate')
        } else {
          setMessage(data.reply.text)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setGenerating(false)
      }
    },
    [selectedId, config]
  )

  const fetchDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true)
      try {
        const res = await fetch(`${backend}/api/conversations/${id}`)
        const data = await safeJSON(res)
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load')
        setDetail(null)
      } else {
        const d = data.data ?? data

        const activity = Array.isArray(d.activities)
          ? d.activities.find(
              (a: { property?: unknown; check_in_date?: string; check_out_date?: string }) =>
                !!a.property
            )
          : null

        const property = d.property || activity?.property || null
        const checkIn =
          d.check_in_date || activity?.check_in_date || null
        const checkOut =
          d.check_out_date || activity?.check_out_date || null

        const ordered = orderMessages(d.messages)
        const merged = mergePending(id, ordered || [])

        setDetail({
          ...d,
          property,
          customer: d.customer || d.guest,
          check_in_date: checkIn,
          check_out_date: checkOut,
          messages: merged,
        })

        const last = merged && merged[merged.length - 1]
        setConversations((prev) => {
          const others = prev.filter((c) => c.id !== id)
          const conv = { id, ...d, last_message: last }
          return [conv, ...others].sort((a, b) => {
            const ta = new Date((a.last_message || a.lastMessage || {}).created_at || 0).getTime()
            const tb = new Date((b.last_message || b.lastMessage || {}).created_at || 0).getTime()
            return tb - ta
          })
        })

        updateReadState(id, true)
        updateServerRead(id, true)

        if (ordered && config?.data?.autoReply) {
          generateReply(ordered)
        }
        console.log('Loaded conversation detail', {
          id,
          messages: ordered?.length,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
  }, [selectedId, fetchDetail, loadConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages?.length])

  useEffect(() => {
    // start websocket server and connect
    let ws: WebSocket | null = null
    let delay = 1000
    let stopped = false

    const proto = backend.startsWith('https')
      ? 'wss'
      : backend.startsWith('http')
      ? 'ws'
      : window.location.protocol === 'https:'
      ? 'wss'
      : 'ws'
    const host = backend ? backend.replace(/^https?:\/\//, '') : window.location.host

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string)
        const id = data.conversationId || data.conversation_id
        if (!id) return
        if (id === selectedId) {
          fetchDetail(id)
          updateReadState(id, true)
          updateServerRead(id, true)
          console.log('WS update for conversation', id, data)
        } else {
          setUpdates((u) => ({ ...u, [id]: true }))
          updateReadState(id, false)
          updateServerRead(id, false)
          loadConversations()
        }
      } catch {
        // ignore JSON parse errors
      }
    }

    const connect = () => {
      if (stopped) return
      fetch(`${backend}/api/events`).catch(() => {})
      ws = new WebSocket(`${proto}://${host}/api/events`)
      ws.onopen = () => {
        delay = 1000
      }
      ws.onmessage = handleMessage
      const reconnect = () => {
        if (stopped) return
        try {
          ws?.close()
        } catch {}
        setTimeout(connect, delay)
        delay = Math.min(delay * 2, 30000)
      }
      ws.onerror = reconnect
      ws.onclose = reconnect
    }

    connect()

    return () => {
      stopped = true
      if (ws) ws.close()
    }
  }, [selectedId, fetchDetail])

  // the backend broadcasts updates via WebSocket so no need for SSE

  async function sendMessage() {
    if (!selectedId || !message.trim()) return
    setSending(true)
    const localId = 'local-' + Math.random().toString(36).slice(2)
    const ts = new Date().toISOString()
    const pendingMsg: Message = {
      id: localId,
      local_id: localId,
      sender_role: 'host',
      content: message,
      created_at: ts,
      pending: true,
    }
    setPendingMap((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), { id: localId, content: message, created_at: ts }],
    }))
    setDetail((d) =>
      d ? { ...d, messages: mergePending(selectedId, [...(d.messages || []), pendingMsg]) } : d
    )
    setConversations((prev) => {
      const others = prev.filter((c) => c.id !== selectedId)
      const conv = prev.find((c) => c.id === selectedId) || { id: selectedId } as any
      const updated = { ...conv, last_message: pendingMsg }
      return [updated, ...others].sort((a, b) => {
        const ta = new Date((a.last_message || a.lastMessage || {}).created_at || 0).getTime()
        const tb = new Date((b.last_message || b.lastMessage || {}).created_at || 0).getTime()
        return tb - ta
      })
    })
    setMessage('')
    updateReadState(selectedId, true)
    updateServerRead(selectedId, true)
    try {
      const res = await fetch(`/api/conversations/${selectedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      })
      const data = await safeJSON(res)
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send')
        setDetail((d) => {
          if (!d) return d
          return {
            ...d,
            messages: (d.messages || []).map((m) =>
              m.id === localId ? { ...m, pending: false, error: true } : m
            ),
          }
        })
        setPendingMap((prev) => ({
          ...prev,
          [selectedId]: (prev[selectedId] || []).filter((p) => p.id !== localId),
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDetail((d) => {
        if (!d) return d
        return {
          ...d,
          messages: (d.messages || []).map((m) =>
            m.id === localId ? { ...m, pending: false, error: true } : m
          ),
        }
      })
      setPendingMap((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).filter((p) => p.id !== localId),
      }))
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
      const data = await safeJSON(res)
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

  function markAllRead() {
    const ids = conversations.map((c) => c.id)
    ids.forEach((id) => {
      updateReadState(id, true)
      updateServerRead(id, true)
    })
  }

  const visibleConversations = conversations
    .filter((c) => !showUnreadOnly || !readState[c.id])
    .sort((a: Conversation, b: Conversation) => {
      const ta = new Date((a.last_message || a.lastMessage || {}).created_at || 0).getTime()
      const tb = new Date((b.last_message || b.lastMessage || {}).created_at || 0).getTime()
      return sortDesc ? tb - ta : ta - tb
    })

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
            <>
              <div className="p-2 flex items-center gap-2 border-b">
                <Button variant="outline" size="sm" onClick={markAllRead}>
                  Mark all read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnreadOnly((v) => !v)}
                >
                  {showUnreadOnly ? 'Show all' : 'Show unread'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDesc((v) => !v)}
                >
                  {sortDesc ? 'Oldest first' : 'Newest first'}
                </Button>
              </div>
              <ul className="flex-1 overflow-y-auto p-4 space-y-2">
              {!isLoadingReadState &&
                visibleConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    selected={selectedId === conv.id}
                    unread={
                      readState[conv.id] !== undefined
                        ? !readState[conv.id]
                        : !conv.isRead
                    }
                    onClick={() => {
                      router.push(`/chat/${conv.id}`)
                      setSelectedId(conv.id)
                      updateReadState(conv.id, true)
                      updateServerRead(conv.id, true)
                      setUpdates((u) => {
                        const { [conv.id]: _removed, ...rest } = u
                        return rest
                      })
                    }}
                  />
                ))}
              </ul>
            </>
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
                        <MessageBubble key={(m as { id?: string }).id ?? idx} message={m} />
                      ))
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(detail, null, 2)}
                      </pre>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-4 border-t dark:bg-gray-900 sticky bottom-0" style={{ minHeight: '60px' }}>
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

