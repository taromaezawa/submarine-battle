"use strict";

const { createServer } = require("http");
const { Server } = require("socket.io");
const { io: ioClient } = require("socket.io-client");
const { GameManager } = require("../server/game");

jest.setTimeout(10000);

function emptyGrid() {
  return Array.from({ length: 10 }, () => Array(10).fill(null));
}

function validGrid() {
  const g = emptyGrid();
  g[0][0] = "submarine";
  g[0][1] = "destroyer";
  g[0][2] = "cruiser";
  return g;
}

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

let httpServer;
let serverIo;
let gameManager;
let PORT;

beforeAll((done) => {
  httpServer = createServer();
  gameManager = new GameManager();
  serverIo = new Server(httpServer, { cors: { origin: "*" } });

  serverIo.on("connection", (socket) => {
    socket.on("join-room", ({ roomCode, playerName }) => {
      const room = gameManager.joinRoom(roomCode, socket.id);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      socket.join(roomCode);
      socket.emit("room-joined", { roomCode, players: room.players });
      serverIo.to(roomCode).emit("player-joined", { playerName });
    });

    socket.on("deploy-fleet", ({ roomCode, grid }) => {
      const room = gameManager.deployFleet(roomCode, socket.id, grid);
      if (!room) {
        socket.emit("error", { message: "Deploy failed" });
        return;
      }
      serverIo.to(roomCode).emit("fleet-deployed", {
        playerId: socket.id,
        ready: room.bothReady,
      });
      if (room.bothReady) {
        serverIo.to(roomCode).emit("game-start");
        gameManager.startTurnTimer(roomCode, serverIo);
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
      serverIo.to(roomCode).emit("attack-result", result);
      if (result.gameOver) {
        gameManager.setGameOver(roomCode);
        gameManager.stopTurnTimer(roomCode);
        serverIo.to(roomCode).emit("game-over", { winner: result.winner });
      } else {
        gameManager.advanceTurn(roomCode);
        gameManager.startTurnTimer(roomCode, serverIo);
        serverIo
          .to(roomCode)
          .emit("turn-change", { nextPlayer: result.nextPlayer });
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
      serverIo.to(roomCode).emit("chat-message", { playerName, text: trimmed });
    });

    socket.on("disconnect", () => {
      for (const roomCode in gameManager.rooms) {
        if (gameManager.rooms[roomCode].players.includes(socket.id)) {
          gameManager.stopTurnTimer(roomCode);
          break;
        }
      }
      gameManager.removePlayer(socket.id);
    });
  });

  httpServer.listen(0, () => {
    PORT = httpServer.address().port;
    done();
  });
});

afterAll((done) => {
  serverIo.close();
  httpServer.close(done);
});

function makeClient() {
  return ioClient(`http://localhost:${PORT}`, {
    autoConnect: true,
    forceNew: true,
  });
}

function connected(client) {
  return new Promise((resolve) => {
    if (client.connected) return resolve();
    client.once("connect", resolve);
  });
}

describe("3-1. ルーム管理", () => {
  let c1, c2, c3;

  afterEach((done) => {
    const clients = [c1, c2, c3].filter(Boolean);
    let remaining = clients.length;
    if (remaining === 0) return done();
    clients.forEach((c) => {
      if (c.connected) {
        c.once("disconnect", () => {
          remaining--;
          if (remaining === 0) done();
        });
        c.disconnect();
      } else {
        remaining--;
        if (remaining === 0) done();
      }
    });
  });

  it("4桁コードで新規ルーム参加できる", async () => {
    c1 = makeClient();
    await connected(c1);
    const p = waitFor(c1, "room-joined");
    c1.emit("join-room", { roomCode: "1111", playerName: "Alice" });
    const data = await p;
    expect(data.roomCode).toBe("1111");
    expect(data.players).toContain(c1.id);
  });

  it("2人目が同じコードで参加できる", async () => {
    c1 = makeClient();
    c2 = makeClient();
    await Promise.all([connected(c1), connected(c2)]);
    c1.emit("join-room", { roomCode: "2222", playerName: "Alice" });
    await waitFor(c1, "room-joined");
    const p = waitFor(c2, "room-joined");
    c2.emit("join-room", { roomCode: "2222", playerName: "Bob" });
    const data = await p;
    expect(data.roomCode).toBe("2222");
    expect(data.players).toHaveLength(2);
  });

  it("3人目はエラーになる", async () => {
    c1 = makeClient();
    c2 = makeClient();
    c3 = makeClient();
    await Promise.all([connected(c1), connected(c2), connected(c3)]);
    c1.emit("join-room", { roomCode: "3333", playerName: "Alice" });
    await waitFor(c1, "room-joined");
    c2.emit("join-room", { roomCode: "3333", playerName: "Bob" });
    await waitFor(c2, "room-joined");
    const p = waitFor(c3, "error");
    c3.emit("join-room", { roomCode: "3333", playerName: "Charlie" });
    const err = await p;
    expect(err.message).toBeDefined();
  });

  it("存在しないルームコードでも参加できる（新規作成される）", async () => {
    c1 = makeClient();
    await connected(c1);
    const p = waitFor(c1, "room-joined");
    c1.emit("join-room", { roomCode: "9999", playerName: "Alice" });
    const data = await p;
    expect(data.roomCode).toBe("9999");
  });
});

describe("3-2. 艦隊配置", () => {
  const ROOM = "DEPL";
  let c1, c2;

  beforeEach(async () => {
    c1 = makeClient();
    c2 = makeClient();
    await Promise.all([connected(c1), connected(c2)]);
    c1.emit("join-room", { roomCode: ROOM, playerName: "A" });
    await waitFor(c1, "room-joined");
    c2.emit("join-room", { roomCode: ROOM, playerName: "B" });
    await waitFor(c2, "room-joined");
  });

  afterEach((done) => {
    gameManager.stopTurnTimer(ROOM);
    const clients = [c1, c2].filter(Boolean);
    let remaining = clients.length;
    if (remaining === 0) return done();
    clients.forEach((c) => {
      if (c.connected) {
        c.once("disconnect", () => {
          remaining--;
          if (remaining === 0) done();
        });
        c.disconnect();
      } else {
        remaining--;
        if (remaining === 0) done();
      }
    });
  });

  it("有効な艦隊でデプロイ成功 → fleet-deployed イベント受信", async () => {
    const p = waitFor(c1, "fleet-deployed");
    c1.emit("deploy-fleet", { roomCode: ROOM, grid: validGrid() });
    const data = await p;
    expect(data.playerId).toBe(c1.id);
  });

  it("両プレイヤーがデプロイ完了 → game-start イベント受信", async () => {
    const p1 = waitFor(c1, "game-start");
    const p2 = waitFor(c2, "game-start");
    c1.emit("deploy-fleet", { roomCode: ROOM, grid: validGrid() });
    c2.emit("deploy-fleet", { roomCode: ROOM, grid: validGrid() });
    await Promise.all([p1, p2]);
  });

  it("無効な艦隊（艦数不足など）でエラー", async () => {
    const p = waitFor(c1, "error");
    c1.emit("deploy-fleet", { roomCode: ROOM, grid: emptyGrid() });
    const err = await p;
    expect(err.message).toBeDefined();
  });
});

async function setupPlayingGame(roomCode) {
  const c1 = makeClient();
  const c2 = makeClient();
  await Promise.all([connected(c1), connected(c2)]);
  c1.emit("join-room", { roomCode, playerName: "A" });
  await waitFor(c1, "room-joined");
  c2.emit("join-room", { roomCode, playerName: "B" });
  await waitFor(c2, "room-joined");

  const gs1 = waitFor(c1, "game-start");
  const gs2 = waitFor(c2, "game-start");
  c1.emit("deploy-fleet", { roomCode, grid: validGrid() });
  c2.emit("deploy-fleet", { roomCode, grid: validGrid() });
  await Promise.all([gs1, gs2]);
  return { c1, c2 };
}

describe("3-3. 攻撃", () => {
  let c1, c2;
  const ROOM = "ATTK";

  beforeEach(async () => {
    ({ c1, c2 } = await setupPlayingGame(ROOM));
  });

  afterEach((done) => {
    gameManager.stopTurnTimer(ROOM);
    const clients = [c1, c2].filter(Boolean);
    let remaining = clients.length;
    if (remaining === 0) return done();
    clients.forEach((c) => {
      if (c.connected) {
        c.once("disconnect", () => {
          remaining--;
          if (remaining === 0) done();
        });
        c.disconnect();
      } else {
        remaining--;
        if (remaining === 0) done();
      }
    });
  });

  it("ゲーム開始後、攻撃できる → attack-result イベント受信", async () => {
    const p = waitFor(c1, "attack-result");
    c1.emit("attack", { roomCode: ROOM, row: 5, col: 5 });
    const result = await p;
    expect(result).toHaveProperty("hit");
    expect(result.row).toBe(5);
    expect(result.col).toBe(5);
  });

  it("命中時 hit: true", async () => {
    const p = waitFor(c1, "attack-result");
    c1.emit("attack", { roomCode: ROOM, row: 0, col: 0 });
    const result = await p;
    expect(result.hit).toBe(true);
  });

  it("外れ時 hit: false", async () => {
    const p = waitFor(c1, "attack-result");
    c1.emit("attack", { roomCode: ROOM, row: 9, col: 9 });
    const result = await p;
    expect(result.hit).toBe(false);
  });

  it("自分のターン以外の攻撃はエラーになる", async () => {
    const p = waitFor(c2, "error");
    c2.emit("attack", { roomCode: ROOM, row: 0, col: 0 });
    const err = await p;
    expect(err.message).toBeDefined();
  });

  it("全艦撃沈で game-over イベント受信", async () => {
    const go1 = waitFor(c1, "game-over");
    const go2 = waitFor(c2, "game-over");
    c1.emit("attack", { roomCode: ROOM, row: 0, col: 0 });
    await waitFor(c1, "attack-result");
    c2.emit("attack", { roomCode: ROOM, row: 9, col: 9 });
    await waitFor(c2, "attack-result");
    c1.emit("attack", { roomCode: ROOM, row: 0, col: 1 });
    await waitFor(c1, "attack-result");
    c2.emit("attack", { roomCode: ROOM, row: 9, col: 8 });
    await waitFor(c2, "attack-result");
    c1.emit("attack", { roomCode: ROOM, row: 0, col: 2 });
    const [go] = await Promise.all([go1, go2]);
    expect(go.winner).toBe(c1.id);
  });
});

describe("3-4. ターン交代", () => {
  let c1, c2;
  const ROOM = "TURN";

  beforeEach(async () => {
    ({ c1, c2 } = await setupPlayingGame(ROOM));
  });

  afterEach((done) => {
    gameManager.stopTurnTimer(ROOM);
    const clients = [c1, c2].filter(Boolean);
    let remaining = clients.length;
    if (remaining === 0) return done();
    clients.forEach((c) => {
      if (c.connected) {
        c.once("disconnect", () => {
          remaining--;
          if (remaining === 0) done();
        });
        c.disconnect();
      } else {
        remaining--;
        if (remaining === 0) done();
      }
    });
  });

  it("攻撃後に turn-change イベントで次プレイヤーに交代", async () => {
    const tc1 = waitFor(c1, "turn-change");
    const tc2 = waitFor(c2, "turn-change");
    c1.emit("attack", { roomCode: ROOM, row: 9, col: 9 });
    const [d1, d2] = await Promise.all([tc1, tc2]);
    expect(d1.nextPlayer).toBe(c2.id);
    expect(d2.nextPlayer).toBe(c2.id);
  });
});

async function setupPlayingGameWithTimer(roomCode) {
  const c1 = makeClient();
  const c2 = makeClient();
  await Promise.all([connected(c1), connected(c2)]);
  const timerPromise = waitFor(c1, "turn-timer");
  c1.emit("join-room", { roomCode, playerName: "A" });
  await waitFor(c1, "room-joined");
  c2.emit("join-room", { roomCode, playerName: "B" });
  await waitFor(c2, "room-joined");
  c1.emit("deploy-fleet", { roomCode, grid: validGrid() });
  c2.emit("deploy-fleet", { roomCode, grid: validGrid() });
  await waitFor(c1, "game-start");
  const firstTimer = await timerPromise;
  return { c1, c2, firstTimer };
}

describe("3-5. ターンタイマー", () => {
  let c1, c2;

  afterEach((done) => {
    const clients = [c1, c2].filter(Boolean);
    let remaining = clients.length;
    if (remaining === 0) return done();
    clients.forEach((c) => {
      if (c.connected) {
        c.once("disconnect", () => {
          remaining--;
          if (remaining === 0) done();
        });
        c.disconnect();
      } else {
        remaining--;
        if (remaining === 0) done();
      }
    });
  });

  it("ゲーム開始後に turn-timer イベントが来る", async () => {
    ({ c1, c2 } = await setupPlayingGameWithTimer("TIMR1"));
    gameManager.stopTurnTimer("TIMR1");
    const p = waitFor(c1, "turn-timer");
    c1.emit("attack", { roomCode: "TIMR1", row: 9, col: 9 });
    await waitFor(c1, "attack-result");
    gameManager.stopTurnTimer("TIMR1");
    const data = await p;
    expect(data).toHaveProperty("secondsLeft");
  });

  it("タイマー送信が秒単位で届く（30秒スタート）", async () => {
    const { firstTimer } = await setupPlayingGameWithTimer("TIMR2");
    gameManager.stopTurnTimer("TIMR2");
    expect(firstTimer.secondsLeft).toBe(30);
  });
});

describe("3-6. チャット", () => {
  let c1, c2;
  const ROOM = "CHAT";

  beforeEach(async () => {
    c1 = makeClient();
    c2 = makeClient();
    await Promise.all([connected(c1), connected(c2)]);
    c1.emit("join-room", { roomCode: ROOM, playerName: "Alice" });
    await waitFor(c1, "room-joined");
    c2.emit("join-room", { roomCode: ROOM, playerName: "Bob" });
    await waitFor(c2, "room-joined");
  });

  afterEach((done) => {
    const clients = [c1, c2].filter(Boolean);
    let remaining = clients.length;
    if (remaining === 0) return done();
    clients.forEach((c) => {
      if (c.connected) {
        c.once("disconnect", () => {
          remaining--;
          if (remaining === 0) done();
        });
        c.disconnect();
      } else {
        remaining--;
        if (remaining === 0) done();
      }
    });
  });

  it("chat-message 送信 → 同ルームの全員に届く", async () => {
    const p1 = waitFor(c1, "chat-message");
    const p2 = waitFor(c2, "chat-message");
    c1.emit("chat-message", {
      roomCode: ROOM,
      playerName: "Alice",
      text: "Hello",
    });
    const [d1, d2] = await Promise.all([p1, p2]);
    expect(d1.text).toBe("Hello");
    expect(d2.text).toBe("Hello");
    expect(d1.playerName).toBe("Alice");
  });

  it("空文字は送信されない", (done) => {
    let received = false;
    c2.once("chat-message", () => {
      received = true;
    });
    c1.emit("chat-message", {
      roomCode: ROOM,
      playerName: "Alice",
      text: "   ",
    });
    setTimeout(() => {
      expect(received).toBe(false);
      done();
    }, 300);
  });

  it("140文字超はサーバーで拒否される", (done) => {
    let received = false;
    c2.once("chat-message", () => {
      received = true;
    });
    c1.emit("chat-message", {
      roomCode: ROOM,
      playerName: "Alice",
      text: "a".repeat(141),
    });
    setTimeout(() => {
      expect(received).toBe(false);
      done();
    }, 300);
  });
});

describe("3-7. 切断処理", () => {
  it("プレイヤー切断でルームが削除される", (done) => {
    const ROOM = "DISC";
    const c1 = makeClient();
    connected(c1).then(() => {
      c1.emit("join-room", { roomCode: ROOM, playerName: "Alice" });
      c1.once("room-joined", () => {
        c1.disconnect();
        setTimeout(() => {
          expect(gameManager.rooms[ROOM]).toBeUndefined();
          done();
        }, 300);
      });
    });
  });
});
