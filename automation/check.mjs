// =============================================================
//  뼈대 자가검수 (Skeleton Health Check)
//  - 설정/콘텐츠/이미지/빌드 산출물/SEO·GEO/채널 준비도를 점검해 리포트
//  - 사용법: npm run check   (빌드 후 검사)
//  - 정보성 리포트. 치명적 누락이 있으면 종료코드 1.
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { site } from "../config/site.config.js";
import { ROOT, PUBLIC_DIR, loadPosts } from "./lib.mjs";

const pass = [], warn = [], fail = [];
const ok = (m) => pass.push(m);
const wn = (m) => warn.push(m);
const er = (m) => fail.push(m);
const exists = (rel) => fs.existsSync(path.join(PUBLIC_DIR, rel));
const hasVal = (v) => !!(v && !String(v).includes("XXXX"));

// 1) 빌드 (최신 산출물 보장)
try {
  execFileSync("node", [path.join(ROOT, "automation", "build.mjs")], { stdio: "pipe" });
  ok("빌드 성공 (build.mjs)");
} catch (e) {
  er("빌드 실패: " + (e.stderr?.toString() || e.message).split("\n")[0]);
}

// 2) 설정 점검
if (hasVal(site.url)) ok(`사이트 URL: ${site.url}`); else er("SITE_URL 미설정");
if ((site.categories || []).length >= 3) ok(`카테고리 ${site.categories.length}개`); else wn("카테고리 부족");
if ((site.editorialBaseline || []).length === 4) ok("고정 작성 기준 4종 로드됨"); else wn("고정 작성 기준 누락");

// 3) 콘텐츠 무결성
const posts = loadPosts();
ok(`발행 글 ${posts.length}편`);
const required = ["title", "slug", "category", "date", "summary", "description", "path", "faqs", "image"];
let badPosts = 0;
for (const p of posts) {
  const miss = required.filter((k) => !p[k] || (Array.isArray(p[k]) && !p[k].length));
  const h2 = (p.body.match(/^##\s+/gm) || []).length;
  if (miss.length) { badPosts++; wn(`[${p.slug}] 누락 필드: ${miss.join(", ")}`); }
  if (h2 < 4) wn(`[${p.slug}] 소제목 ${h2}개(<4) — 이미지 4장 기준 미달 가능`);
}
if (!badPosts) ok("모든 글 필수 프론트매터 충족");

// 4) 이미지(글당 대표+소제목 = 4장+)
let lowImg = 0;
for (const p of posts) {
  const cover = path.join(ROOT, "src", "assets", "covers", `${p.slug}.png`);
  const sections = (fs.existsSync(path.join(ROOT, "src", "assets", "covers"))
    ? fs.readdirSync(path.join(ROOT, "src", "assets", "covers"))
    : []).filter((f) => f.startsWith(`${p.slug}-s`) && f.endsWith(".png")).length;
  const total = (fs.existsSync(cover) ? 1 : 0) + sections;
  if (total < (site.publishing.minImages || 4)) { lowImg++; wn(`[${p.slug}] 이미지 ${total}장(<${site.publishing.minImages})`); }
}
if (!lowImg && posts.length) ok(`모든 글 이미지 ${site.publishing.minImages}장 이상`);

// 5) 빌드 산출물
const artifacts = [
  ["index.html", "홈"], ["sitemap.xml", "사이트맵"], ["robots.txt", "robots"],
  ["llms.txt", "llms.txt"], ["rss.xml", "RSS"], ["404.html", "404"],
  ["dashboard/index.html", "대시보드"], ["dashboard/plan.md", "기획안"],
  ["dashboard/naver-content-pack.md", "네이버팩"], ["about/index.html", "소개"],
  ["author/index.html", "작성자"], ["contact/index.html", "문의"], ["privacy/index.html", "개인정보"],
  [`${site.indexNowKey}.txt`, "IndexNow 키"],
];
for (const [f, label] of artifacts) exists(f) ? ok(`산출물: ${label}`) : er(`산출물 누락: ${label} (${f})`);
for (const c of site.categories)
  exists(`category/${c.slug}/index.html`) ? null : er(`카테고리 페이지 누락: ${c.slug}`);
ok(`카테고리 페이지 ${site.categories.length}개`);

// 6) SEO·GEO 자동검사
try {
  const { runAudit } = await import("./audit.mjs");
  const res = runAudit();
  const entries = Object.entries(res);
  const p = entries.filter(([, v]) => v.pass).length;
  (p === entries.length ? ok : wn)(`SEO·GEO 자동검사 ${p}/${entries.length} 통과`);
  for (const [k, v] of entries) if (!v.pass) wn(`  검사 미통과: ${k} (${v.detail})`);
} catch (e) {
  er("audit 실행 실패: " + e.message);
}

// 7) 채널 준비도
ok("채널: 자체 사이트 — 운영중");
const bsec = ["BLOGGER_BLOG_ID", "BLOGGER_CLIENT_ID", "BLOGGER_CLIENT_SECRET", "BLOGGER_REFRESH_TOKEN"];
const bReady = bsec.every((k) => process.env[k]);
bReady ? ok("채널: 구글 블로거 — 연동됨") : wn("채널: 구글 블로거 — 연동 대기(Secrets 4종 필요)");
const wpReady = !!(process.env.WPCOM_SITE && process.env.WPCOM_TOKEN) ||
  !!(process.env.WORDPRESS_URL && process.env.WORDPRESS_USER && process.env.WORDPRESS_APP_PASSWORD);
wpReady ? ok("채널: 워드프레스 — 연동됨") : wn("채널: 워드프레스 — 연동 대기(WPCOM_SITE/TOKEN 또는 WORDPRESS_* 필요)");
wn("채널: 네이버 블로그 — 수동 발행(기획안 다운로드 제공)");

// 8) 수익화/분석 (정보)
const money = [
  ["AdSense", hasVal(site.ads.adsense.client)], ["Taboola", !!site.ads.taboola.publisher],
  ["GA4", !!site.analytics.ga4], ["GSC 인증", !!site.analytics.googleSiteVerification],
  ["네이버 쇼핑커넥트", !!(site.affiliate?.naverConnect?.enabled)],
  ["쿠팡 파트너스", !!(site.affiliate?.coupang?.enabled)],
];
for (const [k, v] of money) v ? ok(`수익화/분석: ${k} 설정됨`) : wn(`수익화/분석: ${k} 미설정`);

// ---- 리포트 ----
const line = "─".repeat(52);
console.log(`\n${line}\n  뼈대 자가검수 리포트 — ${site.name}\n${line}`);
console.log(`\n✅ 정상 ${pass.length}건`);
for (const m of pass) console.log(`  ✅ ${m}`);
if (warn.length) { console.log(`\n⚠️  확인 필요 ${warn.length}건 (대부분 운영자 설정 항목)`); for (const m of warn) console.log(`  ⚠️  ${m}`); }
if (fail.length) { console.log(`\n❌ 치명 ${fail.length}건`); for (const m of fail) console.log(`  ❌ ${m}`); }
console.log(`\n${line}`);
const verdict = fail.length ? "❌ 뼈대 결함 있음(치명)" : warn.length ? "🟡 뼈대 정상 (운영자 설정 일부 대기)" : "🟢 뼈대 완전 정상";
console.log(`  결론: ${verdict}`);
console.log(`${line}\n`);
process.exit(fail.length ? 1 : 0);
