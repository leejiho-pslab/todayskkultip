// =============================================================
//  워드프레스 기존 글 슬러그 일괄 교정 (1회성 유지보수)
//  - 한글 제목으로 만들어진 URL(%ec%bd%98...)을 사이트와 동일한 영문 슬러그로 교체
//  - 제목 매칭으로 로컬 글 ↔ WP 글을 연결해 REST API 로 slug 만 갱신
//  - 실행: wp-maintenance.yml (workflow_dispatch) — WP 자격증명 필요
// =============================================================
import { site } from "../config/site.config.js";
import { loadPosts } from "./lib.mjs";

const { WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD } = process.env;
if (!WORDPRESS_URL || !WORDPRESS_USER || !WORDPRESS_APP_PASSWORD) {
  console.error("[wp-slugs] WORDPRESS_URL/USER/APP_PASSWORD 필요");
  process.exit(1);
}
const BASE = WORDPRESS_URL.replace(/\/+$/, "");
const AUTH = "Basic " + Buffer.from(`${WORDPRESS_USER}:${WORDPRESS_APP_PASSWORD.replace(/\s+/g, "")}`).toString("base64");

// HTML 엔티티·공백 차이를 무시하는 제목 정규화 키
const norm = (s) => String(s || "")
  .replace(/&#\d+;|&[a-z]+;/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/[\s\W]+/g, "")
  .slice(0, 40);

async function wpFetch(path, init = {}) {
  const res = await fetch(`${BASE}/wp-json/wp/v2${path}`, {
    ...init,
    headers: { Authorization: AUTH, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function main() {
  const local = new Map(loadPosts().map((p) => [norm(p.title), p.slug]));
  let page = 1, fixed = 0, skipped = 0;
  for (;;) {
    let posts;
    try {
      posts = await wpFetch(`/posts?per_page=50&page=${page}&status=publish`);
    } catch (e) {
      if (String(e.message).startsWith("400")) break; // 페이지 초과
      throw e;
    }
    if (!posts.length) break;
    for (const wp of posts) {
      const want = local.get(norm(wp.title?.rendered));
      if (!want) { skipped++; continue; }
      if (wp.slug === want) continue;
      await wpFetch(`/posts/${wp.id}`, { method: "POST", body: JSON.stringify({ slug: want }) });
      fixed++;
      console.log(`[wp-slugs] #${wp.id} → /${want}/`);
    }
    page++;
  }
  console.log(`[wp-slugs] 완료: 슬러그 교정 ${fixed}건 · 매칭 안 됨 ${skipped}건`);
}

main().catch((e) => { console.error("[wp-slugs] 오류:", e.message); process.exit(1); });
