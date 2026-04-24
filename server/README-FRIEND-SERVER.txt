FNF ONLINE FRIEND BATTLE SERVER

Server URL example:
ws://127.0.0.1:8787

HOW TO RUN

1. Install Node.js if it is not already installed:
   https://nodejs.org/

2. Unzip this folder.

3. Double-click:
   start-server.bat

4. Keep the black server window open while playing.

5. If Windows Firewall asks, allow Node.js.

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
