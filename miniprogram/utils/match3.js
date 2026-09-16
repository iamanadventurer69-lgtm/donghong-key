/**
 * 能量三消的纯逻辑：发牌、找三连、下落补牌、判断是否还有可走的一步。
 *
 * 这里不碰页面和 setData，全部是对普通数组的纯函数，
 * 所以「交换后能不能消」「消完怎么落」这些规则可以直接单元测试。
 * 随机数可注入，测试里传入固定序列就能得到确定的棋盘。
 */
const content = require('../data/content');

const TILE_COUNT = content.match3.tiles.length;
const MIN_RUN = 3;

/** 发一张不会立刻凑成三连的牌。 */
function pickTile(board, row, col, tileCount, random) {
  const banned = new Set();
  if (col >= 2 && board[row][col - 1] === board[row][col - 2]) banned.add(board[row][col - 1]);
  if (row >= 2 && board[row - 1][col] === board[row - 2][col]) banned.add(board[row - 1][col]);
  const allowed = [];
  for (let tile = 0; tile < tileCount; tile += 1) {
    if (!banned.has(tile)) allowed.push(tile);
  }
  return allowed[Math.floor(random() * allowed.length)];
}

/** 发一副完整的牌（可能自带三连，由调用方决定是否重发）。 */
function buildBoard(size, tileCount, random) {
  const board = [];
  for (let row = 0; row < size; row += 1) {
    board.push([]);
    for (let col = 0; col < size; col += 1) {
      board[row].push(pickTile(board, row, col, tileCount, random));
    }
  }
  return board;
}

/** 新棋盘：开局没有现成的三连，且至少还有一步可走。 */
function createBoard(size, tileCount = TILE_COUNT, random = Math.random) {
  let board = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    board = buildBoard(size, tileCount, random);
    if (findMatches(board).length === 0 && hasMove(board, tileCount)) return board;
  }
  // 兜底（实测几乎不会发生）：开局三连交给页面自己消掉。
  return board;
}

/** 所有属于三连（横或竖）的格子，按行优先排序。 */
function findMatches(board) {
  const rows = board.length;
  const marked = new Set();

  // 横向扫描
  board.forEach((line, row) => {
    let run = 1;
    for (let col = 1; col <= line.length; col += 1) {
      const same = col < line.length && line[col] != null && line[col] === line[col - 1];
      if (same) {
        run += 1;
        continue;
      }
      if (run >= MIN_RUN) {
        for (let k = col - run; k < col; k += 1) marked.add(`${row}:${k}`);
      }
      run = 1;
    }
  });

  // 纵向扫描（兼容长度不齐的测试用棋盘）
  const width = board.reduce((max, line) => Math.max(max, line.length), 0);
  for (let col = 0; col < width; col += 1) {
    let run = 1;
    for (let row = 1; row <= rows; row += 1) {
      const same = row < rows && board[row][col] != null && board[row][col] === board[row - 1][col];
      if (same) {
        run += 1;
        continue;
      }
      if (run >= MIN_RUN) {
        for (let k = row - run; k < row; k += 1) marked.add(`${k}:${col}`);
      }
      run = 1;
    }
  }

  return [...marked]
    .map((id) => {
      const [row, col] = id.split(':').map(Number);
      return { row, col };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** 交换两个格子，返回新棋盘（不改原数组）。 */
function swapTiles(board, from, to) {
  const next = board.map((line) => line.slice());
  const value = next[from.row][from.col];
  next[from.row][from.col] = next[to.row][to.col];
  next[to.row][to.col] = value;
  return next;
}

/** 两个格子是否上下或左右相邻。 */
function isAdjacent(from, to) {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
}

/** 消掉指定格子，上方牌下落，顶部补新牌。 */
function collapse(board, cleared, random = Math.random, tileCount = TILE_COUNT) {
  const size = board.length;
  const next = board.map((line) => line.slice());
  for (const cell of cleared) next[cell.row][cell.col] = null;

  for (let col = 0; col < size; col += 1) {
    let write = size - 1;
    for (let row = size - 1; row >= 0; row -= 1) {
      if (next[row][col] === null) continue;
      next[write][col] = next[row][col];
      if (write !== row) next[row][col] = null;
      write -= 1;
    }
    for (let row = write; row >= 0; row -= 1) {
      next[row][col] = Math.floor(random() * tileCount);
    }
  }
  return next;
}

/** 还有没有任何一步有效交换。 */
function hasMove(board, tileCount = TILE_COUNT) {
  const size = board.length;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0]
      ]) {
        const to = { row: row + dr, col: col + dc };
        if (to.row >= size || to.col >= size) continue;
        const swapped = swapTiles(board, { row, col }, to);
        if (findMatches(swapped).length > 0) return true;
      }
    }
  }
  return false;
}

/** 一次消除的得分：数量 × 基础分 × 连击倍数。 */
function scoreFor(clearedCount, combo, baseScore = content.match3.baseScore) {
  return clearedCount * baseScore * Math.max(1, combo);
}

/** 摊平成渲染用的二维数据（每格带图块信息，可选标记正在消除的格子）。 */
function decorate(board, clearing = []) {
  const marked = new Set(clearing.map((cell) => cell.row * board.length + cell.col));
  return board.map((line, row) => ({
    key: `row-${row}`,
    cells: line.map((tile, col) => ({
      key: `${row}-${col}`,
      row,
      col,
      tile,
      clearing: marked.has(row * board.length + col),
      ...content.match3.tiles[tile]
    }))
  }));
}

module.exports = {
  TILE_COUNT,
  createBoard,
  findMatches,
  swapTiles,
  isAdjacent,
  collapse,
  hasMove,
  scoreFor,
  decorate
};
