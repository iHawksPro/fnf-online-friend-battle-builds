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
  return typeof value === 'string'
    && value.trim().length >= min
    && value.length <= max
    && !/[\\/\r\n\t\0]/.test(value)
    && !value.includes('..');
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

function safeVoteSong(value, fallback = 'unknown') {
  return isSafeText(value, 1, 64) ? value : fallback;
}

function normalizeSongPick(packet, fallbackSong = 'unknown', fallbackDifficulty = 'normal', fallbackFolder = '') {
  return {
    song: safeVoteSong(packet && packet.song, fallbackSong),
    difficulty: safeDifficulty(packet && packet.difficulty != null ? packet.difficulty : fallbackDifficulty),
    folder: safeFolder(packet && packet.folder != null ? packet.folder : fallbackFolder)
  };
}

function getPlayer(ws) {
  return ws.player || null;
}

// Optional client OS tag for lobby badges; old clients send nothing.
function safePlatform(value) {
  return ['windows', 'linux', 'mac'].includes(value) ? value : null;
}

function lobbySnapshot() {
  return [...rooms.values()]
    .filter((room) => room.matchType === 'quick' && !room.started && room.phase !== 'voting')
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((room) => ({
      code: room.code,
      song: room.song,
      difficulty: room.difficulty,
      folder: room.folder,
      phase: room.phase,
      playerCount: room.players.size,
      readyCount: [...room.players.values()].filter((player) => player.ready).length,
      ageSeconds: Math.max(0, Math.floor((now() - room.createdAt) / 1000)),
      players: [...room.players.values()].map((player) => ({
        name: player.name,
        role: player.role,
        ready: player.ready,
        platform: player.platform
      }))
    }));
}

function sendLobby(ws) {
  send(ws, { type: 'lobby_snapshot', queue: lobbySnapshot() });
  const room = ws.roomCode && rooms.get(ws.roomCode);
  if (room) {
    send(ws, { type: 'room_update', room: roomSnapshot(room), reason: 'lobby_requested' });
  }
}

function broadcastLobby() {
  const packet = { type: 'lobby_snapshot', queue: lobbySnapshot() };
  for (const ws of wss.clients) {
    send(ws, packet);
  }
}

function roomSnapshot(room) {
  const publicVote = (vote) => vote
    ? {
      noVote: vote.noVote === true,
      song: vote.song,
      difficulty: vote.difficulty,
      folder: vote.folder
    }
    : null;

  return {
    code: room.code,
    hostId: room.hostId,
    song: room.song,
    difficulty: room.difficulty,
    folder: room.folder,
    matchType: room.matchType,
    seed: room.seed,
    started: room.started,
    startAt: room.startAt,
    phase: room.phase,
    selectedVote: room.selectedVote || null,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      platform: player.platform,
      ready: player.ready,
      finished: player.finished,
      vote: publicVote(player.vote),
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
    platform: safePlatform(packet.platform),
    role,
    ready: false,
    finished: false,
    vote: null,
    score: 0,
    misses: 0,
    combo: 0,
    ws
  };
}

function attachPlayer(ws, room, player) {
  leave(ws, 'switch_room');
  ws.player = player;
  ws.roomCode = room.code;
  room.players.set(player.id, player);
  room.lastActive = now();
}

function detachPlayer(player) {
  if (!player || !player.ws) return;
  if (player.ws.player && player.ws.player.id === player.id) {
    player.ws.player = null;
    player.ws.roomCode = null;
  }
}

function closeRoom(room, reason, except = null) {
  if (!room || !rooms.has(room.code)) return;

  rooms.delete(room.code);
  for (const player of room.players.values()) {
    if (player.ws !== except) {
      send(player.ws, {
        type: 'room_closed',
        code: room.code,
        reason,
        message: reason === 'player_left'
          ? 'Room closed because a player left.'
          : 'Room closed.'
      });
    }
    detachPlayer(player);
  }
  room.players.clear();
}

