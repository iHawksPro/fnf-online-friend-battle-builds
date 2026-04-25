FNF ONLINE FRIEND BATTLE SERVER

Cloudflare Tunnel URL example:
wss://example.trycloudflare.com

Local server URL example:
ws://127.0.0.1:8787

HOW TO RUN

1. Install Node.js if it is not already installed:
   https://nodejs.org/

2. Unzip this folder.

3. For free online testing without port forwarding, double-click:
   Start-Hawks-Cloudflare-Server.bat

4. Keep the launcher window open while playing.

5. The launcher prints a wss://...trycloudflare.com URL, copies it to your clipboard,
   and saves it to cloudflare-server-url.txt.

6. In the game Online Battle menu, use that wss:// URL if the default does not connect.

Quick Tunnel URLs change every time the launcher starts. For a permanent URL,
create a named Cloudflare Tunnel on a Cloudflare account/domain.

DIRECT IP / LOCAL RUN

1. Double-click:
   start-server.bat

2. Keep the black server window open while playing.

3. If Windows Firewall asks, allow Node.js.

IMPORTANT NETWORK CHECK

This server listens on TCP port 8787.

For players outside your network to connect:

- Use your own public IP address or hostname in the game menu.
- TCP port 8787 must be forwarded from the router to the server computer.
- Windows Firewall must allow Node.js or TCP port 8787.

If the server is running on a different public IP, players must use that actual IP instead.

TEST

Open this on the server computer:
http://127.0.0.1:8787/health

It should show:
{"ok":true,"rooms":0}
