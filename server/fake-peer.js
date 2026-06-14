'use strict';
// fake-peer.js — a stand-in opponent for testing Hawks online versus without a
// second machine. Connects to the relay, shows up in the quick-match lobby (or
// hosts a private room), readies up when you join, and once the match starts it
// streams believable input/score/song_position packets so your client sees a
// live opponent (lane lights up, score ticks, clock stays synced).
//
// Usage:
//   node fake-peer.js                 # quick-match queue (you click Quick Match in-game)
//   node fake-peer.js --host          # create a PRIVATE room, prints the join CODE
//   NAME=Luigi SONG=bopeebo DIFF=hard node fake-peer.js
//   URL=ws://127.0.0.1:8787 node fake-peer.js     # point at a local relay
//
// Default URL = whatever the client uses (online-server-url.txt), else the hosted relay.

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

function defaultUrl() {
  if (process.env.URL) return process.env.URL;
  for (const p of [
    path.join(__dirname, '..', '..', 'build', 'online-server-url.txt'),
    path.join(process.env.HOME || '', 'Downloads', 'Hawks-FNF-Linux', 'online-server-url.txt'),
  ]) {
    try { const u = fs.readFileSync(p, 'utf8').trim(); if (u) return u; } catch (_) {}
  }
  return 'wss://hawks-fnf-relay.onrender.com';
}

const URL = defaultUrl();
const HOST_MODE = process.argv.includes('--host');
// JOIN mode: bot joins YOUR room by code, you host + pick the song.
//   CODE=ABCD node fake-peer.js     (or: node fake-peer.js --join ABCD)
const CODE = (process.env.CODE
  || (process.argv.includes('--join') ? process.argv[process.argv.indexOf('--join') + 1] : '')
  || '').trim().toUpperCase();
const NAME = (process.env.NAME || 'TestBot').slice(0, 18);
const SONG = process.env.SONG || 'chaos';                 // real song in the build (South Park Chaos)
const DIFF = process.env.DIFF || 'hard';
const FOLDER = process.env.FOLDER || 'South Park Chaos';

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

log(`fake-peer "${NAME}" connecting to ${URL} (${HOST_MODE ? 'PRIVATE host' : 'quick-match'})`);
const ws = new WebSocket(URL);
const send = (o) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(o));

let started = false;
let loop = null;
let songPos = 0;
let score = 0;
let combo = 0;
let voted = false;
let finished = false;

// What the bot votes for when the post-match vote opens (default: chaos).
const VOTE_SONG = process.env.VOTE_SONG || 'chaos';
const VOTE_FOLDER = process.env.VOTE_FOLDER || 'South Park Chaos';
const VOTE_DIFF = process.env.VOTE_DIFF || 'hard';

function castVote() {
  if (voted) return;
  voted = true;
  log(`VOTING for "${VOTE_SONG}" (${VOTE_FOLDER} / ${VOTE_DIFF})`);
  send({ type: 'song_vote', noVote: false, song: VOTE_SONG, difficulty: VOTE_DIFF, folder: VOTE_FOLDER, fallbackSongs: [] });
}

function sendFinish() {
  if (finished) return;
  finished = true;
  stopFakePlay();
  log('finishing match (sending finish_match)');
  send({ type: 'finish_match', score, misses: Math.floor(songPos / 400 / 7), combo });
}

function joinLobby() {
  if (CODE) {
    send({ type: 'join_room', name: NAME, code: CODE, platform: 'linux' });
  } else if (HOST_MODE) {
    send({ type: 'create_room', name: NAME, song: SONG, difficulty: DIFF, folder: FOLDER, platform: 'linux' });
  } else {
    send({ type: 'quick_match', name: NAME, song: SONG, difficulty: DIFF, folder: FOLDER, platform: 'linux' });
  }
}

ws.on('open', () => {
  log('connected. (free-tier relay can take ~40s to wake on first connect of the day)');
  joinLobby();
});

ws.on('message', (raw) => {
  let p; try { p = JSON.parse(raw.toString('utf8')); } catch (_) { return; }
  switch (p.type) {
    case 'room_created':
      if (HOST_MODE) log(`PRIVATE room created — JOIN CODE: ${p.room.code}  (enter this in-game)`);
      else log(`in quick-match lobby as "${NAME}" — now click Quick Match in-game to meet me`);
      break;
    case 'player_joined':
    case 'room_joined': {
      const names = (p.room && p.room.players || []).map((x) => x.name).join(', ');
      log(`opponent joined! room players: [${names}] — readying up`);
      send({ type: 'ready', ready: true });
      break;
    }
    case 'room_update':
      if (p.room && p.room.phase === 'voting') castVote();            // post-match vote → pick chaos
      else if (!started) send({ type: 'ready', ready: true });        // pre-match → ready up
      break;
    case 'result':
      // opponent finished their song — finish ours too so the match ends and voting opens
      sendFinish();
      break;
    case 'match_start':
      voted = false; finished = false;
      log(`MATCH START — song=${p.song} diff=${p.difficulty} startAt=${p.startAt}`);
      beginFakePlay(p);
      break;
    case 'player_left':
    case 'room_closed':
      log(`opponent left / room closed (${p.reason || ''}) — re-queuing in 1.5s`);
      stopFakePlay();
      songPos = 0; score = 0; combo = 0; voted = false; finished = false;
      setTimeout(joinLobby, 1500);   // hop back into the lobby for the next match
      break;
    default:
      log('recv', p.type);
  }
});

ws.on('close', (c, r) => { log(`disconnected (${c}) ${r || ''}`); stopFakePlay(); process.exit(0); });
ws.on('error', (e) => log('error:', e.message));

// Sending fake note-`input` packets crashes UNPATCHED clients (PlayState.hx:2727,
// null `notes`). Off by default — opponent score/sync still work, lanes just don't
// light. Set INPUT=1 once the engine has the notes==null guard to drive note lanes.
const SEND_INPUT = process.env.INPUT === '1';

function beginFakePlay(start) {
  if (started) return;
  started = true;
  if (SEND_INPUT) send({ type: 'input', action: 'loaded', st: Date.now() }); // release synced countdown
  const delay = Math.max(0, (start.startAt || Date.now()) - Date.now());
  setTimeout(() => {
    const step = 400; // ms between fake notes (~150bpm 8ths)
    loop = setInterval(() => {
      songPos += step;
      const dir = Math.floor((songPos / step) % 4);     // cycle lanes 0..3 deterministically
      const hit = (songPos / step) % 7 !== 0;            // miss roughly 1 in 7 for realism
      if (SEND_INPUT) send({ type: 'input', action: hit ? 'hit' : 'miss', d: dir, t: songPos, sus: false });
      if (hit) { score += 350; combo += 1; } else { combo = 0; }
      send({ type: 'score', score, misses: Math.floor(songPos / step / 7), combo });
      send({ type: 'song_position', position: songPos });
      if (songPos >= 180000) { sendFinish(); } // ~3 min cap, then finish so voting can open
    }, step);
  }, delay);
}

function stopFakePlay() {
  started = false;
  if (loop) { clearInterval(loop); loop = null; }
}

process.on('SIGINT', () => { log('shutting down'); try { ws.close(); } catch (_) {} process.exit(0); });
