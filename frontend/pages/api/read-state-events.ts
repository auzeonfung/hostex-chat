import type { NextApiRequest, NextApiResponse } from 'next'
import { WebSocketServer } from 'ws'
import { addReadStateWsClient, removeReadStateWsClient } from '@/lib/readStateWs'

type NextApiResponseServerWS = NextApiResponse & {
  socket: {
    server: {
      wssReadState?: WebSocketServer
      on: (event: string, cb: (...args: any[]) => void) => void
    }
  }
}

export const config = {
  api: { bodyParser: false },
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerWS,
) {
  const server = res.socket.server
  if (!server) {
    res.status(500).end()
    return
  }

  if (!server.wssReadState) {
    const wss = new WebSocketServer({ noServer: true })
    server.wssReadState = wss
    server.on('upgrade', (req: any, socket: any, head: any) => {
      if (req.url === '/api/read-state-events') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          addReadStateWsClient(ws)
          ws.on('close', () => removeReadStateWsClient(ws))
        })
      }
    })
  }

  res.status(200).end('ready')
}
