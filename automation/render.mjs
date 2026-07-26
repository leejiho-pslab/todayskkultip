// =============================================================
//  렌더러: 모든 HTML/SEO/광고 마크업을 한 곳에서 생성
//  build.mjs 가 이 모듈을 사용해 정적 페이지를 조립한다.
// =============================================================
import { site } from "../config/site.config.js";
import { t } from "./i18n.mjs";
import { coupangConfigured } from "./coupang.mjs";

/** basePath 를 붙인 절대경로 (사이트 내부 링크용) */
export function url(path = "/") {
  const base = site.basePath || "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`.replace(/\/{2,}/g, "/");
}

/** 전체 URL (sitemap, canonical, OG 용).
 *  site.url 에 이미 basePath 가 포함되어 있으므로 path 만 이어붙인다. */
export function absUrl(path = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  // 프로토콜(://) 뒤를 제외한 중복 슬래시 제거
  return `${site.url}${p}`.replace(/([^:]\/)\/+/g, "$1");
}

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------- 광고 마크업 ----------------

/** 애드센스 로더 스크립트 (head 에 1회) */
export function adsenseLoader() {
  const a = site.ads.adsense;
  if (!a.enabled || !a.client || a.client.includes("XXXX")) return "";
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(
    a.client
  )}" crossorigin="anonymous"></script>`;
}

/** 애드센스 단위 광고 (slot 위치별). autoAds 모드면 수동 슬롯은 비워둬도 됨 */
export function adsenseUnit(position = "inArticle") {
  const a = site.ads.adsense;
  if (!a.enabled || !a.client || a.client.includes("XXXX")) return "";
  const slot = a.slots[position];
  if (!slot) return ""; // 슬롯 ID 없으면 렌더 안 함 (자동광고가 채움)
  const fmt = position === "inArticle"
    ? `data-ad-layout="in-article" data-ad-format="fluid"`
    : `data-ad-format="auto" data-full-width-responsive="true"`;
  return `
<div class="ad-slot ${position === "inArticle" ? "in-article" : ""}">
  <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(a.client)}"
    data-ad-slot="${esc(slot)}" ${fmt}></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

/** 타뷸라 글 하단 추천 위젯 */
export function taboolaWidget() {
  const t = site.ads.taboola;
  if (!t.enabled || !t.publisher) return "";
  return `
<div class="ad-slot">
  <div id="${esc(t.containerId)}"></div>
  <script type="text/javascript">
    window._taboola = window._taboola || [];
    _taboola.push({ mode: "${esc(t.mode)}", container: "${esc(t.containerId)}",
      placement: "${esc(t.placement)}", target_type: "mix" });
    !function(e,f,u,i){ if(!document.getElementById(i)){
      e.async=1;e.src=u;e.id=i;f.parentNode.insertBefore(e,f);}
    }(document.createElement("script"),
      document.getElementsByTagName("script")[0],
      "//cdn.taboola.com/libtrc/${esc(t.publisher)}/loader.js","tb_loader_script");
    window.performance && typeof window.performance.mark=="function" && window.performance.mark("tbl_ic");
  </script>
</div>`;
}

/** 네이버 등 raw 디스플레이 광고 스크립트 */
export function naverAd() {
  const n = site.ads.naver;
  if (!n.enabled || !n.script) return "";
  return `<div class="ad-slot">${n.script}</div>`;
}

/** 제휴 마케팅(쿠팡파트너스 등) 고지 문구.
 *  post.affiliate 배열에 태그가 있으면 항상 노출한다 — 고지 의무는 본문에 링크가
 *  존재하는지에 따르는 것이지, 환경변수(연동 상태)와 무관하기 때문(정책 위반 방지).
 *  네트워크를 추가하면(site.affiliate 에 항목 추가) 자동으로 지원된다. */
export function affiliateDisclosure(post, opts) {
  const lines = affiliateDisclosureLines(post, opts);
  if (!lines.length) return "";
  return `<div class="affiliate-disclosure">${lines.map((l) => esc(l)).join("<br>")}</div>`;
}

/** 고지 문구 텍스트 배열 — 블로거/워드프레스 발행 모듈에서도 재사용.
 *  쿠팡 블록은 모든 글에 자동 삽입되므로, 쿠팡이 설정돼 있으면 글의 affiliate
 *  태그와 무관하게 쿠팡 고지를 항상 포함한다(정책상 링크가 있으면 고지 필수). */
export function affiliateDisclosureLines(post, { excludeCoupang = false } = {}) {
  const a = site.affiliate || {};
  const tags = new Set(post?.affiliate || []);
  // 애드센스 심사 모드에서 자체 사이트는 쿠팡 블록을 숨기므로, 쿠팡 고지도 함께 제외한다
  // (블록 없이 고지만 남는 불일치 방지).
  if (!excludeCoupang && site.lang !== "en" && coupangConfigured()) tags.add("coupang");
  return [...tags].filter((t) => a[t]?.disclosure).map((t) => a[t].disclosure);
}

// ---------------- 분석/검증 ----------------

export function analytics() {
  let out = "";
  const ga = site.analytics.ga4;
  if (ga && !ga.includes("XXXX")) {
    out += `
<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${esc(ga)}');</script>`;
  }
  if (site.analytics.googleSiteVerification)
    out += `\n<meta name="google-site-verification" content="${esc(site.analytics.googleSiteVerification)}">`;
  if (site.analytics.naverWebmaster)
    out += `\n<meta name="naver-site-verification" content="${esc(site.analytics.naverWebmaster)}">`;
  if (site.analytics.bingVerification)
    out += `\n<meta name="msvalidate.01" content="${esc(site.analytics.bingVerification)}">`;
  return out;
}

