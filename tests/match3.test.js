const { test } = require('node:test');
const assert = require('node:assert/strict');
const match3 = require('../miniprogram/utils/match3');
const content = require('../miniprogram/data/content');

/** 固定序列的伪随机数，让发牌与补牌可复现。 */
function sequence(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

const SIZE = content.match3.size;
const TILES = content.match3.tiles.length;

test('发牌：开局没有现成三连，且至少还有一步可走', () => {
  for (let round = 0; round < 30; round += 1) {
    const board = match3.createBoard(SIZE);
    assert.equal(board.length, SIZE);
    assert.equal(board[0].length, SIZE);
    assert.equal(match3.findMatches(board).length, 0, '开局不应自带三连');
    assert.equal(match3.hasMove(board), true, '开局应当还有可消的组合');
    for (const line of board) {
      for (const tile of line) {
        assert.ok(tile >= 0 && tile < TILES, `图块编号越界: ${tile}`);
      }
    }
  }
});

test('找三连：横排、竖排与交叉都能识别', () => {
  const horizontal = [
    [0, 0, 0, 1],
    [1, 2, 3, 2],
    [2, 3, 1, 3],
    [3, 1, 2, 1]
  ];
  assert.deepEqual(match3.findMatches(horizontal), [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 }
  ]);

  const vertical = [
    [0, 1, 2],
    [0, 2, 1],
    [0, 3, 3],
    [3, 1, 3]
  ];
  assert.equal(match3.findMatches(vertical).length, 3);

  const cross = [
    [1, 2, 1],
    [1, 1, 1],
    [1, 3, 2]
  ];
  // 中间一行三个 + 第一列三个，交集只算一次
  assert.equal(match3.findMatches(cross).length, 5);

  const none = [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0]
  ];
  assert.deepEqual(match3.findMatches(none), []);
});

test('交换：返回新棋盘，不改动原数组；相邻判断排除斜角与自身', () => {
  const board = [
    [1, 2],
    [3, 4]
  ];
  const next = match3.swapTiles(board, { row: 0, col: 0 }, { row: 0, col: 1 });
  assert.deepEqual(next, [
    [2, 1],
    [3, 4]
  ]);
  assert.deepEqual(board, [
    [1, 2],
    [3, 4]
  ]);

  assert.equal(match3.isAdjacent({ row: 1, col: 1 }, { row: 1, col: 2 }), true);
  assert.equal(match3.isAdjacent({ row: 1, col: 1 }, { row: 2, col: 1 }), true);
  assert.equal(match3.isAdjacent({ row: 1, col: 1 }, { row: 2, col: 2 }), false);
  assert.equal(match3.isAdjacent({ row: 1, col: 1 }, { row: 1, col: 1 }), false);
});

test('消除后下落补牌：列内保持顺序，顶部补满', () => {
  const board = [
    [0, 1, 2],
    [1, 0, 3],
    [2, 0, 4],
    [3, 0, 6]
  ];
  const cleared = match3.findMatches(board);
  assert.deepEqual(cleared, [
    { row: 1, col: 1 },
    { row: 2, col: 1 },
    { row: 3, col: 1 }
  ]);

  const next = match3.collapse(board, cleared, sequence([0.9, 0.1, 0.5]));
  assert.equal(next.length, 4);
  assert.equal(next[3][1], 1, '最上面的 1 应该落到底部');
  for (let row = 0; row < 4; row += 1) assert.ok(next[row][1] !== null, '不能留空');
  // 其它列不受影响
  assert.deepEqual(
    next.map((line) => line[0]),
    [0, 1, 2, 3]
  );
  assert.deepEqual(
    next.map((line) => line[2]),
    [2, 3, 4, 6]
  );
});

test('没有可消组合时 hasMove 为假（需要重新发牌）', () => {
  // 拉丁方阵：任何一次交换都凑不出三连
  const deadlock = [
    [0, 1, 2, 0],
    [1, 2, 0, 1],
    [2, 0, 1, 2],
    [0, 1, 2, 0]
  ];
  assert.equal(match3.findMatches(deadlock).length, 0);
  assert.equal(match3.hasMove(deadlock), false);

  const playable = [
    [0, 0, 1, 2],
    [1, 1, 0, 2],
    [2, 0, 1, 0],
    [0, 1, 2, 1]
  ];
  assert.equal(match3.hasMove(playable), true);
});

test('计分：数量 × 基础分 × 连击倍数', () => {
  const base = content.match3.baseScore;
  assert.equal(match3.scoreFor(3, 1), 3 * base);
  assert.equal(match3.scoreFor(3, 2), 6 * base);
  assert.equal(match3.scoreFor(4, 1), 4 * base);
  assert.equal(match3.scoreFor(5, 0), 5 * base, '连击至少按 1 倍算');
});

test('渲染数据：每行每格都有唯一的 key，并带上图块信息', () => {
  const board = match3.createBoard(SIZE);
  const view = match3.decorate(board);
  assert.equal(view.length, SIZE);
  assert.equal(view[0].cells.length, SIZE);
  const keys = new Set();
  for (const row of view) {
    keys.add(row.key);
    for (const cell of row.cells) {
      keys.add(cell.key);
      assert.equal(typeof cell.emoji, 'string');
      assert.equal(typeof cell.color, 'string');
      assert.equal(cell.clearing, false);
    }
  }
  assert.equal(keys.size, SIZE * SIZE + SIZE);

  const marked = match3.decorate(board, [{ row: 0, col: 0 }]);
  assert.equal(marked[0].cells[0].clearing, true);
  assert.equal(marked[0].cells[1].clearing, false);
});
