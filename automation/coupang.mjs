// =============================================================
//  쿠팡 파트너스 상품 블록 — 모든 사이트 글에 자동 삽입 (2중 수익)
//  - 애드센스(디스플레이 광고)와 같은 페이지에 공존시켜, 한 글에서
//    광고 노출 수익 + 제휴 구매 수수료가 동시에 발생하도록 설계
//  - 카테고리별 추적 링크는 config/coupang-links.json 에서 관리
//    (운영자가 파트너스에서 링크 생성 후 붙여넣기). 미입력 시 검색 링크로 대체
//  - 문구 정책: "최저가"를 강조하되 단정("무조건 최저가")은 피하고
//    "쿠팡 최저가 확인" 등 확인 유도형으로 — 표시광고법·파트너스 정책 준수
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson } from "./lib.mjs";
import { site } from "../config/site.config.js";

const LINKS_FILE = path.join(ROOT, "config", "coupang-links.json");
// API 딥링크 캐시(coupang-resolve.mjs 가 생성): { "검색어": "https://link.coupang.com/a/..." }
const CACHE_FILE = path.join(ROOT, "config", "coupang-links-cache.json");
let LINKS = {};
let CACHE = {};
try {
  if (fs.existsSync(LINKS_FILE)) LINKS = readJson(LINKS_FILE);
} catch { LINKS = {}; }
try {
  if (fs.existsSync(CACHE_FILE)) CACHE = readJson(CACHE_FILE);
} catch { CACHE = {}; }

// 카테고리별 추천 상품 (글 주제와 자연스럽게 연결 — 클릭·전환율↑)
export const PRODUCTS = {
  season: [
    { name: "휴대용 넥쿨러·미니 선풍기", kw: "넥쿨러" },
    { name: "제습기·제습제 (장마·곰팡이 대비)", kw: "제습기" },
    { name: "쿨매트·냉감 이불", kw: "쿨매트" },
  ],
  life: [
    { name: "무선 물걸레 청소기", kw: "무선 물걸레 청소기" },
    { name: "틈새 수납 정리함 세트", kw: "틈새 수납장" },
    { name: "음식물 쓰레기 냉동 보관함", kw: "음식물 쓰레기 보관함" },
  ],
  money: [
    { name: "대기전력 차단 스마트플러그", kw: "스마트플러그" },
    { name: "LED 전구 (형광등 교체용)", kw: "LED 전구" },
    { name: "절수 샤워헤드", kw: "절수 샤워헤드" },
  ],
  support: [
    { name: "가정용 문서 파쇄기", kw: "가정용 파쇄기" },
    { name: "서류 스캔용 휴대폰 거치대", kw: "휴대폰 거치대" },
  ],
  howto: [
    { name: "가정용 라벨기", kw: "라벨기" },
    { name: "대용량 보조배터리", kw: "보조배터리 20000" },
  ],
  ent: [
    { name: "콘서트용 고배율 쌍안경", kw: "콘서트 쌍안경" },
    { name: "응원봉 보호 케이스·가방", kw: "응원봉 가방" },
    { name: "포토카드 바인더", kw: "포토카드 바인더" },
  ],
};
export const FALLBACK = [
  { name: "휴대용 선풍기", kw: "휴대용 선풍기" },
  { name: "대용량 보조배터리", kw: "보조배터리" },
];

/** 전 카테고리에서 쓰이는 (검색어 → 검색 URL) 유니크 목록 — 딥링크 사전 생성용 */
export function allSearchTargets() {
  const seen = new Set();
  const out = [];
  for (const list of [...Object.values(PRODUCTS), FALLBACK]) {
    for (const p of list) {
      if (seen.has(p.kw)) continue;
      seen.add(p.kw);
      out.push({ kw: p.kw, url: `https://www.coupang.com/np/search?channel=user&q=${encodeURIComponent(p.kw)}` });
    }
  }
  return out;
}

const enc = (s) => encodeURIComponent(String(s));
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 쿠팡 파트너스가 실제로 설정되어 있는가(추적 링크 · API 캐시 · 파트너 ID 중 하나라도) */
export function coupangConfigured() {
  const anyLink = Object.entries(LINKS).some(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim());
  const anyCache = Object.keys(CACHE).length > 0;
  return !!(site.affiliate?.coupang?.partnerId || anyLink || anyCache);
}

/** 추적 링크 우선순위:
 *  ① config 카테고리 링크(운영자 수동 지정) → ② API 딥링크 캐시(상품별) →
 *  ③ config default 링크 → ④ 쿠팡 검색(대체, 추적 안 됨) */
