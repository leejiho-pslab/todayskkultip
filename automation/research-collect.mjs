// =============================================================
//  시장조사 수집기 (네이버 오픈API 기반 · CI 에서 매일 실행)
//  - NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 로 뉴스 검색 + 데이터랩(검색어트렌드) 호출
//  - 뉴스에서 시의성 후보를 발굴하고, 데이터랩 검색량으로 급상승도를 점수화
//  - 결과를 config/market-research.json 에 적재(제목·출처·키워드·점수만, 기사 본문 미저장)
//  - 키 없으면 조용히 종료(기존 파일 유지) → run/워크플로우가 실패하지 않음
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const ID = process.env.NAVER_CLIENT_ID || "";
const SECRET = process.env.NAVER_CLIENT_SECRET || "";
const OUT = path.join(ROOT, "config", "market-research.json");
const H = { "X-Naver-Client-Id": ID, "X-Naver-Client-Secret": SECRET };
const stripTags = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// KST(UTC+9) 기준 오늘
const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
const today = ymd(nowKst);
const month = nowKst.getUTCMonth() + 1;

// 범위별 뉴스 검색 질의 (범위 밖 유입 방지 위해 구체적으로)
const NEWS = {
  "news-kr": ["오늘 주요 뉴스", "실시간 이슈"],
  "news-global": ["해외 국제 뉴스", "글로벌 이슈"],
  "media-buzz": ["홈쇼핑 완판", "유튜브 화제 영상"],
  "platform-event": ["쿠팡 할인 행사", "G마켓 SSG 기획전"],
  "vertical-event": ["무신사 세일", "에이블리 지그재그 29CM W컨셉 프로모션"],
};

async function searchNews(query, display = 8) {
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
  const res = await fetch(url, { headers: H });
  if (!res.ok) throw new Error(`news ${res.status} (${query})`);
  const j = await res.json();
  return (j.items || []).map((it) => ({ title: stripTags(it.title), link: it.originallink || it.link }));
}

// 데이터랩 검색어트렌드: 키워드별 최근 검색량 급상승도(최근 3일 평균 / 직전 평균)
async function trendScores(keywords) {
  if (!keywords.length) return {};
  const end = new Date(nowKst); const start = new Date(nowKst.getTime() - 29 * 86400000);
  const groups = keywords.slice(0, 5).map((k) => ({ groupName: k, keywords: [k] }));
  const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: ymd(start), endDate: ymd(end), timeUnit: "date", keywordGroups: groups }),
  });
  if (!res.ok) throw new Error(`datalab ${res.status}`);
  const j = await res.json();
  const out = {};
  for (const r of j.results || []) {
    const data = (r.data || []).map((d) => d.ratio);
    if (data.length < 6) { out[r.title] = 0; continue; }
    const recent = data.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const prior = data.slice(-10, -3).reduce((a, b) => a + b, 0) / Math.max(1, data.slice(-10, -3).length);
    out[r.title] = prior > 0 ? Math.round((recent / prior) * 100) / 100 : 0; // 1.0=유지, >1 급상승
  }
  return out;
}

// 시즌(제철·계절이슈)은 월 캘린더 기반 — 검색이 아니라 사실 기반으로 구성
const SEASON = {
  7: ["7월 제철: 복숭아·자두·옥수수·갑오징어", "장마·폭염 대비(제습·전기요금)", "초복·중복 보양식"],
  8: ["8월 제철: 전복·포도·복숭아", "말복·휴가철 여행", "냉방비·열대야 대비"],
  9: ["9월 제철: 전어·대하·햇사과", "추석 차례·선물세트", "환절기 건강관리"],
  10: ["10월 제철: 꽃게·새우·사과", "단풍 여행", "김장 준비 시작"],
  11: ["11월 제철: 굴·과메기·귤", "김장철", "수능·연말 준비"],
  12: ["12월 제철: 방어·한라봉", "연말정산 준비", "크리스마스·연말 행사"],
  1: ["1월 제철: 딸기·과메기", "새해 계획·다이어리", "설 명절 준비"],
  2: ["2월 제철: 딸기·바지락", "졸업·입학 준비", "설 연휴"],
  3: ["3월 제철: 냉이·달래·주꾸미", "봄나들이·미세먼지", "새학기"],
  4: ["4월 제철: 봄나물·주꾸미·딸기", "벚꽃 여행", "봄 이사·환절기"],
  5: ["5월 제철: 마늘·양파·완두콩", "가정의 달 선물", "봄 캠핑"],
  6: ["6월 제철: 매실·감자·오이", "장마 시작 대비", "여름 준비"],
};

async function main() {
  if (!ID || !SECRET) {
    console.log("[research] NAVER_CLIENT_ID/SECRET 없음 — 수집 건너뜀(기존 데이터 유지).");
    return;
  }
  const items = [];
  const errs = [];

  // 1) 뉴스 기반 범위 수집
  for (const [scope, queries] of Object.entries(NEWS)) {
    const seen = new Set();
    for (const q of queries) {
      try {
        for (const n of await searchNews(q)) {
          if (!n.title || seen.has(n.title)) continue;
          seen.add(n.title);
          items.push({ scope, title: n.title, source: "네이버 뉴스", url: n.link, capturedAt: today });
        }
      } catch (e) { errs.push(e.message); }
    }
    // 범위별 상위 4건만 유지
    const kept = items.filter((it) => it.scope === scope).slice(0, 4);
    for (let i = items.length - 1; i >= 0; i--) if (items[i].scope === scope && !kept.includes(items[i])) items.splice(i, 1);
  }

  // 2) trend 범위: 뉴스 헤드라인에서 키워드 후보를 뽑아 데이터랩 급상승도로 랭킹
  try {
    const headlines = await searchNews("실시간 급상승 이슈", 10);
    // 헤드라인에서 2~3음절 이상 명사 후보(아주 단순 추출) — 상위 5개만 데이터랩 조회
    const cand = [...new Set(headlines.flatMap((h) => h.title.split(/[\s\[\]"'·,…\-—()]+/)).filter((w) => w.length >= 2 && !/^[0-9]+$/.test(w)))].slice(0, 5);
    const scores = await trendScores(cand);
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    for (const [kw, sc] of ranked) {
      items.push({ scope: "trend", title: `${kw} (검색 급상승도 ${sc})`, keywords: [kw], score: sc, source: "네이버 데이터랩", capturedAt: today });
    }
  } catch (e) { errs.push(`trend: ${e.message}`); }

  // 3) season 범위: 월 캘린더
  for (const t of SEASON[month] || []) {
    items.push({ scope: "season", title: t, source: "시즌 캘린더", capturedAt: today });
  }

  if (!items.length) {
    console.warn("[research] 수집 결과 없음 — 기존 파일 유지.", errs.join(" | "));
    return;
  }
  const desc = "시장조사 수집 데이터(신호). 네이버 오픈API(뉴스·데이터랩)로 매일 자동 수집. 기사 본문 미저장, 제목·출처·키워드·점수만 보관. researchOnly=true 이면 이 범위 안에서만 발행 주제가 뽑힌다.";
  fs.writeFileSync(OUT, JSON.stringify({ _설명: desc, collectedAt: today, items }, null, 2) + "\n", "utf8");
  console.log(`[research] 수집 완료: ${items.length}건 (${today})${errs.length ? ` · 경고 ${errs.length}` : ""}`);
}

main().catch((e) => { console.error("[research] 오류:", e.message); process.exit(1); });
