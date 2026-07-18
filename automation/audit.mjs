// =============================================================
//  자동 감사(audit) 엔진
//  - 빌드 결과물(public/)과 콘텐츠를 스캔해 GEO/SEO 체크리스트의
//    type=auto 항목 통과 여부를 실시간 계산
//  - dashboard.mjs 가 결과를 읽어 진척도를 표시
//  ※ build.mjs 실행(=public/ 생성) 이후에 호출해야 함
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { site } from "../config/site.config.js";
import { PUBLIC_DIR, loadPosts } from "./lib.mjs";
import { t } from "./i18n.mjs";

function read(rel) {
  const p = path.join(PUBLIC_DIR, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}
function postHtmlPath(post) {
  return path.join(post.path.replace(/^\//, ""), "index.html");
}

// 본문(마크다운)에서 외부 링크 수 계산
function externalLinkCount(md) {
  const links = [...md.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
  const host = (() => { try { return new URL(site.url).host; } catch { return ""; } })();
  return links.filter((u) => {
    try { return new URL(u).host !== host; } catch { return false; }
  }).length;
}

/** 비율 기반 통과 판정: 모든 글이 충족해야 하는 항목 */
function everyPost(posts, fn) {
  if (!posts.length) return { pass: false, detail: "글 없음" };
  const ok = posts.filter(fn);
  return {
    pass: ok.length === posts.length,
    detail: `${ok.length}/${posts.length} 글 충족`,
    ratio: ok.length / posts.length,
  };
}
/** 코퍼스 단위: 최소 1개 글이 충족하면 통과 */
function anyPost(posts, fn, label) {
  const ok = posts.filter(fn);
  return { pass: ok.length > 0, detail: `${ok.length}개 글 해당`, ratio: ok.length / (posts.length || 1) };
}

export function runAudit() {
  const posts = loadPosts();
  const index = read("index.html") || "";
  const robots = read("robots.txt") || "";
  const sitemap = read("sitemap.xml") || "";
  const htmls = posts.map((p) => ({ p, html: read(postHtmlPath(p)) || "" }));
  const firstPostHtml = htmls[0]?.html || "";

  // 모든 HTML 페이지 목록(메타/시맨틱 검사용)
  const allPages = [index, ...htmls.map((h) => h.html)].filter(Boolean);

  const checks = {};
  const set = (id, pass, detail) => (checks[id] = { pass: !!pass, detail });

  // ---- 크롤링/인덱싱 ----
  set("crawlable", robots && !/^\s*Disallow:\s*\/\s*$/im.test(robots),
    robots ? "robots.txt 전체 차단 없음" : "robots.txt 없음");
  set("indexable", allPages.length > 0 && !allPages.some((h) => /noindex/i.test(h)),
    "noindex 미사용");
  set("sitemap_exists", !!sitemap, sitemap ? "sitemap.xml 생성됨" : "없음");
  set("sitemap_lastmod", /<lastmod>/.test(sitemap), /<lastmod>/.test(sitemap) ? "lastmod 포함" : "lastmod 없음");
  set("robots_exists", !!robots, robots ? "robots.txt 생성됨" : "없음");
  set("robots_allows_ai", /GPTBot/i.test(robots) && /ClaudeBot/i.test(robots) && /PerplexityBot/i.test(robots),
    "GPTBot/ClaudeBot/PerplexityBot 등 허용");
  set("html_pages", allPages.length > 0, `${allPages.length}개 HTML 페이지`);

  // ---- 테크니컬 SEO ----
  set("https", site.url.startsWith("https://"), site.url.startsWith("https://") ? "HTTPS" : "비HTTPS");
  set("org_schema", /"@type":"Organization"/.test(index), index.includes("Organization") ? "홈 Organization 스키마" : "없음");
  set("page_schema", /"@type":"Article"/.test(firstPostHtml), "글 Article 스키마");
  set("lightweight", (read("assets/main.css") || "").length < 20000,
    `CSS ${Math.round((read("assets/main.css") || "").length / 1024)}KB, 정적·경량 구조`);
  set("mobile_responsive", allPages.every((h) => /name="viewport"/.test(h)), "viewport 메타 포함");
  set("author_schema", /"@type":"Person"/.test(firstPostHtml) && /rel="author"/.test(firstPostHtml),
    "Person 스키마 + 작성자 링크");

  // ---- 콘텐츠 SEO (글 단위) ----
  const ep = (fn) => everyPost(posts, fn);
  let r;
  r = ep((p) => {
    // 대소문자 무시 비교 — 영어 프로필에서 "jyp" vs "JYP" 오판 방지
    const first = (p.body.split(/\n\s*\n/)[0] || "").toLowerCase();
    const title = (p.title || "").toLowerCase();
    return (p.keywords || []).some((k) => first.includes(String(k).toLowerCase())) ||
      (p.keywords || []).some((k) => title.includes(String(k).toLowerCase()));
  });
  checks.first_para_keyword = { pass: r.pass, detail: r.detail };

  r = ep((p) => /\*\*[^*]+\*\*/.test(p.body));
  checks.bold_emphasis = { pass: r.pass, detail: r.detail };

  // 렌더된 글 HTML 의 모든 <img> 가 비어있지 않은 alt 를 갖는지 + 이미지 존재 여부
  const pagesWithImg = htmls.filter((h) => /<img\b/i.test(h.html));
  const imgTags = htmls.flatMap((h) => h.html.match(/<img\b[^>]*>/gi) || []);
  const imgAltOk = imgTags.length > 0 && imgTags.every((t) => /\balt\s*=\s*"[^"]+"/i.test(t));
  checks.img_alt = {
    pass: imgAltOk,
    detail: imgTags.length === 0
      ? "글 이미지 없음(대표 이미지 생성 필요: npm run images)"
      : `${imgTags.length}개 이미지 모두 ALT 보유 (${pagesWithImg.length}개 글)`,
  };

  r = ep((p) => (p.description || "").length > 10);
  checks.meta_description = { pass: r.pass, detail: r.detail };

  const semOk = htmls.length > 0 && htmls.every((h) =>
    /<main/.test(h.html) && /<article/.test(h.html) && /<nav/.test(h.html) &&
    /<header/.test(h.html) && /<section/.test(index));
  set("semantic_html", semOk, "header/nav/main/article/section 사용");

  const headOk = htmls.length > 0 && htmls.every((h) => /<h1/.test(h.html) && /<h2/.test(h.html));
  set("heading_hierarchy", headOk, "H1→H2 계층");

  // 언어별 표시 문자열(i18n) 기준으로 검사 — 영어 프로필은 "Published"
  set("date_visible", htmls.length > 0 && htmls.every((h) => h.html.includes(t.publishedOn)), "게시일/검토일 표시");

  r = ep((p) => (p.summary || "").length >= 150);
  checks.summary_box = { pass: r.pass, detail: r.detail };

  r = ep((p) => /\|.*\|/.test(p.body) || /!\[/.test(p.body));
  checks.visual_format = { pass: r.pass, detail: r.detail + " (표/이미지)" };

  // 팩트체킹 가능성: 외부 출처 링크 + (발행연도 또는 출처 표현)
  r = ep((p) =>
    externalLinkCount(p.body) >= 1 &&
    (/(19|20)\d{2}/.test(p.body) || /(기준|출처|고시|따르면|공식)/.test(p.body))
  );
  checks.source_cited = { pass: r.pass, detail: r.detail + " (외부출처+연도/출처표현)" };

  r = ep((p) => externalLinkCount(p.body) >= 2);
  checks.external_links = { pass: r.pass, detail: r.detail + " (외부링크 2+)" };

  // 내부 링크: 페이지에 카테고리/관련/내부 글 링크 존재
  const intOk = htmls.length > 0 && htmls.every((h) => /href="[^"]*\/category\//.test(h.html));
  set("internal_links", intOk, "카테고리/관련글 내부 링크");

  // 쿼리 유형(코퍼스 단위)
  const defRe = /(란\b|이란|무엇|뜻|개념|what)/i;
  const cmpRe = /(vs|비교|차이|추천|best|순위)/i;
  const howRe = /(방법|하는\s?법|신청|how\s?to|절차|준비)/i;
  const qd = anyPost(posts, (p) => defRe.test(p.title) || defRe.test(p.body.slice(0, 400)));
  const qc = anyPost(posts, (p) => cmpRe.test(p.title) || cmpRe.test(p.body));
  const qh = anyPost(posts, (p) => howRe.test(p.title) || howRe.test(p.body));
  checks.query_definition = { pass: qd.pass, detail: qd.detail };
  checks.query_comparison = { pass: qc.pass, detail: qc.detail };
  checks.query_howto = { pass: qh.pass, detail: qh.detail };

  set("faq_schema", /"@type":"FAQPage"/.test(firstPostHtml), "FAQPage 스키마");

  // IndexNow: 키 존재 + 키 파일 생성
  const inKey = site.indexNowKey;
  const inFile = inKey ? read(`${inKey}.txt`) : null;
  set("indexnow", !!(inKey && inFile), inKey ? "IndexNow 키 파일 생성됨" : "키 미설정");

  return checks;
}

// CLI: 감사 결과 요약 출력
if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runAudit();
  const entries = Object.entries(res);
  const pass = entries.filter(([, v]) => v.pass).length;
  console.log(`[audit] 자동 검사 ${pass}/${entries.length} 통과`);
  for (const [k, v] of entries) console.log(`  ${v.pass ? "✅" : "❌"} ${k}: ${v.detail}`);
}
