// =============================================================
//  채널별 "완전 고유" 콘텐츠 리라이팅 (SEO/GEO 중복 문서 방지)
//  - 같은 글이라도 채널(blogger/wordpress/naver)마다 제목·구성·문장을
//    전부 새로 쓴 별도 원고를 생성한다. 사이트(자체 도메인)=원본(canonical).
//  - 채널마다 "타깃 롱테일 키워드 변형"을 다르게 잡아 서로 검색 경쟁하지 않고
//    SERP 커버리지를 넓힌다(같은 키워드로 자기들끼리 경쟁 금지).
//  - 결과는 content/variants/<slug>.<channel>.json 에 캐시(1회 생성, CI가 커밋)
//  - 모델: REWRITE_MODEL (기본 claude-haiku-4-5 — 리라이팅은 경량으로 충분)
//  - API 키 없거나 실패 시 null 반환 → 호출부는 기존 결정적 변형으로 폴백
// =============================================================
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { site } from "../config/site.config.js";
import { ROOT, POSTS_DIR, loadPosts, isEntertainment } from "./lib.mjs";

const VARIANTS_DIR = path.join(ROOT, "content", "variants");
const MODEL = process.env.REWRITE_MODEL || "claude-haiku-4-5-20251001";
const IS_EN = String(site.lang || "ko").toLowerCase().startsWith("en");

const cachePath = (slug, channel) => path.join(VARIANTS_DIR, `${slug}.${channel}.json`);

export function loadVariant(slug, channel) {
  try {
    const v = JSON.parse(fs.readFileSync(cachePath(slug, channel), "utf8"));
    return v && v.title && v.body_markdown ? v : null;
  } catch { return null; }
}

// 채널별 문체·구성 지침 — 제목/구성/문장까지 서로 완전히 다르게
// 공통: 모든 채널 변형에 "글 내용과 직결되는" 구매 아이템 2~3개(products)를 함께 생성
const PRODUCTS_BRIEF = `
추가로 products 필드에 "이 글 내용과 실제로 직결되는" 구매 아이템 2~3개를 골라라(일반 카테고리 아이템 금지,
글의 주제·상황에서 독자가 정말 살 법한 것). name=상품 종류명(브랜드 지어내기 금지), query=쇼핑 검색어,
why=독자에게 왜 필요한지 자연스러운 한 문장.`;
const CHANNEL_BRIEF_KO = {
  blogger: `구글 블로거용. 친근한 정보 블로그체("~해요/~인데요"). 원본과 다른 소제목 구성(순서·묶음 재설계),
비유·일상 예시 1개 이상. 제목은 원본과 다른 롱테일 변형(예: 원본이 "방법 총정리"면 여기는 "~하는 법 5가지"류).${PRODUCTS_BRIEF}`,
  wordpress: `워드프레스용. 전문 가이드체("~합니다/~하십시오" 아님, 담백한 설명체). 단계형(Step) 구성으로 재편성,
표를 1개 이상 재구성. 제목은 절차/체크리스트 지향 롱테일 변형.${PRODUCTS_BRIEF}`,
  naver: `네이버 블로그용. 직접 겪은 후기·경험담 대화체("저는 ~했는데요", "막상 해보니"). 모바일 가독성:
문단 2~3문장 이하로 짧게, 중간중간 한 줄 강조. 제목은 후기/실사용 지향 롱테일 변형(과장·단정 금지).
앵글: 실생활·시즌성을 전면에 — 지금 계절에 바로 써먹는 관점(제철음식, 휴가 필수템, 냉방·난방용품,
열 내리는 음식, 보양식, 명절 준비 등)으로 도입과 예시를 재구성하라(주제가 허용하는 범위에서).${PRODUCTS_BRIEF}
why 는 후기 톤("~했는데 확실히 편했어요")으로.`,
};
const CHANNEL_BRIEF_EN = {
  blogger: `For Blogger. Friendly blog voice, restructured headings, one relatable example. Title = a different long-tail variant than the original.`,
  wordpress: `For WordPress. Clean step-by-step guide structure with at least one rebuilt table. Title = procedure/checklist-oriented variant.`,
  naver: `Conversational first-person review tone, short mobile-friendly paragraphs. Title = hands-on/review-oriented variant.`,
};

const TOOL = {
  name: "save_rewrite",
  description: "채널 전용으로 재작성한 글을 저장한다.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: IS_EN ? "New unique title (different long-tail keyword variant)" : "원본과 완전히 다른 새 제목(다른 롱테일 키워드 변형, 32자 내외)" },
      description: { type: "string", description: IS_EN ? "New meta description" : "새 메타 설명(80~155자, 원본과 다른 문장)" },
      summary: { type: "string", description: IS_EN ? "New TL;DR paragraph" : "새 핵심 요약 한 단락(원본 요약과 다른 문장·다른 강조점)" },
      body_markdown: {
        type: "string",
        description: IS_EN
          ? "Fully rewritten body in Markdown: new heading structure, all sentences paraphrased, facts/numbers/sources preserved."
          : "전면 재작성 본문(마크다운). 규칙: (1) 소제목 구성·순서를 원본과 다르게 재설계 (2) 모든 문장 새로 쓰기(원본 문장 복사 금지) (3) 사실·수치·출처 링크는 보존(왜곡 금지) (4) 분량은 원본의 80~110%",
      },
      faqs: {
        type: "array", description: IS_EN ? "3-4 FAQs, re-worded" : "FAQ 3~4개 — 질문·답변 모두 새 문장으로(원본 FAQ 복사 금지)",
        items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] },
      },
      products: {
        type: "array",
        description: "글 내용과 직결되는 추천 상품 2~3개(브랜드 지어내기 금지) — 모든 채널 공통",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "상품 종류명 (예: 목쿨링 넥밴드)" },
            query: { type: "string", description: "네이버 쇼핑 검색어" },
            why: { type: "string", description: "독자에게 왜 필요한지 후기 톤 한 문장" },
          },
          required: ["name", "query", "why"],
        },
      },
    },
    required: ["title", "description", "summary", "body_markdown", "faqs"],
  },
};

