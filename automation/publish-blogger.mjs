// =============================================================
//  구글 블로거(Blogger) 자동 발행
//  - content/posts 중 아직 블로거에 발행되지 않은 글을 발행
//  - 발행 후 frontmatter 의 published.blogger 를 true 로 갱신
//
//  인증(서비스가 아닌 사용자 OAuth 필요 — 블로거는 OAuth2):
//    BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN
//    BLOGGER_BLOG_ID
//  refresh token 발급 방법은 README 의 "구글 블로거 연동" 참고.
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { marked } from "marked";
import matter from "gray-matter";
import { site } from "../config/site.config.js";
import { POSTS_DIR, loadPosts, fixLeftoverBold } from "./lib.mjs";
import { absUrl, affiliateDisclosureLines } from "./render.mjs";
import { coupangBlock } from "./coupang.mjs";
import { channelVariant } from "./variation.mjs";
import { t } from "./i18n.mjs";

function getClient() {
  const { BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN } = process.env;
  if (!BLOGGER_CLIENT_ID || !BLOGGER_CLIENT_SECRET || !BLOGGER_REFRESH_TOKEN) {
    throw new Error(
      "블로거 OAuth 환경변수(BLOGGER_CLIENT_ID/SECRET/REFRESH_TOKEN)가 필요합니다."
    );
  }
  const oauth2 = new google.auth.OAuth2(BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: BLOGGER_REFRESH_TOKEN });
  return google.blogger({ version: "v3", auth: oauth2 });
}

/** 블로거용 본문 HTML 생성 (canonical 링크 + 간단 푸터 포함) */
function bloggerHtml(post) {
  // 채널별 변형(중복 콘텐츠 방지): 블로거 전용 도입/요약/마무리 + FAQ 순서
  const v = channelVariant(post, "blogger");
  // 제휴 고지: 본문에 제휴 링크가 있는 글은 발행 채널 어디서든 고지 문구 필수
  const disclosure = affiliateDisclosureLines(post)
    .map((l) => `<p><em>${l}</em></p>`)
    .join("");
  // 원문 링크: 검색엔진이 자체 사이트를 원본으로 인식하도록 유도(중복 콘텐츠 잠식 방지)
  const canonical = absUrl(post.path);
  return `${disclosure}${v.introHtml}${v.summaryHtml}${v.bodyHtml}${v.faqHtml}${v.outroHtml}
${coupangBlock(post)}
<hr>
<p><small>${t.syndicationFooter(canonical, site.name)}</small></p>`;
}

async function publishOne(blogger, blogId, post) {
  const res = await blogger.posts.insert({
    blogId,
    isDraft: false,
    requestBody: {
      title: post.title,
      content: bloggerHtml(post),
      labels: [
        ...site.channels.blogger.defaultLabels,
        ...(post.tags || []).slice(0, 3),
      ],
    },
  });
  return res.data;
}

function markPublished(file) {
  const full = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const { data, content } = matter(raw);
  data.published = { ...(data.published || {}), blogger: true };
  fs.writeFileSync(full, matter.stringify(content, data), "utf8");
}

async function main() {
  const blogId = process.env.BLOGGER_BLOG_ID;
  if (!blogId) throw new Error("BLOGGER_BLOG_ID 가 필요합니다.");
  const blogger = getClient();

  // 1회 실행당 발행 상한 — 신규 블로그에 한꺼번에 쏟아지면 스팸으로 보일 수 있음
  const LIMIT = Number(process.env.PUBLISH_LIMIT || 2);
  const pending = loadPosts()
    .filter((p) => p.channels?.blogger && !p.published?.blogger)
    .slice(0, LIMIT);
  if (!pending.length) {
    console.log("[blogger] 발행할 신규 글이 없습니다.");
    return;
  }
  console.log(`[blogger] 이번 실행 ${pending.length}편(상한 ${LIMIT})`);
  let failed = 0;
  for (const post of pending) {
    try {
      console.log(`[blogger] 발행: ${post.title}`);
      const data = await publishOne(blogger, blogId, post);
      markPublished(post.file);
      console.log(`[blogger] 완료: ${data.url || data.id}`);
    } catch (e) {
      failed++;
      console.warn(`[blogger] ⚠ 발행 실패(다음 실행에서 재시도): ${post.title} — ${e.message}`);
    }
  }
  if (failed) console.warn(`[blogger] 실패 ${failed}편 — published 플래그 미변경으로 자동 재시도 예정`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[blogger] 오류:", e.message);
    process.exit(1);
  });
}
