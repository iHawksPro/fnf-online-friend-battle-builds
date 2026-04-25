# Darkness Takeover Friend Build

## Assets

- `Hawks-FNF-Multiplayer-Darkness-Takeover-SEND-TO-FRIEND.zip`
- `FriendBattleServer.zip`

## Highlights

- Adds the Darkness Takeover Psych Engine mod to the friend-test game build.
- Enables Darkness Takeover by default through `modsList.txt`.
- Adds Online Battle song-browser support for mod folders and custom chart difficulties.
- Keeps host on `P1` and guest on `P2`.
- Keeps the public repository free of hardcoded public IP addresses and saved tunnel URLs.
- Adds the Cloudflare server launcher to the public server package.

## Included Songs

- A Family Guy
- Rooten Family
- Fashioned Values
- Death Lives
- Twinkle
- Final Fight
- Airborne

## Fixes

- Repacked the friend build with the game files at the zip root.
- Added `! RUN HAWKS FNF.bat` so missing `manifest/default.json` or shared assets are caught before Lime starts.
- Tightened the oversized custom menu and Online Battle UI.
- Prevented stale Online Battle callbacks from crashing after switching into gameplay.
- Closes stale quick-match and started lobbies when players disconnect.
- Patched Darkness Takeover charts that referenced missing `Voices.ogg` files so they load instrumental-only.

## Validation

- Windows release build passed.
- Server smoke test passed locally.
- Server smoke test passed through the current Cloudflare tunnel.
- Friend zip contains `PsychEngine.exe`, `manifest/default.json`, shared assets, Darkness Takeover mods, and the extract-first launcher at the zip root.
