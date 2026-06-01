# submarine-battle

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-55%20passing-brightgreen.svg)

> Real-time 2-player naval battle game built with Node.js and Socket.io

Deploy your fleet on a 10×10 grid, hide behind the fog of war, and hunt down your opponent's ships in real time. No sign-up required — just share a 4-digit room code and battle.

## ✨ Features

- **Real-time gameplay** over WebSockets (Socket.io)
- **Fog of War** — you only see your own fleet and enemy hits/misses
- **Turn timer** — 30-second limit per turn keeps the game moving
- **In-game chat** with XSS protection and rate limiting
- **Mobile support** with touch-friendly UI
- **Room system** — connect with friends via a 4-digit code
- **Server-side validation** — all game logic runs on the server

## 🚀 Quick Start

```bash
git clone https://github.com/OWNER/submarine-battle.git
cd submarine-battle
npm install
npm start
# Open http://localhost:3000 in two browser tabs
```

## 🎮 How to Play

1. **Create a room** — open the app and enter any 4-digit code
2. **Share the code** — send it to your opponent so they can join
3. **Deploy your fleet** — place your submarine (3 cells), destroyer (2 cells), and cruiser (1 cell) on the 10×10 grid
4. **Attack** — click a cell on the enemy grid each turn; red = hit, blue = miss
5. **Win** — sink all 3 of your opponent's ships before they sink yours

## 🏗️ Architecture

Node.js + Express serves static files and hosts the Socket.io server. All game state lives in memory on the server — the client only renders what the server tells it. No database required for local play.

```
submarine-battle/
├── server/
│   ├── index.js          # Express + Socket.io server, event routing
│   ├── game.js           # GameManager class, all game logic
│   └── rooms.js          # Room management helpers
├── public/
│   ├── index.html        # Room join UI
│   ├── game.html         # Game board UI
│   ├── style.css         # Grid and game styling
│   └── client.js         # Socket.io client, event listeners
├── tests/
│   ├── game.test.js      # Unit tests (36 cases)
│   └── integration.test.js  # Integration tests (19 cases)
├── .github/workflows/
│   └── ci.yml            # GitHub Actions CI (Node 18 & 20)
├── railway.json          # Railway.app deployment config
├── AGENTS.md             # AI coding assistant guide
└── SPEC.md               # Full game specification
```

## 🔌 Socket.io Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{roomCode, playerName}` | Join or create a room |
| `deploy-fleet` | `{roomCode, grid}` | Submit fleet placement |
| `attack` | `{roomCode, row, col}` | Fire at a coordinate |
| `chat-message` | `{roomCode, playerName, text}` | Send a chat message |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `{roomCode, players}` | Room join confirmed |
| `player-joined` | `{playerName}` | Opponent connected |
| `fleet-deployed` | `{playerId, ready}` | Fleet placement acknowledged |
| `game-start` | — | Both players ready, game begins |
| `attack-result` | `{hit, row, col, gameOver, winner}` | Attack outcome |
| `turn-change` | `{nextPlayer}` | Turn switched |
| `turn-timer` | `{secondsLeft}` | Countdown update |
| `turn-timeout` | `{nextPlayer}` | Turn skipped on timeout |
| `chat-message` | `{playerName, text}` | Broadcast chat message |
| `game-over` | `{winner}` | Game ended |
| `error` | `{message}` | Error response |

## 🧪 Testing

```bash
npm test
```

55 tests across two suites:

- **Unit tests** (`tests/game.test.js`, 36 cases) — fleet validation, hit detection, win condition, GameManager state transitions
- **Integration tests** (`tests/integration.test.js`, 19 cases) — full Socket.io round-trips: room join, fleet deploy, attack sequence, chat, turn timer, disconnect handling

CI runs both suites on Node.js 18 and 20 via GitHub Actions on every push and pull request.

## 🚢 Deployment (Railway)

A `railway.json` is included in the repository. Deploy in three commands:

```bash
railway login
railway init
railway up
```

Railway natively supports persistent WebSocket connections. Vercel is **not** recommended (no persistent WebSocket support).

## 🤖 AI Coding Assistant Support

This project includes [`AGENTS.md`](AGENTS.md) — a navigation guide for AI coding assistants such as OpenAI Codex. It documents the codebase structure, key files, Socket.io event contracts, common task patterns, and a full game-flow diagram. Codex can use this file to onboard instantly and contribute without manual context-setting.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style guidelines, and the pull request process. All contributions must pass `npm test`.

## 📄 License

MIT © 2024 Taro Maezawa
