import type { NextApiRequest, NextApiResponse } from 'next'
import { WebSocketServer } from 'ws'
import { addClient, removeClient } from '@/lib/events'

type NextApiResponseServerWS = NextApiResponse & {
  socket: {
    server: {
      wss?: WebSocketServer
      on: (event: string, cb: (...args: any[]) => void) => void
    }
  }
}

export const config = {
  api: { bodyParser: false }
}


export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerWS
) {
  const server = res.socket.server
  if (!server) {
    res.status(500).end()
    return
  }

  if (!server.wss) {
    const wss = new WebSocketServer({ noServer: true })
    server.wss = wss
    server.on('upgrade', (req: any, socket: any, head: any) => {
      if (req.url === '/api/events') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          addClient(ws)
          ws.on('close', () => removeClient(ws))
        })
      }
    })
  }

  res.status(200).end('ready')
}
