// =============================================================
//  워드프레스 기존 글 레이아웃 리싱크 (1회성 유지보수)
//  - 이미 발행된 WP 글의 본문을 최신 wpHtml(대표이미지·요약·소제목 이미지·
//    제휴고지 재배치)로 다시 채우고, 영문 슬러그도 함께 교정한다.
//  - 제목 매칭으로 로컬 글 ↔ WP 글 연결 → REST API 로 content+slug 갱신
//  - 실행: wp-maintenance.yml (workflow_dispatch)
// =============================================================
import { loadPosts } from "./lib.mjs";
import { wpHtml } from "./publish-wordpress.mjs";

const { WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD } = process.env;
if (!WORDPRESS_URL || !WORDPRESS_USER || !WORDPRESS_APP_PASSWORD) {
  console.error("[wp-resync] WORDPRESS_URL/USER/APP_PASSWORD 필요");
  process.exit(1);
}
const BASE = WORDPRESS_URL.replace(/\/+$/, "");
const AUTH = "Basic " + Buffer.from(`${WORDPRESS_USER}:${WORDPRESS_APP_PASSWORD.replace(/\s+/g, "")}`).toString("base64");

// \W 는 한글을 지우므로 사용 금지 — 한글·영숫자만 남긴 제목 키
const norm = (s) => String(s || "")
  .replace(/&#\d+;|&[a-z]+;/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/[^0-9a-z가-힣]/gi, "")
  .slice(0, 30);

async function wp(path, init = {}) {
  const res = await fetch(`${BASE}/wp-json/wp/v2${path}`, {
    ...init,
    headers: { Authorization: AUTH, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function main() {
  const local = new Map(loadPosts().map((p) => [norm(p.title), p]));
  let page = 1, updated = 0, skipped = 0;
  for (;;) {
    let posts;
    try { posts = await wp(`/posts?per_page=20&page=${page}&status=publish`); }
    catch (e) { if (String(e.message).startsWith("400")) break; throw e; }
    if (!posts.length) break;
    for (const w of posts) {
      const post = local.get(norm(w.title?.rendered));
      if (!post) { skipped++; continue; }
      await wp(`/posts/${w.id}`, { method: "POST", body: JSON.stringify({ slug: post.slug, content: wpHtml(post) }) });
      updated++;
      console.log(`[wp-resync] #${w.id} ↺ ${post.slug}`);
    }
    page++;
  }
  console.log(`[wp-resync] 완료: 레이아웃 갱신 ${updated}건 · 매칭 안 됨 ${skipped}건`);
}

main().catch((e) => { console.error("[wp-resync] 오류:", e.message); process.exit(1); });
