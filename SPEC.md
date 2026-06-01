# submarine-battle Specification

## Game Overview

**submarine-battle** は 2人対戦のリアルタイム海戦シミュレーション。Socket.io を使った WebSocket ゲーム。

- **Players**: 2人
- **Duration**: 10-30分
- **Platform**: Web (Node.js + Socket.io)

## Game Rules

### Setup Phase

1. Player 1 と Player 2 が4桁コードでルーム作成/参加
2. 各プレイヤーが 10×10 グリッドに艦隊配置
3. 艦隊構成:
   - 潜水艦（Submarine）: 3セル
   - 駆逐艦（Destroyer）: 2セル
   - 巡洋艦（Cruiser）: 1セル

### Combat Phase

1. **Turn Order**: Player 1 から交互攻撃
2. **Attack**: 敵グリッドの座標 (row, col) を指定
3. **Result**:
   - **Hit**: 敵の艦に命中 → 赤色マーク
   - **Miss**: 敵の艦を外す → 青色マーク
4. **Fog of War**:
   - 自分のグリッド: 自艦 + 敵の攻撃結果（命中/外れ）を表示
   - 敵のグリッド: 自分の攻撃結果のみ表示、敵艦は隠れている

### Win Condition

- すべての敵艦を撃沈 → 勝利
- 敵が全艦撃沈 → 敗北

## Game Data Model

```javascript
Room = {
  code: "0123",           // 4桁ルームコード
  players: ["socket1", "socket2"],
  grids: {
    socket1: {
      fleet: [[null, 'submarine', ...], ...],  // 10×10
      hits: [[0, 1], [2, 3], ...],
      misses: [[5, 5], ...],
    },
    socket2: { fleet, hits, misses }
  },
  gameState: "waiting" | "playing" | "over",
  currentTurn: 0,  // players[currentTurn]
  winner: null     // socket ID
}
```

## API Events (Socket.io)

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{roomCode, playerName}` | ルーム参加 |
| `deploy-fleet` | `{roomCode, grid}` | 艦隊配置 |
| `attack` | `{roomCode, row, col}` | 攻撃 |

### Server → Client (Broadcast)

| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `{roomCode, players}` | ルーム参加完了 |
| `player-joined` | `{playerName}` | 他プレイヤー参加 |
| `fleet-deployed` | `{playerId, ready}` | 艦隊配置完了 |
| `game-start` | - | ゲーム開始 |
| `attack-result` | `{hit, row, col, gameOver, winner}` | 攻撃結果 |
| `turn-change` | `{nextPlayer}` | ターン交代 |
| `game-over` | `{winner}` | ゲーム終了 |
| `error` | `{message}` | エラー |

## Game Logic

### Fleet Validation

```javascript
isValidFleet(grid) {
  // 10×10 チェック
  // submarine count = 1
  // destroyer count = 1
  // cruiser count = 1
  // それ以外 = null
}
```

### Hit Detection

```javascript
isHit(fleet, row, col) {
  return !!fleet[row][col];  // True if ship, False if water
}
```

### Win Condition

```javascript
hasLost(fleet, hits) {
  const shipCount = fleet.flat().filter(Boolean).length;  // 6
  return hits.length === shipCount;  // 全艦撃沈
}
```

## Frontend UI

### Room Join Screen

- Input: 4桁ルームコード
- Input: プレイヤー名
- Button: Join Game

### Deployment Screen

- 10×10 Grid with drag-and-drop ship placement
- Button: Ready (艦隊配置完了)

### Combat Screen

- Left: Your Fleet Grid (自艦 + 敵の攻撃結果)
- Right: Enemy Fleet Grid (敵の視点：見えるのは自分の攻撃結果のみ)
- Message: ターン情報、命中/外れ

### Game Over Screen

- "You Won! 🎉" or "You Lost"
- Button: Play Again

## Deployment

### Development

```bash
npm install
npm start
# http://localhost:3000
```

### Production

- **Railway**: `npm install && npm start`
- **Render**: Same as Railway
- **Vercel**: NOT RECOMMENDED (WebSocket 非対応)

## Non-Functional Requirements

### Performance

- Real-time 攻撃結果フィードバック (<100ms)
- 1000+ concurrent games support

### Security

- Room code は 4桁（推測可能だが OK for casual play）
- Server-side 艦隊位置検証（クライアント改ざん防止）

### Testing

- Fleet validation logic
- Hit detection
- Win condition
- Room lifecycle (create, join, play, end)

---

Last updated: 2024-06