function resetReady(room, clearVotes = true) {
  for (const player of room.players.values()) {
    player.ready = false;
    player.finished = false;
    if (clearVotes) {
      player.vote = null;
    }
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
    phase: 'lobby',
    startAt: 0
  };

  attachPlayer(ws, room, player);
  rooms.set(code, room);

  send(ws, { type: 'room_created', selfId: player.id, room: roomSnapshot(room) });
  broadcastLobby();
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
  if (room.started || room.phase === 'playing') {
    closeWithError(ws, 'room_started', 'That room already started.');
    return;
  }

  const player = buildPlayer(ws, packet, 'guest');
  attachPlayer(ws, room, player);

  send(ws, { type: 'room_joined', selfId: player.id, room: roomSnapshot(room) });
  broadcast(room, { type: 'player_joined', room: roomSnapshot(room) }, ws);
  broadcastLobby();
}

function joinRoom(ws, packet) {
  const code = typeof packet.code === 'string' ? packet.code.toUpperCase() : '';
  joinExistingRoom(ws, packet, rooms.get(code));
}

function quickMatch(ws, packet) {
  for (const room of rooms.values()) {
    if (room.matchType === 'quick' && !room.started && room.phase !== 'voting' && room.players.size < 2) {
      joinExistingRoom(ws, packet, room);
      return;
    }
  }

  createRoom(ws, packet, 'quick');
}

function updateSettings(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || room.started || room.phase === 'voting') return;

  room.song = safeSong(packet.song);
  room.difficulty = safeDifficulty(packet.difficulty);
  room.folder = safeFolder(packet.folder);
  room.seed = makeId(8);
  room.selectedVote = null;
  room.lastActive = now();
  resetReady(room);
  broadcast(room, { type: 'room_update', room: roomSnapshot(room), reason: 'settings_changed' });
  broadcastLobby();
}

function startMatch(room) {
  room.started = true;
  room.phase = 'playing';
  room.startAt = now() + 3000;
  room.selectedVote = null;
  for (const player of room.players.values()) {
    player.ready = true;
    player.finished = false;
    player.vote = null;
    player.score = 0;
    player.misses = 0;
    player.combo = 0;
  }
  broadcast(room, {
    type: 'match_start',
    startAt: room.startAt,
    song: room.song,
    difficulty: room.difficulty,
    folder: room.folder,
    matchType: room.matchType,
    seed: room.seed
  });
  broadcastLobby();
}

function setReady(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || room.started || room.phase === 'voting') return;

  player.ready = packet.ready === true;
  room.lastActive = now();
  broadcast(room, { type: 'room_update', room: roomSnapshot(room) });
  broadcastLobby();

  if (room.players.size === 2 && [...room.players.values()].every((p) => p.ready) && !room.started) {
    startMatch(room);
  }
}

function applyScore(player, packet) {
  player.score = Number.isFinite(packet.score) ? Math.trunc(packet.score) : player.score;
  player.misses = Number.isFinite(packet.misses) ? Math.trunc(packet.misses) : player.misses;
  player.combo = Number.isFinite(packet.combo) ? Math.trunc(packet.combo) : player.combo;
}

function finishMatch(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || !room.started) return;

  applyScore(player, packet);
  player.finished = true;
  player.ready = false;
  room.lastActive = now();

  broadcast(room, {
    type: 'result',
    from: player.id,
    score: player.score,
    misses: player.misses,
    combo: player.combo,
    serverTime: now()
  }, ws);

  if (room.players.size === 2 && [...room.players.values()].every((p) => p.finished)) {
    room.started = false;
    room.phase = 'voting';
    room.startAt = 0;
    room.selectedVote = null;
    for (const p of room.players.values()) {
      p.ready = false;
      p.vote = null;
    }
    broadcast(room, { type: 'room_update', room: roomSnapshot(room), reason: 'match_finished' });
    broadcastLobby();
  } else {
    broadcast(room, { type: 'room_update', room: roomSnapshot(room), reason: 'player_finished' });
  }
}

function normalizeVote(packet, room) {
  const noVote = packet.noVote === true;
  const fallbackSongs = Array.isArray(packet.fallbackSongs)
    ? packet.fallbackSongs
      .slice(0, 32)
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => normalizeSongPick(entry, room.song, room.difficulty, room.folder))
    : [];

  if (noVote) {
    return {
      noVote: true,
      song: 'No Vote',
      difficulty: '',
      folder: '',
      fallbackSongs
    };
  }

  return {
    noVote: false,
    ...normalizeSongPick(packet, room.song, room.difficulty, room.folder),
    fallbackSongs
  };
}

