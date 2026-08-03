// =============================================================
//  네이버 블로그 "복붙 발행" 원고 생성기 (쇼핑커넥트 수익형)
//  - 발행된 글마다 네이버 스마트에디터에 그대로 붙여넣을 수 있는
//    서식(HTML) 원고를 생성 → 대시보드 네이버 탭의 [복사] 버튼이 사용
//  - 수익화: 카테고리별 추천 상품 블록 삽입 — 상품 이미지·가격·출처는
//    스마트에디터의 [글감 → 쇼핑] 카드로 삽입(판매자 상세페이지 이미지를
//    복제하지 않고도 공식 이미지가 출처와 함께 자동 포함되며,
//    쇼핑커넥트 연동 채널이면 수수료 링크로 연결됨)
//  - 문구 정책: "최저가" 단정은 표시광고법상 허위·과장광고 소지가 있어
//    "오늘 최저가 확인" 등 확인 유도형 후킹만 사용한다
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { site } from "../config/site.config.js";
import { ROOT, fixLeftoverBold, isEntertainment } from "./lib.mjs";
import { absUrl } from "./render.mjs";
import { channelVariant } from "./variation.mjs";
import { loadVariant, applyVariant } from "./rewrite.mjs";

// ---- 이미지: 사이트에 배포된 커버/섹션 카드(절대주소)를 원고에 삽입 ----
// 서식 복사(text/html) → 네이버 에디터 붙여넣기 시 이미지가 자동 업로드된다.
const coverFile = (slug, sfx = "") => path.join(ROOT, "src", "assets", "covers", `${slug}${sfx}.png`);
const coverAbs = (slug, sfx = "") => absUrl(`/assets/covers/${slug}${sfx}.png`);
const imgTag = (u, alt) =>
  `<figure style="margin:14px 0"><img src="${u}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px"></figure>`;

/** 글의 사용 가능한 이미지 절대주소 목록.
 *  네이버 전용 이미지(assets/naver/<slug>-n*.png — 힉스필드/렌더 제작)가 있으면 그것만 사용
 *  (사이트 커버와 다른 비주얼 = 유사문서 신호 차단). 없으면 커버/섹션 카드로 폴백. */
export function postImages(slug, max = 8) {
  const nv = [];
  for (let k = 0; k < 6; k++) {
    for (const ext of [".jpg", ".png"]) { // jpg=실사(AI 사진), png=디자인 카드 — 혼합 구성
      const f = path.join(ROOT, "src", "assets", "naver", `${slug}-n${k}${ext}`);
      if (fs.existsSync(f)) { nv.push(absUrl(`/assets/naver/${slug}-n${k}${ext}`)); break; }
    }
  }
  if (nv.length >= 2) return nv;
  const out = [...nv];
  if (fs.existsSync(coverFile(slug))) out.push(coverAbs(slug));
  for (let k = 0; k < max; k++) {
    if (fs.existsSync(coverFile(slug, `-s${k}`))) out.push(coverAbs(slug, `-s${k}`));
  }
  return out;
}

/** 본문 HTML에 이미지 삽입: 대표는 맨 위, 섹션 카드는 각 H2 뒤에 순서대로.
 *  H2가 적어 3장을 못 채우면 남은 이미지를 본문 끝에 이어 붙여 최소 3장을 보장. */
function insertImages(bodyHtml, slug, title) {
  const imgs = postImages(slug);
  if (!imgs.length) return { html: bodyHtml, used: 0 };
  let used = 0;
  let html = imgTag(imgs[0], title) + bodyHtml; // 대표 이미지 최상단
  used = 1;
  html = html.replace(/<h2[^>]*>[\s\S]*?<\/h2>/g, (m) => {
    if (used >= imgs.length) return m;
    const tag = imgTag(imgs[used], `${title} 관련 이미지 ${used}`);
    used += 1;
    return m + tag;
  });
  while (used < Math.min(3, imgs.length)) { // 최소 3장 보장(이미지가 있으면)
    html += imgTag(imgs[used], `${title} 관련 이미지 ${used}`);
    used += 1;
  }
  return { html, used };
}

const DISCLOSURE =
  "※ 이 포스팅은 네이버 쇼핑커넥트 활동의 일환으로, 링크를 통해 구매 시 일정 수수료를 제공받을 수 있습니다.";

