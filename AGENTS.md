# AGENTS.md — Codex Navigation Guide

## Repository Overview

**submarine-battle** is a real-time 2-player naval combat game with Node.js/Express server and Vanilla JS client connected via Socket.io.

- **Language**: JavaScript (no TypeScript in MVP)
- **Server Framework**: Express 4.x + Socket.io 4.x
- **Client**: HTML5 Canvas + Vanilla JS
- **Game**: Turn-based combat with fog of war

## Codebase Structure

```
submarine-battle/
├── server/
│   ├── index.js       # Express server, Socket.io setup
│   ├── game.js        # GameManager class, game logic
│   └── rooms.js       # (Future) Room management
├── public/
│   ├── index.html     # Room join UI
│   ├── game.html      # Game board UI
│   ├── style.css      # Grid styling, game UI
│   └── client.js      # Socket.io client, event listeners
├── package.json
└── README.md
```

## Key Files

### `server/index.js` — Express + Socket.io Server

**Entry point**. Listens on port 3000, serves static files from `public/`.

```javascript
const io = socketIo(server);  // Socket.io instance
const gameManager = new GameManager();  // Game state

io.on('connection', (socket) => {
  // Handle: 'join-room', 'deploy-fleet', 'attack', 'disconnect'
  // Broadcast: 'room-joined', 'game-start', 'attack-result', 'game-over'
});
```

**Socket Events Handled**:
- `join-room({ roomCode, playerName })` → `gameManager.joinRoom()`
- `deploy-fleet({ roomCode, grid })` → `gameManager.deployFleet()`
- `attack({ roomCode, row, col })` → `gameManager.processAttack()`

**Broadcasts**:
- `io.to(roomCode).emit('event', data)` — Send to specific room

### `server/game.js` — Game Logic

**GameManager class** manages all rooms and game state.

```javascript
class GameManager {
  rooms = {}  // roomCode → Room object

  createRoom(roomCode)  // Returns Room
  joinRoom(roomCode, playerId)  // Returns Room
  deployFleet(roomCode, playerId, grid)  // Returns Room
  processAttack(roomCode, playerId, row, col)  // Returns attack result
  removePlayer(playerId)  // Cleanup on disconnect
}
```

**Helper Functions**:

```javascript
isValidFleet(grid)  // Check 10×10, ship counts
isHit(fleet, row, col)  // Returns bool: hit or miss
hasLost(fleet, hits)  // Returns bool: all ships sunk
```

**Data Structure** (Room):

```javascript
{
  code: "0123",
  players: ["socket-id-1", "socket-id-2"],
  grids: {
    "socket-id-1": { fleet: [[...]], hits: [[row, col], ...], misses: [...] },
    "socket-id-2": { ... }
  },
  gameState: "waiting" | "playing" | "over",
  currentTurn: 0,
  bothReady: false
}
```

### `public/index.html` — Room Join UI

Entry point. Players enter 4-digit room code and name.

```html
<input id="room-code" placeholder="4-digit code">
<input id="player-name" placeholder="Your name">
<button onclick="joinRoom()">Join Game</button>
```

### `public/game.html` — Game Board UI

Two-grid layout: Your Fleet + Enemy Fleet.

```html
<div id="your-grid"></div>  <!-- 10×10 CSS Grid -->
<div id="enemy-grid"></div>  <!-- Clickable for attacks -->
```

Cells:
- `.cell.ship` — Your fleet
- `.cell.hit` — Enemy hit you (red)
- `.cell.miss` — Enemy missed (blue)

### `public/client.js` — Socket.io Client

Handles user interactions and server responses.

```javascript
const socket = io();

socket.on('room-joined', ({roomCode, players}) => {
  // Show deployment UI
});

socket.on('game-start', () => {
  // Show combat UI
});

socket.on('attack-result', (result) => {
  // Update grids, show hit/miss, check game-over
});
```

**Key Functions**:

```javascript
joinRoom()          // Emit 'join-room' to server
startGame()         // Generate fleet, emit 'deploy-fleet'
generateFleet()     // Random placement (3 ships)
attack(row, col)    // Emit 'attack' to server
```

## Common Tasks for Agents

### Add a New Ship Type

1. **Update SPEC.md**: Modify ship counts/sizes
2. **Update `isValidFleet()`** in `server/game.js`
3. **Update grid rendering** in `public/client.js` or CSS
4. **Test**: Deploy fleet validation, play a game

### Fix a Bug in Attack Logic

