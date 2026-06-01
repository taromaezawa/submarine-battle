"use strict";

const { GameManager, isValidFleet, isHit, hasLost } = require("../server/game");

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/** 空の 10×10 グリッドを返す */
function emptyGrid() {
  return Array.from({ length: 10 }, () => Array(10).fill(null));
}

/**
 * 最低限有効なフリート（submarine×1, destroyer×1, cruiser×1 を 1 マスずつ配置）を返す。
 * 各艦は最小 1 セルで配置する（isValidFleet はセル数ではなく種別の有無だけを確認する）。
 */
function validGrid() {
  const g = emptyGrid();
  g[0][0] = "submarine";
  g[0][1] = "destroyer";
  g[0][2] = "cruiser";
  return g;
}

// ---------------------------------------------------------------------------
// isValidFleet
// ---------------------------------------------------------------------------

describe("isValidFleet", () => {
  it("有効なフリートで true を返す", () => {
    expect(isValidFleet(validGrid())).toBe(true);
  });

  it("10×10 でないグリッド（行数不足）は false を返す", () => {
    const g = Array.from({ length: 9 }, () => Array(10).fill(null));
    expect(isValidFleet(g)).toBe(false);
  });

  it("10×10 でないグリッド（列数不足）は false を返す", () => {
    const g = Array.from({ length: 10 }, () => Array(9).fill(null));
    expect(isValidFleet(g)).toBe(false);
  });

  it("submarine が 0 の場合は false を返す", () => {
    const g = validGrid();
    g[0][0] = null; // submarine を削除
    expect(isValidFleet(g)).toBe(false);
  });

  it("destroyer が 0 の場合は false を返す", () => {
    const g = validGrid();
    g[0][1] = null;
    expect(isValidFleet(g)).toBe(false);
  });

  it("cruiser が 0 の場合は false を返す", () => {
    const g = validGrid();
    g[0][2] = null;
    expect(isValidFleet(g)).toBe(false);
  });

  it("submarine が 2 つある場合は false を返す", () => {
    const g = validGrid();
    g[1][0] = "submarine";
    expect(isValidFleet(g)).toBe(false);
  });

  it("未知のセル値は艦数カウントに影響しない（有効な艦3種が揃えば true）", () => {
    const g = validGrid();
    g[5][5] = "unknown_ship";
    expect(isValidFleet(g)).toBe(true);
  });

  it("全セルが null のグリッドは false を返す", () => {
    expect(isValidFleet(emptyGrid())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isHit
// ---------------------------------------------------------------------------

describe("isHit", () => {
  it("艦のあるマスは true を返す", () => {
    const g = validGrid();
    expect(isHit(g, 0, 0)).toBe(true);
  });

  it("空のマスは false を返す", () => {
    const g = validGrid();
    expect(isHit(g, 9, 9)).toBe(false);
  });

  it("グリッド境界の角（0,0）でも正しく判定する", () => {
    const g = emptyGrid();
    g[0][0] = "cruiser";
    expect(isHit(g, 0, 0)).toBe(true);
  });

  it("グリッド境界の角（9,9）でも正しく判定する", () => {
    const g = emptyGrid();
    g[9][9] = "destroyer";
    expect(isHit(g, 9, 9)).toBe(true);
    expect(isHit(g, 9, 8)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasLost
// ---------------------------------------------------------------------------

describe("hasLost", () => {
  it("ヒット数が全艦セル数と一致する場合 true を返す", () => {
    const g = validGrid(); // submarine, destroyer, cruiser 各 1 セル = 合計 3
    const hits = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    expect(hasLost(g, hits)).toBe(true);
  });

  it("ヒット数が足りない場合 false を返す", () => {
    const g = validGrid();
    const hits = [
      [0, 0],
      [0, 1],
    ];
    expect(hasLost(g, hits)).toBe(false);
  });

  it("ヒットがゼロの場合 false を返す", () => {
    const g = validGrid();
    expect(hasLost(g, [])).toBe(false);
  });

  it("複数セルの艦が混在する場合も正しく判定する", () => {
    const g = emptyGrid();
    g[0][0] = "submarine";
    g[1][0] = "submarine"; // 2 セルの submarine
    g[5][5] = "destroyer";
    g[9][9] = "cruiser";
    const allHits = [
      [0, 0],
      [1, 0],
      [5, 5],
      [9, 9],
    ]; // 合計 4 セル
    expect(hasLost(g, allHits)).toBe(true);
    expect(
      hasLost(g, [
        [0, 0],
        [1, 0],
        [5, 5],
      ]),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GameManager
// ---------------------------------------------------------------------------

describe("GameManager", () => {
  let gm;

  beforeEach(() => {
    gm = new GameManager();
  });

  // ---- joinRoom ----

  describe("joinRoom", () => {
    it("存在しないルームへの参加で自動的にルームが作成される", () => {
      const room = gm.joinRoom("ROOM1", "player1");
      expect(room).not.toBeNull();
      expect(room.code).toBe("ROOM1");
      expect(room.players).toContain("player1");
    });

    it("2 人目のプレイヤーが正常に参加できる", () => {
      gm.joinRoom("ROOM1", "player1");
      const room = gm.joinRoom("ROOM1", "player2");
      expect(room.players).toHaveLength(2);
      expect(room.players).toContain("player2");
    });

    it("3 人目の参加は null を返す", () => {
      gm.joinRoom("ROOM1", "player1");
      gm.joinRoom("ROOM1", "player2");
      const result = gm.joinRoom("ROOM1", "player3");
      expect(result).toBeNull();
    });

    it("新規ルームの gameState は waiting", () => {
      const room = gm.joinRoom("ROOM1", "player1");
      expect(room.gameState).toBe("waiting");
    });
  });

  // ---- deployFleet ----

  describe("deployFleet", () => {
    beforeEach(() => {
      gm.joinRoom("ROOM1", "player1");
      gm.joinRoom("ROOM1", "player2");
    });

    it("有効なグリッドで正常にデプロイできる", () => {
      const room = gm.deployFleet("ROOM1", "player1", validGrid());
      expect(room).not.toBeNull();
      expect(room.grids["player1"]).toBeDefined();
    });

    it("無効なグリッドは null を返す", () => {
      const result = gm.deployFleet("ROOM1", "player1", emptyGrid());
      expect(result).toBeNull();
    });

    it("存在しないルームは null を返す", () => {
      expect(gm.deployFleet("NOROOM", "player1", validGrid())).toBeNull();
    });

    it("参加していないプレイヤーは null を返す", () => {
      expect(gm.deployFleet("ROOM1", "intruder", validGrid())).toBeNull();
    });

    it("両プレイヤーがデプロイすると gameState が playing になる", () => {
      gm.deployFleet("ROOM1", "player1", validGrid());
      const room = gm.deployFleet("ROOM1", "player2", validGrid());
      expect(room.gameState).toBe("playing");
      expect(room.bothReady).toBe(true);
    });

    it("片方だけデプロイしても gameState は playing にならない", () => {
      const room = gm.deployFleet("ROOM1", "player1", validGrid());
      expect(room.gameState).toBe("waiting");
    });
  });

  // ---- processAttack ----

  describe("processAttack", () => {
    beforeEach(() => {
      gm.joinRoom("ROOM1", "player1");
      gm.joinRoom("ROOM1", "player2");
      gm.deployFleet("ROOM1", "player1", validGrid());
      gm.deployFleet("ROOM1", "player2", validGrid());
    });

    it("命中の場合 hit: true を返す", () => {
      // player2 のグリッドには [0][0] = submarine がある
      const result = gm.processAttack("ROOM1", "player1", 0, 0);
      expect(result).not.toBeNull();
      expect(result.hit).toBe(true);
      expect(result.row).toBe(0);
      expect(result.col).toBe(0);
    });

    it("外れの場合 hit: false を返す", () => {
      const result = gm.processAttack("ROOM1", "player1", 9, 9);
      expect(result.hit).toBe(false);
    });

    it("命中しても全滅していなければ gameOver: false", () => {
      const result = gm.processAttack("ROOM1", "player1", 0, 0);
      expect(result.gameOver).toBe(false);
      expect(result.nextPlayer).toBe("player2");
    });

    it("全艦を沈めると gameOver: true かつ winner が攻撃者になる", () => {
      // validGrid は [0][0]=submarine, [0][1]=destroyer, [0][2]=cruiser の 3 セル
      gm.processAttack("ROOM1", "player1", 0, 0);
      gm.processAttack("ROOM1", "player1", 0, 1);
      const result = gm.processAttack("ROOM1", "player1", 0, 2);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe("player1");
      expect(result.nextPlayer).toBeNull();
    });

    it("gameState が playing でない場合は null を返す", () => {
      const gm2 = new GameManager();
      gm2.joinRoom("ROOM2", "p1");
      gm2.joinRoom("ROOM2", "p2");
      // deployFleet せず playing にしない
      const result = gm2.processAttack("ROOM2", "p1", 0, 0);
      expect(result).toBeNull();
    });

    it("存在しないルームは null を返す", () => {
      expect(gm.processAttack("NOROOM", "player1", 0, 0)).toBeNull();
    });
  });

  // ---- removePlayer ----

  describe("removePlayer", () => {
    it("プレイヤーが所属するルームが削除される", () => {
      gm.joinRoom("ROOM1", "player1");
      gm.removePlayer("player1");
      // 削除後に joinRoom するとルームが再作成される（既存でない）
      const room = gm.joinRoom("ROOM1", "player1");
      expect(room).not.toBeNull();
      expect(room.players).toHaveLength(1);
    });

    it("存在しないプレイヤーを削除してもエラーにならない", () => {
      expect(() => gm.removePlayer("ghost")).not.toThrow();
    });

    it("2 人いるルームで片方を削除するとルーム全体が消える", () => {
      gm.joinRoom("ROOM1", "player1");
      gm.joinRoom("ROOM1", "player2");
      gm.removePlayer("player2");
      const room = gm.joinRoom("ROOM1", "player1");
      expect(room.players).toHaveLength(1);
    });
  });
});
