'use strict';

const WebSocket = require('ws');

const URL = process.env.URL || 'ws://127.0.0.1:8787';
const assert = require('assert');

function connect(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const timer = setTimeout(() => reject(new Error(`${name} timed out`)), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function onceType(ws, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing packet ${type}`)), 5000);
    const handler = (raw) => {
      const packet = JSON.parse(raw.toString('utf8'));
      if (packet.type === type) {
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
  host.send(JSON.stringify({ type: 'update_settings', song: 'fresh', difficulty: 'normal', folder: '' }));
  const settings = await onceType(host, 'room_update');
  assert.strictEqual(settings.room.song, 'fresh');
  assert(settings.room.players.every((player) => player.ready === false));

  host.send(JSON.stringify({ type: 'ready', ready: true }));
  guest.send(JSON.stringify({ type: 'ready', ready: true }));
  await onceType(host, 'match_start');
  await onceType(guest, 'match_start');

  host.close();
  guest.close();
}

async function quickMatchScenario() {
  const playerOne = await connect('quick-one');
  const playerTwo = await connect('quick-two');

  playerOne.send(JSON.stringify({ type: 'quick_match', name: 'Q1', song: 'bopeebo', difficulty: 'hard', folder: '' }));
  const created = await onceType(playerOne, 'room_created');
  assert.strictEqual(created.room.matchType, 'quick');

  playerTwo.send(JSON.stringify({ type: 'quick_match', name: 'Q2', song: 'fresh', difficulty: 'easy', folder: '' }));
  const joined = await onceType(playerTwo, 'room_joined');
  assert.strictEqual(joined.room.code, created.room.code);
  assert.strictEqual(joined.room.song, 'bopeebo');
  await onceType(playerOne, 'player_joined');

  playerOne.send(JSON.stringify({ type: 'ready', ready: true }));
  playerTwo.send(JSON.stringify({ type: 'ready', ready: true }));
  await onceType(playerOne, 'match_start');
  await onceType(playerTwo, 'match_start');

  playerOne.close();
  playerTwo.close();
}

(async () => {
  await privateRoomScenario();
  await quickMatchScenario();
  console.log('smoke test passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