1. **Locate**: `server/game.js` → `processAttack()` method
2. **Check**: `isHit()`, `hasLost()` logic
3. **Test**: Unit test ship validation, then E2E with 2 browsers

### Add Persistence (Save Game State)

1. **Schema**: Add `games` table with JSON game state
2. **Save**: Call `db.saveGame()` after each attack
3. **Load**: On `join-room`, fetch resumed game if exists
4. **Test**: Disconnect mid-game, refresh browser, state restored

## Game Flow Walkthrough

```
Browser 1                          Server                         Browser 2
   |                                |                                |
   | --joinRoom(code1, Alice)-----→ |                                |
   |                                | createRoom(code1)             |
   |←-------room-joined-------------|                                |
   |                                |←---joinRoom(code2, Bob)------  |
   |                                |                                |
   |←---player-joined(Bob)---------|                                |
   |                                |-------player-joined(Alice)-→  |
   |                                |                                |
   | --deploy-fleet(grid1)-------→  |                                |
   |                                | deployFleet(code1, Alice)     |
   |←-------fleet-deployed---------|                                |
   |                                |-------fleet-deployed--------→  |
   |                                |                                |
   |                        (Both ready, start game)                 |
   |                                |                                |
   |←----------game-start-----------|--------game-start----------→  |
   |                                |                                |
   | (Alice attacks 3,5)            |                                |
   | --attack(3,5)------------------→                                |
   |                                | Hit! (Alice's hit → Bob)      |
   |                                |-------attack-result---------→  |
   |←-------attack-result---------|                                |
   |                                |--------turn-change--------→   |
   |                                |                                |
   |                       (Bob attacks, etc.)                       |
   |                                |                                |
   |                    (Game ends when all ships sunk)              |
   |                                |                                |
   |←-----------game-over---------|------game-over----------→       |
```

## Recent Features (v0.2.0)

### Turn Timer

Each turn is limited to 30 seconds. If a player does not attack in time, the turn is automatically skipped.

- **Server**: `GameManager.startTurnTimer(roomCode, io)` — emits `turn-timer` every second
- **Forced skip**: `GameManager.forceTurnEnd(roomCode, io)` — emits `turn-timeout` and advances turn
- **Key events**: `turn-timer { secondsLeft }`, `turn-timeout { nextPlayer }`

### In-Game Chat

Players can send messages during a game via the `chat-message` event.

- **Rate limit**: 1 message per second per socket (enforced in `server/index.js`)
- **Length limit**: 140 characters max
- **XSS protection**: messages are trimmed and sent as plain text (no HTML rendering)
- **Key events**: `chat-message { playerName, text }` (client → server and server → client broadcast)

## Development Workflow

### Run Locally

```bash
npm install
npm start
# Open http://localhost:3000 in 2 tabs
```

### Run Tests

```bash
npm test
```

Test suites:

- **`tests/game.test.js`** (36 unit tests) — `isValidFleet`, `isHit`, `hasLost`, `GameManager` state transitions
- **`tests/integration.test.js`** (19 integration tests) — Socket.io round-trips: room join, fleet deploy, attack sequence, chat, turn timer, disconnect

All tests must pass before merging a pull request.

### Test Fleet Validation

```javascript
const grid = generateFleet();
console.assert(isValidFleet(grid) === true, "Fleet valid");
```

### Useful Grep Patterns

```bash
# Find all socket events
grep -r "socket.on\|socket.emit\|io.to" public/ server/

# Find game logic
grep -r "isHit\|hasLost\|processAttack" server/

# Find grid operations
grep -r "grid\[" server/ public/
```

## Testing Strategy

- **Unit**: Fleet validation, hit detection, win condition
- **E2E**: 2-browser test, full game from room join → game over
- **Load**: 100+ concurrent rooms

## Performance Notes

- **Scalability**: One GameManager (in-memory). For production, use Redis.
- **Memory**: ~1KB per game room (fleet grid + attack history)
- **Network**: Only delta updates sent (hit/miss only, not full grid)

## Security

- **Server-side Validation**: Fleet placement, attack legality
- **Client Trust**: 0 — all game logic computed server-side
- **Room Code**: 4-digit (not cryptographically secure, casual play OK)

---

## Deployment

See `railway.json` in the project root for Railway.app configuration.

```bash
railway login
railway init
railway up
```

Full deployment notes are in [README.md](README.md#-deployment-railway).

---

**Last updated**: 2026-06-01  
**Maintainer**: Taro Maezawa
