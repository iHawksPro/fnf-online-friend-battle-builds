# Hawks FNF Multiplayer Mod

This repository packages the online multiplayer Friday Night Funkin' test build, the Node.js relay server, and the current friend-test release files.

The public repository does not commit a public IP address or saved Cloudflare tunnel URL. The game build can read `online-server-url.txt`, and the in-game Online Battle menu also lets players edit the server URL before connecting.

## Latest Friend Build

Latest release: `v2026.04.26-song-search-fixes`

Download the full ready-to-send Windows build from the Releases page:

- `Hawks-FNF-Multiplayer-SEND-TO-FRIEND.zip`

That zip contains the complete game files at the zip root. Extract the whole zip first, then run `! RUN HAWKS FNF.bat`.

The launcher checks that `manifest/default.json` and the shared assets are beside `PsychEngine.exe` before starting. If Windows shows `There is no asset library with an ID of "default"`, the zip was not extracted as a whole or only the exe was copied.

## Current Build

Both players should use the same latest release zip so their mod folder names, chart files, stage assets, and Online Battle code match.

The Online Battle song browser supports search: focus the song panel, press `/`, then type to filter songs. You can also click the Search box directly.

This build also adds Kenny's opposite-side notes for Bloodbath Spanish Mix, removes the broken Chaos/Reign of Chaos spacebar dodge popup/death behavior, and restores the original Doubling Down hallway background.

## Repository Contents

- `server/` contains the relay server source, smoke test, and Windows launcher scripts.
- `artifacts/FriendBattleServer.zip` is the ready-to-send server package.
- `release-notes.md` summarizes the latest release.
- `SHA256SUMS.txt` lists hashes for the uploaded zips.

## Server

From the `server/` folder:

```powershell
npm install
node server.js
```

For quick testing, run:

```powershell
Start-Hawks-Cloudflare-Server.bat
```

The Cloudflare launcher starts the local relay, creates a temporary tunnel, writes `cloudflare-server-url.txt`, and does not require committing a public server address.

## Validation

- Windows game build completed successfully.
- Relay smoke tests passed locally and through the current Cloudflare tunnel.
- The latest friend zip was checked for `manifest/default.json`, shared assets, packaged mods, and the extract-first launcher at the zip root.
