// .env 또는 환경변수의 SUPABASE_URL / SUPABASE_ANON_KEY 로 dist/ 를 생성한다.
const fs = require("fs");
if (fs.existsSync(".env")) {
  for (const l of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !l.trim().startsWith("#") && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) console.warn("⚠ SUPABASE_URL / SUPABASE_ANON_KEY 가 없어 DB 기능이 꺼진 채 빌드됩니다.");
fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist");
for (const f of ["index.html", "style.css", "sudoku.js", "app.js"]) fs.copyFileSync(f, "dist/" + f);
fs.writeFileSync("dist/config.js",
  `window.SUPABASE_URL = ${JSON.stringify(SUPABASE_URL || "YOUR_SUPABASE_URL")};\nwindow.SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY")};\n`);
console.log("dist/ 빌드 완료");
