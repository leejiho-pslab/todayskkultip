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
import { fixLeftoverBold, isEntertainment } from "./lib.mjs";
import { absUrl } from "./render.mjs";

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

function productBlock(p, i) {
  return `
<h3>🛒 추천템 ${i + 1}. ${p.name}</h3>
<p><b>왜 필요한가:</b> ${p.why}</p>
<p style="background:#f2f6ff;border-radius:8px;padding:12px 14px">
📌 <b>[여기에 상품 카드 넣기]</b> — 에디터 오른쪽 <b>글감</b> 버튼 → <b>쇼핑</b> 탭 → 검색창에
<b>「${p.query}」</b> 입력 → 마음에 드는 상품 클릭.<br>
상품 <b>공식 이미지·가격·판매처 출처가 자동으로</b> 들어가고, 쇼핑커넥트 채널이면 수수료 링크로 연결됩니다.</p>
<p><b>👉 카드를 눌러 오늘 최저가를 직접 확인해 보세요.</b></p>`;
}

/** 글 1건 → 네이버 붙여넣기용 서식 HTML */
export function naverDraftHtml(post) {
  // 본문 마크다운 → HTML, 내부 링크는 절대주소로 (출처 역할)
  let body = fixLeftoverBold(marked.parse(post.body || ""));
  body = body.replace(/(src|href)="\/(?!\/)/g, (m, attr) => `${attr}="${site.url.replace(/\/+$/, "")}/`);

  const prods = (PRODUCTS[post.category] || PRODUCT_FALLBACK).slice(0, 3);
  const faq = (post.faqs || []).length
    ? `<h2>자주 묻는 질문</h2>` + post.faqs.map((f) => `<h3>Q. ${f.q}</h3><p>${f.a}</p>`).join("")
    : "";
  const tags = (post.keywords || []).concat(post.tags || []).slice(0, 8)
    .map((k) => `#${String(k).replace(/\s+/g, "")}`).join(" ");

  return `<p><i>${DISCLOSURE}</i></p>
<p>${post.description || ""}</p>
${body}
${faq}
<hr>
<h2>💰 이 글 보고 바로 쓰는 추천템 (오늘 최저가 확인)</h2>
<p>아래 제품들은 글 내용과 직접 관련된 것만 골랐습니다. 가격은 수시로 바뀌니 <b>카드에서 오늘 가격을 꼭 확인</b>하세요.</p>
${prods.map(productBlock).join("\n")}
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
  for (const p of posts) {
    const html = naverDraftHtml(p);
    // 복사 버튼용 순수 서식 조각 (뷰어 페이지와 별도)
    fs.writeFileSync(path.join(dir, `${p.slug}.frag.html`), html, "utf8");
    fs.writeFileSync(path.join(dir, `${p.slug}.html`),
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${p.title} — 네이버 복붙 원고</title></head>
<body style="max-width:760px;margin:24px auto;font-family:sans-serif;line-height:1.7">
<div style="background:#fff7e0;border-radius:8px;padding:12px 14px">이 페이지는 <b>네이버 붙여넣기용 원고</b>입니다.
대시보드의 [📋 원고 복사] 버튼을 쓰면 서식까지 복사됩니다. 이 페이지에서는 전체 선택(Ctrl+A)→복사(Ctrl+C)로도 가능합니다.</div>
<hr>${html}</body></html>`, "utf8");
    list.push({ slug: p.slug, title: p.title, hooks: hookTitles(p), category: p.category, date: p.date });
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(list, null, 2), "utf8");
  return list;
}
