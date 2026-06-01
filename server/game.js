class GameManager {
  constructor() {
    this.rooms = {};
  }

  createRoom(roomCode) {
    if (this.rooms[roomCode]) return null;
    this.rooms[roomCode] = {
      code: roomCode,
      players: [],
      grids: {},
      currentTurn: 0,
      gameState: "waiting",
      turnTimer: null,
    };
    return this.rooms[roomCode];
  }

  startTurnTimer(roomCode, io) {
    const room = this.rooms[roomCode];
    if (!room) return;
    if (room.turnTimer) clearInterval(room.turnTimer);
    let secondsLeft = 30;
    io.to(roomCode).emit("turn-timer", { secondsLeft });
    room.turnTimer = setInterval(() => {
      secondsLeft--;
      io.to(roomCode).emit("turn-timer", { secondsLeft });
      if (secondsLeft <= 0) {
        this.forceTurnEnd(roomCode, io);
      }
    }, 1000);
  }

  forceTurnEnd(roomCode, io) {
    const room = this.rooms[roomCode];
    if (!room) return;
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }
    room.currentTurn = room.currentTurn === 0 ? 1 : 0;
    io.to(roomCode).emit("turn-timeout", {
      nextPlayer: room.players[room.currentTurn],
    });
  }

  stopTurnTimer(roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return;
    if (room.turnTimer) {
      clearInterval(room.turnTimer);
      room.turnTimer = null;
    }
  }

  joinRoom(roomCode, playerId) {
    let room = this.rooms[roomCode];
    if (!room) {
      room = this.createRoom(roomCode);
    }

    if (room.players.length >= 2) return null;

    room.players.push(playerId);
    return room;
  }

  deployFleet(roomCode, playerId, grid) {
    const room = this.rooms[roomCode];
    if (!room || !room.players.includes(playerId)) return null;

    if (!isValidFleet(grid)) return null;

    room.grids[playerId] = {
      fleet: grid,
      hits: [],
      misses: [],
    };

    room.bothReady =
      room.players.length === 2 && Object.keys(room.grids).length === 2;

    if (room.bothReady) {
      room.gameState = "playing";
      room.currentTurn = 0;
    }

    return room;
  }

  isCurrentTurn(roomCode, playerId) {
    const room = this.rooms[roomCode];
    if (!room) return false;
    return room.players[room.currentTurn] === playerId;
  }

  advanceTurn(roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return;
    room.currentTurn = room.currentTurn === 0 ? 1 : 0;
  }

  setGameOver(roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return;
    room.gameState = "over";
  }

  processAttack(roomCode, playerId, row, col) {
    const room = this.rooms[roomCode];
    if (!room || room.gameState !== "playing") return null;

    const opponentId = room.players.find((p) => p !== playerId);
    const opponentGrid = room.grids[opponentId];
    const playerGrid = room.grids[playerId];

    if (!opponentGrid || !playerGrid) return null;

    // 既に攻撃済みのマスへの再攻撃を防ぐ
    const alreadyHit = opponentGrid.hits.some(
      ([r, c]) => r === row && c === col,
    );
    const alreadyMissed = opponentGrid.misses.some(
      ([r, c]) => r === row && c === col,
    );
    if (alreadyHit || alreadyMissed) return null;

    const hit = isHit(opponentGrid.fleet, row, col);

    if (hit) {
      opponentGrid.hits.push([row, col]);
    } else {
      opponentGrid.misses.push([row, col]);
    }

    const gameOver = hasLost(opponentGrid.fleet, opponentGrid.hits);
    const result = {
      hit,
      row,
      col,
      gameOver: false,
      winner: null,
      nextPlayer: null,
    };

    if (gameOver) {
      result.gameOver = true;
      result.winner = playerId;
    } else {
      result.nextPlayer = opponentId;
    }

    return result;
  }

  removePlayer(playerId) {
    for (const roomCode in this.rooms) {
      const room = this.rooms[roomCode];
      const idx = room.players.indexOf(playerId);
      if (idx !== -1) {
        delete this.rooms[roomCode];
        console.log(`Room ${roomCode} destroyed`);
        break;
      }
    }
  }
}

function isValidFleet(grid) {
  if (grid.length !== 10 || grid[0].length !== 10) return false;
  const shipCounts = { submarine: 0, destroyer: 0, cruiser: 0 };
  for (const row of grid) {
    for (const cell of row) {
      if (cell && shipCounts[cell] !== undefined) shipCounts[cell]++;
    }
  }
  return (
    shipCounts.submarine === 3 &&
    shipCounts.destroyer === 2 &&
    shipCounts.cruiser === 1
  );
}

function isHit(fleet, row, col) {
  return !!fleet[row][col];
}

function hasLost(fleet, hits) {
  const shipCount = fleet.flat().filter(Boolean).length;
  return hits.length >= shipCount;
}

module.exports = { GameManager, isValidFleet, isHit, hasLost };
