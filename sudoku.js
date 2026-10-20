// 스도쿠 생성기: 유일해를 보장하는 퍼즐을 만든다.
(function () {
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function candidates(g, i) {
    const r = Math.floor(i / 9), c = i % 9, used = new Set();
    for (let k = 0; k < 9; k++) {
      used.add(g[r * 9 + k]); used.add(g[k * 9 + c]);
    }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) used.add(g[(br + y) * 9 + bc + x]);
    const out = [];
    for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
    return out;
  }
  // 해의 개수를 limit까지 센다. randomize=true면 임의의 해를 g에 채운다.
  function solve(g, limit, randomize) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const cs = candidates(g, i);
      if (cs.length === 0) return 0;
      if (!bestC || cs.length < bestC.length) { best = i; bestC = cs; if (cs.length === 1) break; }
    }
    if (best < 0) return 1;
    if (randomize) shuffle(bestC);
    let count = 0;
    for (const n of bestC) {
      g[best] = n;
      count += solve(g, limit - count, randomize);
      if (randomize && count) return count;
      if (count >= limit) { g[best] = 0; return count; }
    }
    g[best] = 0;
    return count;
  }
  const REMOVE = { easy: 38, medium: 47, hard: 54 };
  const api = {
    generate(diff) {
      const sol = new Array(81).fill(0);
      solve(sol, 1, true);
      const puz = sol.slice();
      let removed = 0;
      for (const i of shuffle([...Array(81).keys()])) {
        if (removed >= REMOVE[diff]) break;
        const keep = puz[i];
        puz[i] = 0;
        if (solve(puz.slice(), 2, false) !== 1) puz[i] = keep; else removed++;
      }
      return { puzzle: puz, solution: sol };
    },
  };
  if (typeof window !== "undefined") window.Sudoku = api;
  if (typeof module !== "undefined") module.exports = api;
})();
