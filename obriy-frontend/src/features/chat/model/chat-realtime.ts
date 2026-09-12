import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../../../shared/config/env'

const realtimeUrl = `${new URL(API_BASE_URL, window.location.origin).origin}/realtime`

export function createChatSocket(accessToken: string): Socket {
  return io(realtimeUrl, {
    auth: { accessToken },
    transports: ['websocket'],
    reconnection: true,
  })
}

