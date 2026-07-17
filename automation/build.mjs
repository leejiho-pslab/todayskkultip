// =============================================================
//  정적 사이트 빌드
//  content/posts/*.md  ->  public/ (GitHub Pages 배포 대상)
//  생성물: 글 페이지, 인덱스, 카테고리, about/privacy,
//          sitemap.xml, robots.txt, rss.xml, .nojekyll, CNAME
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { site } from "../config/site.config.js";
import {
  ROOT, PUBLIC_DIR, ensureDir, loadPosts, excerpt, todayKST, slugify, fixLeftoverBold,
} from "./lib.mjs";
import { buildDashboard } from "./dashboard.mjs";
import { t } from "./i18n.mjs";
import {
  head, header, footer, url, absUrl,
  adsenseUnit, taboolaWidget, naverAd, affiliateDisclosure, breadcrumbNav,
  articleJsonLd, breadcrumbJsonLd, faqJsonLd, organizationJsonLd, esc,
} from "./render.mjs";

marked.setOptions({ mangle: false, headerIds: false, breaks: false });

function write(rel, html) {
  const out = path.join(PUBLIC_DIR, rel);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, html, "utf8");
}

function catName(slug) {
  const c = site.categories.find((x) => x.slug === slug);
  return c ? c.name : slug;
}

