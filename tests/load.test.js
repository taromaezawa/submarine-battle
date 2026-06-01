const { io: ioClient } = require("socket.io-client");

const BASE_URL = process.env.LOAD_TEST_URL || "http://localhost:3000";
const ROOMS = 100;

jest.setTimeout(60000);

function makeGrid() {
  const grid = Array(10)
    .fill(null)
    .map(() => Array(10).fill(null));
  grid[0][0] = grid[0][1] = grid[0][2] = "submarine";
  grid[1][0] = grid[1][1] = "destroyer";
  grid[2][0] = "cruiser";
  return grid;
}

function connectPlayer() {
  return new Promise((resolve, reject) => {
    const socket = ioClient(BASE_URL, { forceNew: true, timeout: 10000 });
    socket.on("connect_error", reject);
    socket.on("connect", () => resolve(socket));
  });
}

function joinAndDeploy(socket, roomCode) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout room ${roomCode}`)),
      15000,
    );

    socket.emit("join-room", { roomCode, playerName: "Player" });
    socket.on("room-joined", () => {
      socket.emit("deploy-fleet", { roomCode, grid: makeGrid() });
    });
    socket.on("game-start", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(err.message));
    });
  });
}

describe("Load test: 100 rooms / 200 players", () => {
  const allSockets = [];

  afterAll(() => {
    allSockets.forEach((s) => s.disconnect());
  });

  test("90% of rooms complete game-start successfully", async () => {
    const roomPromises = Array.from({ length: ROOMS }, async (_, i) => {
      const roomCode = `LOAD${i.toString().padStart(3, "0")}`;
      try {
        const [s1, s2] = await Promise.all([connectPlayer(), connectPlayer()]);
        allSockets.push(s1, s2);
        await Promise.all([
          joinAndDeploy(s1, roomCode),
          joinAndDeploy(s2, roomCode),
        ]);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    });

    const results = await Promise.all(roomPromises);
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const rate = passed / ROOMS;

    console.log(
      `Passed: ${passed}/${ROOMS}, Failed: ${failed}, Rate: ${(rate * 100).toFixed(1)}%`,
    );
    if (failed > 0) {
      const errors = results
        .filter((r) => !r.ok)
        .slice(0, 5)
        .map((r) => r.error);
      console.log("Sample errors:", errors);
    }

    expect(rate).toBeGreaterThanOrEqual(0.9);
  });
});
