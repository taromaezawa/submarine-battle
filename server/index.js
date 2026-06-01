const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const { GameManager } = require("./game");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
});

app.use(express.static(path.join(__dirname, "../public")));

const PORT = process.env.PORT || 3000;
const gameManager = new GameManager();

io.on("connection", (socket) => {
  console.log(`[Socket] ${socket.id} connected`);

  socket.on("join-room", ({ roomCode, playerName }) => {
    const room = gameManager.joinRoom(roomCode, socket.id);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    socket.join(roomCode);
    socket.emit("room-joined", { roomCode, players: room.players });
    io.to(roomCode).emit("player-joined", { playerName });
  });

  socket.on("deploy-fleet", ({ roomCode, grid }) => {
    const room = gameManager.deployFleet(roomCode, socket.id, grid);
    if (!room) {
      socket.emit("error", { message: "Deploy failed" });
      return;
    }

    io.to(roomCode).emit("fleet-deployed", {
      playerId: socket.id,
      ready: room.bothReady,
    });

    if (room.bothReady) {
      io.to(roomCode).emit("game-start");
      gameManager.startTurnTimer(roomCode, io);
    }
  });

  socket.on("attack", ({ roomCode, row, col }) => {
    if (!gameManager.isCurrentTurn(roomCode, socket.id)) {
      socket.emit("error", { message: "Invalid attack" });
      return;
    }

    const result = gameManager.processAttack(roomCode, socket.id, row, col);
    if (!result) {
      socket.emit("error", { message: "Invalid attack" });
      return;
    }

    io.to(roomCode).emit("attack-result", result);

    if (result.gameOver) {
      gameManager.setGameOver(roomCode);
      gameManager.stopTurnTimer(roomCode);
      io.to(roomCode).emit("game-over", { winner: result.winner });
    } else {
      gameManager.advanceTurn(roomCode);
      gameManager.startTurnTimer(roomCode, io);
      io.to(roomCode).emit("turn-change", { nextPlayer: result.nextPlayer });
    }
  });

  socket.on("chat-message", ({ roomCode, playerName, text }) => {
    const room = gameManager.rooms[roomCode];
    if (!room) return;
    if (!text || typeof text !== "string") return;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 140) return;
    const now = Date.now();
    if (socket.lastChatTime && now - socket.lastChatTime < 1000) return;
    socket.lastChatTime = now;
    io.to(roomCode).emit("chat-message", { playerName, text: trimmed });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] ${socket.id} disconnected`);
    for (const roomCode in gameManager.rooms) {
      if (gameManager.rooms[roomCode].players.includes(socket.id)) {
        gameManager.stopTurnTimer(roomCode);
        break;
      }
    }
    gameManager.removePlayer(socket.id);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { server, io, gameManager };
