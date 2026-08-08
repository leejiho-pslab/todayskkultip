// =============================================================
//  블로거 중복 발행 정리 (일회성 복구 도구)
//  - 사고 경위: publish.yml 커밋 스텝의 git add 가 gitignore 된 파일 하나 때문에
//    통째로 실패 → published.blogger 플래그가 커밋되지 않아, 같은 글이
//    매 크론 실행마다 다시 발행됨(재작성 제목만 조금씩 다른 사실상 중복 문서).
//  - 동작:
//    1) 블로거의 모든 글을 나열, 본문 푸터의 원문(canonical) 링크에서 슬러그 추출
//    2) 같은 슬러그가 2개 이상이면 최초 발행본만 남기고 나머지 삭제
//    3) 블로거에 살아남은 슬러그는 frontmatter published.blogger=true 로 표시
//       (다음 크론부터 재발행 중단 — 플래그는 워크플로가 커밋)
//  - DRY_RUN=true 면 삭제하지 않고 계획만 출력
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import matter from "gray-matter";
import { POSTS_DIR, loadPosts } from "./lib.mjs";

function getClient() {
  const { BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN } = process.env;
  if (!BLOGGER_CLIENT_ID || !BLOGGER_CLIENT_SECRET || !BLOGGER_REFRESH_TOKEN)
    throw new Error("블로거 OAuth 환경변수(BLOGGER_CLIENT_ID/SECRET/REFRESH_TOKEN)가 필요합니다.");
  const oauth2 = new google.auth.OAuth2(BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: BLOGGER_REFRESH_TOKEN });
  return google.blogger({ version: "v3", auth: oauth2 });
}

// 본문 푸터의 원문 링크(https://<사이트>/posts/<슬러그>/)에서 슬러그 추출
function slugFromContent(html) {
  const m = String(html || "").match(/\/posts\/([a-z0-9-]+)\/?/i);
  return m ? m[1] : null;
}

function markPublished(file) {
  const full = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const { data, content } = matter(raw);
  if (data.published?.blogger) return false;
  data.published = { ...(data.published || {}), blogger: true };
  fs.writeFileSync(full, matter.stringify(content, data), "utf8");
  return true;
}

async function main() {
  const blogId = process.env.BLOGGER_BLOG_ID;
  if (!blogId) throw new Error("BLOGGER_BLOG_ID 가 필요합니다.");
  const dry = process.env.DRY_RUN === "true";
  const blogger = getClient();

  // 1) 전체 글 수집 (페이지네이션)
  const items = [];
  let pageToken;
  do {
    const res = await blogger.posts.list({
      blogId, maxResults: 50, pageToken, fetchBodies: true, status: ["live"],
    });
    items.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  console.log(`[dedupe] 블로거 글 ${items.length}개 수집`);

  // 2) 슬러그별 그룹핑 (원문 링크 없는 글은 건드리지 않음)
  const groups = new Map();
  for (const it of items) {
    const slug = slugFromContent(it.content);
    if (!slug) continue;
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(it);
  }

  // 3) 중복 삭제 — 최초 발행본(published 가장 이른 것)만 유지
  let removed = 0;
  for (const [slug, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => new Date(a.published) - new Date(b.published));
    const keep = list[0];
    console.log(`[dedupe] ${slug}: ${list.length}개 → 유지 1개(${keep.published?.slice(0, 16)}) 삭제 ${list.length - 1}개`);
    for (const extra of list.slice(1)) {
      if (dry) { console.log(`  (dry) 삭제 예정: ${extra.url}`); continue; }
      await blogger.posts.delete({ blogId, postId: extra.postId || extra.id });
      removed++;
    }
  }

  // 4) 블로거에 존재하는 슬러그는 발행됨으로 표시(재발행 중단)
  let flagged = 0;
  const bySlug = new Map(loadPosts().map((p) => [p.slug, p]));
  for (const slug of groups.keys()) {
    const post = bySlug.get(slug);
    if (post && markPublished(post.file)) { flagged++; console.log(`[dedupe] 플래그: ${slug} → published.blogger=true`); }
  }
  console.log(`[dedupe] 완료 — 삭제 ${removed}개, 플래그 갱신 ${flagged}건${dry ? " (DRY RUN)" : ""}`);
}

main().catch((e) => { console.error("[dedupe] 오류:", e.message); process.exit(1); });
