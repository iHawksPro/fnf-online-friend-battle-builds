# Hawks FNF Multiplayer Mod

This repository packages the online multiplayer Friday Night Funkin' test build, the Node.js relay server, and the current friend-test release files.

The public repository does not commit a public IP address or saved Cloudflare tunnel URL. The game build can read `online-server-url.txt`, and the in-game Online Battle menu also lets players edit the server URL before connecting.

## Latest Friend Build

Download the full ready-to-send Windows build from the Releases page:

- `Hawks-FNF-Multiplayer-Darkness-Takeover-SEND-TO-FRIEND.zip`

That zip contains the complete `Hawks FNF Multiplayer Mod` folder. Extract it and run `PsychEngine.exe`.

## Included Mod Songs

Darkness Takeover is installed and enabled in the latest build:

- A Family Guy
- Rooten Family
- Fashioned Values
- Death Lives
- Twinkle
- Final Fight
- Airborne

Both players should use the same release zip so their mod folder names and chart files match during Online Battle.

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
- The latest game launch was checked after packaging.
