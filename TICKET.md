# submarine-battle Implementation Tickets

## MVP Status: ✅ Core Mechanics Complete

### Core Game Features (MVP)

- [x] Socket.io server setup
- [x] Room join/create (4-digit code)
- [x] Fleet deployment validation (3 ships)
- [x] Turn-based attack system
- [x] Hit/miss detection
- [x] Win condition (all ships sunk)
- [x] Fog of war (client-side grid rendering)
- [x] Basic HTML5 UI (10×10 CSS Grid)
- [x] Real-time player-to-player communication

### Code Quality

- [x] Game logic separation (server/game.js)
- [x] Input validation
- [x] Error handling (socket events)
- [x] Server-side state verification

### Documentation

- [x] README.md
- [x] CONTRIBUTING.md
- [x] AGENTS.md
- [x] SPEC.md
- [x] LICENSE (MIT)

### Testing

- [ ] Unit tests (fleet validation, hit detection)
- [ ] E2E test (full game with 2 browsers)
- [ ] Load test (100+ concurrent rooms)

## Known Limitations (Future Work)

- [ ] **In-Memory Storage**: Game state lost on server restart (use Redis for production)
- [ ] **Simple Room Code**: 4-digit code is guessable (add expiration / longer codes)
- [ ] **No Persistence**: Games not saved (add PostgreSQL backend)
- [ ] **Mobile UI**: Not optimized for touch (add drag/tap ship placement)
- [ ] **AI Opponent**: No single-player mode (add ML bot)
- [ ] **Chat**: No in-game messaging
- [ ] **Leaderboards**: No ranking system

## Deployment Checklist

- [ ] Install Node.js 18+ on production server
- [ ] Set `NODE_ENV=production`
- [ ] Use `PORT` env var
- [ ] Enable HTTPS (SSL cert)
- [ ] Set up process manager (PM2, systemd)
- [ ] Configure firewall (allow port 3000 / 443)
- [ ] Smoke test (2-browser game)

## Future Enhancements (Out of MVP Scope)

- [ ] Ship placement hints / suggestions
- [ ] Undo last attack
- [ ] Game replay / spectator mode
- [ ] Difficulty levels (AI opponent)
- [ ] Custom grid sizes (8×8, 12×12)
- [ ] Time-limited turns
- [ ] Badges / achievements
- [ ] Discord integration (watch friend games)

---

**Last updated**: 2024-06