// 실제 존재하는 커버 이미지 상대경로 반환(없으면 "")
function coverFor(post) {
  if (!post.image) return "";
  const srcFile = path.join(ROOT, "src", post.image.replace(/^\//, ""));
  return fs.existsSync(srcFile) ? post.image : "";
}

/** 본문 마크다운 → HTML.
 *  광고 극대화: 소제목(H2) 2개마다 인아티클 광고 삽입(최대 3회) +
 *  내부 링크: 첫 광고 지점에 "함께 보면 좋은 글" 인라인 박스 동반 삽입. */
function renderBody(markdown, inlineBox = "") {
  const html = fixLeftoverBold(marked.parse(markdown));
  const adUnit = adsenseUnit("inArticle");
  const parts = html.split("<h2");
  if (parts.length < 3) return html + inlineBox + adUnit;
  // parts[0]=도입부, parts[1..]=각 H2 섹션. 섹션 2,4,6 시작 직전에 삽입.
  let out = parts[0];
  let adCount = 0;
  for (let i = 1; i < parts.length; i++) {
    if (i >= 2 && (i - 2) % 2 === 0 && adCount < 3) {
      out += adUnit;
      if (adCount === 0) out += inlineBox; // 첫 삽입 지점에 관련글 박스 동반
      adCount++;
    }
    out += "<h2" + parts[i];
  }
  return out;
}

/** 본문 속 인라인 관련글 박스 (내부 이동 유도) */
function inlineRelatedBox(post, allPosts) {
  const picks = allPosts
    .filter((p) => p.path !== post.path)
    .sort((a, b) => (a.category === post.category ? -1 : 0) - (b.category === post.category ? -1 : 0))
    .slice(0, 2);
  if (!picks.length) return "";
  const items = picks
    .map((p) => `<li><a href="${url(p.path)}">${esc(p.title)}</a></li>`)
    .join("");
  return `<aside class="related-inline"><strong>${t.relatedInline}</strong><ul>${items}</ul></aside>`;
}

/** 이전/다음 글 내비게이션 (최신순 정렬 기준) */
function prevNextNav(post, allPosts) {
  const idx = allPosts.findIndex((p) => p.path === post.path);
  if (idx === -1) return "";
  const newer = allPosts[idx - 1];
  const older = allPosts[idx + 1];
  if (!newer && !older) return "";
  const cell = (p, lbl) =>
    p
      ? `<a href="${url(p.path)}"><span class="lbl">${lbl}</span>${esc(p.title)}</a>`
      : `<span class="pn-empty"></span>`;
  return `<nav class="prevnext">${cell(newer, t.newerPost)}${cell(older, t.olderPost)}</nav>`;
}

/** 썸네일 관련글 그리드 (같은 카테고리 우선, 부족하면 최신글로 채움) */
function relatedGrid(post, allPosts) {
  const sameCat = allPosts.filter((p) => p.path !== post.path && p.category === post.category);
  const others = allPosts.filter((p) => p.path !== post.path && p.category !== post.category);
  const picks = [...sameCat, ...others].slice(0, 6);
  if (!picks.length) return "";
  const cards = picks
    .map((p) => {
      const cover = coverFor(p);
      const img = cover
        ? `<img src="${url(cover)}" alt="${esc(p.imageAlt || p.title)}" loading="lazy" width="1200" height="630">`
        : "";
      return `<li class="rcard">${img ? `<a href="${url(p.path)}">${img}</a>` : ""}
        <a class="t" href="${url(p.path)}">${esc(p.title)}</a></li>`;
    })
    .join("");
  return `<section class="related"><h2>${t.relatedHeading}</h2><ul class="related-grid">${cards}</ul></section>`;
}

/** 글 페이지 사이드바 — 광고(스티키) + 최신글 + 카테고리 (내부 순환 링크) */
function sidebar(post, allPosts) {
  const recent = allPosts.filter((p) => p.path !== post.path).slice(0, 5);
  const recentHtml = recent.length
    ? `<div class="widget"><strong class="wt">${t.recentPosts}</strong><ul>${recent
        .map((p) => `<li><a href="${url(p.path)}">${esc(p.title)}</a></li>`)
        .join("")}</ul></div>`
    : "";
  const cats = site.categories
    .map((c) => `<li><a href="${url(`/category/${c.slug}/`)}">${esc(c.name)}</a></li>`)
    .join("");
  return `<aside class="sidebar">
    ${adsenseUnit("sidebar")}
    ${recentHtml}
    <div class="widget"><strong class="wt">${t.categoriesWidget}</strong><ul>${cats}</ul></div>
    ${adsenseUnit("sidebar")}
  </aside>`;
}

function buildToc(markdown) {
  const heads = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  if (heads.length < 3) return "";
  const items = heads.map((h, i) => `<li><a href="#h${i}">${esc(h)}</a></li>`).join("");
  return `<nav class="toc"><strong>${t.toc}</strong><ol>${items}</ol></nav>`;
}

/** H2 에 id 를 부여해 목차 앵커와 연결 */
function addHeadingIds(html) {
  let i = -1;
  return html.replace(/<h2>/g, () => {
    i += 1;
    return `<h2 id="h${i}">`;
  });
}

/** 각 H2 소제목 뒤에 소제목 카드 이미지를 삽입(파일이 있을 때만). 본문-연결 이미지 확보. */
function insertSectionImages(html, post) {
  return html.replace(/<h2 id="h(\d+)">([\s\S]*?)<\/h2>/g, (m, k, text) => {
    const rel = `/assets/covers/${post.slug}-s${k}.png`;
    const srcFile = path.join(ROOT, "src", rel.replace(/^\//, ""));
    if (!fs.existsSync(srcFile)) return m;
    const alt = text.replace(/<[^>]+>/g, "").trim();
    return `${m}<img class="section" src="${url(rel)}" alt="${esc(alt)} - ${esc(post.title)}" loading="lazy" width="1200" height="630">`;
  });
}

// ---------------- 개별 글 ----------------
function buildPost(post, allPosts, validTags = new Set()) {
  const canonical = absUrl(post.path);
  const toc = buildToc(post.body);
  const bodyHtml = insertSectionImages(
    addHeadingIds(renderBody(post.body, inlineRelatedBox(post, allPosts))),
    post
  );

  // 대표(커버) 이미지: src/assets 에 실제 파일이 있을 때만 사용 (깨진 이미지 방지)
  const coverRel = coverFor(post);
  const heroImg = coverRel
    ? `<img class="hero" src="${url(coverRel)}" alt="${esc(post.imageAlt || post.title)}" width="1200" height="630" loading="eager">`
    : "";

  const relatedHtml = relatedGrid(post, allPosts);

  const faqHtml =
    post.faqs && post.faqs.length
      ? `<section class="related"><h2>${t.faqHeading}</h2>${post.faqs
          .map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`)
          .join("")}</section>`
      : "";

  const tagLinks = (post.tags || [])
    .filter((t) => validTags.has(t))
    .map((t) => `<a class="chip" href="${url(`/tag/${slugify(t)}/`)}">#${esc(t)}</a>`)
    .join("");
  const tagsHtml = tagLinks ? `<div class="chips" style="margin-top:22px">${tagLinks}</div>` : "";

  const jsonld = [
    articleJsonLd({ ...post, image: coverRel ? absUrl(coverRel) : undefined }),
    breadcrumbJsonLd([
      { name: t.breadcrumbHome, path: "/" },
      { name: catName(post.category), path: `/category/${post.category}/` },
      { name: post.title, path: post.path },
    ]),
    faqJsonLd(post.faqs),
  ]
    .filter(Boolean)
    .join("</script>\n<script type=\"application/ld+json\">");

  const crumb = breadcrumbNav([
    { name: t.breadcrumbHome, path: "/" },
    { name: catName(post.category), path: `/category/${post.category}/` },
    { name: post.title, path: post.path },
  ]);

  const html =
    head({
      title: post.title,
      description: post.description,
      canonical,
      type: "article",
      image: coverRel ? absUrl(coverRel) : undefined,
      jsonld,
    }) +
    header(true) +
    `<div class="layout">
    <article class="post">
      ${crumb}
      <span class="card cat" style="border:0;padding:0">
        <a href="${url(`/category/${post.category}/`)}" class="cat">${esc(catName(post.category))}</a>
      </span>
      <h1>${esc(post.title)}</h1>
      <div class="meta">${t.publishedOn} ${esc(post.date)}${
        post.updated && post.updated !== post.date ? ` · ${t.reviewedOn} ${esc(post.updated)}` : ""
      } · <a href="${url("/author/")}" rel="author">${esc(site.authorProfile?.name || site.author)}</a></div>
      ${heroImg}
      ${post.summary ? `<blockquote class="summary"><strong>${t.summaryLabel}</strong><br>${esc(post.summary)}</blockquote>` : ""}
      ${affiliateDisclosure(post)}
      ${adsenseUnit("top")}
      ${toc}
      ${bodyHtml}
      ${adsenseUnit("bottom")}
      ${faqHtml}
      ${taboolaWidget()}
      ${naverAd()}
      ${tagsHtml}
      ${prevNextNav(post, allPosts)}
      ${relatedHtml}
    </article>
    ${sidebar(post, allPosts)}
    </div>` +
    footer();

  write(path.join(post.path, "index.html"), html);
}

// ---------------- 목록(카드) ----------------
function postCard(p) {
  const cover = coverFor(p);
  const thumb = cover
    ? `<a href="${url(p.path)}" class="thumb"><img src="${url(cover)}" alt="${esc(p.imageAlt || p.title)}" loading="lazy" width="1200" height="630"></a>`
    : "";
  return `<li class="card">
    ${thumb}
    <a href="${url(`/category/${p.category}/`)}" class="cat">${esc(catName(p.category))}</a>
    <h2><a href="${url(p.path)}">${esc(p.title)}</a></h2>
    <p class="excerpt">${esc(p.description || excerpt(p.body))}</p>
    <div class="meta">${esc(p.date)}</div>
  </li>`;
}

/** 목록 카드 배열 중간(7번째 위치)에 인피드 광고 삽입 */
function cardsWithFeedAd(items) {
  const cards = items.map(postCard);
  const feedAd = adsenseUnit("inArticle");
  if (feedAd && cards.length > 6) {
    cards.splice(6, 0, `<li class="feed-ad">${feedAd}</li>`);
  }
  return cards.join("");
}

const PER_PAGE = 12;
function chunkPages(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
}
// base 는 "/" 또는 "/category/slug/" 처럼 슬래시로 끝남
function pager(base, page, total) {
  if (total <= 1) return "";
  const href = (p) => url(p === 1 ? base : `${base}page/${p}/`);
  const item = (p, label, on) =>
    on ? `<a class="pg" href="${href(p)}">${label}</a>` : `<span class="pg disabled">${label}</span>`;
  let nums = "";
  for (let i = 1; i <= total; i++)
    nums += i === page ? `<span class="pg cur">${i}</span>` : `<a class="pg" href="${href(i)}">${i}</a>`;
  return `<nav class="pager">${item(page - 1, t.pagerPrev, page > 1)}${nums}${item(page + 1, t.pagerNext, page < total)}</nav>`;
}

function buildIndex(posts) {
  const chips = site.categories
    .map((c) => `<a class="chip" href="${url(`/category/${c.slug}/`)}">${esc(c.name)}</a>`)
    .join("");
  const pages = chunkPages(posts, PER_PAGE);
  pages.forEach((items, idx) => {
    const page = idx + 1;
    const rel = page === 1 ? "/" : `/page/${page}/`;
    const list = items.length
      ? `<ul class="post-list">${cardsWithFeedAd(items)}</ul>`
      : `<p>${t.emptyIndex}</p>`;
    const html =
      head({
        title: page === 1 ? site.name : `${site.name}${t.pageTitleSuffix(page)}`,
        description: site.description,
        canonical: absUrl(rel),
        jsonld: page === 1 ? organizationJsonLd() : "",
      }) +
      header() +
      `<section>
         <h1 style="font-size:24px">${esc(site.tagline)}</h1>
         <div class="chips">${chips}</div>
         ${adsenseUnit("top")}
         ${list}
         ${pager("/", page, pages.length)}
       </section>` +
      footer();
    write(page === 1 ? "index.html" : path.join("page", String(page), "index.html"), html);
  });
}

function buildCategories(posts) {
  for (const c of site.categories) {
    const items = posts.filter((p) => p.category === c.slug);
    const base = `/category/${c.slug}/`;
    const pages = chunkPages(items, PER_PAGE);
    pages.forEach((pageItems, idx) => {
      const page = idx + 1;
      const rel = page === 1 ? base : `${base}page/${page}/`;
      const list = pageItems.length
        ? `<ul class="post-list">${cardsWithFeedAd(pageItems)}</ul>`
        : `<p>${t.emptyCategory}</p>`;
      const html =
        head({
          title: page === 1 ? t.categoryTitle(c.name) : `${t.categoryTitle(c.name)}${t.pageTitleSuffix(page)}`,
          description: `${c.name} - ${c.desc}`,
          canonical: absUrl(rel),
        }) +
        header() +
        `<h1 style="font-size:24px">${esc(c.name)}</h1>
         <p style="color:var(--muted)">${esc(c.desc)}</p>
         ${adsenseUnit("top")}
         ${list}
         ${pager(base, page, pages.length)}` +
        footer();
      write(page === 1 ? path.join("category", c.slug, "index.html")
        : path.join("category", c.slug, "page", String(page), "index.html"), html);
    });
  }
}

// 태그 페이지 (2편 이상 태그만 — 얇은 페이지 방지). 반환: {slug,tag} 목록(사이트맵용)
function buildTags(posts) {
  const map = new Map();
  for (const p of posts)
    for (const t of p.tags || []) {
      const k = (t || "").trim();
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
  const built = [];
  for (const [tag, ps] of map) {
    if (ps.length < 2) continue;
    const slug = slugify(tag);
    if (!slug || built.find((b) => b.slug === slug)) continue;
    const list = `<ul class="post-list">${ps.map(postCard).join("")}</ul>`;
    const html =
      head({
        title: t.tagTitle(tag),
        description: t.tagDesc(tag, site.niche),
        canonical: absUrl(`/tag/${slug}/`),
      }) +
      header() +
      `<h1 style="font-size:24px"># ${esc(tag)}</h1>
       ${adsenseUnit("top")}
       ${list}` +
      footer();
    write(path.join("tag", slug, "index.html"), html);
    built.push({ slug, tag });
  }
  return built;
}

// 사이트 내 검색: 검색 인덱스(JSON) + 검색 페이지(클라이언트 필터)
function buildSearch(posts) {
  const index = posts.map((p) => ({
    t: p.title,
    u: url(p.path),
    c: catName(p.category),
    e: (p.description || excerpt(p.body)).slice(0, 120),
    g: (p.tags || []).join(" "),
  }));
  write(path.join("search", "index.json"), JSON.stringify(index));
  const hintJs = JSON.stringify(`<p class="mini" style="color:var(--muted)">${t.search.hint}</p>`);
  const noResJs = JSON.stringify(t.search.noResults);
  const html =
    head({ title: t.search.title, description: t.search.desc(site.name), canonical: absUrl("/search/") }) +
    header() +
    `<section>
      <h1 style="font-size:24px">${t.search.heading}</h1>
      <input id="q" class="search-box" type="search" placeholder="${esc(t.search.placeholder)}">
      <div id="search-results"><p class="mini" style="color:var(--muted)">${t.search.hint}</p></div>
    </section>
    <script>
    (function(){
      var box=document.getElementById('q'), out=document.getElementById('search-results'), data=[];
      var HINT=${hintJs}, NORES=${noResJs};
      function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
      function render(q){
        q=(q||'').trim().toLowerCase();
        if(!q){out.innerHTML=HINT;return;}
        var r=data.filter(function(d){return (d.t+' '+d.c+' '+d.e+' '+d.g).toLowerCase().indexOf(q)>-1;}).slice(0,50);
        if(!r.length){out.innerHTML='<p class="mini" style="color:var(--muted)">'+esc(NORES.replace('{q}',q))+'</p>';return;}
        out.innerHTML='<ul class="post-list">'+r.map(function(d){return '<li class="card"><span class="cat">'+esc(d.c)+'</span><h2><a href="'+d.u+'">'+esc(d.t)+'</a></h2><p class="excerpt">'+esc(d.e)+'</p></li>';}).join('')+'</ul>';
      }
      fetch('index.json').then(function(x){return x.json();}).then(function(j){data=j;
        var p=new URLSearchParams(location.search).get('q'); if(p){box.value=p; render(p);}
      });
      box.addEventListener('input',function(){render(box.value);});
    })();
    </script>` +
    footer();
  write(path.join("search", "index.html"), html);
}

// ---------------- 정적 페이지 (본문은 locale 파일에서 — 한국어/영어 프로필 공용) ----------------
function buildStaticPages() {
  const ctx = { site, url, absUrl, esc };

  const about = t.pages.about(ctx);
  write(
    "about/index.html",
    head({ title: about.title, description: about.desc, canonical: absUrl("/about/") }) +
      header() + about.html + footer()
  );

  const ap = site.authorProfile || {};
  const authorPage = t.pages.author(ctx);
  write(
    "author/index.html",
    head({
      title: authorPage.title,
      description: authorPage.desc,
      canonical: absUrl("/author/"),
      jsonld: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        name: ap.name,
        jobTitle: ap.jobTitle,
        description: ap.bio,
        url: absUrl("/author/"),
        worksFor: { "@type": "Organization", name: site.name },
        sameAs: ap.sameAs && ap.sameAs.length ? ap.sameAs : undefined,
      }),
    }) + header() + authorPage.html + footer()
  );

  const privacy = t.pages.privacy(ctx);
  write(
    "privacy/index.html",
    head({ title: privacy.title, description: privacy.desc, canonical: absUrl("/privacy/") }) +
      header() + privacy.html + footer()
  );

  // 이용약관 · 면책조항 (애드센스 심사 신뢰도)
  const terms = t.pages.terms(ctx);
  write(
    "terms/index.html",
    head({ title: terms.title, description: terms.desc, canonical: absUrl("/terms/") }) +
      header() + terms.html + footer()
  );

  // 문의(contact) 페이지 — 애드센스 심사 시 권장
  const contact = t.pages.contact(ctx);
  write(
    "contact/index.html",
    head({ title: contact.title, description: contact.desc, canonical: absUrl("/contact/") }) +
      header() + contact.html + footer()
  );

  // 커스텀 404 (GitHub Pages 가 미존재 경로에 자동 사용)
  const chips = site.categories
    .map((c) => `<a class="chip" href="${url(`/category/${c.slug}/`)}">${esc(c.name)}</a>`)
    .join("");
  const notFound =
    head({ title: t.notFound.title, description: t.notFound.desc, canonical: absUrl("/404.html") }) +
    header() +
    `<article class="post" style="text-align:center">
      <h1 style="font-size:64px;margin:20px 0 0">404</h1>
      <p>${t.notFound.body}</p>
      <p><a href="${url("/")}">${t.notFound.home}</a></p>
      <div class="chips" style="justify-content:center;margin-top:24px">${chips}</div>
    </article>` +
    footer();
  write("404.html", notFound);
}

// ---------------- SEO 산출물 ----------------
function buildSitemap(posts, tags = []) {
  // 모든 URL 에 lastmod 부여 (체크리스트: sitemap <lastmod> 포함)
  const latest = posts.length ? posts[0].updated || posts[0].date : todayKST();
  const catLast = (slug) => {
    const inCat = posts.filter((p) => p.category === slug);
    return inCat.length ? inCat[0].updated || inCat[0].date : latest;
  };
  const urls = [
    { loc: absUrl("/"), pri: "1.0", lastmod: latest },
    { loc: absUrl("/about/"), pri: "0.3", lastmod: latest },
    { loc: absUrl("/author/"), pri: "0.3", lastmod: latest },
    { loc: absUrl("/contact/"), pri: "0.3", lastmod: latest },
    { loc: absUrl("/privacy/"), pri: "0.3", lastmod: latest },
    { loc: absUrl("/terms/"), pri: "0.3", lastmod: latest },
    { loc: absUrl("/search/"), pri: "0.4", lastmod: latest },
    ...site.categories.map((c) => ({
      loc: absUrl(`/category/${c.slug}/`), pri: "0.6", lastmod: catLast(c.slug),
    })),
    ...tags.map((t) => ({ loc: absUrl(`/tag/${t.slug}/`), pri: "0.5", lastmod: latest })),
    ...posts.map((p) => ({ loc: absUrl(p.path), pri: "0.8", lastmod: p.updated || p.date })),
  ];
  const body = urls
    .map(
      (u) =>
        `<url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.pri}</priority></url>`
    )
    .join("\n");
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  );
}