// ---------------- 공통 레이아웃 ----------------

export function head({ title, description, canonical, image, type = "website", jsonld = "" }) {
  const fullTitle = title === site.name ? title : `${title} | ${site.name}`;
  const desc = (description || site.description).slice(0, 160);
  const img = image || absUrl("/assets/og-default.png");
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="${site.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="icon" type="image/svg+xml" href="${url("/assets/favicon.svg")}">
<link rel="icon" type="image/png" href="${url("/assets/favicon.png")}">
<link rel="apple-touch-icon" href="${url("/assets/favicon.png")}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="${absUrl("/rss.xml")}">
<link rel="stylesheet" href="${url("/assets/main.css")}">
${analytics()}
${adsenseLoader()}
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}
</head>
<body>`;
}

export function header(wide = false) {
  const nav = site.categories
    .map((c) => `<a href="${url(`/category/${c.slug}/`)}">${esc(c.name)}</a>`)
    .join("");
  return `
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${url("/")}">${esc(site.name)}<small>${esc(site.tagline)}</small></a>
    <nav class="nav">${nav}<a href="${url("/search/")}">${t.navSearch}</a></nav>
  </div>
</header>
<div class="wrap${wide ? " wide" : ""}"><main>`;
}

/** 눈에 보이는 브레드크럼 내비게이션 (JSON-LD 와 별개로 UX/내부링크용) */
export function breadcrumbNav(items) {
  const parts = items.map((it, i) =>
    i === items.length - 1
      ? `<span>${esc(it.name)}</span>`
      : `<a href="${url(it.path)}">${esc(it.name)}</a>`
  );
  return `<nav class="breadcrumb" aria-label="${t.breadcrumbAria}">${parts.join(" › ")}</nav>`;
}

export function footer() {
  const year = (process.env.BUILD_YEAR || "2026");
  const nav = site.categories
    .map((c) => `<a href="${url(`/category/${c.slug}/`)}">${esc(c.name)}</a>`)
    .join("");
  return `</main></div>
<footer class="site-footer">
  <div class="wrap">
    <strong>${esc(site.name)}</strong> · ${esc(site.tagline)}
    <nav class="nav">${nav}</nav>
    <div class="nav" style="margin-top:6px">
      <a href="${url("/about/")}">${t.footerLinks.about}</a>
      <a href="${url("/author/")}">${t.footerLinks.author}</a>
      <a href="${url("/contact/")}">${t.footerLinks.contact}</a>
      <a href="${url("/privacy/")}">${t.footerLinks.privacy}</a>
      <a href="${url("/terms/")}">${t.footerLinks.terms}</a>
      <a href="${url("/sitemap.xml")}">${t.footerLinks.sitemap}</a>
    </div>
    <p class="disclaimer">
      ${t.footerDisclaimer}<br>
      ${site.disclaimerExtra ? `${esc(site.disclaimerExtra)}<br>` : ""}
      &copy; ${year} ${esc(site.name)}. All rights reserved.
    </p>
  </div>
</footer>
</body></html>`;
}

// ---------------- JSON-LD ----------------

export function articleJsonLd(post) {
  const ap = site.authorProfile || {};
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    // author 를 Person 으로 명시하고 작성자 프로필 페이지에 연결 (E-E-A-T)
    author: {
      "@type": "Person",
      name: ap.name || site.author,
      url: ap.url ? absUrl(ap.url) : undefined,
      jobTitle: ap.jobTitle || undefined,
      sameAs: ap.sameAs && ap.sameAs.length ? ap.sameAs : undefined,
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: { "@type": "ImageObject", url: absUrl("/assets/logo.png") },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": absUrl(post.path) },
    image: post.image ? [post.image] : undefined,
  });
}

/** Organization + WebSite 스키마 (홈페이지용, GEO 브랜드 엔티티) */
export function organizationJsonLd() {
  const b = site.brand || {};
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: absUrl("/"),
    description: site.description,
    logo: absUrl("/assets/logo.png"),
    foundingDate: b.foundingDate || undefined,
    sameAs: b.sameAs && b.sameAs.length ? b.sameAs : undefined,
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: absUrl("/"),
    inLanguage: site.lang,
    publisher: { "@type": "Organization", name: site.name },
  };
  // 사이트 내 검색 페이지(/search/) 기반 SearchAction
  website.potentialAction = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: b.searchUrlTemplate || `${absUrl("/search/")}?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  };
  return [JSON.stringify(org), JSON.stringify(website)].join(
    '</script>\n<script type="application/ld+json">'
  );
}

export function breadcrumbJsonLd(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  });
}

/** FAQPage 스키마 (글에 Q&A 가 있으면 리치결과 노출 기대) */
export function faqJsonLd(faqs) {
  if (!faqs || !faqs.length) return "";
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });
}

export { esc };
