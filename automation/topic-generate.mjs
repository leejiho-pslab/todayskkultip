// =============================================================
//  주제 자동 발굴 (Claude API)
//  - 시즌 주제 풀이 부족해지면 현재/다음 달 시의성 주제를 새로 생성해
//    config/topics/generated-topics.json 에 보충한다 (자동 커밋됨).
//  - 기존 발행 글·풀 주제와 중복되지 않도록 제외 목록을 프롬프트에 제공.
//  - ANTHROPIC_API_KEY 없으면 조용히 건너뜀 (빌드는 계속).
// =============================================================
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { site } from "../config/site.config.js";
import { ROOT, readJson, nowKST, existingTitles } from "./lib.mjs";
import { pickTopics, GENERATED_FILE } from "./topic-picker.mjs";
import { researchTopicCandidates } from "./research-lib.mjs";

// 발행 자동화 플래그 (researchOnly: 시장조사 범위 안에서만 주제 발굴)
function flags() {
  try { return readJson(path.join(ROOT, "config", "automation-flags.json")); }
  catch { return {}; }
}

/** researchOnly 일 때 프롬프트에 넣을 '허용 범위' 지시문 — 시장조사 신호 목록 기반.
 *  목록은 검색량(데이터랩 점수) 높은 순으로 정렬돼 있어, 상위 신호부터 기획된다. */
function researchDirective(isEn) {
  const cands = researchTopicCandidates();
  if (!cands.length) return "";
  const lines = cands.map((c, i) =>
    `${i + 1}. ${c.title}${c.keywords?.length ? ` (${c.keywords.join(", ")})` : ""}${c.score != null ? ` [검색지수 ${c.score}]` : ""}`
  ).join("\n");
  return isEn
    ? `\n[MANDATORY SCOPE — market research, ordered by search volume]
The list below is sorted by search volume (highest first). Only propose topics clearly tied to one of these signals, and prioritize the TOP of the list. Do NOT invent topics outside this scope.
${lines}\n`
    : `\n[필수 범위 — 시장조사 · 검색량 높은 순]
아래 목록은 검색량이 높은 순서입니다. 이 신호 중 하나와 명확히 연결되는 주제만 제안하되, 목록 상위 신호를 우선 기획하세요. 범위 밖 주제는 금지합니다.
${lines}\n`;
}

const SEASONAL_FILE = path.join(ROOT, "config", "topics", `${site.topicsPrefix}seasonal-topics.json`);
// 주제 발굴은 짧은 구조화 목록 작업이라 경량 모델로 충분 — 본문 생성(CONTENT_MODEL)과 분리해
// 토큰 비용 절감. 필요 시 TOPIC_MODEL 로 상향 가능.
const MODEL = process.env.TOPIC_MODEL || "claude-haiku-4-5-20251001";
const IS_EN = String(site.lang || "ko").toLowerCase().startsWith("en");

const TOPIC_TOOL = {
  name: "save_topics",
  description: IS_EN ? "Save the list of discovered blog topics." : "발굴한 블로그 주제 목록을 저장한다.",
  input_schema: {
    type: "object",
    properties: {
      topics: {
        type: "array",
        description: IS_EN ? "Topic list (12 items)" : "주제 목록 (12개)",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: IS_EN
                ? "Topic title (specific long-tail phrasing with real search demand)"
                : "주제 제목 (검색 수요가 있는 구체적 롱테일형)",
            },
            category: {
              type: "string",
              // 카테고리 슬러그는 프로필 설정에서 동적으로 — 프로필마다 카테고리가 다름
              enum: site.categories.map((c) => c.slug),
              description: IS_EN ? "Category slug" : "카테고리 슬러그",
            },
            keywords: {
              type: "array", items: { type: "string" },
              description: IS_EN ? "2-4 key search keywords" : "핵심 검색 키워드 2~4개",
            },
            month: {
              type: "integer", minimum: 1, maximum: 12,
              description: IS_EN ? "Best month to publish" : "가장 적합한 발행 월",
            },
          },
          required: ["title", "category", "keywords", "month"],
        },
      },
    },
    required: ["topics"],
  },
};

function loadGenerated() {
  try {
    return readJson(GENERATED_FILE);
  } catch {
    return { topics: [] };
  }
}

