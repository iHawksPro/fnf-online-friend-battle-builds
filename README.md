# FNF Online Friend Battle

This repository packages the online multiplayer Friday Night Funkin' build and the relay server for the current test setup.

The public GitHub copy uses local and generic defaults only. Set your own server address in the in-game menu before connecting across the internet.

## Repository Contents

- `server/` contains the Node.js relay source and startup files.
- `artifacts/FriendBattleServer.zip` is the ready-to-send server package.
- The latest Windows game build is attached to the GitHub Release for this repository because the zip is too large for a normal Git commit.

## Server

From the `server/` folder:

```powershell
npm install
node server.js
```

Or run `start-server.bat` on Windows.

## Latest Build

Download the current game build from the Releases page for this repository:

- `FNF-Online-Friend-Battle.zip`

## Notes

- Host players should forward TCP port `8787` to the server machine when using a public internet connection.
- Both players should use the same latest build zip from the Release page.
- The current multiplayer logic assigns the host to `P1` and the guest to `P2`.
