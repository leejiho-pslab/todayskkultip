// =============================================================
//  워드프레스(WordPress) 자동 발행 — 두 가지 모드
//  - content/posts 중 아직 WP에 발행되지 않은 글을 발행
//  - 발행 후 frontmatter 의 published.wordpress 를 true 로 갱신
//
//  ① wpcom 모드 (WordPress.com 무료 플랜 — 공식 REST API):
//    WPCOM_SITE   예: todays-kkultip.wordpress.com (도메인만)
//    WPCOM_TOKEN  OAuth2 액세스 토큰 (developer.wordpress.com 앱으로 발급, 만료 없음)
//  ② selfhosted 모드 (자체 호스팅/비즈니스 — 앱 비밀번호 Basic Auth):
//    WORDPRESS_URL / WORDPRESS_USER / WORDPRESS_APP_PASSWORD
//  공통: WORDPRESS_STATUS  publish(기본) | draft
//  발급 방법은 docs/SETUP.md 의 "워드프레스 연동" 참고.
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import matter from "gray-matter";
import { site } from "../config/site.config.js";
import { ROOT, POSTS_DIR, loadPosts, fixLeftoverBold } from "./lib.mjs";
import { absUrl, affiliateDisclosureLines, esc } from "./render.mjs";
import { coupangBlock } from "./coupang.mjs";
import { channelVariant } from "./variation.mjs";
import { t } from "./i18n.mjs";

// 커버 이미지가 로컬(레포)에 있으면 = 사이트에 배포돼 있음 → 절대 URL 로 참조 가능
const coverExists = (slug, suffix = "") =>
  fs.existsSync(path.join(ROOT, "src", "assets", "covers", `${slug}${suffix}.png`));
const coverUrl = (slug, suffix = "") => absUrl(`/assets/covers/${slug}${suffix}.png`);

/** 각 H2 소제목 뒤에 소제목 카드 이미지 삽입(파일 있을 때만) — 사이트 레이아웃과 동일 */
function insertSectionImages(html, post) {
  let k = -1;
  return html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (m, text) => {
    k += 1;
    if (!coverExists(post.slug, `-s${k}`)) return m;
    const alt = text.replace(/<[^>]+>/g, "").trim();
    return `${m}<figure><img src="${coverUrl(post.slug, `-s${k}`)}" alt="${esc(alt)}" style="max-width:100%;height:auto;border-radius:8px" loading="lazy"></figure>`;
  });
}

// 추천 게시물(다른 글로 이동) — 같은 카테고리 우선 4편, WP 주소로 링크
let _allPosts = null;
const allPosts = () => (_allPosts ||= loadPosts());
function relatedBlock(post) {
  const base = (process.env.WORDPRESS_URL || "").replace(/\/+$/, "");
  if (!base) return "";
  const rest = allPosts().filter((p) => p.slug && p.slug !== post.slug);
  const same = rest.filter((p) => p.category === post.category);
  const picks = [...same, ...rest.filter((p) => p.category !== post.category)].slice(0, 4);
  if (!picks.length) return "";
  const cards = picks.map((p) => {
    const img = coverExists(p.slug)
      ? `<img src="${coverUrl(p.slug)}" alt="" style="width:96px;height:64px;object-fit:cover;border-radius:8px;flex:0 0 auto">`
      : "";
    return `<a href="${base}/${p.slug}/" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;border:1px solid #eee;border-radius:10px;padding:10px 12px;margin:8px 0">${img}<span style="font-weight:600;line-height:1.45">${esc(p.title)}</span></a>`;
  }).join("");
  return `<h2>👉 함께 보면 좋은 글</h2>${cards}`;
}

function auth() {
  const { WORDPRESS_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD } = process.env;
  if (!WORDPRESS_URL || !WORDPRESS_USER || !WORDPRESS_APP_PASSWORD) {
    throw new Error("WORDPRESS_URL / WORDPRESS_USER / WORDPRESS_APP_PASSWORD 가 필요합니다.");
  }
  const base = WORDPRESS_URL.replace(/\/+$/, "");
  const token = Buffer.from(
    `${WORDPRESS_USER}:${WORDPRESS_APP_PASSWORD.replace(/\s+/g, "")}`
  ).toString("base64");
  return { base, token };
}

/** WP 본문 HTML — 사이트와 동일한 읽기 레이아웃
 *  (대표이미지 → 요약 → 소제목별 이미지가 삽입된 본문 → FAQ → 제휴 고지 → 상품 → 원문) */
