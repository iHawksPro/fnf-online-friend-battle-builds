'use strict';

const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_HOST = process.env.PUBLIC_HOST || '127.0.0.1';
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 200);
const MAX_PACKET_BYTES = Number(process.env.MAX_PACKET_BYTES || 8192);
const HEARTBEAT_MS = 15000;
const STALE_MS = Number(process.env.STALE_MS || 10 * 60 * 1000);

const rooms = new Map();

function now() {
  return Date.now();
}

function makeId(bytes = 4) {
  return crypto.randomBytes(bytes).toString('hex').toUpperCase();
}

function send(ws, packet) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(packet));
  }
}

function broadcast(room, packet, except = null) {
  for (const player of room.players.values()) {
    if (player.ws !== except) {
      send(player.ws, packet);
    }
  }
}

function closeWithError(ws, code, message) {
  send(ws, { type: 'error', code, message });
  ws.close(1008, message.slice(0, 120));
}

function isSafeText(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max && /^[\w .\-]+$/.test(value);
}

function safeName(value, fallback) {
  return isSafeText(value, 1, 18) ? value : fallback;
}

function safeSong(value) {
  return isSafeText(value, 1, 64) ? value : 'unknown';
}

function safeDifficulty(value) {
  return isSafeText(value, 1, 24) ? value : 'normal';
}

function safeFolder(value) {
  return value === '' || value == null ? '' : (isSafeText(value, 1, 64) ? value : '');
}

function getPlayer(ws) {
  return ws.player || null;
}

function roomSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    song: room.song,
    difficulty: room.difficulty,
    folder: room.folder,
    matchType: room.matchType,
    seed: room.seed,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      ready: player.ready,
      score: player.score,
      misses: player.misses,
      combo: player.combo
    }))
  };
}

function buildPlayer(ws, packet, role) {
  return {
    id: makeId(8),
    name: safeName(packet.name, role === 'host' ? 'Host' : 'Guest'),
    role,
    ready: false,
    score: 0,
    misses: 0,
    combo: 0,
    ws
  };
}

function attachPlayer(ws, room, player) {
  ws.player = player;
  ws.roomCode = room.code;
  room.players.set(player.id, player);
  room.lastActive = now();
}

function resetReady(room) {
  for (const player of room.players.values()) {
    player.ready = false;
    player.score = 0;
    player.misses = 0;
    player.combo = 0;
  }
}

function createRoom(ws, packet, matchType = 'private') {
  if (rooms.size >= MAX_ROOMS) {
    closeWithError(ws, 'server_full', 'Server room limit reached.');
    return;
  }

  let code = makeId(3);
  while (rooms.has(code)) {
    code = makeId(3);
  }

  const player = buildPlayer(ws, packet, 'host');

  const room = {
    code,
    hostId: player.id,
    song: safeSong(packet.song),
    difficulty: safeDifficulty(packet.difficulty),
    folder: safeFolder(packet.folder),
    matchType,
    seed: makeId(8),
    players: new Map(),
    createdAt: now(),
    lastActive: now(),
    started: false,
    startAt: 0
  };

  attachPlayer(ws, room, player);
  rooms.set(code, room);

  send(ws, { type: 'room_created', selfId: player.id, room: roomSnapshot(room) });
}

function joinExistingRoom(ws, packet, room) {
  if (!room) {
    closeWithError(ws, 'room_missing', 'That room does not exist.');
    return;
  }
  if (room.players.size >= 2) {
    closeWithError(ws, 'room_full', 'That room already has two players.');
    return;
  }
  if (room.started) {
    closeWithError(ws, 'room_started', 'That room already started.');
    return;
  }

  const player = buildPlayer(ws, packet, 'guest');
  attachPlayer(ws, room, player);

  send(ws, { type: 'room_joined', selfId: player.id, room: roomSnapshot(room) });
  broadcast(room, { type: 'player_joined', room: roomSnapshot(room) }, ws);
}

function joinRoom(ws, packet) {
  const code = typeof packet.code === 'string' ? packet.code.toUpperCase() : '';
  joinExistingRoom(ws, packet, rooms.get(code));
}

