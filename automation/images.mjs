// =============================================================
//  이미지 생성기 (headless Chrome 로 HTML → PNG)
//  - 브랜드 로고, 기본 OG 이미지, 글별 커버(대표) 이미지 생성
//  - 한글 폰트는 Pretendard(@font-face file://) 사용
//  - 로컬/생성 단계 전용. CI 빌드에는 의존하지 않음(PNG 결과물만 커밋).
//
//  사용:
//    node automation/images.mjs brand     # 로고/기본OG/파비콘
//    node automation/images.mjs covers     # 모든 글 커버 생성
//    node automation/images.mjs all
// =============================================================
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { site } from "../config/site.config.js";
import { ROOT, ensureDir, loadPosts } from "./lib.mjs";
import { cropTop } from "./pngcrop.mjs";

const ASSETS = path.join(ROOT, "src", "assets");
const COVERS = path.join(ASSETS, "covers");

// Chrome 실행 파일 탐색
function chromeBin() {
  const cands = [
    process.env.CHROME_BIN,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  // glob fallback
  const base = "/opt/pw-browsers";
  if (fs.existsSync(base)) {
    const dir = fs.readdirSync(base).find((d) => d.startsWith("chromium-"));
    if (dir) {
      const p = path.join(base, dir, "chrome-linux", "chrome");
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("Chrome 실행 파일을 찾을 수 없습니다. CHROME_BIN 환경변수로 지정하세요.");
}

// Pretendard OTF 경로 탐색 (weight 별)
function fontFace() {
  const dir = path.join(ROOT, "node_modules", "pretendard", "dist", "public", "static");
  if (!fs.existsSync(dir)) {
    console.warn("[images] Pretendard 미설치 — 'npm i --no-save pretendard' 후 실행하세요. 시스템 폰트로 대체합니다.");
    return "";
  }
  const pick = (name, fallback) => {
    const f = path.join(dir, name);
    return fs.existsSync(f) ? f : path.join(dir, fallback);
  };
  const reg = pick("Pretendard-Regular.otf", "Pretendard-Medium.otf");
  const bold = pick("Pretendard-Bold.otf", "Pretendard-SemiBold.otf");
  const black = pick("Pretendard-Black.otf", "Pretendard-ExtraBold.otf");
  return `
@font-face{font-family:'P';src:url('file://${reg}') format('opentype');font-weight:400}
@font-face{font-family:'P';src:url('file://${bold}') format('opentype');font-weight:700}
@font-face{font-family:'P';src:url('file://${black}') format('opentype');font-weight:900}
*{font-family:'P',sans-serif}`;
}

function shoot(html, w, h, outPath, transparent = false) {
  const tmp = path.join(os.tmpdir(), `card-${Math.abs(hashCode(outPath))}.html`);
  fs.writeFileSync(tmp, html, "utf8");
  ensureDir(path.dirname(outPath));
  // headless chrome 가 뷰포트보다 캔버스를 ~90px 길게 출력하므로
  // 더 크게 렌더한 뒤 정확히 h 행으로 크롭한다.
  const PAD = 120;
  const args = [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--force-color-profile=srgb", "--force-device-scale-factor=1",
    `--screenshot=${outPath}`, `--window-size=${w},${h + PAD}`,
  ];
  if (transparent) args.push("--default-background-color=00000000");
  args.push(`file://${tmp}`);
  execFileSync(chromeBin(), args, { stdio: "pipe" });
  fs.rmSync(tmp, { force: true });
  cropTop(outPath, h);
  console.log(`[images] 생성: ${path.relative(ROOT, outPath)} (${w}x${h})`);
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const FF = fontFace();
const GRAD = "linear-gradient(135deg,#2563eb 0%,#1e40af 60%,#1e3a8a 100%)";

// 브랜드 문안 (프로필별 — config brandmark)
const BM = site.brandmark || { emoji: "💡", line1: "오늘의", line2: "꿀팁", chip: "편집부", logoWord: "꿀팁" };

// 카테고리별 색상 (커버 다양성) — 프로필별 카테고리 순서에 팔레트를 매핑
const PALETTE = [
  ["#2563eb", "#1e40af"],
  ["#0891b2", "#0e7490"],
  ["#16a34a", "#15803d"],
  ["#db2777", "#9d174d"],
  ["#7c3aed", "#5b21b6"],
];
function catColors(slug) {
  const i = site.categories.findIndex((c) => c.slug === slug);
  return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
}

// ---- 로고 (512x512, 투명배경) ----
function genLogo() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FF}
  html,body{margin:0}.box{width:512px;height:512px;display:flex;align-items:center;justify-content:center}
  .c{width:430px;height:430px;border-radius:96px;background:${GRAD};display:flex;flex-direction:column;
     align-items:center;justify-content:center;color:#fff;box-shadow:0 20px 60px rgba(37,99,235,.4)}
  .e{font-size:150px;line-height:1}.t{font-weight:900;font-size:74px;margin-top:6px;letter-spacing:-2px}
  </style></head><body><div class="box"><div class="c"><div class="e">${BM.emoji}</div><div class="t">${BM.logoWord}</div></div></div></body></html>`;
  shoot(html, 512, 512, path.join(ASSETS, "logo.png"), true);
}

// ---- 기본 OG (1200x630) ----
function genOgDefault() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FF}
  html,body{margin:0}
  .bg{position:fixed;inset:0;background:${GRAD}}
  .box{position:relative;z-index:1;width:1200px;height:630px;color:#fff;
    display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box}
  .e{font-size:90px}.t{font-weight:900;font-size:84px;letter-spacing:-3px;margin:10px 0 14px}
  .s{font-size:38px;opacity:.92;font-weight:400}
  .b{position:absolute;bottom:54px;left:90px;font-size:30px;opacity:.85}
  </style></head><body><div class="bg"></div><div class="box"><div class="e">${BM.emoji}</div>
  <div class="t">${site.name}</div><div class="s">${site.tagline}</div>
  <div class="b">${(site.url||"").replace(/^https?:\/\//,"")}</div></div></body></html>`;
  shoot(html, 1200, 630, path.join(ASSETS, "og-default.png"));
}

// ---- 프로필 이미지 (1000x1000) ----
// 쇼핑커넥트/네이버 블로그/블로거/SNS 프로필 공용. 원형 크롭을 고려해
// 콘텐츠를 중앙 원 안에 배치한다. 크리에이터명: "오늘의 꿀팁 편집부"
function genProfile() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FF}
  html,body{margin:0}
  .bg{position:fixed;inset:0;background:${GRAD}}
  .deco{position:fixed;border-radius:50%;background:rgba(255,255,255,.07)}
  .d1{width:560px;height:560px;top:-180px;right:-160px}
  .d2{width:420px;height:420px;bottom:-150px;left:-130px}
  .box{position:relative;z-index:1;width:1000px;height:1000px;color:#fff;
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .e{font-size:200px;line-height:1;filter:drop-shadow(0 14px 30px rgba(0,0,0,.25))}
  .t1{font-weight:700;font-size:86px;letter-spacing:-2px;margin-top:26px;opacity:.95}
  .t2{font-weight:900;font-size:168px;letter-spacing:-7px;line-height:1.02;margin-top:2px}
  .chip{margin-top:40px;background:rgba(255,255,255,.18);border:3px solid rgba(255,255,255,.5);
    padding:14px 46px;border-radius:999px;font-size:46px;font-weight:700;letter-spacing:2px}
  </style></head><body><div class="bg"></div>
  <div class="deco d1"></div><div class="deco d2"></div>
  <div class="box"><div class="e">${BM.emoji}</div>
  <div class="t1">${BM.line1}</div><div class="t2">${BM.line2}</div>
  <div class="chip">${BM.chip}</div></div></body></html>`;
  shoot(html, 1000, 1000, path.join(ASSETS, "profile.png"));
}

// ---- 파비콘 (SVG, 폰트 불필요) ----
function genFavicon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2563eb"/>
  <text x="32" y="44" font-size="38" text-anchor="middle">${BM.emoji}</text></svg>`;
  ensureDir(ASSETS);
  fs.writeFileSync(path.join(ASSETS, "favicon.svg"), svg, "utf8");
  console.log("[images] 생성: src/assets/favicon.svg");
  // PNG 파비콘도 생성
  shoot(`<!doctype html><html><body style="margin:0">${svg.replace('width="64" height="64"','width="180" height="180"')}</body></html>`,
    180, 180, path.join(ASSETS, "favicon.png"), true);
}

// ---- 글 커버 (1200x630) ----
function catName(slug) {
  const c = site.categories.find((x) => x.slug === slug);
  return c ? c.name : slug;
}
export function genCover(post) {
  const [c1, c2] = catColors(post.category);
  const grad = `linear-gradient(135deg,${c1} 0%,${c2} 100%)`;
  const title = post.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FF}
  html,body{margin:0}
  .bg{position:fixed;inset:0;background:${grad}}
  .box{position:relative;z-index:1;width:1200px;height:630px;color:#fff;
    display:flex;flex-direction:column;justify-content:space-between;padding:70px 80px;box-sizing:border-box}
  .top{display:flex;align-items:center;gap:16px}
  .chip{background:rgba(255,255,255,.22);padding:10px 26px;border-radius:999px;font-size:30px;font-weight:700}
  .e{font-size:48px}
  .t{font-weight:900;font-size:74px;line-height:1.25;letter-spacing:-2px;
     display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .bot{display:flex;justify-content:space-between;align-items:center;font-size:30px;opacity:.92}
  .brand{font-weight:700}
  </style></head><body><div class="bg"></div><div class="box">
  <div class="top"><span class="e">${BM.emoji}</span><span class="chip">${catName(post.category)}</span></div>
  <div class="t">${title}</div>
  <div class="bot"><span class="brand">${site.name}</span><span>${(site.url||"").replace(/^https?:\/\//,"")}</span></div>
  </div></body></html>`;
  const out = path.join(COVERS, `${post.slug}.png`);
  shoot(html, 1200, 630, out);
  return out;
}

// 본문 마크다운에서 H2(##) 소제목 추출
export function extractHeadings(markdown) {
  return [...(markdown || "").matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
}

// 소제목별 카드 이미지 (본문 내용과 연결되는 이미지 확보용)
export function genSectionCard(post, heading, idx) {
  const [c1, c2] = catColors(post.category);
  const grad = `linear-gradient(135deg,${c2} 0%,${c1} 100%)`;
  const h = String(heading).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FF}
  html,body{margin:0}
  .bg{position:fixed;inset:0;background:${grad}}
  .box{position:relative;z-index:1;width:1200px;height:630px;color:#fff;
    display:flex;flex-direction:column;justify-content:center;padding:80px;box-sizing:border-box}
  .chip{align-self:flex-start;background:rgba(255,255,255,.22);padding:10px 24px;border-radius:999px;font-size:28px;font-weight:700;margin-bottom:24px}
  .t{font-weight:900;font-size:70px;line-height:1.25;letter-spacing:-2px;
     display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .b{position:absolute;bottom:54px;left:80px;font-size:28px;opacity:.9;font-weight:700}
  </style></head><body><div class="bg"></div><div class="box">
  <div class="chip">POINT ${idx + 1}</div><div class="t">${h}</div>
  <div class="b">${BM.emoji} ${site.name}</div></div></body></html>`;
  const out = path.join(COVERS, `${post.slug}-s${idx}.png`);
  shoot(html, 1200, 630, out);
  return out;
}

// 한 글의 모든 소제목 카드 생성
export function genSectionCards(post, headings) {
  const hs = headings || extractHeadings(post.body);
  hs.forEach((h, i) => genSectionCard(post, h, i));
  return hs.length;
}

function genBrand() { genLogo(); genOgDefault(); genFavicon(); genProfile(); }
function genCovers() {
  const posts = loadPosts();
  for (const p of posts) {
    genCover(p);
    const n = genSectionCards(p);
    console.log(`[images] ${p.slug}: 대표 + 소제목 ${n}장`);
  }
  console.log(`[images] 커버/섹션 이미지 생성 완료 (${posts.length}글)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] || "all";
  ensureDir(ASSETS);
  if (cmd === "brand" || cmd === "all") genBrand();
  if (cmd === "profile") genProfile();
  if (cmd === "covers" || cmd === "all") genCovers();
}
