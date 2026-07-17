// =============================================================
//  IndexNow 핑 — 콘텐츠 발행/수정 시 검색엔진에 즉시 인덱싱 요청
//  (Bing, Yandex, Naver(예정) 등 IndexNow 지원 엔진)
//  환경변수: INDEXNOW_KEY (임의의 영숫자 키, public/<KEY>.txt 로도 노출됨)
//  키 없으면 no-op. 구글은 IndexNow 미지원 → GSC 사이트맵/색인 요청으로 보완.
// =============================================================
import { loadPosts } from "./lib.mjs";
import { absUrl, url as siteUrl } from "./render.mjs";
import { site } from "../config/site.config.js";

export async function pingIndexNow(urls) {
  const key = site.indexNowKey;
  if (!key) {
    console.log("[indexnow] 키 없음 — 건너뜀.");
    return;
  }
  if (!urls || !urls.length) return;
  const host = new URL(site.url).host;
  const body = {
    host,
    key,
    keyLocation: absUrl(`/${key}.txt`),
    urlList: urls,
  };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    console.log(`[indexnow] ${res.status} — ${urls.length}개 URL 제출`);
  } catch (e) {
    console.warn("[indexnow] 핑 실패:", e.message);
  }
}

// CLI: 전체 글 + 홈/카테고리 핑
if (import.meta.url === `file://${process.argv[1]}`) {
  const posts = loadPosts();
  const urls = [
    absUrl("/"),
    ...site.categories.map((c) => absUrl(`/category/${c.slug}/`)),
    ...posts.map((p) => absUrl(p.path)),
  ];
  pingIndexNow(urls);
}
