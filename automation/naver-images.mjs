// =============================================================
//  네이버 전용 고품질 이미지 생성기 (HTML → PNG, 무료·CI 자동)
//  - 네이버 원고에는 사이트 커버와 "다른" 이미지를 쓴다:
//    유사문서 신호 차단 + 채널별 비주얼 차별화.
//  - 파일: src/assets/naver/<slug>-n0.png(히어로) -n1(핵심 포인트) -n2(요약 인용)
//    이미 있는 인덱스는 건너뜀 → 힉스필드 등 외부 제작 이미지를 n0/n1 로 넣어두면
//    그대로 존중하고 부족한 장수만 렌더로 채운다(최소 3장 목표).
//  - 스타일: 사이트 커버(파란 그라디언트 카드)와 구분되는 크림톤 에디토리얼 프린트 룩,
//    카테고리별 듀오톤 팔레트. 제목은 네이버 재작성본 제목을 우선 사용.
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { site } from "../config/site.config.js";
import { ROOT, ensureDir, loadPosts, isEntertainment } from "./lib.mjs";
import { shoot, FONT_FACE, extractHeadings } from "./images.mjs";
import { loadVariant } from "./rewrite.mjs";

const OUT = path.join(ROOT, "src", "assets", "naver");
const W = 960, H = 720; // 4:3 — 네이버 본문 폭에 넉넉
const file = (slug, k) => path.join(OUT, `${slug}-n${k}.png`);
// 같은 인덱스에 외부 제작(jpg — 힉스필드 실사 등) 이미지가 있으면 렌더하지 않는다
const EXTS = [".png", ".jpg"];
const taken = (slug, k) => EXTS.some((e) => fs.existsSync(path.join(OUT, `${slug}-n${k}${e}`)));

// 카테고리별 듀오톤 팔레트 (크림 배경 공통 — 사이트 커버와 확실히 다른 인상)
const PALETTES = {
  money:   { a: "#0f766e", b: "#f59e0b", name: "공공요금·환급" },
  support: { a: "#7c3aed", b: "#f472b6", name: "지원금·정책" },
  life:    { a: "#ea580c", b: "#84cc16", name: "생활꿀팁" },
  season:  { a: "#0369a1", b: "#fb923c", name: "계절·시즌" },
  howto:   { a: "#be185d", b: "#38bdf8", name: "신청·방법" },
  ent:     { a: "#6d28d9", b: "#fbbf24", name: "연예·팬라이프" },
};
const pal = (cat) => PALETTES[cat] || { a: "#334155", b: "#f59e0b", name: cat };

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BASE_CSS = (p) => `
${FONT_FACE}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;background:#faf6ef;position:relative}
.blob{position:absolute;border-radius:50%;filter:blur(2px);opacity:.16}
.b1{width:520px;height:520px;background:${p.a};top:-180px;right:-140px}
.b2{width:380px;height:380px;background:${p.b};bottom:-150px;left:-120px}
.frame{position:absolute;inset:26px;border:2px solid ${p.a}22;border-radius:22px}
.chip{display:inline-block;background:${p.a};color:#fff;font-weight:700;font-size:24px;
  padding:10px 26px;border-radius:999px;letter-spacing:.5px}
.brand{position:absolute;left:64px;bottom:52px;font-size:22px;font-weight:700;color:${p.a}99}
.tick{position:absolute;right:64px;bottom:48px;width:56px;height:8px;background:${p.b};border-radius:4px}`;

/** n0 — 매거진 히어로: 카테고리 칩 + 큰 제목 */
function heroHtml(title, cat) {
  const p = pal(cat);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS(p)}
.wrap{position:absolute;inset:0;padding:88px 64px;display:flex;flex-direction:column;justify-content:center;gap:34px}
h1{font-size:64px;font-weight:900;line-height:1.28;color:#1c1917;word-break:keep-all;max-width:800px}
h1 em{font-style:normal;box-shadow:inset 0 -20px 0 ${p.b}55}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div><div class="frame"></div>
<div class="wrap"><div><span class="chip">${esc(p.name)}</span></div>
<h1><em>${esc(title)}</em></h1></div>
<div class="brand">${esc(site.name)} · 직접 확인한 생활 기록</div><div class="tick"></div>
</body></html>`;
}

/** n1 — 핵심 포인트 3 (소제목에서 추출, 큰 번호 타이포) */
function pointsHtml(title, cat, points) {
  const p = pal(cat);
  const rows = points.slice(0, 3).map((t, i) => `
    <div class="row"><div class="num">${i + 1}</div><div class="txt">${esc(t)}</div></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS(p)}
