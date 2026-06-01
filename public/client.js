const socket = io();
let roomCode = null;
let playerId = null;

function joinRoom() {
  const code = document.getElementById("room-code").value;
  const name = document.getElementById("player-name").value;

  if (!code || code.length !== 4) {
    alert("Room code must be 4 digits");
    return;
  }

  roomCode = code;
  socket.emit("join-room", { roomCode, playerName: name });
}

function startGame() {
  // Generate fleet grid (simplified: random placement)
  const fleet = generateFleet();
  socket.emit("deploy-fleet", { roomCode, grid: fleet });
}

function generateFleet() {
  const grid = Array(10)
    .fill(null)
    .map(() => Array(10).fill(null));
  const ships = ["submarine", "destroyer", "cruiser"];

  ships.forEach((ship) => {
    let placed = false;
    while (!placed) {
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);
      if (!grid[row][col]) {
        grid[row][col] = ship;
        placed = true;
      }
    }
  });

  return grid;
}

function attack(row, col) {
  socket.emit("attack", { roomCode, row, col });
}

socket.on("room-joined", ({ roomCode, players }) => {
  console.log(`Joined room ${roomCode}`);
  document.getElementById("room-join").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("deployment").style.display = "block";
});

socket.on("player-joined", ({ playerName }) => {
  console.log(`${playerName} joined the game`);
});

socket.on("game-start", () => {
  document.getElementById("deployment").style.display = "none";
  document.getElementById("combat").style.display = "block";
  document.getElementById("message").textContent =
    "Game started! Your turn to attack.";
});

socket.on("attack-result", (result) => {
  const hit = result.hit ? "Hit!" : "Miss";
  document.getElementById("message").textContent = hit;

  if (result.gameOver) {
    document.getElementById("combat").style.display = "none";
    document.getElementById("game-over").style.display = "block";
    const isWinner = result.winner === socket.id;
    document.getElementById("game-result").textContent = isWinner
      ? "You Won! 🎉"
      : "You Lost";
  }
});

socket.on("turn-timer", ({ secondsLeft }) => {
  const el = document.getElementById("turn-timer");
  if (!el) return;
  el.textContent = secondsLeft;
  if (secondsLeft <= 5) {
    el.classList.add("warning");
  } else {
    el.classList.remove("warning");
  }
});

socket.on("turn-timeout", ({ nextPlayer }) => {
  document.getElementById("message").textContent =
    nextPlayer === socket.id ? "Your turn!" : "Opponent's turn";
  const timerEl = document.getElementById("turn-timer");
  if (timerEl) {
    timerEl.textContent = "30";
    timerEl.classList.remove("warning");
  }
});

socket.on("error", ({ message }) => {
  alert("Error: " + message);
});

socket.on("chat-message", ({ playerName, text }) => {
  const messages = document.getElementById("chat-messages");
  if (!messages) return;
  const p = document.createElement("p");
  p.textContent = `[${playerName}]: ${text}`;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
});

document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("chat-send");
  const chatInput = document.getElementById("chat-input");

  function sendChatMessage() {
    const text = chatInput.value;
    if (!text || text.trim().length === 0) return;
    const name = document.getElementById("player-name").value;
    socket.emit("chat-message", {
      roomCode,
      playerName: name,
      text: text.trim(),
    });
    chatInput.value = "";
  }

  if (sendBtn) sendBtn.addEventListener("click", sendChatMessage);
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
  }

  ["grid", "your-grid", "enemy-grid"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(
      "touchstart",
      (e) => {
        const cell = e.target.closest(".cell");
        if (!cell) return;
        e.preventDefault();
        cell.click();
      },
      { passive: false },
    );
  });
});
