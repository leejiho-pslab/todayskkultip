// =============================================================
//  네이버 DataLab 트렌드 기반 주제 우선순위 보정 (선택)
//  - NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 가 있으면 동작
//  - 없으면 입력 순서를 그대로 반환(no-op) → 파이프라인에 영향 없음
//
//  DataLab 통합검색어 트렌드 API로 각 주제의 핵심 키워드 검색량 추이를 받아
//  최근 상승폭이 큰(=시의성 높은) 주제를 앞으로 정렬한다.
//  문서: https://developers.naver.com/docs/serviceapi/datalab/search/search.md
// =============================================================
import { nowKST } from "./lib.mjs";

const ID = process.env.NAVER_CLIENT_ID;
const SECRET = process.env.NAVER_CLIENT_SECRET;

function lastMonths(n) {
  const end = nowKST();
  const start = new Date(end);
  start.setMonth(start.getMonth() - n);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** 키워드 묶음의 최근 추이 점수(마지막 시점 / 평균)를 반환 */
async function trendScore(keyword) {
  const { startDate, endDate } = lastMonths(3);
  const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": ID,
      "X-Naver-Client-Secret": SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: "week",
      keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
    }),
  });
  if (!res.ok) throw new Error(`DataLab ${res.status}`);
  const json = await res.json();
  const data = json.results?.[0]?.data || [];
  if (data.length < 2) return 1;
  const ratios = data.map((d) => d.ratio);
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const recent = ratios[ratios.length - 1];
  return avg > 0 ? recent / avg : 1; // >1 이면 최근 상승세
}

/**
 * 주제 배열을 트렌드 점수로 정렬(내림차순). 키 없거나 오류 시 원본 반환.
 * @param {Array<{title,keywords}>} topics
 */
export async function rankByTrend(topics) {
  if (!ID || !SECRET || !topics.length) return topics;
  try {
    const scored = await Promise.all(
      topics.map(async (t) => {
        const kw = (t.keywords && t.keywords[0]) || t.title;
        let score = 1;
        try {
          score = await trendScore(kw);
        } catch {
          /* 개별 키워드 실패는 무시 */
        }
        return { t, score };
      })
    );
    scored.sort((a, b) => b.score - a.score);
    console.log(
      "[trend] 트렌드 정렬:",
      scored.map((s) => `${s.t.title}(${s.score.toFixed(2)})`).join(" > ")
    );
    return scored.map((s) => s.t);
  } catch (e) {
    console.warn("[trend] 트렌드 조회 실패, 원본 순서 사용:", e.message);
    return topics;
  }
}