// 카테고리별 추천 상품 슬롯 — query 는 [글감→쇼핑] 검색어
const PRODUCTS = {
  season: [
    { name: "넥쿨러 (목에 거는 휴대용 냉풍기)", why: "폭염 출퇴근·야외활동 필수템 — 손 안 쓰고 시원함 유지", query: "넥쿨러" },
    { name: "미니 제습기 (원룸·옷장용)", why: "장마철 곰팡이·꿉꿉함 예방, 전기료 부담 적은 소형", query: "미니 제습기" },
    { name: "캠핑 아이스박스 (대용량 쿨러)", why: "휴가·캠핑 식재료 보관 — 보냉력이 곧 식중독 예방", query: "캠핑 아이스박스" },
  ],
  life: [
    { name: "틈새 수납 정리함 세트", why: "좁은 집 공간 2배 활용 — 정리 글과 찰떡 조합", query: "틈새 수납장" },
    { name: "무선 물걸레 청소기", why: "걸레질 시간 1/3로 — 생활꿀팁 독자 최다 관심템", query: "무선 물걸레 청소기" },
    { name: "음식물 쓰레기 냉동 보관함", why: "여름 초파리·냄새 원천 차단", query: "음식물 쓰레기 냉동 보관함" },
  ],
  money: [
    { name: "대기전력 차단 스마트플러그", why: "콘센트만 바꿔도 전기요금 절감 — 글 주제와 직결", query: "스마트플러그" },
    { name: "LED 전구 (형광등 교체용)", why: "교체만으로 조명 전기 최대 80% 절약", query: "LED 전구" },
    { name: "절수 샤워헤드", why: "수도요금 절약 + 수압은 그대로", query: "절수 샤워헤드" },
  ],
  support: [
    { name: "가정용 문서 세단기(파쇄기)", why: "지원금 신청 서류·개인정보 안전 폐기", query: "가정용 파쇄기" },
    { name: "휴대폰 거치대 (서류 촬영용)", why: "비대면 신청 서류 스캔·제출이 편해짐", query: "휴대폰 거치대" },
  ],
  howto: [
    { name: "가정용 라벨기", why: "서류·보관함 정리로 신청·갱신 일정 관리", query: "라벨기" },
    { name: "대용량 보조배터리", why: "관공서·은행 대기 중 필수", query: "보조배터리 20000" },
  ],
  ent: [
    { name: "콘서트용 쌍안경 (고배율)", why: "티켓팅 실패로 뒷자리여도 표정까지 보임 — 후기 필수템", query: "콘서트 쌍안경" },
    { name: "응원봉 보호 케이스·가방", why: "이동 중 파손 방지 — 팬이라면 공감하는 소모템", query: "응원봉 가방" },
    { name: "포토카드 바인더", why: "포카 수집 정리 국룰템", query: "포토카드 바인더" },
  ],
};
const PRODUCT_FALLBACK = [
  { name: "휴대용 선풍기", why: "계절 상관없이 검색량 꾸준한 스테디템", query: "휴대용 선풍기" },
  { name: "보조배터리", why: "누구나 필요한 무난한 추천템", query: "보조배터리" },
];

/** 낚시성(단정 없는) 후킹 제목 후보 */
export function hookTitles(post) {
  const t = post.title;
  return [
    `${t} (오늘 최저가 확인하고 결정하세요)`,
    `${t} — 모르면 나만 비싸게 삽니다`,
  ];
}

/** 독자용 추천 문단 — 운영자 지시문 없음(그대로 발행돼도 자연스러운 글).
 *  운영자는 대시보드의 [검색어 복사] 안내에 따라 각 소제목 아래에 쇼핑 카드만 끼워 넣는다. */
function productBlock(p, i) {
  return `
<h3>🛒 함께 준비하면 좋은 것 ${i + 1}. ${p.name}</h3>
<p>${p.why}</p>`;
}

/** 이 글의 추천 상품 목록: 재작성본(글 맞춤 LLM 선정) 우선, 없으면 카테고리 기본 풀 */
export function draftProducts(post, rw) {
  const fromRw = (rw?.products || []).filter((p) => p?.name && p?.query && p?.why);
  if (fromRw.length >= 2) return fromRw.slice(0, 3);
  return (PRODUCTS[post.category] || PRODUCT_FALLBACK).slice(0, 3);
}

/** 글 1건 → 네이버 붙여넣기용 서식 HTML
 *  - content/variants 에 네이버 전용 전면 재작성본이 있으면 그것을 사용(제목~본문 고유)
 *  - 없으면 결정적 변형으로 폴백 (rewrite.mjs 가 매 실행 최신 글부터 백필) */