export function wpHtml(post) {
  // 대표(히어로) 이미지 — 글 맨 위
  const hero = coverExists(post.slug)
    ? `<figure><img src="${coverUrl(post.slug)}" alt="${esc(post.title)}" style="max-width:100%;height:auto;border-radius:10px" loading="eager"></figure>`
    : "";
  // 채널별 변형(중복 콘텐츠 방지): 워드프레스 전용 도입/요약/마무리 + FAQ 순서
  const v = channelVariant(post, "wordpress");
  const body = insertSectionImages(v.bodyHtml, post);
  // 제휴 고지: 상단 대신 상품 블록 바로 위에 배치(첫인상은 콘텐츠, 고지는 링크 근처)
  const disclosure = affiliateDisclosureLines(post)
    .map((l) => `<p style="font-size:13px;color:#888"><em>${l}</em></p>`)
    .join("");
  // 원문 링크: 검색엔진이 자체 사이트를 원본으로 인식하도록 유도(중복 콘텐츠 잠식 방지)
  const canonical = absUrl(post.path);
  return `${hero}${v.introHtml}${v.summaryHtml}${body}${v.faqHtml}${v.outroHtml}
${disclosure}${coupangBlock(post)}
${relatedBlock(post)}
<hr>
<p><small>${t.syndicationFooter(canonical, site.name)}</small></p>`;
}

async function publishOne({ base, token }, post) {
  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: post.title,
      // 한글 제목 그대로 두면 URL 이 %ec%bd%98... 로 깨져 가독성이 나쁨 →
      // 사이트와 동일한 영문 슬러그를 지정 (고유주소 설정이 '글 이름'일 때 적용됨)
      slug: post.slug,
      content: wpHtml(post),
      status: site.channels.wordpress.status || "publish",
      excerpt: post.description || "",
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`WP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// WordPress.com 공식 REST API (무료 플랜 지원, Bearer 토큰)
async function publishOneWpcom(post) {
  const siteDomain = process.env.WPCOM_SITE;
  const res = await fetch(
    `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(siteDomain)}/posts/new`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WPCOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: post.title,
        content: wpHtml(post),
        status: site.channels.wordpress.status || "publish",
        excerpt: post.description || "",
        tags: (post.tags || []).slice(0, 5).join(","),
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`WP.com ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function markPublished(file) {
  const full = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const { data, content } = matter(raw);
  data.published = { ...(data.published || {}), wordpress: true };
  fs.writeFileSync(full, matter.stringify(content, data), "utf8");
}

async function main() {
  // wpcom(WordPress.com) 모드는 config 가 명시할 때만 — 무료 플랜 자동화가 계정 정지를
  // 유발한 이력이 있어, 남아있는 WPCOM 시크릿만으로 wpcom 발행이 켜지지 않게 한다.
  const wpcom =
    site.channels.wordpress.mode === "wpcom" &&
    !!(process.env.WPCOM_SITE && process.env.WPCOM_TOKEN);
  const client = wpcom ? null : auth();
  // 1회 실행당 발행 상한 — 신규 블로그에 한꺼번에 쏟아지면 스팸으로 보일 수 있음
  const LIMIT = Number(process.env.PUBLISH_LIMIT || 2);
  const pending = loadPosts()
    .filter((p) => p.channels?.wordpress && !p.published?.wordpress)
    .slice(0, LIMIT);
  if (!pending.length) {
    console.log("[wordpress] 발행할 신규 글이 없습니다.");
    return;
  }
  console.log(`[wordpress] 모드: ${wpcom ? "WordPress.com(무료 플랜)" : "자체 호스팅"} · 이번 실행 ${pending.length}편(상한 ${LIMIT})`);
  let failed = 0;
  for (const post of pending) {
    try {
      console.log(`[wordpress] 발행: ${post.title}`);
      const data = wpcom ? await publishOneWpcom(post) : await publishOne(client, post);
      markPublished(post.file);
      console.log(`[wordpress] 완료: ${data.URL || data.link || data.ID || data.id}`);
    } catch (e) {
      failed++;
      console.warn(`[wordpress] ⚠ 발행 실패(다음 실행에서 재시도): ${post.title} — ${e.message}`);
    }
  }
  if (failed) console.warn(`[wordpress] 실패 ${failed}편 — published 플래그 미변경으로 자동 재시도 예정`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[wordpress] 오류:", e.message);
    process.exit(1);
  });
}
