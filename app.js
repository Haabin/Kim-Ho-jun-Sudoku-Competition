const $ = (s) => document.querySelector(s);
const hasDb = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith("YOUR_");
const db = hasDb ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const BASE = { easy: 1000, medium: 2000, hard: 3000 };
const MAX_MISTAKES = 3, MAX_HINTS = 3, MAX_AD_HINTS = 3, AD_SECONDS = 5;

let G; // 게임 상태
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
const say = (t, el = "#msg") => ($(el).textContent = t);
const sameBox = (a, b) => Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3);
const isPeer = (a, b) => Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 || sameBox(a, b);

// ---- 진행 상태: 게임 클리어 -> 순위 확인 -> 리뷰 ----
const store = {
  get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const played = () => store.get("played"); // 클리어 기록이 저장된 닉네임
const rankSeen = () => store.get("rankSeen") === "1";
const token = () => store.get("playToken"); // 클리어 시 발급되는 일회용 리뷰 토큰
const canReview = () => !!played() && !!token() && rankSeen();

function refreshReviewGate() {
  const ok = canReview();
  $("#reviewTab").textContent = (ok ? "" : "🔒 ") + "리뷰";
  $("#reviewForm").hidden = !ok;
  $("#rvLock").hidden = ok;
  $("#rvNick").value = played();
  if (!ok) say(!token() ? "리뷰는 게임을 클리어해 점수를 저장한 뒤 작성할 수 있어요. 먼저 게임을 플레이하세요!" : "순위 탭에서 내 순위를 확인하면 리뷰를 작성할 수 있어요.", "#rvLock");
}

function showTab(name) {
  document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("active", x.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
  if (name === "rank") loadRank();
  if (name === "review") { refreshReviewGate(); loadReviews(); }
}
document.querySelectorAll("nav button").forEach((b) => b.onclick = () => showTab(b.dataset.tab));
$("#startBtn").onclick = () => showTab("game");

// ---- 게임 ----
// 게임 탭을 보고 있고 광고 창이 닫혀 있을 때만 시간이 흐른다
const gameVisible = () => $("#tab-game").classList.contains("active") && $("#adModal").hidden;

function newGame() {
  if (G) clearInterval(G.tid);
  say("퍼즐 생성 중...");
  setTimeout(() => {
    const diff = $("#diff").value;
    const { puzzle, solution } = Sudoku.generate(diff);
    G = { diff, puzzle, solution, cur: puzzle.slice(), notes: puzzle.map(() => new Set()),
      sel: -1, mistakes: 0, hints: 0, bonus: 0, secs: 0, note: false, over: false };
    G.tid = setInterval(() => { if (!G.over && gameVisible()) { G.secs++; $("#timer").textContent = fmt(G.secs); } }, 1000);
    say("");
    render();
  }, 20);
}

function render() {
  const b = $("#board");
  if (!b.children.length) {
    for (let i = 0; i < 81; i++) {
      const d = document.createElement("div");
      d.className = "cell r" + Math.floor(i / 9) + " c" + (i % 9);
      d.onclick = () => { if (!G.over) { G.sel = i; render(); } };
      b.appendChild(d);
    }
  }
  const sv = G.sel >= 0 ? G.cur[G.sel] : 0;
  [...b.children].forEach((d, i) => {
    const v = G.cur[i], given = G.puzzle[i] !== 0;
    d.classList.toggle("given", given);
    d.classList.toggle("bad", !given && !!v && v !== G.solution[i]);
    d.classList.toggle("sel", i === G.sel);
    d.classList.toggle("peer", G.sel >= 0 && i !== G.sel && isPeer(i, G.sel));
    d.classList.toggle("same", !!sv && i !== G.sel && v === sv);
    if (v) d.textContent = v;
    else if (G.notes[i].size) d.innerHTML = '<div class="notes">' + [1,2,3,4,5,6,7,8,9].map((n) => `<span>${G.notes[i].has(n) ? n : ""}</span>`).join("") + "</div>";
    else d.textContent = "";
  });
  $("#mistakes").textContent = G.mistakes;
  const limit = MAX_HINTS + G.bonus;
  $("#hints").textContent = G.hints + "/" + limit;
  const needAd = G.hints >= limit;
  $("#hintBtn").textContent = needAd ? (G.bonus >= MAX_AD_HINTS ? "힌트 소진" : "📺 광고 보고 힌트") : "💡 힌트";
  $("#hintBtn").disabled = G.over || (needAd && G.bonus >= MAX_AD_HINTS);
  $("#timer").textContent = fmt(G.secs);
  $("#noteBtn").textContent = "✏️ 메모 " + (G.note ? "ON" : "OFF");
  const left = Array(10).fill(9);
  G.cur.forEach((v, k) => v === G.solution[k] && left[v]--);
  document.querySelectorAll("#pad button").forEach((p) => (p.disabled = G.over || left[p.dataset.n] <= 0));
}

function place(n) {
  if (!G || G.over || G.sel < 0 || G.puzzle[G.sel]) return;
  const i = G.sel;
  if (G.note) {
    if (G.cur[i]) return;
    G.notes[i].has(n) ? G.notes[i].delete(n) : G.notes[i].add(n);
    return render();
  }
  if (G.cur[i] === n) return;
  G.cur[i] = n;
  G.notes[i].clear();
  if (n !== G.solution[i]) {
    G.mistakes++;
    if (G.mistakes >= MAX_MISTAKES) return end(false);
  } else clearPeerNotes(i, n);
  render();
  if (G.cur.every((v, k) => v === G.solution[k])) end(true);
}
function clearPeerNotes(i, n) {
  for (let k = 0; k < 81; k++) if (isPeer(k, i)) G.notes[k].delete(n);
}
function erase() {
  if (!G || G.over || G.sel < 0 || G.puzzle[G.sel]) return;
  G.cur[G.sel] = 0; G.notes[G.sel].clear(); render();
}
function hint() {
  if (!G || G.over) return;
  if (G.hints >= MAX_HINTS + G.bonus) return watchAd();
  let i = G.sel;
  if (i < 0 || G.puzzle[i] || G.cur[i] === G.solution[i]) {
    const empties = G.cur.map((v, k) => (v !== G.solution[k] ? k : -1)).filter((k) => k >= 0);
    if (!empties.length) return;
    i = empties[Math.floor(Math.random() * empties.length)];
  }
  G.hints++; G.sel = i; G.cur[i] = G.solution[i]; G.notes[i].clear();
  clearPeerNotes(i, G.solution[i]);
  render();
  if (G.cur.every((v, k) => v === G.solution[k])) end(true);
}

const calcScore = () => Math.max(100, BASE[G.diff] - G.secs * 2 - G.mistakes * 100 - G.hints * 150);

async function end(win) {
  G.over = true; clearInterval(G.tid); render();
  if (!win) return say("😢 실수 3회로 게임 종료! 새 게임을 시작하세요.");
  const score = calcScore();
  const nick = $("#nick").value.trim();
  if (!nick) return say(`🎉 ${score}점! 닉네임을 입력하지 않아 기록은 저장되지 않았어요.`);
  if (!db) return say(`🎉 ${score}점! (Supabase 미설정: 저장 안 됨)`);
  say(`🎉 클리어! ${score}점 (${fmt(G.secs)}) 저장 중...`);
  const tk = crypto.randomUUID();
  const { error } = await db.from("scores").insert({ nickname: nick, difficulty: G.diff,
    time_seconds: G.secs, mistakes: G.mistakes, hints: G.hints, score, play_token: tk });
  if (error) return say(`🎉 ${score}점! 저장 실패: ${error.message}`);
  say(`🎉 ${score}점! 순위에 기록되었습니다.`);
  store.set("played", nick);
  store.set("playToken", tk);
  store.set("rankSeen", "0");
  $("#rankDiff").value = G.diff;
  setTimeout(() => showTab("rank"), 1200); // 게임 -> 순위 확인
}

// ---- 광고 보고 힌트 받기 (보상형 광고 자리: 실제 광고 SDK로 교체 가능) ----
let adTimer;
function watchAd() {
  if (G.bonus >= MAX_AD_HINTS) return;
  const m = $("#adModal"), close = $("#adClose");
  let left = AD_SECONDS;
  m.hidden = false; close.disabled = true;
  const tick = () => {
    $("#adCount").textContent = left > 0 ? left + "초 후 보상 지급" : "시청 완료!";
    if (left-- <= 0) { clearInterval(adTimer); close.disabled = false; close.textContent = "힌트 받기"; }
  };
  close.textContent = "광고 시청 중...";
  tick(); adTimer = setInterval(tick, 1000);
}
$("#adClose").onclick = () => {
  $("#adModal").hidden = true;
  G.bonus++;
  say("🎁 광고 보상으로 힌트 1회가 추가되었어요!");
  render();
};
$("#adSkip").onclick = () => { clearInterval(adTimer); $("#adModal").hidden = true; };

// 입력 UI
for (let n = 1; n <= 9; n++) {
  const b = document.createElement("button");
  b.textContent = n; b.dataset.n = n; b.onclick = () => place(n);
  $("#pad").appendChild(b);
}
$("#newGame").onclick = newGame;
$("#noteBtn").onclick = () => { if (G) { G.note = !G.note; render(); } };
$("#eraseBtn").onclick = erase;
$("#hintBtn").onclick = hint;
document.addEventListener("keydown", (e) => {
  if (!G || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key >= "1" && e.key <= "9") place(+e.key);
  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
  else if (G.sel >= 0 && e.key.startsWith("Arrow")) {
    e.preventDefault();
    const c = G.sel % 9;
    if ((e.key === "ArrowLeft" && c === 0) || (e.key === "ArrowRight" && c === 8)) return;
    const n = G.sel + { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key];
    if (n >= 0 && n < 81) { G.sel = n; render(); }
  }
});
$("#nick").value = store.get("nick");
$("#nick").oninput = () => store.set("nick", $("#nick").value);

// ---- 순위 ----
async function loadRank() {
  const ul = $("#rankList");
  if (!db) return (ul.innerHTML = "<li>Supabase 설정이 필요합니다 (config.js)</li>");
  ul.innerHTML = "<li>불러오는 중...</li>";
  const { data, error } = await db.from("scores").select("nickname,time_seconds,mistakes,hints,score").eq("difficulty", $("#rankDiff").value)
    .order("score", { ascending: false }).order("time_seconds").limit(50);
  if (error) return (ul.innerHTML = `<li>${esc(error.message)}</li>`);
  if (played()) { // 순위를 본 뒤에 리뷰가 열린다
    store.set("rankSeen", "1");
    refreshReviewGate();
    $("#goReview").hidden = false;
    say(`${played()}님, 순위를 확인했어요! 이제 리뷰를 남겨주세요.`, "#rankNote");
  } else say("게임을 클리어하면 내 기록이 순위에 올라가요.", "#rankNote");
  ul.innerHTML = data.length ? data.map((r) => `<li><span class="n">${esc(r.nickname)}<div class="sub">${fmt(r.time_seconds)} · 실수 ${r.mistakes} · 힌트 ${r.hints}</div></span><b>${r.score}</b></li>`).join("")
    : "<li>아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</li>";
}
$("#goReview").onclick = () => showTab("review");
$("#rankDiff").onchange = $("#rankReload").onclick = loadRank;

// ---- 리뷰 ----
let rating = 5;
function drawStars() {
  $("#stars").innerHTML = [1,2,3,4,5].map((n) => `<button type="button" data-n="${n}" role="radio" aria-checked="${n === rating}">${n <= rating ? "★" : "☆"}</button>`).join("");
  $("#stars").querySelectorAll("button").forEach((b) => b.onclick = () => { rating = +b.dataset.n; drawStars(); });
}
drawStars();
async function loadReviews() {
  const ul = $("#rvList");
  if (!db) return (ul.innerHTML = "<li>Supabase 설정이 필요합니다 (config.js)</li>");
  const { data, error } = await db.from("reviews").select("nickname,rating,comment,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) return (ul.innerHTML = `<li>${esc(error.message)}</li>`);
  const avg = data.length ? (data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1) : "-";
  $("#rvAvg").textContent = `평균 ★ ${avg} (${data.length}개)`;
  ul.innerHTML = data.map((r) => `<li><div class="rvhead"><b>${esc(r.nickname)}</b><span>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div>${esc(r.comment)}<div class="sub">${new Date(r.created_at).toLocaleString("ko-KR")}</div></li>`).join("");
}
$("#reviewForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!db) return say("Supabase 설정이 필요합니다.", "#rvMsg");
  if (!canReview()) return refreshReviewGate();
  const { error } = await db.from("reviews").insert({ nickname: played(), rating, comment: $("#rvText").value.trim(), play_token: token() });
  if (error) return say("등록 실패: " + (error.code === "42501" ? "게임을 클리어해야 리뷰를 쓸 수 있어요." : error.message), "#rvMsg");
  store.set("playToken", ""); store.set("rankSeen", "0"); refreshReviewGate(); // 리뷰는 클리어 1회당 1번
  $("#rvText").value = ""; say("리뷰가 등록되었습니다. 감사합니다!", "#rvMsg"); loadReviews();
};

refreshReviewGate();
newGame();
