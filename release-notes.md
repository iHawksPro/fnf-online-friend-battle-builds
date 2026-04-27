# Hawks FNF Multiplayer Friend Build - Online Rematch Update

## Assets

- `Hawks-FNF-Multiplayer-SEND-TO-FRIEND.zip`
- `FriendBattleServer.zip`

## Highlights

- Redesigns the menus and online hub with a clean dark blue and black theme.
- Adds a Menu Music setting that can play any song included in the mod, not only the default menu tracks.
- Fixes Online Battle end flow so 1v1 battles return to the Online Battle hub instead of Freeplay.
- Adds a post-battle rematch lobby with Vote Song and No Vote choices.
- Shows host and guest votes clearly in the room panel.
- Keeps both players in the same 1v1 room so they can keep battling without leaving and rejoining.

## Post-Battle Voting

- When both players finish a 1v1, the relay moves the room into a voting phase.
- If one player votes and the other chooses No Vote, the voted song wins.
- If both players choose No Vote, the relay picks a fair random/default song from client-provided candidates.
- If both players vote for different songs, the relay randomly chooses between the tied votes.
- After the vote resolves, both players ready up again from the same room.

## UI

- Dark blue and black theme across the main menu, options, freeplay, story, credits, mods, editors, and online hub.
- Online Battle hub keeps the song search/browser, room panel, quick-match lobby, and connection status.
- The room panel now includes vote status and next-song status after battles.

## Fixes

- Online Battle no longer closes the socket when returning from gameplay to the lobby.
- The relay now tracks room phases: lobby, playing, and voting.
- Menu music loading preserves existing behavior while allowing mod song selections.
- The server tunnel launcher now writes fresh Cloudflare URLs into the actual playable build folder.
- The built-in fallback server URL is local (`ws://127.0.0.1:8787`) instead of an expired temporary tunnel.

## Validation

- Windows release build completed successfully.
- Server JavaScript syntax check passed with `node --check`.
- Existing relay smoke test passed locally.
- New post-battle vote/rematch relay test passed locally.
- Friend zip contains `PsychEngine.exe`, `manifest/default.json`, shared assets, mod content, and the extract-first launcher at the zip root.
