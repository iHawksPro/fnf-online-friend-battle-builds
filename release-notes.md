# Hawks FNF Multiplayer Friend Build - Wasted V3 + Linux Server Hosting

## Assets

- `Hawks-FNF-Multiplayer-All-Mods-No-Darkness-SEND-TO-FRIEND.zip` - the full game build (six mods).
- `Hawks-FNF-Wasted-V3-Addon.zip` - adds the FNF Wasted V3 mod; extract it over the extracted game folder.
- `FriendBattleServer.zip` - the relay server package, now with a Linux launcher.

The combined zip `Hawks-FNF-Multiplayer-All-Mods-Plus-Wasted-SEND-TO-FRIEND.zip` is over the 2 GiB release-asset limit, so it is shared directly instead of through GitHub Releases. Its hash is in `SHA256SUMS.txt`.

## Highlights

- Resyncs the repository with the current friend build (the previous recorded zip hash no longer matched the build in circulation).
- Adds the FNF Wasted V3 mod (`mods/wasted`, song `wasted-v3` with normal and hard charts) as an addon zip and in the combined build.
- Fixes the Wasted mod's stale `pack.json` (it still carried Last Chance V7 metadata) and sets `needsVoices` to false to match the shipped audio (vocals are baked into `Inst.ogg`; no `Voices.ogg` exists).
- Renames the Wasted mod's week file from `weeks/LC.json` to `weeks/wasted-v3.json` — Bloodbath Spanish Mix also ships a `weeks/LC.json`, and Psych Engine keys weeks by filename, so the duplicate was silently skipped and `wasted-v3` never appeared in freeplay. Also sets the week's `difficulties` to `Normal, Hard` to match the shipped charts.
- Adds `server/start-hawks-cloudflare-server.sh` so the relay plus Cloudflare Quick Tunnel can be hosted natively on Linux.
- Adds `run-hawks-fnf-linux.sh` to the game build for playing the Windows client through Wine on Linux.
- Resets `online-server-url.txt` in the build to the local fallback (`ws://127.0.0.1:8787`) instead of an expired tunnel URL, per repository policy.

## Build Contents

- Mods enabled: Bloodbath Spanish Mix, Doubling Down, South Park Chaos, Tolkien Week, Silly Billy, Wednesday's Infidelity, and (with the addon) FNF Wasted V3.
- Smoke Em Out Struggle is not present in the current friend build; the docs previously claimed it was. It can be re-added in a future release if the mod folder is recovered.
- Darkness Takeover remains intentionally excluded.

## Linux Server Hosting

From `server/` on any Linux machine with Node.js:

```bash
./start-hawks-cloudflare-server.sh
```

The script installs `ws` if needed, starts the relay on port 8787, downloads `cloudflared` automatically if it is not installed, opens a Quick Tunnel, prints the `wss://` URL, and writes it to `cloudflare-server-url.txt` plus any game folder given via `GAME_DIRS=/path/to/game`. Pass `--no-wait` to leave it running in the background.

## Validation

- Relay smoke test passed natively on Linux (Fedora 44, Node v22.17.0).
- Relay smoke test also passed end to end through a live Cloudflare Quick Tunnel using the new Linux launcher.
- Main zip verified to contain no `mods/wasted` entries and the six-mod `modsList.txt`.
- Combined zip and addon verified to contain `mods/wasted` and the seven-mod `modsList.txt`.
- Chart character references for `wasted-v3` (`bf c`, `peter`, `bfblack`) verified present in `mods/wasted/characters`.
- No saved public tunnel URL is committed or shipped inside the release zips.