function quickMatch(ws, packet) {
  for (const room of rooms.values()) {
    if (room.matchType === 'quick' && !room.started && room.players.size < 2) {
      joinExistingRoom(ws, packet, room);
      return;
    }
  }

  createRoom(ws, packet, 'quick');
}

function updateSettings(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || room.started) return;

  room.song = safeSong(packet.song);
  room.difficulty = safeDifficulty(packet.difficulty);
  room.folder = safeFolder(packet.folder);
  room.seed = makeId(8);
  room.lastActive = now();
  resetReady(room);
  broadcast(room, { type: 'room_update', room: roomSnapshot(room), reason: 'settings_changed' });
}

function setReady(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || room.started) return;

  player.ready = packet.ready === true;
  room.lastActive = now();
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });

  if (room.players.size === 2 && [...room.players.values()].every((p) => p.ready) && !room.started) {
    room.started = true;
    room.startAt = now() + 3000;
    broadcast(room, {
      type: 'match_start',
      startAt: room.startAt,
      song: room.song,
      difficulty: room.difficulty,
      folder: room.folder,
      matchType: room.matchType,
      seed: room.seed
    });
  }
}

function relay(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || !room.started) return;

  const allowed = new Set(['input', 'score', 'song_position', 'pause', 'resume', 'result']);
  if (!allowed.has(packet.type)) return;

  if (packet.type === 'score') {
    player.score = Number.isFinite(packet.score) ? Math.trunc(packet.score) : player.score;
    player.misses = Number.isFinite(packet.misses) ? Math.trunc(packet.misses) : player.misses;
    player.combo = Number.isFinite(packet.combo) ? Math.trunc(packet.combo) : player.combo;
  }

  room.lastActive = now();
  broadcast(room, { ...packet, from: player.id, serverTime: now() }, ws);
}

function leave(ws) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room) return;

  room.players.delete(player.id);
  broadcast(room, { type: 'player_left', id: player.id });

  if (room.players.size === 0) {
    rooms.delete(room.code);
  } else if (player.id === room.hostId) {
    const nextHost = [...room.players.values()][0];
    nextHost.role = 'host';
    room.hostId = nextHost.id;
    room.started = false;
    broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
  }
}

function handlePacket(ws, raw) {
  if (raw.length > MAX_PACKET_BYTES) {
    closeWithError(ws, 'packet_too_large', 'Packet is too large.');
    return;
  }

  let packet;
  try {
    packet = JSON.parse(raw);
  } catch {
    closeWithError(ws, 'bad_json', 'Packet is not valid JSON.');
    return;
  }

  if (!packet || typeof packet.type !== 'string') {
    closeWithError(ws, 'bad_packet', 'Packet is missing a type.');
    return;
  }

  switch (packet.type) {
    case 'create_room':
      createRoom(ws, packet);
      break;
    case 'quick_match':
      quickMatch(ws, packet);
      break;
    case 'join_room':
      joinRoom(ws, packet);
      break;
    case 'update_settings':
      updateSettings(ws, packet);
      break;
    case 'ready':
      setReady(ws, packet);
      break;
    default:
      relay(ws, packet);
      break;
  }
}

const app = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

const wss = new WebSocket.Server({ server: app, maxPayload: MAX_PACKET_BYTES });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('message', (raw) => handlePacket(ws, raw.toString('utf8')));
  ws.on('close', () => leave(ws));
  send(ws, { type: 'hello', serverTime: now(), heartbeatMs: HEARTBEAT_MS });
});

setInterval(() => {
  const cutoff = now() - STALE_MS;
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
  for (const [code, room] of rooms.entries()) {
    if (room.players.size === 0 || room.lastActive < cutoff) {
      for (const player of room.players.values()) {
        player.ws.close(1001, 'Room expired.');
      }
      rooms.delete(code);
    }
  }
}, HEARTBEAT_MS);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FNF Online Friend Battle server listening on ws://${PUBLIC_HOST}:${PORT}`);
});
