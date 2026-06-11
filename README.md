# Hawks FNF Multiplayer Mod

This repository packages the online multiplayer Friday Night Funkin' test build, the Node.js relay server, and the current friend-test release files.

The public repository does not commit a public IP address or saved Cloudflare tunnel URL. The game build can read `online-server-url.txt`, and the in-game Online Battle menu also lets players edit the server URL before connecting. The default is local testing at `ws://127.0.0.1:8787`; the server tunnel launcher writes fresh Cloudflare URLs into the playable build folder when you start a tunnel.

## Latest Build — engine rebuild v1.0 (recommended)

Download from the Releases page (`engine-v1.0`): a full rebuild of the
multiplayer client on stock Psych Engine 1.0.4, with **native Windows and
Linux builds** and a permanently hosted relay (`wss://hawks-fnf-relay.onrender.com`
— nobody hosts anything anymore). Grab the engine package for your OS plus
both mods packs and follow the bundled `INSTALL.txt`. Old and new builds can
share the lobby but cannot play matches against each other — both players
should use `engine-v1.0`.

## Legacy Friend Build (original 2025 client)

- `Hawks-FNF-Multiplayer-All-Mods-No-Darkness-SEND-TO-FRIEND.zip` - the full game build (six mods).
- `Hawks-FNF-Wasted-V3-Addon.zip` - adds the FNF Wasted V3 mod; extract it into the extracted game folder and let it overwrite `modsList.txt`.

A combined zip with Wasted already merged (`Hawks-FNF-Multiplayer-All-Mods-Plus-Wasted-SEND-TO-FRIEND.zip`) exists but is over GitHub's 2 GiB release-asset limit, so it is shared directly. All hashes are in `SHA256SUMS.txt`.

The game zip contains the complete game files at the zip root. Extract the whole zip first, then run `! RUN HAWKS FNF.bat` (Windows) or `./run-hawks-fnf-linux.sh` (Linux, runs the Windows client through Wine).

The launcher checks that `manifest/default.json` and the shared assets are beside `PsychEngine.exe` before starting. If Windows shows `There is no asset library with an ID of "default"`, the zip was not extracted as a whole or only the exe was copied.

## Latest Game Updates

- Adds the FNF Wasted V3 mod (song `wasted-v3`, normal and hard) with a corrected `pack.json` and `needsVoices` matching the shipped audio.
- Adds native Linux server hosting: `server/start-hawks-cloudflare-server.sh` runs the relay plus a Cloudflare Quick Tunnel on Linux.
- Adds `run-hawks-fnf-linux.sh` for playing the build through Wine on Linux.
- Clean dark blue and black UI theme across menus and hubs.
- Menu Music in Visuals settings can use the default menu tracks or any song included in the mod.
- Online 1v1 battles now return to the Online Battle hub instead of Freeplay.
- Post-battle rematch voting keeps both players in the room with Vote Song and No Vote choices.
- Player votes are shown in the room panel, and the relay handles one-vote, no-vote, and tie/random selection rules.
- Wednesday's Infidelity now works through the relay with its apostrophe-containing mod folder name.

## Included Mods

- Bloodbath Spanish Mix
- Doubling Down
- South Park Chaos
- Tolkien Week
- Silly Billy
- Wednesday's Infidelity
- FNF Wasted V3 (via the addon zip or the combined zip)

Darkness Takeover is intentionally not included. Smoke Em Out Struggle is not present in the current friend build (earlier docs claimed it was); it can return in a future release if the mod folder is recovered.

Both players should use the same release zip (and the same addon) so their mod folder names and chart files match during Online Battle.

## Repository Contents

- `server/` contains the relay server source, smoke test, and the Windows and Linux launcher scripts.
- `artifacts/FriendBattleServer.zip` is the ready-to-send server package with no public IP hardcoded.
- `release-notes.md` summarizes the latest release.
- `SHA256SUMS.txt` lists hashes for the release zips.

## Server

From the `server/` folder:

```bash
npm install
node server.js
```

For quick testing with a free public URL (no port forwarding):

```powershell
# Windows
Start-Hawks-Cloudflare-Server.bat
```

```bash
# Linux
./start-hawks-cloudflare-server.sh
```

Both launchers start the local relay, create a temporary Cloudflare tunnel, write `cloudflare-server-url.txt`, and do not require committing a public server address. The Linux script downloads `cloudflared` automatically if it is missing, accepts `--no-wait` to keep running in the background, and writes the fresh `wss://` URL into any game folder listed in `GAME_DIRS`.

## Validation

- Relay smoke test passed natively on Linux (Node v22.17.0) and end to end through a live Cloudflare Quick Tunnel.
- The release zips were verified for correct `modsList.txt` contents, the `mods/wasted` folder placement, and no Darkness Takeover folder.
- The friend zip was checked for `PsychEngine.exe`, `manifest/default.json`, and the extract-first launcher at the zip root.