export function linkFor(category, kw) {
  const cat = (LINKS[category] || "").trim();
  const cached = (CACHE[kw] || "").trim();
  const def = (LINKS.default || "").trim();
  // 검색어 정밀 링크(해당 상품으로 정확히 연결)가 최우선 — exact 로 구분해
  // 호출부가 "정확한 상품 링크"와 "카테고리 공용 링크"를 다르게 취급할 수 있게 한다
  if (cached) return { href: cached, tracked: true, exact: true };
  if (cat) return { href: cat, tracked: true, exact: false };
  if (def) return { href: def, tracked: true, exact: false };
  // 대체: 쿠팡 검색 (해당 상품은 정확히 보여주지만 수익 추적은 안 됨)
  return { href: `https://www.coupang.com/np/search?channel=user&q=${enc(kw)}`, tracked: false, exact: true };
}

/** 이 글의 추천 상품: ①채널 재작성본의 글 맞춤 상품(post._products)
 *  ②네이버 재작성본의 글 맞춤 상품(사이트 빌드 등 변형이 없는 호출부용)
 *  ③카테고리 기본 풀 — 순서로 폴백. 어떤 채널이든 "글 내용과 직결된" 상품이 우선. */
function postProducts(post) {
  const norm = (arr) => (arr || [])
    .filter((p) => p && p.name && (p.query || p.kw))
    .map((p) => ({ name: p.name, kw: p.query || p.kw, why: p.why || "" }))
    .slice(0, 3);
  const own = norm(post._products);
  if (own.length >= 2) return own;
  try {
    // 순환 의존 방지를 위해 변형 캐시 파일을 직접 읽는다 (rewrite.mjs import 없이)
    const f = path.join(ROOT, "content", "variants", `${post.slug}.naver.json`);
    if (fs.existsSync(f)) {
      const nv = norm(JSON.parse(fs.readFileSync(f, "utf8")).products);
      if (nv.length >= 2) return nv;
    }
  } catch { /* 무시 → 폴백 */ }
  return norm(PRODUCTS[post.category] || FALLBACK);
}

/**
 * 글 하나에 삽입할 쿠팡 파트너스 상품 블록 HTML (사이트·블로거·WP 공용).
 * 링크 원칙(네이버와 동일): 상품 버튼은 "그 상품이 실제 나오는 링크"만 —
 *  정밀 추적 링크가 있으면 그것, 없으면 정확한 검색 링크 + 입구 추적 링크 1개.
 * 영문 프로필(jype)은 쿠팡 대상이 아니므로 빈 문자열 반환.
 */
export function coupangBlock(post) {
  if (site.lang === "en") return "";
  const prods = postProducts(post);
  if (!prods.length) return "";
  let needEntry = false;
  const cards = prods.map((p) => {
    const { href, tracked, exact } = linkFor(post.category, p.kw);
    let btnHref = href;
    if (!(tracked && exact)) {
      needEntry = needEntry || tracked;
      btnHref = `https://www.coupang.com/np/search?channel=user&q=${encodeURIComponent(p.kw)}`;
    }
    return `<li class="cpg-item">
      <span class="cpg-name">${esc(p.name)}</span>
      ${p.why ? `<span class="cpg-why">${esc(p.why)}</span>` : ""}
      <a class="cpg-btn" href="${esc(btnHref)}" target="_blank" rel="nofollow sponsored noopener">🔥 지금 최저가 보러가기</a>
    </li>`;
  }).join("");
  const entry = needEntry
    ? `<p class="cpg-entry">🧡 쿠팡에서 구매 예정이라면 <a href="${esc(linkFor(post.category, "").href)}" target="_blank" rel="nofollow sponsored noopener"><b>이 링크로 먼저 들어간 뒤</b></a> 검색해 주세요. 가격은 같고, 블로그 운영에 큰 도움이 됩니다.</p>`
    : "";
  // 고지 문구는 글 상단 affiliate-disclosure 에서 이미 노출됨(중복 방지 위해 여기선 짧게 재고지)
  return `<aside class="coupang-block" aria-label="쿠팡 추천 상품">
  <div class="cpg-head">🛒 이 글 보고 바로 챙기면 좋은 <b>추천템 최저가</b></div>
  <p class="cpg-sub">가격은 수시로 바뀌니, <b>지금 최저가</b>를 눌러 바로 확인해 보세요.</p>
  <ul class="cpg-list">${cards}</ul>
  ${entry}
  <p class="cpg-disc">${esc(site.affiliate.coupang.disclosure)}</p>
</aside>`;
}