.wrap{position:absolute;inset:0;padding:80px 64px 120px;display:flex;flex-direction:column;gap:8px}
.head{font-size:30px;font-weight:900;color:${p.a};margin-bottom:26px;letter-spacing:.5px}
.row{display:flex;align-items:center;gap:28px;padding:26px 0;border-bottom:2px dashed ${p.a}33}
.num{font-size:76px;font-weight:900;color:${p.b};min-width:76px;text-align:center}
.txt{font-size:38px;font-weight:700;color:#1c1917;line-height:1.35;word-break:keep-all}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div><div class="frame"></div>
<div class="wrap"><div class="head">✔ 이 글의 핵심 포인트</div>${rows}</div>
<div class="brand">${esc(site.name)}</div><div class="tick"></div>
</body></html>`;
}

/** n2 — 요약 인용 카드 */
function quoteHtml(summary, cat) {
  const p = pal(cat);
  const text = String(summary || "").slice(0, 150);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS(p)}
.wrap{position:absolute;inset:0;padding:90px 84px;display:flex;flex-direction:column;justify-content:center}
.qm{font-size:150px;font-weight:900;color:${p.b};line-height:.6;margin-bottom:8px}
.q{font-size:42px;font-weight:700;color:#1c1917;line-height:1.55;word-break:keep-all}
.bar{width:120px;height:10px;background:${p.a};border-radius:5px;margin-top:44px}
</style></head><body>
<div class="blob b1"></div><div class="blob b2"></div><div class="frame"></div>
<div class="wrap"><div class="qm">&ldquo;</div><div class="q">${esc(text)}</div><div class="bar"></div></div>
<div class="brand">${esc(site.name)} · 한 줄 결론</div><div class="tick"></div>
</body></html>`;
}

/** 글 1건의 네이버 이미지 세트 보장(있는 인덱스는 보존, 부족분만 렌더) */
export function genNaverImages(post) {
  const rw = loadVariant(post.slug, "naver");
  const title = rw?.title || post.title;
  const summary = rw?.summary || post.summary || post.description;
  const heads = extractHeadings(rw?.body_markdown || post.body || "").map((h) => h.replace(/[#*`]/g, "").trim());
  ensureDir(OUT);
  let made = 0;
  if (!taken(post.slug, 0)) { shoot(heroHtml(title, post.category), W, H, file(post.slug, 0)); made++; }
  if (!taken(post.slug, 1) && heads.length >= 2) { shoot(pointsHtml(title, post.category, heads), W, H, file(post.slug, 1)); made++; }
  if (!taken(post.slug, 2) && summary) { shoot(quoteHtml(summary, post.category), W, H, file(post.slug, 2)); made++; }
  return made;
}

/** 외부 제작 이미지(힉스필드 AI 실사/일러스트) 가져오기 — CI에서 실행(외부망 필요).
 *  config/naver-image-imports.json 목록 중 없는 파일만 다운로드한다. */
const MANIFEST = path.join(ROOT, "config", "naver-image-imports.json");
async function importExternal() {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).images || []; } catch { return 0; }
  ensureDir(OUT);
  let n = 0;
  for (const it of list) {
    if (!it?.file || !it?.url || it.file.includes("/")) continue;
    const dest = path.join(OUT, it.file);
    if (fs.existsSync(dest)) continue;
    try {
      const r = await fetch(it.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      console.log(`[naver-img] 외부 이미지 가져옴: ${it.file}`);
      n++;
    } catch (e) { console.warn(`[naver-img] ⚠ ${it.file} 다운로드 실패(다음 실행 재시도): ${e.message}`); }
  }
  return n;
}

// CLI: 외부 이미지 가져오기 + 최신 N편(연예 제외) 이미지 보장 — run-all 1.8단계
async function main() {
  if (String(site.lang || "ko").startsWith("en")) { console.log("[naver-img] 영문 프로필 — 건너뜀"); return; }
  await importExternal();
  const N = Number(process.env.REWRITE_NAVER_LIMIT || 3);
  const posts = loadPosts().filter((p) => !isEntertainment(p.category)).slice(0, N);
  let total = 0;
  for (const p of posts) {
    try { total += genNaverImages(p); }
    catch (e) { console.warn(`[naver-img] ⚠ ${p.slug}: ${e.message}`); }
  }
  console.log(`[naver-img] 신규 ${total}장 (검사 ${posts.length}글)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error("[naver-img] 오류:", e.message); process.exit(0); });
}