function saveGenerated(data) {
  fs.writeFileSync(GENERATED_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** 미발행 주제 수가 min 미만이면 Claude 로 12개 발굴해 보충한다. */
export async function ensureTopicPool(min = 6) {
  const remaining = pickTopics(999).length;
  if (remaining >= min) {
    console.log(`[topic-gen] 주제 풀 충분 (${remaining}개 남음) — 보충 생략`);
    return { generated: 0, remaining };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[topic-gen] 풀 부족하지만 ANTHROPIC_API_KEY 없음 — 건너뜀");
    return { generated: 0, remaining };
  }

  const kst = nowKST();
  const month = kst.getMonth() + 1;
  const nextMonth = (month % 12) + 1;
  const used = existingTitles();
  const gen = loadGenerated();
  const poolTitles = [
    ...(fs.existsSync(SEASONAL_FILE) ? Object.values(readJson(SEASONAL_FILE)).flat() : []),
    ...gen.topics,
  ].map((t) => t.title);
  // 제외 목록은 최근 80건으로 상한 — 코퍼스가 커져도 프롬프트(토큰)가 무한정 늘지 않게
  const exclusion = [...new Set([...used, ...poolTitles])].slice(-80).join("\n- ");

  const researchOnly = !!flags().researchOnly;
  const scopeBlock = researchOnly ? researchDirective(IS_EN) : "";
  const cats = site.categories.map((c) => `${c.slug}: ${c.name} — ${c.desc}`).join("\n");
  const prompt = IS_EN
    ? `You are the content planner of "${site.name}", an English-language blog about Korea for a global audience.
Today is ${kst.toISOString().slice(0, 10)} (month ${month}). If a topic title includes a year,
it MUST be the current year. Discover 12 blog topics about Korea (${site.niche}) that international
readers will actually search for during month ${month}-${nextMonth}.

[Categories]
${cats}

[Requirements]
1. Timeliness: seasonal events, festivals, comebacks/releases, travel seasons relevant to months ${month}-${nextMonth}
2. Specific long-tail topics with real search demand (e.g. "Seoul 3-day itinerary for first-timers on a budget")
3. Mix evergreen guides (how-to / what-is / best-of) with timely angles; all topics in ENGLISH
4. Distribute evenly across the 5 categories
5. Must NOT overlap with or resemble any of these existing topics:
- ${exclusion}
${scopeBlock}
You MUST call the save_topics tool to store the result.`
    : `당신은 한국 ${site.niche} 블로그 "${site.name}"의 콘텐츠 기획자입니다.
오늘은 ${kst.toISOString().slice(0, 10)} (${month}월)입니다. 주제 제목에 연도를 넣을 경우
반드시 현재 연도를 사용하세요(지난 연도 금지). ${month}월 하순~${nextMonth}월에 한국인이 실제로 많이 검색할
${site.niche} 주제 12개를 발굴하세요.

[카테고리]
${cats}

[요건]
1. 시의성: 지금 시점(${month}월~${nextMonth}월)의 제도 신청 기간, 계절 이슈, 세금/요금 일정 등
2. 검색 수요가 있는 구체적 롱테일 주제 (예: "9월 재산세 2기분 카드 무이자 납부 방법")
3. 12개 중 5~6개는 상품·용품 추천/구매가이드/비교형 (예: "환절기 가습기 고르는 법", "○○ 추천 TOP5") —
   쿠팡 전환이 잘 되는 구매의도 높은 주제를 우선(수익 직결). 나머지는 정보성으로 균형.
4. 카테고리 5종에 고르게 분배
5. 아래 기존 주제와 겹치거나 유사한 것 금지:
- ${exclusion}

반드시 save_topics 도구로 저장하세요.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    tools: [TOPIC_TOOL],
    tool_choice: { type: "tool", name: "save_topics" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("모델이 save_topics 를 호출하지 않았습니다.");

  const seen = new Set([...used, ...poolTitles]);
  const fresh = (toolUse.input.topics || []).filter((t) => {
    if (!t.title || seen.has(t.title)) return false;
    if (!site.categories.some((c) => c.slug === t.category)) return false;
    seen.add(t.title);
    return true;
  });
  gen.topics.push(...fresh.map((t) => ({ ...t, generatedAt: kst.toISOString().slice(0, 10) })));
  saveGenerated(gen);
  console.log(`[topic-gen] 신규 주제 ${fresh.length}개 보충 (풀 잔여 ${remaining} → ${remaining + fresh.length})`);
  return { generated: fresh.length, remaining: remaining + fresh.length };
}

// CLI: node automation/topic-generate.mjs [min]
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureTopicPool(Number(process.argv[2] || 6)).catch((e) => {
    console.error("[topic-gen] 오류:", e.message);
    process.exit(1);
  });
}
