# Hawks FNF Online — engine rebuild v1.0 (Windows + Linux)

Full rebuild of the Hawks multiplayer client on stock Psych Engine 1.0.4 —
now with a native Linux build and a permanently hosted relay server.

## What's here
- **Hawks-FNF-Windows-Engine.zip** — the game, Windows
- **Hawks-FNF-Linux-Engine.tar.gz** — the game, native Linux
- **Hawks-FNF-Mods-Pack1.zip** — Wednesday's Infidelity
- **Hawks-FNF-Mods-Pack2.zip** — Bloodbath Spanish Mix, Doubling Down, Silly Billy, South Park Chaos, Tolkien Week, wasted

Install: extract the engine for your OS, then extract BOTH mods packs into its
`mods/` folder. See INSTALL.txt inside.

## One-file downloads (Google Drive)

Prefer a single download with everything baked in (engine + all 7 mods)?
- Windows: https://drive.google.com/open?id=1yggwI_dOYtkB5pqPD_lGO1zxFIaWxQux
- Linux: https://drive.google.com/open?id=1JDP5JFDSod5yUJ42MBt5z2HP4yWaBT7N

(Too big for GitHub's 2 GiB release-file limit, hence Drive. SHA256 hashes are
in the Drive folder. Google will show a "can't scan for viruses" warning for
files this size — choose "download anyway".)

## Online play
- Quick match, private rooms with 6-char codes, live lobby with player OS
  badges (Linux/Windows), ready-up flow, post-match song voting / rematch.
- Connects automatically to the hosted relay (`wss://hawks-fnf-relay.onrender.com`)
  — nobody hosts anything. If the first connect of the day fails, wait ~40s
  and Reconnect (free-tier server waking up).
- You'll be asked to choose a player name on your first visit to ONLINE.
- NOTE: not cross-compatible in-match with the old 2025 Hawks build — both
  players should use this release.

## Mod fixes in this release (wasted-v3)
- Fixed all missing/case-mismatched character files (errors + black death screen).
- Rewrote the mod's stage-color helper for Psych 1.0.4 (sprite errors gone).
- The shotgun section no longer insta-kills on a miss; the 24-of-26 quota
  death at 3:34 is disabled (re-enable via SHOTGUN_QUOTA in a.lua).

Known gaps (next releases): opponent strum lane rendering, tighter
simultaneous song start.


---

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
- Makes `wasted-v3` actually playable on this build's Psych Engine 1.0.4 (the mod was written for 0.6.x and crashed within seconds):
  - In Psych 1.0, Lua sprites and HScript `game.variables` share one namespace; the shader system's `game.variables["bloomEffect"]`-style assignments overwrote six same-named dummy sprites, so tweening them hit a shader with no `x` property and crashed ("The object does not have the property \"x\""). All shader variable keys are now prefixed `shdr_`.
  - Replaced the removed `game.modchartSprites` API in `unfortunate_Shaders.lua` and `global_functions.lua` (the two on-screen HScript errors).
  - `mirrordrug` tweened six `nada*` value-holder sprites that no script created (crash on Hard at 4:21); they are now created up front.
  - Fixed case-mismatched `'Cleveland'` sprite references in `a.lua`, replaced the missing `characters/Oooooooooohhh` spritesheet with a blank dummy, and guarded a cross-script `updateShader()` call.
  - The chart swapped boyfriend to `bf exe` at 31s, whose spritesheet is missing from every known copy of the mod (instant crash); remapped to `bf s`. Added the vanilla `bf`/`dad`/`gf` character JSONs the chart's other Change Character events need (the original standalone shipped them in `assets/`).
  - Added silent `switch off` / `Radio Static` sound stubs (missing upstream).
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
