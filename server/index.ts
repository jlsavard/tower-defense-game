import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { GameRoom } from './game/GameRoom.js';
import { ClientMessage } from '../shared/types/network.types.js';
import { log } from './utils/logger.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = parseInt(process.env.PORT || '8080', 10);

// --- Simple HTTP server to serve client files ---
const DIST_CLIENT = path.resolve('dist/client');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const httpServer = http.createServer((req, res) => {
  let filePath = path.join(DIST_CLIENT, req.url === '/' ? 'index.html' : req.url!);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server: httpServer });

// Single room for now (extend to RoomManager later)
let currentRoom: GameRoom | null = null;

function getOrCreateRoom(): GameRoom {
  if (!currentRoom || currentRoom.isFull()) {
    currentRoom = new GameRoom();
  }
  return currentRoom;
}

wss.on('connection', (ws: WebSocket) => {
  let playerId = uuid();
  let room: GameRoom | null = null;

  log(`Connection opened: ${playerId}`);

  ws.on('message', (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'JOIN_GAME') {
      room = getOrCreateRoom();
      const result = room.addPlayer(playerId, ws);

      if (result) {
        // Use the actual playerId (may differ from generated one on reconnect)
        playerId = result.playerId;
        ws.send(JSON.stringify({
          type: 'GAME_JOINED',
          playerId: result.playerId,
          playerSide: result.side,
          roomId: room.roomId,
        }));
      } else {
        ws.send(JSON.stringify({ type: 'ACTION_FAILED', reason: 'Room is full' }));
      }
      return;
    }

    if (room) {
      room.handleMessage(playerId, msg);
    }
  });

  ws.on('close', () => {
    log(`Connection closed: ${playerId}`);
    if (room) {
      room.removePlayer(playerId);
      if (room.isEmpty()) {
        currentRoom = null;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  log(`Server listening on http://localhost:${PORT}`);
});