export function naverDraftHtml(post) {
  const rw = loadVariant(post.slug, "naver");
  post = applyVariant(post, rw);
  let v;
  if (post._rewritten) {
    v = {
      introHtml: "",
      summaryHtml: post.summary ? `<p style="background:#eefaf0;border-radius:8px;padding:12px 14px"><strong>✅ 먼저 결론부터</strong><br>${post.summary}</p>` : "",
      bodyHtml: fixLeftoverBold(marked.parse(post.body || "")),
      faqHtml: (post.faqs || []).length ? `<h2>자주 묻는 질문</h2>` + post.faqs.map((f) => `<h3>Q. ${f.q}</h3><p>${f.a}</p>`).join("") : "",
      outroHtml: "",
    };
  } else {
    v = channelVariant(post, "naver");
  }
  // 본문 내부 링크는 절대주소로 (출처 역할)
  let body = v.bodyHtml.replace(/(src|href)="\/(?!\/)/g, (m, attr) => `${attr}="${site.url.replace(/\/+$/, "")}/`);
  // 이미지 3장+ 삽입(대표 + 소제목 카드) — 붙여넣기 시 네이버가 자동 업로드
  body = insertImages(body, post.slug, post.title).html;

  const prods = draftProducts(post, rw);
  const tags = (post.keywords || []).concat(post.tags || []).slice(0, 8)
    .map((k) => `#${String(k).replace(/\s+/g, "")}`).join(" ");

  return `<p><i>${DISCLOSURE}</i></p>
${v.introHtml}
${v.summaryHtml}
${body}
${v.faqHtml}
<hr>
<h2>💰 이 글 내용, 실전에서 챙기면 좋은 것들</h2>
<p>글에서 다룬 내용을 실제로 해보면서 유용했던 것들만 추렸어요. 가격은 수시로 바뀌니 <b>오늘 가격을 한 번 확인</b>해 보시는 걸 추천드려요.</p>
${prods.map(productBlock).join("\n")}
${v.outroHtml}
<hr>
<p>원문(더 자세한 표와 그림): <a href="${absUrl(post.path)}">${absUrl(post.path)}</a></p>
<p>${tags}</p>`;
}

/** 대시보드 산출물: dashboard/naver/<slug>.html + 목록 JSON */
export function writeNaverDrafts(dashboardDir, posts) {
  // 한국어 사이트에서만 의미가 있음 (영문 프로필은 네이버 채널 미사용)
  if (site.lang === "en") return [];
  const dir = path.join(dashboardDir, "naver");
  fs.mkdirSync(dir, { recursive: true });
  const list = [];
  // 연예(팬라이프) 글은 네이버 블로그에 발행하지 않는다(운영자 정책) — 원고에서 제외.
  posts = posts.filter((p) => !isEntertainment(p.category));
  for (const p0 of posts) {
    // 목록/제목도 재작성본 기준으로 노출(운영자가 복사하는 제목 = 네이버 고유 제목)
    const rw = loadVariant(p0.slug, "naver");
    const p = applyVariant(p0, rw);
    const html = naverDraftHtml(p0);
    // 복사 버튼용 순수 서식 조각 (뷰어 페이지와 별도)
    fs.writeFileSync(path.join(dir, `${p.slug}.frag.html`), html, "utf8");
    const imgs = postImages(p.slug);
    const imgGuide = imgs.length
      ? `<details style="background:#eef4ff;border-radius:8px;padding:10px 14px;margin-top:8px"><summary><b>🖼 이미지 ${imgs.length}장 포함</b> — 붙여넣기에 이미지가 안 들어갔다면 클릭</summary>
<p style="font-size:13px">아래 주소를 하나씩 새 탭에 열어 이미지를 <b>우클릭 → 복사</b> 후 네이버 본문에 붙여넣으세요.</p>
<ol style="font-size:12px">${imgs.map((u) => `<li><a href="${u}" target="_blank">${u}</a></li>`).join("")}</ol></details>`
      : "";
    fs.writeFileSync(path.join(dir, `${p.slug}.html`),
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${p.title} — 네이버 복붙 원고</title></head>
<body style="max-width:760px;margin:24px auto;font-family:sans-serif;line-height:1.7">
<div style="background:#fff7e0;border-radius:8px;padding:12px 14px">이 페이지는 <b>네이버 붙여넣기용 원고</b>입니다.
대시보드의 [📋 원고 복사] 버튼을 쓰면 <b>서식+이미지</b>까지 복사됩니다. 이 페이지에서는 전체 선택(Ctrl+A)→복사(Ctrl+C)로도 가능합니다.</div>
${imgGuide}
<hr>${html}</body></html>`, "utf8");
    list.push({
      slug: p.slug, title: p.title, hooks: hookTitles(p), category: p.category, date: p.date,
      imgs: postImages(p.slug).length,   // 원고에 포함된 이미지 수
      unique: !!p._rewritten,            // 네이버 전용 전면 재작성본 여부
      products: draftProducts(p0, rw),   // 카드 삽입용: {name, query, why} — 대시보드 검색어 복사 버튼
    });
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(list, null, 2), "utf8");
  return list;
}