// AI/LLM 크롤러를 명시적으로 허용 (체크리스트: robots 가 에이전트/LLM 허용)
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web",
  "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended",
  "Applebot-Extended", "Bingbot", "CCBot", "Amazonbot", "Bytespider",
];
function buildRobots() {
  const aiBlocks = AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n");
  write(
    "robots.txt",
    `# 모든 검색/AI 크롤러 허용\nUser-agent: *\nAllow: /\n\n${aiBlocks}\n\nSitemap: ${absUrl(
      "/sitemap.xml"
    )}\n`
  );
}

// llms.txt — LLM 친화 사이트 요약 (GEO 표준). 사이트 핵심/주요 링크 안내.
function buildLlmsTxt(posts) {
  const cats = site.categories
    .map((c) => `- [${c.name}](${absUrl(`/category/${c.slug}/`)}): ${c.desc}`)
    .join("\n");
  const recent = posts
    .slice(0, 15)
    .map((p) => `- [${p.title}](${absUrl(p.path)}): ${p.description || ""}`)
    .join("\n");
  write("llms.txt", t.llms({ site, absUrl }, cats, recent));
}

// ads.txt — 애드센스 승인 후 광고 수익 보호(무단 인벤토리 차단). client 있을 때만.
function buildAdsTxt() {
  const client = site.ads.adsense.client;
  if (!client || client.includes("XXXX")) return;
  const pub = client.replace(/^ca-/, ""); // ca-pub-XXX -> pub-XXX
  write("ads.txt", `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
}

// IndexNow 키 파일 (Bing/Yandex 등 즉시 인덱싱). config.indexNowKey 또는 환경변수.
function buildIndexNow() {
  const key = site.indexNowKey;
  if (!key) return;
  write(`${key}.txt`, key + "\n");
}

// 네이버 서치어드바이저 소유확인 파일 (HTML 파일 업로드 방식)
function buildNaverVerification() {
  const f = site.analytics.naverVerificationFile;
  if (!f) return;
  write(f, `naver-site-verification: ${f}`);
}

function buildRss(posts) {
  const items = posts
    .slice(0, 20)
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${absUrl(p.path)}</link>
    <guid>${absUrl(p.path)}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${esc(p.description || excerpt(p.body))}</description>
  </item>`
    )
    .join("\n");
  write(
    "rss.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(site.name)}</title>
  <link>${absUrl("/")}</link>
  <description>${esc(site.description)}</description>
  <language>${site.lang || "ko"}</language>
${items}
</channel></rss>\n`
  );
}

function copyAssets() {
  const destAssets = path.join(PUBLIC_DIR, "assets");
  ensureDir(destAssets);
  fs.copyFileSync(
    path.join(ROOT, "src", "styles", "main.css"),
    path.join(destAssets, "main.css")
  );
  // src/assets/** (로고/OG/파비콘/커버) 전체 복사
  const srcAssets = path.join(ROOT, "src", "assets");
  if (fs.existsSync(srcAssets)) {
    fs.cpSync(srcAssets, destAssets, { recursive: true });
  }
  // GitHub Pages 가 Jekyll 처리를 건너뛰도록
  fs.writeFileSync(path.join(PUBLIC_DIR, ".nojekyll"), "");
  // 커스텀 도메인 설정 시 CNAME 생성
  if (process.env.SITE_CNAME) {
    fs.writeFileSync(path.join(PUBLIC_DIR, "CNAME"), process.env.SITE_CNAME.trim() + "\n");
  }
}

function build() {
  if (fs.existsSync(PUBLIC_DIR)) fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  ensureDir(PUBLIC_DIR);

  const posts = loadPosts();
  // 2편 이상 태그만 페이지화 (얇은 페이지 방지) + 글 페이지 태그 링크용 집합
  const tagCount = {};
  for (const p of posts) for (const t of p.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
  const validTags = new Set(Object.entries(tagCount).filter(([, n]) => n >= 2).map(([t]) => t));

  for (const p of posts) buildPost(p, posts, validTags);
  buildIndex(posts);
  buildCategories(posts);
  const tags = buildTags(posts);
  buildSearch(posts);
  buildStaticPages();
  buildSitemap(posts, tags);
  buildRobots();
  buildLlmsTxt(posts);
  buildIndexNow();
  buildNaverVerification();
  buildAdsTxt();
  buildRss(posts);
  copyAssets();
  buildDashboard(); // public/ 완성 후 감사+대시보드 생성

  console.log(
    `[build] 완료: 글 ${posts.length}편 + 태그 ${tags.length} + 검색/인덱스/카테고리/SEO + 대시보드 -> public/`
  );
}

build();