/** 캐시에 있으면 반환, 없으면 API로 생성해 캐시 후 반환. 실패 시 null. */
export async function ensureVariant(post, channel) {
  const hit = loadVariant(post.slug, channel);
  if (hit) return hit;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const brief = (IS_EN ? CHANNEL_BRIEF_EN : CHANNEL_BRIEF_KO)[channel];
    if (!brief) return null;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = IS_EN
      ? `Rewrite the article below as a COMPLETELY DISTINCT article for another channel. Same facts, different everything else (title, structure, sentences). Channel brief: ${brief}\n\n[Original title] ${post.title}\n[Keywords] ${(post.keywords || []).join(", ")}\n[Original body]\n${post.body}\n\nCall save_rewrite.`
      : `아래 원본 글을 "다른 채널용 별개의 글"로 전면 재작성하세요. 사실·수치·출처는 유지하되
제목·소제목 구성·모든 문장을 새로 씁니다(문장 복사 금지). 두 글이 검색엔진에 서로 다른 문서로 보여야 하며,
타깃 키워드도 서로 다른 롱테일 변형을 잡아 자기들끼리 경쟁하지 않게 합니다.
[채널 지침] ${brief}

[원본 제목] ${post.title}
[키워드] ${(post.keywords || []).join(", ")}
[원본 본문]
${post.body}

반드시 save_rewrite 도구로 저장하세요.`;
    const msg = await client.messages.create({
      model: MODEL, max_tokens: 6000,
      tools: [TOOL], tool_choice: { type: "tool", name: "save_rewrite" },
      messages: [{ role: "user", content: prompt }],
    });
    const tu = msg.content.find((b) => b.type === "tool_use");
    if (!tu?.input?.title || !tu?.input?.body_markdown) return null;
    const variant = { channel, srcSlug: post.slug, createdAt: new Date().toISOString().slice(0, 10), ...tu.input };
    fs.mkdirSync(VARIANTS_DIR, { recursive: true });
    fs.writeFileSync(cachePath(post.slug, channel), JSON.stringify(variant, null, 2) + "\n", "utf8");
    console.log(`[rewrite] ${channel} 변형 생성: ${post.slug} → "${variant.title}"`);
    return variant;
  } catch (e) {
    console.warn(`[rewrite] ⚠ ${channel}/${post.slug} 실패(폴백 사용): ${e.message}`);
    return null;
  }
}

/** 변형을 글 객체에 입혀 "채널 전용 글"로 만든다(경로·슬러그·카테고리는 원본 유지 → canonical 보존). */
export function applyVariant(post, variant) {
  if (!variant) return post;
  return { ...post, title: variant.title, description: variant.description, summary: variant.summary, body: variant.body_markdown, faqs: variant.faqs || post.faqs, _products: variant.products || null, _rewritten: true };
}

/** CLI 사전 생성: 발행 임박분(blogger/wordpress 각 PUBLISH_LIMIT)과 네이버 최신분을 미리 생성 */
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.log("[rewrite] API 키 없음 — 건너뜀"); return; }
  const posts = loadPosts();
  const LIMIT = Number(process.env.PUBLISH_LIMIT || 2);
  const NAVER_N = Number(process.env.REWRITE_NAVER_LIMIT || 2); // 비용 절감: 발행 페이스(1~2편/일)에 맞춤
  const jobs = [];
  for (const p of posts.filter((x) => x.channels?.blogger && !x.published?.blogger).slice(0, LIMIT)) jobs.push([p, "blogger"]);
  for (const p of posts.filter((x) => x.channels?.wordpress && !x.published?.wordpress).slice(0, LIMIT)) jobs.push([p, "wordpress"]);
  // 연예(ent) 글은 네이버에 발행하지 않으므로 네이버 원고 생성 대상에서도 제외
  if (site.lang !== "en") for (const p of posts.filter((x) => !isEntertainment(x.category)).slice(0, NAVER_N)) jobs.push([p, "naver"]);
  let made = 0;
  for (const [p, ch] of jobs) {
    if (loadVariant(p.slug, ch)) continue;
    if (await ensureVariant(p, ch)) made++;
  }
  console.log(`[rewrite] 신규 변형 ${made}건 (검사 대상 ${jobs.length}건)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error("[rewrite] 오류:", e.message); process.exit(0); });
}
