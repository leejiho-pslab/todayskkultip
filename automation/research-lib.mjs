// =============================================================
//  시장조사 데이터 헬퍼
//  - config/research-scope.json (범위 정의) + config/market-research.json (수집 신호) 로드
//  - 대시보드 표시용 그룹화 + 생성 제약용 주제 후보 변환
//  ※ 수집은 Claude 가 MCP 로 수행해 market-research.json 을 갱신한다(일 1회 크론).
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

function readSafe(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }
  catch { return fallback; }
}

export function loadScopes() {
  return readSafe("config/research-scope.json", { scopes: [] }).scopes || [];
}

export function loadResearch() {
  return readSafe("config/market-research.json", { collectedAt: null, items: [] });
}

/** 범위별로 수집 신호를 묶어 대시보드에 넘길 구조 */
export function researchForDashboard() {
  const scopes = loadScopes();
  const { collectedAt, items } = loadResearch();
  const byScope = scopes.map((sc) => ({
    ...sc,
    items: (items || []).filter((it) => it.scope === sc.id),
  }));
  return { collectedAt, total: (items || []).length, scopes: byScope };
}

/** 수집 신호 → 발행 주제 후보(키워드 기반). researchOnly 모드에서 생성 제약에 사용 */
export function researchTopicCandidates() {
  const { items } = loadResearch();
  return (items || []).map((it) => ({
    title: it.title,
    keywords: it.keywords || [],
    scope: it.scope,
    source: it.source,
  }));
}
