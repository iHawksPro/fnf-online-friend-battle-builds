# Hawks FNF Multiplayer Friend Build - Mod Pack And Online Fixes

## Assets

- `Hawks-FNF-Multiplayer-All-Mods-No-Darkness-SEND-TO-FRIEND.zip`
- `FriendBattleServer.zip`

## Highlights

- Redesigns the menus and online hub with a clean dark blue and black theme.
- Adds a Menu Music setting that can play any song included in the mod, not only the default menu tracks.
- Fixes Online Battle end flow so 1v1 battles return to the Online Battle hub instead of Freeplay.
- Adds a post-battle rematch lobby with Vote Song and No Vote choices.
- Shows host and guest votes clearly in the room panel.
- Keeps both players in the same 1v1 room so they can keep battling without leaving and rejoining.
- Adds Smoke Em Out Struggle with Headache, Nerves, Release, Fading, and Dip.
- Keeps Wednesday's Infidelity, Bloodbath Spanish Mix, Doubling Down, South Park Chaos, Tolkien Week, and Silly Billy enabled.
- Keeps Darkness Takeover out of the build.

## Online Fixes

- Folder names with apostrophes now survive relay validation, fixing Wednesday's Infidelity in multiplayer.
- Private room and quick-match server state keeps the selected song, difficulty, and mod folder.
- Changing the song or difficulty resets both ready states before the match starts.
- Closed quick-match and started rooms are removed when players disconnect.
- The built-in fallback server URL is local (`ws://127.0.0.1:8787`) instead of an expired temporary tunnel.

## Post-Battle Voting

- When both players finish a 1v1, the relay moves the room into a voting phase.
- If one player votes and the other chooses No Vote, the voted song wins.
- If both players choose No Vote, the relay picks a fair random/default song from client-provided candidates.
- If both players vote for different songs, the relay randomly chooses between the tied votes.
- After the vote resolves, both players ready up again from the same room.

## Validation

- Windows release build completed successfully.
- Server smoke test passed locally.
- Friend zip contains `PsychEngine.exe`, `manifest/default.json`, shared assets, Wednesday's Infidelity, Smoke Em Out Struggle, and the extract-first launcher at the zip root.
- Friend zip scan confirmed no Darkness Takeover folder.
- GitHub server artifact scan confirmed no public IP text.