function voteKey(vote) {
  return `${vote.song.toLowerCase()}|${vote.difficulty.toLowerCase()}|${vote.folder.toLowerCase()}`;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function resolveVotes(room) {
  const votes = [...room.players.values()].map((player) => player.vote).filter(Boolean);
  const songVotes = votes.filter((vote) => !vote.noVote);
  let selected;
  let resolution = 'vote';

  if (songVotes.length === 0) {
    const fallbackPool = [];
    for (const vote of votes) {
      if (Array.isArray(vote.fallbackSongs)) {
        fallbackPool.push(...vote.fallbackSongs);
      }
    }
    selected = fallbackPool.length > 0
      ? pickRandom(fallbackPool)
      : normalizeSongPick(room, room.song, room.difficulty, room.folder);
    resolution = 'random_default';
  } else {
    const buckets = new Map();
    for (const vote of songVotes) {
      const key = voteKey(vote);
      const bucket = buckets.get(key) || { count: 0, vote };
      bucket.count += 1;
      buckets.set(key, bucket);
    }

    const maxVotes = Math.max(...[...buckets.values()].map((bucket) => bucket.count));
    const tied = [...buckets.values()].filter((bucket) => bucket.count === maxVotes);
    selected = pickRandom(tied).vote;
    resolution = tied.length > 1 ? 'tie_random' : 'vote';
  }

  room.song = safeSong(selected.song);
  room.difficulty = safeDifficulty(selected.difficulty);
  room.folder = safeFolder(selected.folder);
  room.seed = makeId(8);
  room.started = false;
  room.phase = 'lobby';
  room.startAt = 0;
  room.selectedVote = {
    song: room.song,
    difficulty: room.difficulty,
    folder: room.folder,
    resolution
  };
  resetReady(room, true);
  broadcast(room, {
    type: 'room_update',
    room: roomSnapshot(room),
    reason: 'vote_resolved',
    selectedSong: room.selectedVote
  });
  broadcastLobby();
}

function songVote(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || room.started || room.phase !== 'voting') return;

  player.vote = normalizeVote(packet, room);
  player.ready = false;
  room.lastActive = now();

  if (room.players.size === 2 && [...room.players.values()].every((p) => p.vote)) {
    resolveVotes(room);
  } else {
    broadcast(room, { type: 'room_update', room: roomSnapshot(room), reason: 'vote_changed' });
  }
}

function relay(ws, packet) {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room || !room.started) return;

  const allowed = new Set(['input', 'score', 'song_position', 'pause', 'resume', 'result']);
  if (!allowed.has(packet.type)) return;

  if (packet.type === 'score') {
    applyScore(player, packet);
  }

  room.lastActive = now();
  broadcast(room, { ...packet, from: player.id, serverTime: now() }, ws);
}

function leave(ws, reason = 'player_left') {
  const player = getPlayer(ws);
  const room = player && rooms.get(ws.roomCode);
  if (!room) {
    ws.player = null;
    ws.roomCode = null;
    return;
  }

  const wasHost = player.id === room.hostId;
  const shouldCloseRoom = room.started || room.matchType === 'quick' || wasHost;
  room.players.delete(player.id);
  detachPlayer(player);

  if (room.players.size === 0) {
    rooms.delete(room.code);
  } else if (shouldCloseRoom) {
    broadcast(room, { type: 'player_left', id: player.id, reason });
    closeRoom(room, reason, ws);
  } else {
    room.lastActive = now();
    broadcast(room, { type: 'player_left', id: player.id, reason });
    broadcast(room, { type: 'room_update', room: roomSnapshot(room), reason });
  }
  broadcastLobby();
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
    case 'finish_match':
      finishMatch(ws, packet);
      break;
    case 'song_vote':
      songVote(ws, packet);
      break;
    case 'lobby':
      sendLobby(ws);
      break;
    case 'ping':
      // Clock-sync probe: reply straight back to the sender (not broadcast) so
      // the client can measure RTT and correct its server-time estimate.
      // ct = the client's send timestamp, echoed verbatim.
      send(ws, { type: 'pong', ct: packet.ct, serverTime: now() });
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
  sendLobby(ws);
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
      broadcastLobby();
    }
  }
}, HEARTBEAT_MS);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FNF Online Friend Battle server listening on ws://${PUBLIC_HOST}:${PORT}`);
});
