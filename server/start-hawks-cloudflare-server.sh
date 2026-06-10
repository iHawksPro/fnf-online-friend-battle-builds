#!/usr/bin/env bash
# Hawks FNF Multiplayer Server Launcher (Linux)
# Starts the Node relay and a Cloudflare Quick Tunnel, then prints the wss:// URL
# to share with your friend. Keep this terminal open while players are connected.
#
# Usage:
#   ./start-hawks-cloudflare-server.sh           # run until Ctrl+C / q
#   ./start-hawks-cloudflare-server.sh --no-wait # print URL and leave processes running
#
# Optional env:
#   PORT=8787                 relay port
#   GAME_DIRS="/path/a:/path/b"  extra game folders to receive online-server-url.txt

set -u
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8787}"
LOG_DIR="$SERVER_DIR/logs"
mkdir -p "$LOG_DIR"

NO_WAIT=0
[ "${1:-}" = "--no-wait" ] && NO_WAIT=1

step() { printf '\033[36m[Hawks]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "node is not installed or not on PATH. Install it from https://nodejs.org/ or your package manager."

port_listening() {
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && { exec 3>&- 3<&-; return 0; }
  return 1
}

if [ ! -d "$SERVER_DIR/node_modules/ws" ]; then
  step "Installing server packages..."
  command -v npm >/dev/null 2>&1 || fail "npm is required to install server packages."
  (cd "$SERVER_DIR" && npm install --no-audit --no-fund) || fail "npm install failed."
fi

RELAY_PID=""
if port_listening; then
  step "Relay is already listening on port $PORT."
else
  step "Starting local relay on port $PORT..."
  : > "$LOG_DIR/server.out.log"
  (cd "$SERVER_DIR" && PORT="$PORT" node server.js >> "$LOG_DIR/server.out.log" 2>&1) &
  RELAY_PID=$!
  started=0
  for _ in $(seq 1 20); do
    if port_listening; then started=1; break; fi
    sleep 0.5
  done
  if [ "$started" != 1 ]; then
    tail -n 40 "$LOG_DIR/server.out.log" || true
    fail "Relay did not start on port $PORT."
  fi
fi

CLOUDFLARED="$(command -v cloudflared || true)"
if [ -z "$CLOUDFLARED" ] && [ -x "$SERVER_DIR/cloudflared" ]; then
  CLOUDFLARED="$SERVER_DIR/cloudflared"
fi
if [ -z "$CLOUDFLARED" ]; then
  step "Downloading Cloudflare Tunnel..."
  arch="$(uname -m)"
  case "$arch" in
    x86_64) asset="cloudflared-linux-amd64" ;;
    aarch64) asset="cloudflared-linux-arm64" ;;
    *) fail "Unsupported architecture: $arch. Install cloudflared manually." ;;
  esac
  curl -fsSL -o "$SERVER_DIR/cloudflared" "https://github.com/cloudflare/cloudflared/releases/latest/download/$asset" || fail "Could not download cloudflared."
  chmod +x "$SERVER_DIR/cloudflared"
  CLOUDFLARED="$SERVER_DIR/cloudflared"
fi

step "Starting Cloudflare Quick Tunnel..."
: > "$LOG_DIR/cloudflared.log"
"$CLOUDFLARED" tunnel --url "http://localhost:$PORT" --no-autoupdate >> "$LOG_DIR/cloudflared.log" 2>&1 &
TUNNEL_PID=$!

cleanup() {
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null
  [ -n "${RELAY_PID:-}" ] && kill "$RELAY_PID" 2>/dev/null
}

HTTPS_URL=""
for _ in $(seq 1 60); do
  sleep 1
  HTTPS_URL="$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | head -n 1 || true)"
  [ -n "$HTTPS_URL" ] && break
  kill -0 "$TUNNEL_PID" 2>/dev/null || break
done

if [ -z "$HTTPS_URL" ]; then
  tail -n 80 "$LOG_DIR/cloudflared.log" || true
  cleanup
  fail "Cloudflare did not return a tunnel URL."
fi

WS_URL="${HTTPS_URL/https:/wss:}"
printf '%s\n' "$WS_URL" > "$SERVER_DIR/cloudflare-server-url.txt"

# Write the URL into any game build folders that exist.
DEFAULT_GAME_DIRS=(
  "$SERVER_DIR/../build"
  "$SERVER_DIR/../../build"
  "$SERVER_DIR/../../Playable Build/Extracted"
)
IFS=':' read -r -a EXTRA_GAME_DIRS <<< "${GAME_DIRS:-}"
UPDATED_TARGETS=()
for target in "${DEFAULT_GAME_DIRS[@]}" "${EXTRA_GAME_DIRS[@]}"; do
  [ -n "$target" ] && [ -d "$target" ] || continue
  resolved="$(cd "$target" && pwd)"
  case " ${UPDATED_TARGETS[*]:-} " in *" $resolved "*) continue ;; esac
  printf '%s\n' "$WS_URL" > "$resolved/online-server-url.txt"
  UPDATED_TARGETS+=("$resolved")
done

# Copy to clipboard when a clipboard tool is available (Wayland or X11).
if command -v wl-copy >/dev/null 2>&1; then printf '%s' "$WS_URL" | wl-copy 2>/dev/null || true
elif command -v xclip >/dev/null 2>&1; then printf '%s' "$WS_URL" | xclip -selection clipboard 2>/dev/null || true
fi

echo
printf '\033[32mSERVER IS ON\033[0m\n\n'
printf '\033[33mGame Server URL:\033[0m\n%s\n\n' "$WS_URL"
echo "Saved to: $SERVER_DIR/cloudflare-server-url.txt"
if [ "${#UPDATED_TARGETS[@]}" -gt 0 ]; then
  echo "Also wrote it to these game folders as online-server-url.txt:"
  for t in "${UPDATED_TARGETS[@]}"; do echo " - $t"; done
fi
echo
echo "Quick Tunnel URLs change every time this launcher starts."
echo "If your friend cannot connect, send them the URL above or have them paste it into Online Battle > Server URL."
echo

if [ "$NO_WAIT" = 1 ]; then
  echo "Leaving relay (pid ${RELAY_PID:-external}) and tunnel (pid $TUNNEL_PID) running."
  exit 0
fi

trap 'cleanup; echo; echo "Server launcher closed."; exit 0' INT TERM
echo "Press q then Enter (or Ctrl+C) to stop the tunnel and close this launcher."
while kill -0 "$TUNNEL_PID" 2>/dev/null; do
  if read -r -t 1 key 2>/dev/null && [ "$key" = "q" ]; then break; fi
done
kill -0 "$TUNNEL_PID" 2>/dev/null || printf '\033[31mCloudflare Tunnel stopped.\033[0m\n'
cleanup
echo "Server launcher closed."
