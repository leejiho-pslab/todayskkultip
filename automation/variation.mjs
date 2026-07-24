// =============================================================
//  채널별 콘텐츠 변형(variation) — 중복 콘텐츠 방지
//  같은 글이라도 채널마다 도입부·요약·마무리·FAQ 순서를 다르게 만들어
//  사이트(원본/canonical)와 워드프레스·블로거·네이버에 "같은 내용"이
//  그대로 발행되지 않도록 한다. (운영자 지시, 2026-07-24 오늘부터)
//
//  설계: 무료(비-LLM) 결정적 변형 — (slug+channel) 시드로 채널마다
//  고정되지만 서로 다른 문구를 고른다. 채널별 문구 풀은 서로 겹치지
//  않게 구성해, 어떤 두 채널도 동일한 도입/마무리를 쓰지 않는다.
//  사이트(build.mjs)는 원본 그대로 두어 검색엔진이 원본으로 인식하게 한다.
// =============================================================
import { marked } from "marked";
import { fixLeftoverBold } from "./lib.mjs";
import { site } from "../config/site.config.js";
import { t } from "./i18n.mjs";

// --- 결정적 난수 (slug+channel 시드) ---
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seedStr) {
  let x = hashSeed(seedStr) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
function shuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const IS_EN = String(site.lang || "ko").toLowerCase().startsWith("en");

// --- 채널별 도입부 풀 (서로 겹치지 않음) ---
const INTRO_KO = {
  wordpress: [
    (ti) => `이 글에서는 <strong>${ti}</strong>에 대해 직접 확인한 내용을 한 번에 정리했습니다. 바쁜 분들을 위해 핵심부터 짚어 드릴게요.`,
    (ti) => `<strong>${ti}</strong>, 검색해도 정보가 흩어져 있어 헷갈리기 쉽죠. 실제로 알아보며 정리한 기준을 아래에 담았습니다.`,
  ],
  blogger: [
    (ti) => `안녕하세요! 오늘은 <strong>${ti}</strong> 이야기를 가져왔어요. 알아보면서 헷갈렸던 부분 위주로 쉽게 풀어 드릴게요.`,
    (ti) => `<strong>${ti}</strong> 관련해서 궁금해하시는 분이 많아 따로 정리해 봤습니다. 끝까지 보시면 감이 잡히실 거예요.`,
  ],
  naver: [
    (ti) => `<strong>${ti}</strong>, 막상 알아보려면 막막하시죠? 발품 팔아 확인한 핵심만 모았습니다.`,
    (ti) => `결론부터 말씀드리면 <strong>${ti}</strong>는 몇 가지만 알면 훨씬 수월해집니다. 하나씩 짚어볼게요.`,
  ],
};
const INTRO_EN = {
  wordpress: [
    (ti) => `Here's everything I actually checked about <strong>${ti}</strong>, pulled together in one place. Let's start with what matters most.`,
    (ti) => `<strong>${ti}</strong> can be surprisingly hard to pin down online, so I gathered the essentials below from first-hand digging.`,
  ],
  blogger: [
    (ti) => `Hi there! Today I'm breaking down <strong>${ti}</strong> — focusing on the parts that tripped me up so you don't have to guess.`,
    (ti) => `A lot of readers have been asking about <strong>${ti}</strong>, so I put together a clear rundown. Stick around to the end.`,
  ],
  naver: [
    (ti) => `Not sure where to start with <strong>${ti}</strong>? I've boiled it down to what really counts.`,
    (ti) => `Bottom line first: <strong>${ti}</strong> gets a lot easier once you know a few things. Let's go through them.`,
  ],
};

// --- 채널별 마무리 CTA 풀 (서로 겹치지 않음) ---
const OUTRO_KO = {
  wordpress: [
    `위 내용은 작성 시점 기준이며, 제도·요금·일정은 바뀔 수 있으니 실제 이용 전 공식 안내를 꼭 확인하세요. 도움이 되셨다면 북마크해 두고 필요할 때 다시 찾아보세요.`,
    `여기까지 핵심을 정리해 봤습니다. 상황에 따라 조건이 달라질 수 있으니 공식 출처로 한 번 더 확인하시길 권합니다.`,
  ],
  blogger: [
    `오늘 내용이 도움이 되셨길 바라요. 궁금한 점은 댓글로 남겨주시면 확인해 볼게요. 다음 글에서 또 유용한 정보로 찾아올게요!`,
    `여기까지 읽어주셔서 감사합니다 :) 저장해 두면 나중에 필요할 때 유용하실 거예요. 다음에 더 알찬 글로 만나요!`,
  ],
  naver: [
    `끝까지 봐주셔서 감사합니다. 가격·조건은 수시로 바뀌니 최신 정보는 꼭 다시 확인해 보세요. 이웃추가 해두시면 새 글을 놓치지 않으실 거예요.`,
    `이 정도만 챙겨도 훨씬 수월하실 거예요. 도움이 되셨다면 공감 한 번 눌러주시면 큰 힘이 됩니다!`,
  ],
};
const OUTRO_EN = {
  wordpress: [
    `Details like schedules and prices can change, so always confirm with official sources before you act. Bookmark this if you'd like to come back to it.`,
    `That's the gist of it. Conditions vary case by case, so double-check the official pages before relying on any figure.`,
  ],
  blogger: [
    `Hope this helped! Drop any questions in the comments and I'll take a look. See you in the next post with more useful tips.`,
    `Thanks for reading through :) Save this for when you need it, and catch you in the next one!`,
  ],
  naver: [
    `Thanks for reading to the end. Prices and terms change often, so verify the latest details before deciding.`,
    `Get these basics down and it all gets much easier. If this helped, a quick like means a lot!`,
  ],
};

/** 요약 블록 — 채널마다 표현/스타일을 달리한다 */
function summaryHtmlFor(post, channel) {
  if (!post.summary) return "";
  const s = post.summary;
  const label = t.summaryLabel || (IS_EN ? "Key Takeaways" : "핵심 요약");
  if (channel === "wordpress") {
    return `<blockquote style="border-left:4px solid #4f7cff;background:#f5f8ff;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0"><strong>${label}</strong><br>${s}</blockquote>`;
  }
  if (channel === "blogger") {
    return `<div style="background:#fff8e6;border:1px solid #ffe3a3;border-radius:10px;padding:12px 16px;margin:16px 0"><strong>📌 ${IS_EN ? "In short" : "3줄 요약"}</strong><br>${s}</div>`;
  }
  // naver
  return `<p style="background:#eefaf0;border-radius:8px;padding:12px 14px"><strong>✅ ${IS_EN ? "Bottom line" : "먼저 결론부터"}</strong><br>${s}</p>`;
}

/** FAQ — 채널마다 순서와 질문 접두 표기를 달리한다 */
function faqHtmlFor(post, channel, r) {
  if (!post.faqs || !post.faqs.length) return "";
  const faqs = shuffle(post.faqs, r);
  const heading = t.faqHeading || (IS_EN ? "FAQ" : "자주 묻는 질문");
  const qPrefix = channel === "naver" ? "Q. " : channel === "blogger" ? "❓ " : "";
  return `<h2>${heading}</h2>` +
    faqs.map((f) => `<h3>${qPrefix}${f.q}</h3><p>${f.a}</p>`).join("");
}

/**
 * 채널별 변형 조각을 반환.
 * @param {object} post
 * @param {"wordpress"|"blogger"|"naver"} channel
 * @returns {{introHtml:string, summaryHtml:string, bodyHtml:string, faqHtml:string, outroHtml:string}}
 */
export function channelVariant(post, channel) {
  const r = makeRng(`${post.slug || post.title}::${channel}`);
  const introPool = (IS_EN ? INTRO_EN : INTRO_KO)[channel] || [];
  const outroPool = (IS_EN ? OUTRO_EN : OUTRO_KO)[channel] || [];
  const introFn = introPool.length ? pick(introPool, r) : null;
  const introHtml = introFn ? `<p>${introFn(post.title)}</p>` : "";
  const outro = outroPool.length ? pick(outroPool, r) : "";
  const outroHtml = outro ? `<p>${outro}</p>` : "";
  const bodyHtml = fixLeftoverBold(marked.parse(post.body || ""));
  return {
    introHtml,
    summaryHtml: summaryHtmlFor(post, channel),
    bodyHtml,
    faqHtml: faqHtmlFor(post, channel, r),
    outroHtml,
  };
}

export default channelVariant;
