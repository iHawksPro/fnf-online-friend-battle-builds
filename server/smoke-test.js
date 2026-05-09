'use strict';

const WebSocket = require('ws');

const URL = process.env.URL || 'ws://127.0.0.1:8787';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);
const assert = require('assert');

function connect(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const timer = setTimeout(() => reject(new Error(`${name} timed out`)), TIMEOUT_MS);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function onceType(ws, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing packet ${type}`)), TIMEOUT_MS);
    const handler = (raw) => {
      const packet = JSON.parse(raw.toString('utf8'));
      if (packet.type === type && predicate(packet)) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(packet);
      }
    };
    ws.on('message', handler);
  });
}

function waitForLobby(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Missing expected lobby snapshot')), TIMEOUT_MS);
    const handler = (raw) => {
      const packet = JSON.parse(raw.toString('utf8'));
      if (packet.type === 'lobby_snapshot' && predicate(packet.queue || [])) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(packet);
      }
    };
    ws.on('message', handler);
  });
}

async function privateRoomScenario() {
  const host = await connect('host');
  const guest = await connect('guest');

  host.send(JSON.stringify({ type: 'create_room', name: 'Host', song: 'bopeebo', difficulty: 'hard' }));
  const created = await onceType(host, 'room_created');

  guest.send(JSON.stringify({ type: 'join_room', name: 'Guest', code: created.room.code }));
  await onceType(guest, 'room_joined');

  host.send(JSON.stringify({ type: 'ready', ready: true }));
  await onceType(guest, 'room_update');
  host.send(JSON.stringify({ type: 'update_settings', song: 'unknown suffering', difficulty: 'normal', folder: "Wednesday's Infidelity" }));
  const settings = await onceType(host, 'room_update', (packet) => packet.room && packet.room.song === 'unknown suffering');
  assert.strictEqual(settings.room.song, 'unknown suffering');
  assert.strictEqual(settings.room.folder, "Wednesday's Infidelity");
  assert(settings.room.players.every((player) => player.ready === false));

  const hostStartPromise = onceType(host, 'match_start');
  const guestStartPromise = onceType(guest, 'match_start');
  host.send(JSON.stringify({ type: 'ready', ready: true }));
  guest.send(JSON.stringify({ type: 'ready', ready: true }));
  await hostStartPromise;
  await guestStartPromise;

  host.close();
  guest.close();
}

async function quickMatchScenario() {
  const playerOne = await connect('quick-one');
  const playerTwo = await connect('quick-two');
  const watcher = await connect('watcher');

  const lobbyOnePromise = waitForLobby(watcher, (queue) => queue.length === 1 && queue[0].players.some((player) => player.name === 'Q1'));
  playerOne.send(JSON.stringify({ type: 'quick_match', name: 'Q1', song: 'bopeebo', difficulty: 'hard', folder: '' }));
  const created = await onceType(playerOne, 'room_created');
  assert.strictEqual(created.room.matchType, 'quick');
  const lobbyOne = await lobbyOnePromise;
  assert.strictEqual(lobbyOne.queue[0].song, 'bopeebo');

  const lobbyTwoPromise = waitForLobby(watcher, (queue) => queue.length === 1 && queue[0].players.length === 2);
  const playerJoinedPromise = onceType(playerOne, 'player_joined');
  playerTwo.send(JSON.stringify({ type: 'quick_match', name: 'Q2', song: 'fresh', difficulty: 'easy', folder: '' }));
  const joined = await onceType(playerTwo, 'room_joined');
  assert.strictEqual(joined.room.code, created.room.code);
  assert.strictEqual(joined.room.song, 'bopeebo');
  await playerJoinedPromise;
  const lobbyTwo = await lobbyTwoPromise;
  assert(lobbyTwo.queue[0].players.some((player) => player.name === 'Q2'));

  const emptyLobbyPromise = waitForLobby(watcher, (queue) => queue.length === 0);
  const playerOneStartPromise = onceType(playerOne, 'match_start');
  const playerTwoStartPromise = onceType(playerTwo, 'match_start');
  playerOne.send(JSON.stringify({ type: 'ready', ready: true }));
  playerTwo.send(JSON.stringify({ type: 'ready', ready: true }));
  await playerOneStartPromise;
  await playerTwoStartPromise;
  await emptyLobbyPromise;

  playerOne.close();
  playerTwo.close();
  watcher.close();
}

async function quickLobbyCleanupScenario() {
  const queued = await connect('queued-cleanup');
  const watcher = await connect('cleanup-watcher');

  const lobbyVisiblePromise = waitForLobby(watcher, (queue) => queue.length === 1 && queue[0].players.some((player) => player.name === 'Cleanup'));
  queued.send(JSON.stringify({ type: 'quick_match', name: 'Cleanup', song: 'bopeebo', difficulty: 'hard', folder: '' }));
  await onceType(queued, 'room_created');
  await lobbyVisiblePromise;

  const emptyLobbyPromise = waitForLobby(watcher, (queue) => queue.length === 0);
  queued.close();
  await emptyLobbyPromise;

  watcher.close();
}

async function startedQuickRoomCleanupScenario() {
  const playerOne = await connect('started-cleanup-one');
  const playerTwo = await connect('started-cleanup-two');
  const watcher = await connect('started-cleanup-watcher');

  playerOne.send(JSON.stringify({ type: 'quick_match', name: 'S1', song: 'bopeebo', difficulty: 'hard', folder: '' }));
  await onceType(playerOne, 'room_created');
  playerTwo.send(JSON.stringify({ type: 'quick_match', name: 'S2', song: 'fresh', difficulty: 'easy', folder: '' }));
  await onceType(playerTwo, 'room_joined');

  const playerOneStartPromise = onceType(playerOne, 'match_start');
  const playerTwoStartPromise = onceType(playerTwo, 'match_start');
  playerOne.send(JSON.stringify({ type: 'ready', ready: true }));
  playerTwo.send(JSON.stringify({ type: 'ready', ready: true }));
  await playerOneStartPromise;
  await playerTwoStartPromise;

  const roomClosedPromise = onceType(playerTwo, 'room_closed');
  const emptyLobbyPromise = waitForLobby(watcher, (queue) => queue.length === 0);
  playerOne.close();
  await roomClosedPromise;
  watcher.send(JSON.stringify({ type: 'lobby' }));
  await emptyLobbyPromise;

  playerTwo.close();
  watcher.close();
}

(async () => {
  await privateRoomScenario();
  await quickMatchScenario();
  await quickLobbyCleanupScenario();
  await startedQuickRoomCleanupScenario();
  console.log('smoke test passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
