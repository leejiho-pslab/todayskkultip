// =============================================================
//  모니터링 대시보드 생성
//  - 발행 현황(채널별/카테고리별/월별) + GEO/SEO 체크리스트 진척도
//  - 자동 항목은 audit.mjs 실시간 검사 결과, 수동 항목은 체크리스트 status
//  - 결과: public/dashboard/index.html (noindex) + dashboard/data.json
//  ※ build.mjs 마지막 단계에서 호출(=public/ 완성 후)
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { site } from "../config/site.config.js";
import { PUBLIC_DIR, ROOT, ensureDir, loadPosts, readJson, todayKST, nowKST } from "./lib.mjs";
import { runAudit } from "./audit.mjs";
import { pickTopics } from "./topic-picker.mjs";
import { listTopicsForDashboard, editorialNotes } from "./requests.mjs";
import { writeNaverDrafts } from "./naver-drafts.mjs";
import { researchForDashboard } from "./research-lib.mjs";

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function catName(slug) {
  const c = site.categories.find((x) => x.slug === slug);
  return c ? c.name : slug;
}

// ---- 데이터 집계 ----
function collect() {
  const posts = loadPosts();
  const audit = runAudit();
  const checklist = readJson(path.join(ROOT, "config", "geo-checklist.json"));

  // 체크리스트 병합 + 진척도
  let total = 0, done = 0, autoPass = 0, autoTotal = 0, manualDone = 0, manualTotal = 0;
  const categories = checklist.categories.map((cat) => {
    const items = cat.items.map((it) => {
      let status, detail;
      if (it.type === "auto") {
        const a = audit[it.check];
        status = a ? (a.pass ? "done" : "todo") : "todo";
        detail = a ? a.detail : "검사 항목 미구현";
        autoTotal++;
        if (a && a.pass) autoPass++;
      } else {
        status = it.status || "todo"; // todo/done/na
        detail = it.howto || it.note || "";
        if (status !== "na") { manualTotal++; if (status === "done") manualDone++; }
      }
      if (status !== "na") { total++; if (status === "done") done++; }
      return { item: it.item, note: it.note, type: it.type, status, detail };
    });
    const catTotal = items.filter((i) => i.status !== "na").length;
    const catDone = items.filter((i) => i.status === "done").length;
    return { name: cat.name, items, catTotal, catDone };
  });

  // 발행 현황
  const byCat = {};
  const byMonth = {};
  let bloggerPublished = 0;
  for (const p of posts) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
    const ym = (p.date || "").slice(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + 1;
    if (p.published?.blogger) bloggerPublished++;
  }

  // 내 의견·요청 + 발행 예정(플랜)
  const myNotes = editorialNotes();
  const myTopics = listTopicsForDashboard();
  const userPending = myTopics
    .filter((t) => t.status === "pending")
    .map((t) => ({ title: t.title, category: t.category, source: "운영자 요청", note: t.note }));
  // 시즌성 미리보기(아직 발행 안 된 주제 순서)
  const seasonalPreview = pickTopics(8).map((t) => ({
    title: t.title, category: t.category, keywords: t.keywords || [], source: "시즌 자동",
  }));
  const perRun = site.publishing.postsPerRun || 1;
  // 발행 예정: 운영자 요청 먼저, 그다음 시즌
  // 발행 스케줄: 매일 runsPerDay회 cron, 1회 perRun편 → 예정일 산정
  const runsPerDay = site.publishing.runsPerDay || 1;
  const postsPerDay = perRun * runsPerDay;
  const times = site.publishing.publishTimes || [];
  const base = nowKST();
  const plan = [...userPending, ...seasonalPreview].slice(0, 12).map((t, i) => {
    const dayOffset = Math.floor(i / postsPerDay); // 0 = 오늘 남은 회차 기준
    const slotInDay = i % postsPerDay;
    const dt = new Date(base.getTime() + (dayOffset + 1) * 86400000);
    const time = times[slotInDay % (times.length || 1)] || "";
    return {
      ...t,
      when: i < perRun ? "다음 발행" : "예정",
      date: dt.toISOString().slice(0, 10) + (time ? ` ${time}` : ""),
      keywords: t.keywords || [],
    };
  });

  const gh = site.github || {};
  const editUrl = `https://github.com/${gh.repo}/edit/${gh.branch}/config/requests.json`;
  const setupUrl = `https://github.com/${gh.repo}/blob/${gh.branch}/docs/SETUP.md`;
  const revenueEditUrl = `https://github.com/${gh.repo}/edit/${gh.branch}/config/revenue.json`;

  // ---- 기간별 발행 리포트 (일 30일 / 주 12주) ----
  const now = nowKST();
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const k = dayKey(d);
    daily.push({ date: k, count: posts.filter((p) => p.date === k).length });
  }
  const weekly = [];
  for (let i = 11; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 7 * 86400000);
    const start = new Date(end.getTime() - 6 * 86400000);
    const s = dayKey(start), e = dayKey(end);
    weekly.push({
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      count: posts.filter((p) => p.date >= s && p.date <= e).length,
    });
  }

  // ---- 수익 기록 (운영자 수동 입력: config/revenue.json — 선택) ----
  let revenueRecords = [];
  try {
    revenueRecords = readJson(path.join(ROOT, "config", "revenue.json")).records || [];
  } catch { /* 파일 없으면 빈 상태 */ }
  const revByMonth = {};
  const revBySource = {};
  let revTotal = 0;
  for (const r of revenueRecords) {
    const m = (r.date || "").slice(0, 7);
    const amt = Number(r.amount) || 0;
    if (!m) continue;
    revByMonth[m] = (revByMonth[m] || 0) + amt;
    revBySource[r.source || "기타"] = (revBySource[r.source || "기타"] || 0) + amt;
    revTotal += amt;
  }

  // ---- 주제 풀 모니터링 (소진 예측) ----
  const pool = pickTopics(999);
  const poolByCat = {};
  for (const t of pool) poolByCat[t.category] = (poolByCat[t.category] || 0) + 1;
  const poolDays = postsPerDay ? Math.floor(pool.length / postsPerDay) : 0;

  // ---- 멀티 사이트 현황 ----
  const sites = [
    { key: "default", name: "오늘의 꿀팁", url: "https://starship-ent.ai.kr", niche: "생활정보/꿀팁 · 한국어", repo: "leejiho-pslab/site" },
    { key: "kkultip", name: "오늘의 머니꿀팁", url: "https://todayskkultip.co.kr", niche: "재테크·금융 · 한국어", repo: "leejiho-pslab/todayskkultip" },
    { key: "jype", name: "Korea Unboxed", url: "https://jype.ai.kr", niche: "K-culture · 영어(해외)", repo: "leejiho-pslab/jype" },
  ].map((s) => ({ ...s, current: s.key === (site.profile || "default") }));

  // ---- 채널별 데이터 ----
  const env = process.env;
  const hasVal = (v) => !!(v && !String(v).includes("XXXX"));
  const mapPost = (p) => ({
    title: p.title, date: p.date, category: p.category, path: p.path,
    slug: p.slug, blogger: !!p.published?.blogger,
  });
  const sitePosts = posts.filter((p) => p.channels?.site !== false);
  const bloggerPosts = posts.filter((p) => p.channels?.blogger);
  const bloggerPub = bloggerPosts.filter((p) => p.published?.blogger).length;
  const wpPosts = posts.filter((p) => p.channels?.wordpress);
  const wpPub = wpPosts.filter((p) => p.published?.wordpress).length;
  // 워드프레스: 자체 호스팅 전용 (WP.com 무료 자동화는 계정 정지 이력으로 봉인)
  const wpSecrets = [
    { k: "WORDPRESS_URL (Variables)", ok: !!env.WORDPRESS_URL },
    { k: "WORDPRESS_USER (Variables)", ok: !!env.WORDPRESS_USER },
    { k: "WORDPRESS_APP_PASSWORD (Secrets)", ok: !!env.WORDPRESS_APP_PASSWORD },
  ];
  const wpConfigured =
    site.channels.wordpress.enabled &&
    !!(env.WORDPRESS_URL && env.WORDPRESS_USER && env.WORDPRESS_APP_PASSWORD);
  const bloggerSecrets = [
    { k: "BLOGGER_BLOG_ID", ok: !!env.BLOGGER_BLOG_ID },
    { k: "BLOGGER_CLIENT_ID", ok: !!env.BLOGGER_CLIENT_ID },
    { k: "BLOGGER_CLIENT_SECRET", ok: !!env.BLOGGER_CLIENT_SECRET },
    { k: "BLOGGER_REFRESH_TOKEN", ok: !!env.BLOGGER_REFRESH_TOKEN },
  ];
  const bloggerConfigured = bloggerSecrets.every((s) => s.ok);
  const siteSettings = [
    { k: "배포 (GitHub Pages)", ok: true, v: site.url },
    { k: "Google AdSense", ok: hasVal(site.ads.adsense.client), v: hasVal(site.ads.adsense.client) ? site.ads.adsense.client : "미설정" },
    { k: "Taboola", ok: !!site.ads.taboola.publisher, v: site.ads.taboola.publisher || "미설정" },
    { k: "Google Analytics 4", ok: !!site.analytics.ga4, v: site.analytics.ga4 || "미설정" },
    { k: "Search Console 인증", ok: !!site.analytics.googleSiteVerification, v: site.analytics.googleSiteVerification ? "설정됨" : "미설정" },
    { k: "IndexNow", ok: !!site.indexNowKey, v: site.indexNowKey ? "활성화" : "미설정" },
  ];
  const aff = site.affiliate || {};
  const coupangReady = !!(aff.coupang && aff.coupang.enabled);
  const naverConnectReady = !!(aff.naverConnect && aff.naverConnect.enabled);
  const channels = {
    site: {
      label: "자체 사이트", icon: "🌐", enabled: true, count: sitePosts.length,
      url: site.url, settings: siteSettings, posts: sitePosts.map(mapPost),
    },
    blogger: {
      label: "구글 블로거", icon: "📝", enabled: site.channels.blogger.enabled,
      configured: bloggerConfigured, published: bloggerPub,
      pending: bloggerPosts.length - bloggerPub, secrets: bloggerSecrets,
      posts: bloggerPosts.map(mapPost), setupUrl,
    },
    naver: {
      label: "네이버 블로그", icon: "🟢",
      enabled: !!(site.channels.naver && site.channels.naver.enabled), count: 0,
    },
    wordpress: {
      label: "워드프레스", icon: "🔵", enabled: site.channels.wordpress.enabled,
      configured: wpConfigured, published: wpPub, pending: wpPosts.length - wpPub,
      secrets: wpSecrets, posts: wpPosts.map(mapPost), setupUrl,
      url: (env.WORDPRESS_URL || "").replace(/\/+$/, ""),
    },
  };
  const activeChannels = [channels.site.enabled, channels.blogger.enabled, channels.naver.enabled, channels.wordpress.enabled].filter(Boolean).length;

  // ---- 구축·연동 현황 (한눈에 보기) ----
  const a = site.analytics;
  const setup = {
    search: [
      { k: "GitHub Pages 배포", ok: true, v: "운영중" },
      { k: "GA4 분석", ok: hasVal(a.ga4), v: hasVal(a.ga4) ? a.ga4 : "미설정" },
      { k: "Search Console 소유확인", ok: !!a.googleSiteVerification, v: a.googleSiteVerification ? "완료" : "미설정" },
      { k: "Bing 소유확인", ok: !!a.bingVerification, v: a.bingVerification ? "완료" : "미설정" },
      { k: "IndexNow 즉시색인", ok: !!site.indexNowKey, v: site.indexNowKey ? "활성화" : "미설정" },
      { k: "사이트맵·robots·llms.txt", ok: true, v: "생성됨" },
    ],
    channels: [
      { k: "네이버 블로그 (1순위)", ok: false, v: "수동(다운로드 제공)" },
      { k: "구글 블로거 (2순위)", ok: bloggerConfigured, v: bloggerConfigured ? `연동됨 · ${bloggerPub}편` : "연동 대기" },
      { k: "워드프레스 (3순위)", ok: wpConfigured, v: wpConfigured ? `연동됨 · ${wpPub}편` : "자체 호스팅 연결 대기 (WP.com 무료 자동화는 정지 이력으로 봉인)" },
      { k: "자체 사이트 (기준)", ok: true, v: `운영중 · ${sitePosts.length}편` },
    ],
    money: [
      { k: "Google AdSense", ok: hasVal(site.ads.adsense.client), v: hasVal(site.ads.adsense.client) ? "설정됨" : "승인·설정 대기" },
      { k: "ads.txt", ok: hasVal(site.ads.adsense.client), v: hasVal(site.ads.adsense.client) ? "생성됨" : "AdSense 설정 시 생성" },
      { k: "Taboola", ok: !!site.ads.taboola.publisher, v: site.ads.taboola.publisher ? "설정됨" : "미설정" },
      { k: "네이버 쇼핑커넥트", ok: naverConnectReady, v: naverConnectReady ? "연동됨" : "가입·설정 대기 (심사 없음, 즉시)" },
      { k: "쿠팡 파트너스", ok: coupangReady, v: coupangReady ? "연동됨" : "가입·설정 대기 (즉시 링크 발급)" },
      { k: "네이버 애드포스트", ok: false, v: "네이버 블로그 90일+ 운영 후 신청" },
    ],
    features: [
      { k: "사이트 내 검색", ok: true, v: "/search/" },
      { k: "카테고리·태그·페이지네이션", ok: true, v: "적용" },
      { k: "구조화 데이터(스키마)·RSS", ok: true, v: "적용" },
      { k: "커스텀 도메인", ok: !!env.SITE_CNAME, v: env.SITE_CNAME || "미연결(github.io 사용중)" },
    ],
  };
  const setupDone = Object.values(setup).flat().filter((s) => s.ok).length;
  const setupTotal = Object.values(setup).flat().length;

  // ---- 애드센스 승인 준비도 ----
  const TARGET_POSTS = 20;
  const everyCatHasPost = site.categories.every((c) => posts.some((p) => p.category === c.slug));
  const enoughLen = posts.length > 0 && posts.every((p) => (p.body || "").length >= 1200);
  const allHaveImg = posts.length > 0 && posts.every((p) => !!p.image);
  const adsense = [
    { k: "필수 페이지(소개·문의·개인정보·이용약관)", ok: true, v: "완비" },
    { k: `콘텐츠 ${TARGET_POSTS}편 이상`, ok: posts.length >= TARGET_POSTS, v: `${posts.length}/${TARGET_POSTS}편` },
    { k: "모든 카테고리 글 보유", ok: everyCatHasPost, v: everyCatHasPost ? "충족" : "빈 카테고리 있음" },
    { k: "글당 충분한 분량(1500자 내외)", ok: enoughLen, v: enoughLen ? "충족" : "일부 짧음" },
    { k: "글당 고유 이미지", ok: allHaveImg, v: allHaveImg ? "충족" : "일부 없음" },
    { k: "개인정보·쿠키(광고) 고지", ok: true, v: "완비" },
    { k: "AdSense 코드 삽입", ok: hasVal(site.ads.adsense.client), v: hasVal(site.ads.adsense.client) ? "삽입됨" : "ADSENSE_CLIENT 설정 시" },
    { k: "ads.txt", ok: hasVal(site.ads.adsense.client), v: hasVal(site.ads.adsense.client) ? "생성됨" : "AdSense 설정 시" },
    { k: "커스텀 도메인(필수)", ok: !!env.SITE_CNAME, v: env.SITE_CNAME || "필수 — github.io 주소로는 사이트 등록 불가" },
  ];
  const adsenseDone = adsense.filter((s) => s.ok).length;

  // ---- 제휴/기타 수익화 준비도 ----
  // 쿠팡파트너스: 가입 즉시 링크 발급 → 현재 구조에서 가장 빠른 수익원.
  // 네이버 애드포스트: 네이버 블로그(채널) 광고 수익 — 사이트 코드가 아니라
  //   블로그 운영 실적(90일+, 원본 글 50개+)으로 심사되므로 수동 항목으로만 추적.
  const affiliate = {
    naverConnect: [
      { k: "브랜드커넥트 스페이스 개설 + 쇼핑커넥트 약관 동의", ok: naverConnectReady, v: naverConnectReady ? "완료" : "심사 없음 — 네이버 계정으로 즉시 가입" },
      { k: "활동 채널 등록(네이버 블로그 등)", ok: naverConnectReady, v: naverConnectReady ? "완료" : "블로그·인스타·유튜브·개인 사이트 모두 가능" },
      { k: "식별자 등록", ok: !!aff.naverConnect?.partnerId, v: aff.naverConnect?.partnerId || "NAVER_CONNECT_ID 설정 시" },
      { k: "글 내 고지 문구 자동 노출", ok: true, v: "affiliate:[naverConnect] 글에 자동 삽입" },
    ],
    coupang: [
      { k: "쿠팡 파트너스 가입", ok: coupangReady, v: coupangReady ? "완료" : "partners.coupang.com — 가입 즉시 링크 발급" },
      { k: "채널(트래킹) ID 등록", ok: !!aff.coupang?.partnerId, v: aff.coupang?.partnerId || "COUPANG_PARTNER_ID 설정 시" },
      { k: "글 내 고지 문구 자동 노출", ok: true, v: "affiliate:[coupang] 글에 자동 삽입" },
    ],
    adpost: [
      { k: "네이버 블로그 개설(90일 요건 시계 시작)", ok: false, v: "개설일 기준 90일 이상 운영 필요" },
      { k: "원본 글 50개 이상 축적", ok: false, v: "복사·붙여넣기 글은 심사 탈락 사유 — 변형 발행 필수" },
      { k: "애드포스트 신청", ok: false, v: "adpost.naver.com (요건 충족 후)" },
    ],
  };
  const affiliateDone = [...affiliate.naverConnect, ...affiliate.coupang].filter((s) => s.ok).length;
  const affiliateTotal = affiliate.naverConnect.length + affiliate.coupang.length;

  return {
    generatedAt: todayKST(),
    editUrl,
    setupUrl,
    revenueEditUrl,
    coupangEditUrl: `https://github.com/${gh.repo}/edit/${gh.branch}/config/coupang-links.json`,
    coupangLinks: (() => {
      let total = 0, filled = 0, apiLinks = 0;
      try {
        const j = readJson(path.join(ROOT, "config", "coupang-links.json"));
        const cats = Object.entries(j).filter(([k]) => !k.startsWith("_"));
        total = cats.length;
        filled = cats.filter(([, v]) => typeof v === "string" && v.trim()).length;
      } catch { /* 파일 없음 */ }
      try {
        const c = readJson(path.join(ROOT, "config", "coupang-links-cache.json"));
        apiLinks = Object.keys(c).length;
      } catch { /* 캐시 없음 */ }
      return { total, filled, apiLinks };
    })(),
    // 사이트 간 교차 표시용 요약 — 다른 사이트 대시보드가 이 data.json 을 fetch 해 사용
    summary: {
      profile: site.profile || "default",
      name: site.name,
      url: site.url,
      lang: site.lang,
      totalPosts: posts.length,
      today: daily[daily.length - 1]?.count || 0,
      last7d: daily.slice(-7).reduce((a, x) => a + x.count, 0),
      bloggerConfigured: !!(site.channels.blogger.enabled),
      bloggerPublished: bloggerPub,
      bloggerPending: bloggerPosts.length - bloggerPub,
      wpConfigured,
      wpPublished: wpPub,
      wpPending: wpPosts.length - wpPub,
      poolTotal: pool.length,
      poolDays,
      paused: (() => { try { return !!readJson(path.join(ROOT, "config", "automation-flags.json")).paused; } catch { return false; } })(),
      generatedAt: todayKST(),
    },
    report: {
      daily, weekly,
      revenue: { records: revenueRecords, byMonth: revByMonth, bySource: revBySource, total: revTotal },
      poolByCat, poolTotal: pool.length, poolDays,
    },
    // 채널 바로가기 (기본 프로필 기준값 · 환경변수로 덮어쓰기 가능)
    bloggerUrl: process.env.BLOGGER_BLOG_URL ||
      ((site.profile || "default") === "default" ? "https://todays-kkultip.blogspot.com" : ""),
    naverBlogUrl: process.env.NAVER_BLOG_URL ||
      ((site.profile || "default") === "default" ? "https://blog.naver.com/astrape1" : ""),
    research: researchForDashboard(),
    researchOnly: (() => { try { return !!readJson(path.join(ROOT, "config", "automation-flags.json")).researchOnly; } catch { return false; } })(),
    sites,
    channels,
    activeChannels,
    setup,
    setupDone,
    setupTotal,
    adsense,
    adsenseDone,
    affiliate,
    affiliateDone,
    affiliateTotal,
    postsPerDayInfo: perRun * runsPerDay,
    progress: {
      total, done, pct: total ? Math.round((done / total) * 100) : 0,
      autoPass, autoTotal, manualDone, manualTotal,
    },
    plan,
    requests: { notes: myNotes, topics: myTopics, pendingCount: userPending.length, baseline: site.editorialBaseline || [] },
    perRun,
    categories,
    publishing: {
      totalPosts: posts.length,
      sitePublished: posts.length, // 빌드되면 사이트 발행 간주
      bloggerEnabled: site.channels.blogger.enabled,
      bloggerPublished,
      byCat, byMonth,
      recent: posts.slice(0, 12).map((p) => ({
        title: p.title, date: p.date, category: p.category,
        path: p.path, blogger: !!p.published?.blogger,
      })),
    },
  };
}

// ---- HTML 렌더 ----
const STYLE = `
:root{--bg:#0f172a;--card:#1e293b;--fg:#e2e8f0;--mut:#94a3b8;--ok:#22c55e;--no:#f43f5e;--na:#475569;--ac:#38bdf8;--line:#334155}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}
.wrap{max-width:1080px;margin:0 auto;padding:24px 18px 80px}
.copybtn{background:var(--ac);color:#04202f;border:0;border-radius:6px;padding:5px 10px;font-weight:700;cursor:pointer;font-size:12px;margin-right:4px}
.copybtn:disabled{background:var(--ok);color:#04240f}
h1{font-size:24px;margin:0 0 4px}.sub{color:var(--mut);font-size:14px;margin-bottom:24px}
.grid{display:grid;gap:16px}.cols{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.kpi{font-size:30px;font-weight:800}.kpi small{font-size:13px;color:var(--mut);font-weight:500}
.label{color:var(--mut);font-size:13px;margin-bottom:6px}
.bar{height:12px;background:#0b1220;border-radius:999px;overflow:hidden;margin-top:10px}
.bar>span{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#38bdf8)}
section{margin-top:30px}section h2{font-size:18px;border-bottom:1px solid var(--line);padding-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600}
.badge{display:inline-block;font-size:12px;padding:2px 9px;border-radius:999px}
.b-done{background:rgba(34,197,94,.15);color:#4ade80}.b-todo{background:rgba(244,63,94,.15);color:#fb7185}
.b-na{background:rgba(71,85,105,.25);color:#94a3b8}.b-auto{background:rgba(56,189,248,.15);color:#7dd3fc}
.b-manual{background:rgba(168,85,247,.15);color:#c4b5fd}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:10px 0;padding:4px 14px}
summary{cursor:pointer;padding:10px 0;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:10px}
summary::-webkit-details-marker{display:none}
.mini{font-size:12px;color:var(--mut)}
.row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)}
.row:last-child{border:0}.row .d{color:var(--mut);font-size:12px}
a{color:var(--ac)}
.chl{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.chl span{font-size:12px;background:#0b1220;border:1px solid var(--line);border-radius:8px;padding:4px 10px}
.tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:18px 0 8px;position:sticky;top:0;background:var(--bg);z-index:5}
.tabs button{background:transparent;border:0;color:var(--mut);font-size:15px;font-weight:700;padding:12px 16px;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.tabs button:hover{color:var(--fg)}
.tabs button.active{color:#fff;border-bottom-color:var(--ac)}
.panel{display:none}.panel.active{display:block}
.set{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);align-items:center}
.set:last-child{border:0}.set .v{color:var(--mut);font-size:13px;word-break:break-all}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:9px;vertical-align:middle}
.dot.on{background:var(--ok)}.dot.off{background:var(--no)}
.linkrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;font-size:14px}
.linkrow a{background:#0b1220;border:1px solid var(--line);border-radius:8px;padding:7px 12px;text-decoration:none}
.chcard{cursor:pointer;transition:border-color .15s}.chcard:hover{border-color:var(--ac)}
.note{background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;padding:12px 14px;font-size:14px;margin-top:12px}
.warn{background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.3);border-radius:10px;padding:12px 14px;font-size:14px;margin-top:12px}
.vbars{display:flex;align-items:flex-end;gap:3px;height:120px;margin-top:12px}
.vbars .vb{flex:1;min-width:4px;background:linear-gradient(180deg,#38bdf8,#2563eb);border-radius:3px 3px 0 0;position:relative}
.vbars .vb.zero{background:#0b1220;border:1px dashed var(--line)}
.vaxis{display:flex;justify-content:space-between;color:var(--mut);font-size:11px;margin-top:6px}
.sitecard{border-left:3px solid var(--ac)}
.sitecard.cur{border-left-color:var(--ok)}
`;

function bars(obj, nameFn) {
  const max = Math.max(1, ...Object.values(obj));
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) =>
      `<div class="row"><span>${esc(nameFn ? nameFn(k) : k)}</span><span>${v}편</span></div>
       <div class="bar"><span style="width:${Math.round((v / max) * 100)}%"></span></div>`
    ).join("");
}

// 글 목록 테이블 행 (원고 다운로드 포함)
function postRows(posts, showBlogger) {
  const cols = 3 + (showBlogger ? 1 : 0) + 1;
  if (!posts.length) return `<tr><td colspan="${cols}" class="mini">발행 글 없음</td></tr>`;
  return posts.map((r) =>
    `<tr><td><a href="${esc(site.url + r.path)}" target="_blank">${esc(r.title)}</a></td>
      <td>${esc(catName(r.category))}</td><td>${esc(r.date)}</td>
      ${showBlogger ? `<td><span class="badge ${r.blogger ? "b-done" : "b-todo"}">${r.blogger ? "발행" : "대기"}</span></td>` : ""}
      <td><a href="drafts/${esc(r.slug)}.md" download>원고 ⬇</a></td></tr>`
  ).join("");
}
// 발행 스케줄(예정) 표 — 예정일 + 기획 브리프
function scheduleTable(plan) {
  if (!plan.length) return `<div class="mini">예정된 주제가 없습니다.</div>`;
  return `<table><thead><tr><th>예정일</th><th>제목</th><th>카테고리</th><th>핵심 키워드</th><th>구분</th></tr></thead><tbody>` +
    plan.map((t) =>
      `<tr><td>${esc(t.date)}</td><td>${esc(t.title)}</td><td>${esc(catName(t.category))}</td>
        <td class="d">${esc((t.keywords || []).join(", "))}</td>
        <td><span class="badge ${t.source === "운영자 요청" ? "b-manual" : "b-auto"}">${esc(t.source)}</span></td></tr>`
    ).join("") + `</tbody></table>`;
}
// 세로 막대 차트 (일별/주별 발행) — 외부 라이브러리 없이 div 로
function vbarChart(items, labelFn) {
  const max = Math.max(1, ...items.map((x) => x.count));
  const bars = items.map((x) => {
    const h = x.count ? Math.max(8, Math.round((x.count / max) * 100)) : 2;
    return `<div class="vb ${x.count ? "" : "zero"}" style="height:${h}%" title="${esc(labelFn(x))}: ${x.count}편"></div>`;
  }).join("");
  return `<div class="vbars">${bars}</div>
    <div class="vaxis"><span>${esc(labelFn(items[0]))}</span><span>${esc(labelFn(items[items.length - 1]))}</span></div>`;
}

// 설정/상태 목록
function setRows(arr) {
  return arr.map((s) =>
    `<div class="set"><div><span class="dot ${s.ok ? "on" : "off"}"></span>${esc(s.k)}</div>
      <div class="v">${esc(s.v || (s.ok ? "설정됨" : "미설정"))}</div></div>`
  ).join("");
}

function render(d) {
  const p = d.progress;
  const ch = d.channels;
  // 발행 스케줄 섹션(다운로드 포함) — 채널 공통
  const planDownloads = `<div class="linkrow">
    <a href="plan.md" download>📥 기획안 (.md)</a>
    <a href="plan.csv" download>📥 스케줄 (.csv)</a></div>`;
  const scheduleSection = (extra = "") => `
<section><h2>🗓 발행 스케줄 (예정)</h2>
  <div class="sub">매일 09:00·15:00·21:00(KST) 자동 발행 기준 예상 일정입니다(하루 3편). 운영자 요청이 시즌 주제보다 먼저 처리됩니다.</div>
  <div class="card">${scheduleTable(d.plan)}</div>
  ${planDownloads}${extra}</section>`;
  const catCards = d.categories.map((c) => {
    const pct = c.catTotal ? Math.round((c.catDone / c.catTotal) * 100) : 100;
    const rows = c.items.map((it) => {
      const b = it.status === "done" ? "b-done" : it.status === "na" ? "b-na" : "b-todo";
      const st = it.status === "done" ? "완료" : it.status === "na" ? "해당없음" : "필요";
      const tb = it.type === "auto" ? "b-auto" : "b-manual";
      const tl = it.type === "auto" ? "자동" : "수동";
      return `<div class="row"><div><div>${esc(it.item)} <span class="badge ${tb}">${tl}</span></div>
        <div class="d">${esc(it.detail || it.note || "")}</div></div>
        <div><span class="badge ${b}">${st}</span></div></div>`;
    }).join("");
    return `<details><summary>${esc(c.name)}
      <span class="mini">${c.catDone}/${c.catTotal} (${pct}%)</span></summary>${rows}</details>`;
  }).join("");

  // 사이트 3개 실시간 카드 — 현재 사이트는 빌드 데이터로, 다른 사이트는
  // 해당 도메인의 /dashboard/data.json 을 브라우저에서 fetch 해 채운다
  const sm = d.summary;
  const siteCards = d.sites.map((s) => {
    const cur = s.current;
    return `
    <div class="card sitecard ${cur ? "cur" : "sitefetch"}" data-url="${esc(s.url)}">
      <div class="label">${cur ? "● 지금 보는 사이트" : "🌐 위성 사이트"} · ${esc(s.niche)}</div>
      <div style="font-weight:800;font-size:18px">${esc(s.name)}</div>
      <div class="chl" style="margin:10px 0 4px">
        <span class="s-today">${cur ? `오늘 ${sm.today}편` : "…"}</span>
        <span class="s-week">${cur ? `최근7일 ${sm.last7d}편` : "…"}</span>
        <span class="s-posts">${cur ? `누적 ${sm.totalPosts}편` : "…"}</span>
        <span class="s-pool">${cur ? `남은주제 ${sm.poolTotal}개` : "…"}</span>
      </div>
      <div style="margin-top:6px"><span class="s-status badge ${cur ? "b-done" : "b-na"}">${cur ? "정상 운영" : "확인 중…"}</span></div>
      <div class="linkrow">
        <a href="${esc(s.url)}/" target="_blank">사이트</a>
        <a href="${esc(s.url)}/dashboard/" target="_blank">대시보드</a>
        <a href="https://github.com/${esc(s.repo)}/actions" target="_blank">실행 로그</a>
      </div>
    </div>`;
  }).join("");

  // "지금 해야 할 일" — 상태에서 파생되는 운영자 액션만 추림(자동으로 되는 일은 제외)
  const todos = [];
  if (d.adsenseDone < d.adsense.length)
    todos.push({ t: "애드센스 심사 결과 확인", s: "대기", b: "b-todo",
      d: "3개 도메인 심사 중(2~4주). 승인 메일이 오면 슬롯 ID 4종 등록이 다음 액션입니다." });
  if (ch.wordpress.configured && ch.wordpress.pending > 0)
    todos.push({ t: `워드프레스 백필 자동 진행 중 — 대기 ${ch.wordpress.pending}편`, s: "자동", b: "b-auto",
      d: "매 실행 2편씩 자동 발행됩니다. 운영자가 할 일은 없습니다." });
  if ((site.profile || "default") === "default")
    todos.push({ t: "네이버 블로그 복붙 발행 (주 2~3회)", s: "수동", b: "b-manual",
      d: `<a href="#naver" onclick="showTab('naver')">네이버 탭</a>의 🛒 복붙 발행 시스템에서 [제목]·[📋 원고] 복사 → 붙여넣기 → 상품 카드 3개 삽입 → 발행. 글당 5~10분.` });
  if (!d.report.revenue.total)
    todos.push({ t: "첫 수익 발생 시 기록", s: "나중", b: "b-na",
      d: `수익이 확인되면 <a href="${esc(d.revenueEditUrl)}" target="_blank">revenue.json</a> 에 한 줄 추가 → 리포트 탭에 집계됩니다.` });

  // ===== 탭1: 전체 =====
  const overview = `
<div class="grid cols">
  <div class="card"><div class="label">총 발행 글</div>
    <div class="kpi">${d.publishing.totalPosts}<small> 편</small></div></div>
  <div class="card"><div class="label">최근 7일 발행</div>
    <div class="kpi">${sm.last7d}<small> 편</small></div></div>
  <div class="card"><div class="label">SEO·GEO 진척도</div>
    <div class="kpi">${p.pct}%<small> ${p.done}/${p.total}</small></div>
    <div class="bar"><span style="width:${p.pct}%"></span></div></div>
  <div class="card"><div class="label">자동 검사 통과</div>
    <div class="kpi">${p.autoPass}<small>/${p.autoTotal}</small></div>
    <div class="bar"><span style="width:${p.autoTotal ? Math.round(p.autoPass/p.autoTotal*100):0}%"></span></div></div>
  <div class="card"><div class="label">활성 채널</div>
    <div class="kpi">${d.activeChannels}<small> / 4</small></div></div>
</div>

<section><h2>📡 채널 발행 보드 <span class="mini">(6개 채널 동일 우선순위 · 기획→발행 여부 중심)</span></h2>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
    ${siteCards}
    <div class="card">
      <div class="label">🔵 워드프레스 블로그</div>
      <div style="font-weight:800;font-size:18px">카페24 자체 호스팅</div>
      <div class="chl" style="margin:10px 0 4px">
        <span>발행 ${ch.wordpress.published}편</span>
        <span>대기 ${ch.wordpress.pending}편</span>
      </div>
      <div style="margin-top:6px"><span class="badge ${ch.wordpress.configured ? "b-done" : "b-todo"}">${ch.wordpress.configured ? "자동 발행 중" : "연동 필요"}</span></div>
      <div class="linkrow">
        ${ch.wordpress.url ? `<a href="${esc(ch.wordpress.url)}" target="_blank">블로그 열기</a>
        <a href="${esc(ch.wordpress.url)}/wp-admin" target="_blank">관리자</a>` : ""}
        <a href="#wordpress" onclick="showTab('wordpress')">상세 탭</a>
      </div>
    </div>
    <div class="card">
      <div class="label">📝 구글 블로거</div>
      <div style="font-weight:800;font-size:18px">Blogspot</div>
      <div class="chl" style="margin:10px 0 4px">
        <span>발행 ${ch.blogger.published}편</span>
        <span>대기 ${ch.blogger.pending}편</span>
      </div>
      <div style="margin-top:6px"><span class="badge ${ch.blogger.configured ? "b-done" : "b-todo"}">${ch.blogger.configured ? "자동 발행 중" : "연동 필요"}</span></div>
      <div class="linkrow">
        ${d.bloggerUrl ? `<a href="${esc(d.bloggerUrl)}" target="_blank">블로그 열기</a>` : ""}
        <a href="https://www.blogger.com" target="_blank">블로거 관리</a>
        <a href="#blogger" onclick="showTab('blogger')">상세 탭</a>
      </div>
    </div>
    <div class="card">
      <div class="label">🟢 네이버 블로그 (원고만)</div>
      <div style="font-weight:800;font-size:18px">복붙 발행</div>
      <div class="chl" style="margin:10px 0 4px">
        <span>원고 ${(d.naverDrafts || []).length}편 준비</span>
        <span>수동 발행</span>
      </div>
      <div style="margin-top:6px"><span class="badge b-manual">복사 → 붙여넣기</span></div>
      <div class="linkrow">
        ${d.naverBlogUrl ? `<a href="${esc(d.naverBlogUrl)}" target="_blank">내 블로그</a>` : ""}
        <a href="https://blog.naver.com/GoBlogWrite.naver" target="_blank">글쓰기</a>
        <a href="#naver" onclick="showTab('naver')">원고 탭</a>
      </div>
    </div>
  </div></section>

<section><h2>⏭ 다음 발행 3편 <span class="mini">(자동 · 매일 09:00/15:00/21:00 KST)</span></h2>
  <div class="card"><table><thead><tr><th>#</th><th>제목</th><th>카테고리</th><th>구분</th></tr></thead><tbody>
  ${d.plan.length ? d.plan.slice(0, 3).map((t, i) => `<tr>
      <td>${i + 1}</td><td>${esc(t.title)}</td><td>${esc(catName(t.category))}</td>
      <td><span class="badge ${t.source === "운영자 요청" ? "b-manual" : "b-auto"}">${esc(t.source)}</span></td></tr>`).join("")
    : `<tr><td colspan="4" class="mini">예정된 주제가 없습니다 — 다음 발행 시 자동 보충됩니다.</td></tr>`}
  </tbody></table>
  <div class="linkrow"><a href="#report" onclick="showTab('report')">전체 발행 계획·추이·수익 → 📊 리포트 탭</a></div></div></section>

<section><h2>✅ 지금 해야 할 일 <span class="mini">(운영자 액션만 추림)</span></h2>
  <div class="card">${todos.length ? todos.map((x) => `
    <div class="row"><div><div>${esc(x.t)} <span class="badge ${x.b}">${esc(x.s)}</span></div>
      <div class="d">${x.d}</div></div></div>`).join("")
    : "<div class=mini>지금 필요한 운영자 액션이 없습니다. 자동 발행이 계속됩니다.</div>"}
  </div></section>

<section><h2>🗂 장기 체크 <span class="mini">(가끔 열어보는 것들 — 접어둠)</span></h2>
  <div class="card">
    <details><summary>💰 애드센스 심사 (4개 도메인) <span class="mini">승인까지 2~4주</span></summary>
      <div class="row"><div>starship-ent.ai.kr · todayskkultip.co.kr · jype.ai.kr · mycafe24(WP) — 전부 검토 요청됨.
        승인 메일 도착 시 슬롯 ID 4종 등록 + 자동광고 ON 이 다음 액션.</div>
        <div><a href="https://adsense.google.com/adsense/naui/sites" target="_blank">심사 상태 ↗</a></div></div></details>
    <details><summary>🛒 쿠팡 파트너스 최종승인 <span class="mini">누적 판매 15만원 도달 시 자동 심사</span></summary>
      <div class="row"><div>승인되면 오픈API 키 발급 가능 → 등록 시 글마다 상품별 자동 추적 링크로 업그레이드(코드 준비됨).</div>
        <div><a href="https://partners.coupang.com" target="_blank">실적 확인 ↗</a></div></div></details>
    <details><summary>🟢 네이버 애드포스트 <span class="mini">블로그 개설 90일+ · 공개 글 50개+</span></summary>
      <div class="row"><div>요건 충족 시 신청 — 복붙 발행을 꾸준히 하면 자연 충족됩니다.</div>
        <div><a href="https://adpost.naver.com" target="_blank">애드포스트 ↗</a></div></div></details>
    <details><summary>📈 수익 기록 (revenue.json) <span class="mini">수익 발생 시부터</span></summary>
      <div class="row"><div>각 채널 보고서의 금액을 한 줄씩 기록하면 리포트 탭에 월별·채널별 집계.</div>
        <div><a href="${esc(d.revenueEditUrl)}" target="_blank">✏️ 기록 ↗</a></div></div></details>
    <details><summary>🔎 검색 노출 상태 <span class="mini">월 1회 점검 권장</span></summary>
      <div class="row"><div>GSC 색인 페이지 수 / 네이버 서치어드바이저 수집 현황 — 늘고 있는지만 확인.</div>
        <div><a href="https://search.google.com/search-console" target="_blank">GSC ↗</a>
          <a href="https://searchadvisor.naver.com" target="_blank">네이버 ↗</a></div></div></details>
    <details><summary>🧩 선택 과제 <span class="mini">여유 있을 때</span></summary>
      <div class="row"><div>jype 네이버 서치어드바이저 등록 · www CNAME 레코드 · WP 퍼머링크(고유주소)를 '글 이름'으로 변경.</div></div></details>
  </div></section>`;

  // ===== 탭: 리포트 (기간별 발행·수익·주제 풀) =====
  const rp = d.report;
  const srcName = { adsense: "애드센스", coupang: "쿠팡 파트너스", naverConnect: "쇼핑커넥트", adpost: "애드포스트" };
  const revMonths = Object.keys(rp.revenue.byMonth).sort().reverse();
  const reportTab = `
<div class="grid cols">
  <div class="card"><div class="label">최근 7일 발행</div>
    <div class="kpi">${rp.daily.slice(-7).reduce((a, x) => a + x.count, 0)}<small> 편</small></div></div>
  <div class="card"><div class="label">최근 30일 발행</div>
    <div class="kpi">${rp.daily.reduce((a, x) => a + x.count, 0)}<small> 편</small></div></div>
  <div class="card"><div class="label">누적 발행</div>
    <div class="kpi">${d.publishing.totalPosts}<small> 편</small></div></div>
  <div class="card"><div class="label">기록된 수익 합계</div>
    <div class="kpi">${rp.revenue.total ? rp.revenue.total.toLocaleString("ko-KR") : "—"}<small>${rp.revenue.total ? " 원" : " 기록 없음"}</small></div></div>
</div>

<section><h2>📈 기간별 발행 추이</h2>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card"><div class="label">일별 (최근 30일)</div>${vbarChart(rp.daily, (x) => x.date.slice(5))}</div>
    <div class="card"><div class="label">주별 (최근 12주 · 주 시작일)</div>${vbarChart(rp.weekly, (x) => x.label)}</div>
  </div>
  <div class="card" style="margin-top:16px"><div class="label">월별 누적</div>
    ${Object.keys(d.publishing.byMonth).length ? bars(d.publishing.byMonth) : "<div class=mini>데이터 없음</div>"}</div></section>

<section><h2>💰 수익 현황 (기간별)</h2>
  <div class="sub">애드센스 승인 전에는 수익 데이터가 없습니다. 승인 후 각 채널 보고서에서 확인한 금액을
    <a href="${esc(d.revenueEditUrl)}" target="_blank">✏️ config/revenue.json 에 기록</a>하면 여기에 월별·채널별로 집계됩니다(선택 사항).</div>
  <div class="linkrow">
    <a href="https://adsense.google.com" target="_blank">애드센스 보고서 ↗</a>
    <a href="https://partners.coupang.com" target="_blank">쿠팡 파트너스 실적 ↗</a>
    <a href="https://brandconnect.naver.com" target="_blank">쇼핑커넥트(브랜드커넥트) ↗</a>
    <a href="https://analytics.google.com" target="_blank">GA4 트래픽 ↗</a>
  </div>
  ${revMonths.length ? `
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:16px">
    <div class="card"><div class="label">월별 수익(기록 기준)</div>
      <table><thead><tr><th>월</th><th style="text-align:right">금액(원)</th></tr></thead><tbody>
      ${revMonths.map((m) => `<tr><td>${esc(m)}</td><td style="text-align:right">${rp.revenue.byMonth[m].toLocaleString("ko-KR")}</td></tr>`).join("")}
      </tbody></table></div>
    <div class="card"><div class="label">채널별 수익(기록 기준)</div>
      ${bars(Object.fromEntries(Object.entries(rp.revenue.bySource).map(([k, v]) => [srcName[k] || k, v])))}</div>
  </div>` : `<div class="note" style="margin-top:14px">아직 수익 기록이 없습니다. 수익이 발생하기 시작하면
    위 ✏️ 링크에서 <code>records</code> 배열에 한 줄씩 추가하세요 —
    예: <code>{"date":"2026-08-31","source":"adsense","amount":12340}</code></div>`}
</section>

<section><h2>🧠 주제 풀 모니터링</h2>
  <div class="sub">남은 주제가 하루 발행량(${d.postsPerDayInfo}편) 기준 6편 미만이 되면 발행 시 Claude 가 자동으로 12개를 보충합니다(topic-generate).</div>
  <div class="grid cols">
    <div class="card"><div class="label">남은 주제</div><div class="kpi">${rp.poolTotal}<small> 개</small></div></div>
    <div class="card"><div class="label">예상 커버 기간</div><div class="kpi">${rp.poolDays}<small> 일치</small></div></div>
    <div class="card"><div class="label">자동 보충</div><div class="kpi" style="font-size:22px">활성화</div>
      <div class="chl"><span>부족 시 12개 자동 발굴</span></div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="label">카테고리별 남은 주제</div>
    ${Object.keys(rp.poolByCat).length
      ? Object.entries(rp.poolByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
          `<div class="row"><span>${esc(catName(k))}</span><span>${v}개</span></div>`).join("")
      : "<div class=mini>남은 주제 없음 — 다음 발행 시 자동 보충됩니다.</div>"}
  </div>
  ${rp.poolDays < 3 ? `<div class="warn">⚠️ 주제 풀이 ${rp.poolDays}일치 남았습니다. 자동 보충이 동작하지만, 원하는 주제가 있다면 <a href="${esc(d.editUrl)}" target="_blank">requests.json</a> 에 직접 등록해 두세요.</div>` : ""}
</section>

<section><h2>🗓 발행 계획 (다음 12편)</h2>
  <div class="card">${scheduleTable(d.plan)}</div>
  ${planDownloads}</section>

<section><h2>📝 내 의견 · 요청 (편집 지시)</h2>
  <div class="sub"><code>config/requests.json</code> 에서 관리 ·
    <a href="${esc(d.editUrl)}" target="_blank">✏️ 깃허브에서 바로 편집</a> → 저장하면 다음 발행부터 반영됩니다.</div>
  <div class="card">
    <div class="label">📌 고정 작성 기준 (모든 글 항상 적용 · 코드 내장)</div>
    <ol style="margin:6px 0 18px;padding-left:20px">
      ${(d.requests.baseline || []).map((r) => `<li style="margin:4px 0">${esc(r)}</li>`).join("")}
    </ol>
    <div class="label">공통 편집 지침 (운영자 수정 가능)</div>
    <div style="margin:6px 0 16px">${d.requests.notes ? esc(d.requests.notes) : "<span class=mini>아직 없음 — requests.json 의 notes 에 적어주세요. 예: '존댓말, 정부 공식 출처 필수, 표 적극 활용'</span>"}</div>
    <div class="label">요청 주제 (${d.requests.pendingCount}건 대기)</div>
    <table style="margin-top:6px"><thead><tr><th>제목</th><th>카테고리</th><th>상태</th><th>메모</th></tr></thead><tbody>
    ${d.requests.topics.length ? d.requests.topics.map((t) => `<tr>
        <td>${esc(t.title)}</td><td>${esc(catName(t.category))}</td>
        <td><span class="badge ${t.status === "done" ? "b-done" : t.status === "pending" ? "b-manual" : "b-na"}">${t.status === "done" ? "발행됨" : t.status === "pending" ? "대기" : esc(t.status)}</span></td>
        <td class="d">${esc(t.note || "")}</td></tr>`).join("")
      : `<tr><td colspan="4" class="mini">등록된 요청이 없습니다.</td></tr>`}
    </tbody></table>
  </div></section>`;

  // ===== 탭2: 자체 사이트 =====
  const siteTab = `
<section><h2>🌐 자체 사이트 상태</h2>
  <div class="grid cols">
    <div class="card"><div class="label">발행 글</div><div class="kpi">${ch.site.count}<small> 편</small></div></div>
    <div class="card"><div class="label">배포</div><div class="kpi" style="font-size:22px">GitHub Pages</div>
      <div class="chl"><span>운영중</span></div></div>
    <div class="card"><div class="label">SEO·GEO 자동검사</div><div class="kpi">${p.autoPass}<small>/${p.autoTotal}</small></div></div>
  </div>
  <div class="linkrow">
    <a href="${esc(ch.site.url)}/" target="_blank">사이트 열기</a>
    <a href="${esc(ch.site.url)}/sitemap.xml" target="_blank">sitemap.xml</a>
    <a href="${esc(ch.site.url)}/robots.txt" target="_blank">robots.txt</a>
    <a href="${esc(ch.site.url)}/llms.txt" target="_blank">llms.txt</a>
    <a href="${esc(ch.site.url)}/rss.xml" target="_blank">RSS</a>
  </div></section>

${scheduleSection()}

<section><h2>⚙️ 수익화·분석 설정</h2>
  <div class="card">${setRows(ch.site.settings)}</div>
  <div class="note">미설정 항목은 GitHub <b>Settings → Secrets and variables → Actions → Variables</b> 에 등록하면 자동 반영됩니다. 자세한 절차는 <a href="${esc(d.setupUrl)}" target="_blank">SETUP 가이드</a> 참고.</div></section>

<section><h2>🗂 카테고리별 발행</h2>
  <div class="card">${Object.keys(d.publishing.byCat).length ? bars(d.publishing.byCat, catName) : "<div class=mini>아직 발행된 글이 없습니다.</div>"}</div></section>

<section><h2>✅ SEO · GEO 체크리스트</h2>
  <div class="sub">자동 항목은 빌드 결과물을 실시간 검사한 결과(현재 ${p.autoPass}/${p.autoTotal}). 수동 항목은 <code>config/geo-checklist.json</code> 의 status 로 관리합니다.</div>
  ${catCards}</section>

<section><h2>📰 사이트 발행 글 (${ch.site.count})</h2>
  <div class="card"><table><thead><tr><th>제목</th><th>카테고리</th><th>게시일</th><th>원고</th></tr></thead><tbody>
  ${postRows(ch.site.posts, false)}</tbody></table></div></section>`;

  // ===== 탭3: 구글 블로거 =====
  const bloggerTab = `
<section><h2>📝 구글 블로거 상태</h2>
  <div class="grid cols">
    <div class="card"><div class="label">연동 상태</div>
      <div class="kpi" style="font-size:22px">${ch.blogger.configured ? "연동됨" : "연동 필요"}</div></div>
    <div class="card"><div class="label">발행됨</div><div class="kpi">${ch.blogger.published}<small> 편</small></div></div>
    <div class="card"><div class="label">발행 대기</div><div class="kpi">${ch.blogger.pending}<small> 편</small></div></div>
  </div>
  ${ch.blogger.configured ? "" : `<div class="note">아직 연동되지 않았습니다. 아래 4개 Secret 을 등록하고 워크플로우 입력 <code>publish_blogger=true</code>(또는 변수 <code>PUBLISH_BLOGGER=true</code>) 로 두면 자동 발행됩니다. 발급 절차: <a href="${esc(d.setupUrl)}" target="_blank">SETUP STEP 6</a>.</div>`}</section>

${scheduleSection()}

<section><h2>🔑 연동 설정 (Secrets)</h2>
  <div class="card">${setRows(ch.blogger.secrets.map((s) => ({ k: s.k, ok: s.ok, v: s.ok ? "등록됨" : "미등록" })))}</div></section>

<section><h2>📰 블로거 발행 대상 글 (${ch.blogger.posts.length})</h2>
  <div class="card"><table><thead><tr><th>제목</th><th>카테고리</th><th>게시일</th><th>블로거</th><th>원고</th></tr></thead><tbody>
  ${postRows(ch.blogger.posts, true)}</tbody></table></div></section>`;

  // ===== 탭: 워드프레스 =====
  const wpTab = `
<section><h2>🔵 워드프레스 상태</h2>
  ${ch.wordpress.url ? `<div class="linkrow" style="margin-bottom:12px">
    <a href="${esc(ch.wordpress.url)}" target="_blank">🔵 워드프레스 블로그 열기 ↗</a>
    <a href="${esc(ch.wordpress.url)}/wp-admin" target="_blank">⚙️ 관리자(글 관리) ↗</a></div>` : ""}
  <div class="grid cols">
    <div class="card"><div class="label">연동 상태</div>
      <div class="kpi" style="font-size:22px">${ch.wordpress.configured ? "연동됨" : "연동 필요"}</div></div>
    <div class="card"><div class="label">발행됨</div><div class="kpi">${ch.wordpress.published}<small> 편</small></div></div>
    <div class="card"><div class="label">발행 대기</div><div class="kpi">${ch.wordpress.pending}<small> 편</small></div></div>
  </div>
  ${ch.wordpress.configured ? "" : `<div class="note">아직 연동되지 않았습니다. 아래 항목(변수/시크릿)을 등록하면 자동 발행됩니다: <code>WORDPRESS_URL</code>·<code>WORDPRESS_USER</code>(Variables), <code>WORDPRESS_APP_PASSWORD</code>(Secret). 워드프레스 → 사용자 → 프로필 → <b>애플리케이션 비밀번호</b>에서 발급. 절차: <a href="${esc(d.setupUrl)}" target="_blank">SETUP 가이드</a>.</div>`}</section>

${scheduleSection()}

<section><h2>🔑 연동 설정</h2>
  <div class="card">${setRows(ch.wordpress.secrets.map((s) => ({ k: s.k, ok: s.ok, v: s.ok ? "등록됨" : "미등록" })))}</div>
  <div class="note">💡 워드프레스는 <b>호스팅</b>이 필요합니다(워드프레스닷컴 비즈니스 이상 또는 자체 호스팅). REST API + 애플리케이션 비밀번호만 있으면 자체 사이트와 동일 글이 자동 발행됩니다.</div></section>

<section><h2>📰 워드프레스 발행 대상 글 (${ch.wordpress.posts.length})</h2>
  <div class="card"><table><thead><tr><th>제목</th><th>카테고리</th><th>게시일</th><th>WP</th><th>원고</th></tr></thead><tbody>
  ${ch.wordpress.posts.length ? ch.wordpress.posts.map((r) =>
    `<tr><td><a href="${esc(site.url + r.path)}" target="_blank">${esc(r.title)}</a></td>
      <td>${esc(catName(r.category))}</td><td>${esc(r.date)}</td>
      <td><span class="badge b-todo">대기</span></td>
      <td><a href="drafts/${esc(r.slug)}.md" download>원고 ⬇</a></td></tr>`).join("")
    : `<tr><td colspan="5" class="mini">연동 후 발행 대상 글이 여기에 표시됩니다. (신규 생성 글부터 WP 채널로 지정됨)</td></tr>`}
  </tbody></table></div></section>`;

  // ===== 탭4: 네이버 블로그 =====
  const nd = d.naverDrafts || [];
  // 쿠팡 정밀 딥링크 상태 — OpenAPI 키 등록 시 자동으로 채워짐(coupang-resolve.mjs)
  const cpCache = (() => {
    try { return readJson(path.join(ROOT, "config", "coupang-links-cache.json")); } catch { return {}; }
  })();
  const cpKeys = Object.keys(cpCache).filter((k) => !k.startsWith("_"));
  const cpDone = cpKeys.filter((k) => (cpCache[k] || "").trim()).length;
  const naverTab = `
<section><h2>🛒 복붙 발행 시스템 <span class="mini">(쇼핑커넥트 수익형 · 원고 ${nd.length}편 준비됨)</span></h2>
  <div class="sub">버튼 한 번으로 <b>서식·추천 상품 슬롯·수익 고지문</b>이 포함된 원고가 복사됩니다.
    네이버 글쓰기 화면에 붙여넣기(Ctrl+V)만 하면 됩니다.</div>
  <div class="card">
    <div class="label">발행 4단계 (글당 5~10분)</div>
    <div class="row"><div>① <a href="https://blog.naver.com/GoBlogWrite.naver" target="_blank"><b>네이버 글쓰기 열기</b> ↗</a> (로그인돼 있으면 바로 글쓰기 화면)</div></div>
    <div class="row"><div>② 아래 표 <b>[제목]</b> 버튼 → 화면 <b>제목칸</b>에 붙여넣기</div></div>
    <div class="row"><div>③ <b>[📋 원고]</b> 버튼 → 화면 <b>본문칸</b>에 붙여넣기
      — 원고에 <b>이미지 3장 이상</b>이 포함돼 있어 붙여넣으면 자동 업로드됩니다
      (안 붙으면 [열기] 페이지 상단의 이미지 안내 사용)</div></div>
    <div class="row"><div>💎 <b>정밀 상품 링크</b>: ${cpDone}/${cpKeys.length} 활성
      ${cpDone ? "— 활성된 상품 CTA는 '정확한 상품+수수료 추적' 링크로 자동 발행됩니다" :
      "— 쿠팡 OpenAPI 키(COUPANG_ACCESS_KEY/SECRET_KEY) 등록 시 시스템이 전 상품 링크를 자동 생성·적용합니다(파트너스 최종승인 후 발급 가능)"}</div></div>
    <div class="row"><div>④ 본문 끝 <b>"🛒 함께 준비하면 좋은 것"</b> 각 소제목 아래에 상품 카드 삽입 → 발행.<br>
      에디터 오른쪽 <b>글감</b> 버튼 → <b>쇼핑</b> 탭 → 아래 표의 <b>[검색어]</b> 버튼으로 복사한 검색어 붙여넣기 → 상품 클릭.
      카드가 상품 <b>공식 이미지·가격·판매처 출처</b>를 자동으로 넣어주고, 쇼핑커넥트 연동 채널이면 <b>수수료 링크</b>가 됩니다.<br>
      <span class="mini">※ 원고에는 운영자용 안내문이 없습니다 — 카드를 못 넣고 발행해도 글이 어색하지 않아요.</span></div></div>
  </div>
  ${(() => {
    // 행 템플릿 (오늘 할 일/보관함 공용) — 최신순, 발행완료 체크는 브라우저(localStorage)에 저장
    const nvRow = (p, i) => `<tr data-slug="${esc(p.slug)}" data-idx="${i}">
    <td>${esc(p.hooks[0])}<div class="d">원제: ${esc(p.title)} · ${esc(p.date)}
      ${p.unique ? ' · <b style="color:#2e7d32">✍ 네이버 전용 고유원고</b>' : ""}${p.imgs ? ` · 🖼 이미지 ${p.imgs}장 포함` : ""}</div>
      ${(p.products || []).length ? `<div class="d" style="margin-top:4px">🛒 카드 검색어:
        ${(p.products || []).map((pr) => `<button class="copybtn" style="font-size:11px;padding:2px 8px"
          onclick="copyText(this,${JSON.stringify(pr.query).replace(/"/g, "&quot;")})">${esc(pr.query)}</button>`).join(" ")}</div>` : ""}</td>
    <td>${esc(catName(p.category))}</td>
    <td style="white-space:nowrap">
      <button class="copybtn" onclick="copyText(this,${JSON.stringify(p.hooks[0]).replace(/"/g, "&quot;")})">제목</button>
      <button class="copybtn" onclick="copyDraft(this,'${esc(p.slug)}')">📋 원고</button>
      <a href="naver/${esc(p.slug)}.html" target="_blank" class="mini">열기</a>
      <label class="mini" style="display:block;margin-top:4px"><input type="checkbox" class="nvcb"
        onchange="nvDone(this,'${esc(p.slug)}')"> 발행완료</label>
    </td></tr>`;
    const header = `<thead><tr><th>후킹 제목(복사용)</th><th>카테고리</th><th>복사</th></tr></thead>`;
    return `
  <div class="card" style="margin-top:12px">
    <div class="label">📌 오늘·내일 발행할 것 <span class="mini">(최신 글 중 미발행분 — 하루 1~2편이면 충분해요. 발행 후 [발행완료] 체크)</span></div>
    <div id="nv-todoempty" class="d" style="display:none">🎉 밀린 발행이 없습니다. 새 글이 생성되면 여기에 나타나요.</div>
    <table>${header}<tbody id="nv-todobody"></tbody></table>
  </div>
  <details class="card" style="margin-top:12px"><summary><b>📚 전체 원고 보관함</b> (<span id="nv-allcount">${nd.length}</span>편 · 최신순)</summary>
    <table>${header}<tbody id="nv-allbody">${nd.map((p, i) => nvRow(p, i)).join("")}</tbody></table>
  </details>`;
  })()}
  <div class="note">⚠️ <b>운영 원칙 3가지</b><br>
    1) <b>"최저가" 단정 금지</b> — 원고는 "오늘 최저가 확인" 같은 <b>확인 유도형</b> 문구만 씁니다(허위·과장광고 제재 예방).<br>
    2) <b>상품 이미지는 반드시 글감 카드로</b> — 판매자 상세페이지 이미지를 복사해 붙이면 출처를 적어도 저작권 침해입니다.<br>
    3) <b>유사문서 예방</b> — 제목은 후킹 제목을 쓰고, 붙여넣은 뒤 도입부 1~2문장을 본인 말로 바꾸면 더 안전합니다.</div>
</section>

<section><h2>🟢 채널 상태</h2>
  <div class="card">
    <div class="set"><div><span class="dot off"></span>자동 발행</div><div class="v">불가(네이버 공식 API 없음) → 위 복붙 시스템으로 반자동</div></div>
    <div class="set"><div><span class="dot on"></span>쇼핑커넥트 수익화</div><div class="v">원고에 상품 슬롯·고지문 자동 포함</div></div>
  </div>
  <div class="note">비공식 자동화(Selenium 등)는 네이버 약관 위반·계정 차단 위험이 있어 쓰지 않습니다.</div></section>

<section><h2>💰 네이버 애드포스트 (이 채널의 수익화)</h2>
  <div class="card">${setRows(d.affiliate.adpost)}
    <div class="note">애드포스트 심사 기준: <b>개설 90일+ · 공개 글 50개+ · 복사 콘텐츠 없음 · 방문자 지표</b>.
      블로그를 아직 안 만들었다면 <b>오늘 개설</b>하세요 — 90일 시계가 개설일부터 돌아갑니다.
      신청: <a href="https://adpost.naver.com" target="_blank">adpost.naver.com</a></div></section>

<section><h2>📥 기획안 · 원고 다운로드 (네이버 수동 발행용)</h2>
  <div class="sub">네이버는 직접 발행해야 하므로, 아래 파일을 받아 네이버 에디터에서 다듬어 발행하세요.</div>
  <div class="linkrow">
    <a href="naver-content-pack.md" download>📦 통합 기획안+전체 원고 (.md)</a>
    <a href="plan.md" download>📥 기획안 (.md)</a>
    <a href="plan.csv" download>📥 스케줄 (.csv)</a>
  </div>
  <div class="note">⚠️ <b>그대로 복붙 금지</b> — 사이트에 이미 게시된 글을 그대로 붙여넣으면
    네이버 검색의 <b>유사문서 필터</b>에 걸려 노출이 제한되고, <b>애드포스트 심사에서 '복사 콘텐츠'로 탈락</b>할 수 있습니다.
    원고를 뼈대로 삼아 도입부·소제목 구성·어투를 바꾸고 본인 경험 한두 문단을 더해 발행하세요(글당 10~15분).</div>
</section>

${scheduleSection()}

<section><h2>📝 원고 다운로드 (글별)</h2>
  <div class="card"><table><thead><tr><th>제목</th><th>카테고리</th><th>게시일</th><th>원고</th></tr></thead><tbody>
  ${postRows(ch.site.posts, false)}</tbody></table></div></section>

<section><h2>🔗 네이버 노출 보조 (적용됨)</h2>
  <div class="card">
    <div class="set"><div><span class="dot ${site.analytics.naverWebmaster ? "on" : "off"}"></span>네이버 서치어드바이저 소유확인</div>
      <div class="v">${site.analytics.naverWebmaster ? "설정됨" : "미설정 (NAVER_SITE_VERIFICATION)"}</div></div>
    <div class="set"><div><span class="dot on"></span>RSS 피드 제공</div><div class="v">/rss.xml</div></div>
  </div>
  <div class="note">자체 사이트 글을 네이버 검색에 노출시키려면 <a href="https://searchadvisor.naver.com" target="_blank">네이버 서치어드바이저</a>에 사이트를 등록하고 사이트맵을 제출하세요.</div></section>`;

  // ===== 탭: 광고사이트(수익화) — 애드센스·쇼핑커넥트·쿠팡파트너스 =====
  const adsTab = `
<section><h2>💰 수익화 최속 경로 (수익 도달 속도 순)</h2>
  <div class="sub">각 채널마다 승인 리드타임이 다르므로, 순서를 기다리지 말고 <b>오늘 병렬로 시작</b>하는 것이 총 대기시간을 최소화합니다.</div>
  <div class="card">
    <div class="row"><div><b>① 네이버 쇼핑커넥트 가입</b> — 오늘 <span class="badge b-done">심사 없음</span></div>
      <div class="d">브랜드커넥트 스페이스 개설 → 쇼핑커넥트 약관 동의 → 즉시 시작 · 수수료 최대 30~50%(판매자 설정)</div></div>
    <div class="row"><div><b>② 쿠팡 파트너스 가입</b> — 오늘 <span class="badge b-done">즉시 링크 발급</span></div>
      <div class="d">기존 글에 상품 링크 삽입 → 수일 내 수익 가능 · 최종 승인은 누적 판매 15만원 도달 시 자동 심사</div></div>
    <div class="row"><div><b>③ 커스텀 도메인 구매 + AdSense 신청</b> — 이번 주</div>
      <div class="d">도메인은 AdSense의 전제조건(연 1~2만원) · 심사 2~4주</div></div>
    <div class="row"><div><b>④ 네이버 블로그 개설 (애드포스트 시계 시작)</b> — 오늘</div>
      <div class="d">애드포스트는 개설 90일+ 운영 실적 심사 → 오늘 개설해야 3개월 뒤 신청 가능</div></div>
  </div></section>

<section><h2>1️⃣ 네이버 쇼핑커넥트 (제휴 마케팅) — 심사 없이 즉시 시작</h2>
  <div class="sub">네이버가 2025년 7월 정식 출시한 크리에이터 제휴 서비스입니다. 스마트스토어 상품 링크를 콘텐츠에 넣고 구매 발생 시 수수료(판매자 설정, 최대 30~50%)를 받습니다.</div>
  <div class="card">${setRows(d.affiliate.naverConnect)}
    <div class="note">가입: 네이버 <b>브랜드커넥트</b>에서 크리에이터 스페이스 개설 → <b>쇼핑 커넥트</b> 메뉴에서 이용약관 동의 → 즉시 시작(사전 심사 없음).
      활동 채널로 네이버 블로그·인스타그램·유튜브는 물론 <b>개인 사이트(본 사이트)</b>도 등록할 수 있습니다.<br>
      💡 네이버 블로그와 궁합이 가장 좋습니다 — 네이버 생태계 안에서 콘텐츠·상품·구매가 한 흐름으로 이어집니다.<br>
      식별자를 GitHub <b>Variables</b>에 <code>NAVER_CONNECT_ID</code>로 등록하면 대시보드에 연동 상태가 반영되고,
      글 frontmatter에 <code>affiliate: [naverConnect]</code>를 넣으면 고지 문구가 자동 삽입됩니다.<br>
      ℹ️ 명칭 주의: "쇼핑파트너센터"는 스마트스토어 <b>판매자</b>용 센터로 별개입니다. 블로거용 제휴는 <b>쇼핑커넥트</b>가 정식 명칭입니다.</div>
  </div></section>

<section><h2>2️⃣ 쿠팡 파트너스 (제휴 마케팅) — 즉시 링크 발급</h2>
  <div class="sub">글에서 소개한 상품에 쿠팡 링크를 걸고, 클릭 후 구매가 발생하면 수수료를 받는 방식입니다. 배너광고와 병행 가능합니다.</div>
  <div class="card">${setRows(d.affiliate.coupang)}
    <div class="note">가입: <a href="https://partners.coupang.com" target="_blank">partners.coupang.com</a> → 가입 후 발급되는 채널(트래킹) ID를
      GitHub <b>Variables</b>에 <code>COUPANG_PARTNER_ID</code>로 등록하면 연동됩니다.<br>
      ⚠️ 정책상 링크가 포함된 글에는 <b>"이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."</b> 문구를 반드시 표시해야 하며,
      본 사이트는 <b>모든 글에 쿠팡 상품 블록을 자동 삽입</b>하므로 이 문구도 자동으로 노출됩니다.<br>
      💡 <b>최종 승인</b>은 누적 판매금액 15만원 도달 시 자동 심사되므로, 가입 직후부터 활동 실적을 쌓는 것이 중요합니다.</div>
  </div>
  <div class="card" style="margin-top:12px">
    <div class="label">🔁 쿠팡 상품 링크 자동 삽입 (애드센스와 2중 수익)</div>
    <div class="sub">모든 글 하단에 카테고리별 <b>쿠팡 최저가 확인</b> 상품 블록이 자동으로 들어갑니다.
      애드센스 배너와 <b>같은 페이지에 공존</b>해, 한 글에서 광고수익 + 제휴수수료가 동시에 발생합니다.</div>
    <div class="set"><div><span class="dot ${d.coupangLinks.apiLinks ? "on" : "off"}"></span>🤖 오픈API 자동 추적 링크</div>
      <div class="v">${d.coupangLinks.apiLinks ? `${d.coupangLinks.apiLinks}개 자동 생성됨 (전 상품 추적)` : "미연동 — COUPANG_ACCESS_KEY/SECRET_KEY 등록 시 자동 생성"}</div></div>
    <div class="set"><div><span class="dot ${d.coupangLinks.filled ? "on" : "off"}"></span>수동 카테고리 링크(선택)</div>
      <div class="v">${d.coupangLinks.filled}/${d.coupangLinks.total} 등록</div></div>
    <div class="note">📌 <b>권장(완전 자동)</b>: 쿠팡 파트너스 <b>오픈API 키</b> 2개(<code>ACCESS_KEY</code>·<code>SECRET_KEY</code>)를 GitHub Secrets에 등록하면,
      빌드할 때 모든 상품이 추적 링크로 <b>자동 변환</b>됩니다 — 앞으로 발행되는 글까지 전부 자동. 링크를 손으로 붙일 필요가 없습니다.<br>
      🔧 <b>수동(대안)</b>: 카테고리별 링크를 <a href="${esc(d.coupangEditUrl)}" target="_blank">✏️ config/coupang-links.json</a> 에 붙여넣어도 됩니다.<br>
      둘 다 없으면 블록은 쿠팡 검색으로 연결돼 작동은 하지만 <b>수수료 추적은 안 됩니다</b>.<br>
      ⚖️ 문구 정책: "무조건 최저가" 같은 <b>단정 표현은 쓰지 않고</b> "쿠팡 최저가 확인" 등 확인 유도형으로 강조합니다(표시광고법·파트너스 정책 준수).</div>
  </div></section>

<section><h2>3️⃣ Google AdSense (배너 광고) — 커스텀 도메인 필수</h2>
  <div class="sub">정공법 승인 기준입니다. 미끼(그림자) 사이트 없이 <b>이 사이트 그대로</b> 신청하세요.</div>
  <div class="card">${setRows(d.adsense)}
    <div class="note">⚠️ <b>커스텀 도메인이 사실상 필수입니다.</b> AdSense는 루트 도메인만 사이트로 등록할 수 있어
      <code>github.io</code> 하위 주소(현재 주소)로는 신청 자체가 불가합니다. 도메인 구매(연 1~2만원) 후
      <a href="${esc(d.setupUrl)}" target="_blank">SETUP STEP 10</a>대로 연결하고 신청하세요.<br>
      콘텐츠 요건(20편+)은 이미 충족했으므로, <b>도메인 연결이 유일하게 남은 관문</b>입니다.<br>
      💡 <b>승인 후 수익 극대화</b>: AdSense → 광고 → 사이트별 설정에서 <b>자동 광고 ON + 앵커 광고·전면 광고 허용</b>으로 두세요
      (본문 광고 자리는 코드에 이미 준비됨 — 승인 후 슬롯 ID 4종을 등록하면 수동 배치까지 활성화됩니다).<br>
      (대안: 구글 블로거는 애드센스 '호스트 파트너'라 blogspot 주소 그대로 승인 신청이 가능합니다 — 단, 그 승인은 해당 블로그에만 적용됩니다.)<br>
      가입: <a href="https://adsense.google.com" target="_blank">adsense.google.com</a></div>
  </div></section>

<section><h2>4️⃣ 네이버 애드포스트 (네이버 블로그 광고 수익)</h2>
  <div class="sub">네이버 블로그에 붙는 광고 수익 프로그램입니다. 사이트 코드가 아니라 <b>블로그 운영 실적</b>으로 심사합니다.</div>
  <div class="card">${setRows(d.affiliate.adpost)}
    <div class="note">신청: <a href="https://adpost.naver.com" target="_blank">adpost.naver.com</a> · 심사 기준: 개설 90일+, 공개 글 50개+, 방문자 지표, <b>복사 콘텐츠 없음</b>.<br>
      ⚠️ 사이트 글을 <b>그대로 복붙하면 '복사 콘텐츠'로 탈락</b>할 수 있습니다. 네이버 탭의 원고를 기반으로
      도입부·구성·어투를 다듬어 발행하세요(네이버 검색의 유사문서 필터에도 유리합니다).</div>
  </div></section>

<section><h2>5️⃣ Taboola (추천 위젯) — 후순위</h2>
  <div class="card">
    <div class="note">Taboola 등 네이티브 광고 네트워크는 <b>일정 규모 이상의 트래픽</b>을 요구해 신규 사이트는 승인되기 어렵습니다.
      트래픽이 쌓인 뒤(월 수만 PV+) 신청하는 후순위 항목으로 두세요. 코드는 이미 준비되어 있어 <code>TABOOLA_PUBLISHER</code>만 등록하면 활성화됩니다.</div>
  </div></section>

<section><h2>📝 제휴 마케팅 콘텐츠 운영 방식</h2>
  <div class="card">
    <p style="margin:0 0 10px">제휴 마케팅은 "상품 추천/비교"형 콘텐츠에서 효과가 크므로, 상품 추천 주제를
      <code>config/requests.json</code>에 등록해 요청하거나, 다음 라운드의 주제·자동화 기획에서 전용 카테고리로 편입할 수 있습니다.
      (예: 계절 주제인 '제습기'·'장마철 곰팡이' 글은 쿠팡/네이버 상품 링크와 궁합이 좋습니다.)</p>
    <p style="margin:0">글 frontmatter에 <code>affiliate: ["coupang"]</code> 또는 <code>["naverConnect"]</code>를 추가하면
      해당 글 상단에 고지 문구가 자동 노출됩니다(<code>automation/render.mjs</code>의 <code>affiliateDisclosure()</code>).</p>
  </div></section>`;

  // ===== 탭: 시장조사 (발행 주제 범위) =====
  const rs = d.research || { scopes: [], total: 0, collectedAt: null };
  const scopeCards = (rs.scopes || []).map((sc) => `
    <details ${sc.items.length ? "open" : ""}>
      <summary>${esc(sc.label)} <span class="mini">${sc.items.length}건 · ${esc(sc.source)}</span></summary>
      <div class="d" style="margin:4px 0 10px">${esc(sc.desc)}</div>
      ${sc.items.length ? sc.items.map((it) => `
        <div class="row"><div><div>${esc(it.title)}</div>
          <div class="d">${esc(it.source)} · ${esc(it.capturedAt || "")}${it.keywords?.length ? ` · ${esc(it.keywords.join(", "))}` : ""}</div></div></div>`).join("")
        : `<div class="mini">아직 수집된 신호가 없습니다.</div>`}
    </details>`).join("");
  const researchTab = `
<section><h2>🔎 시장조사 — 발행 주제 범위 <span class="mini">(수집 ${rs.total}건 · ${esc(rs.collectedAt || "미수집")})</span></h2>
  <div class="sub">아래 7개 범위에서 수집한 시의성 신호입니다. <b>${d.researchOnly ? "발행 주제는 이 범위 안에서만 뽑히도록 제약이 켜져 있습니다(researchOnly)." : "현재 범위 제약이 꺼져 있습니다."}</b>
    수집은 매일 자동 갱신되며(네이버 뉴스·데이터랩·유튜브 트렌드), 발행은 현재 <b>일시정지</b> 상태입니다.</div>
  <div class="grid cols">
    <div class="card"><div class="label">수집 신호</div><div class="kpi">${rs.total}<small> 건</small></div></div>
    <div class="card"><div class="label">범위</div><div class="kpi">${(rs.scopes || []).length}<small> 개</small></div></div>
    <div class="card"><div class="label">범위 제약</div><div class="kpi" style="font-size:20px">${d.researchOnly ? "ON ✅" : "OFF"}</div></div>
    <div class="card"><div class="label">발행 상태</div><div class="kpi" style="font-size:20px">⏸ 정지</div></div>
  </div>
  <div class="card" style="margin-top:14px">${scopeCards}</div>
  <div class="note">📌 이 신호들이 발행 주제의 <b>재료</b>가 됩니다. 발행을 재개하면 글 주제는 이 범위 안에서만 생성됩니다.
    범위를 넓히거나 좁히려면 <code>config/research-scope.json</code>, 제약 on/off 는 <code>config/automation-flags.json</code> 의 <code>researchOnly</code> 로 조정합니다.</div>
</section>`;

  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(site.name)} · 운영 대시보드</title>
<style>${STYLE}</style></head><body><div class="wrap">
<h1>📊 운영 대시보드</h1>
<div class="sub">${esc(site.name)} — 채널별 발행·관리 모니터링 · 생성 ${d.generatedAt} (비공개 페이지)</div>

<div class="tabs">
  <button data-tab="all" onclick="showTab('all',this)">📊 전체</button>
  <button data-tab="research" onclick="showTab('research',this)">🔎 시장조사</button>
  <button data-tab="report" onclick="showTab('report',this)">📈 리포트</button>
  <button data-tab="naver" onclick="showTab('naver',this)">🟢 네이버 블로그</button>
  <button data-tab="blogger" onclick="showTab('blogger',this)">📝 구글 블로거</button>
  <button data-tab="wordpress" onclick="showTab('wordpress',this)">🔵 워드프레스</button>
  <button data-tab="ads" onclick="showTab('ads',this)">💰 광고·수익화</button>
  <button data-tab="site" onclick="showTab('site',this)">🌐 자체 사이트</button>
</div>

<div id="t-all" class="panel">${overview}</div>
<div id="t-research" class="panel">${researchTab}</div>
<div id="t-report" class="panel">${reportTab}</div>
<div id="t-naver" class="panel">${naverTab}</div>
<div id="t-blogger" class="panel">${bloggerTab}</div>
<div id="t-wordpress" class="panel">${wpTab}</div>
<div id="t-ads" class="panel">${adsTab}</div>
<div id="t-site" class="panel">${siteTab}</div>

<script>
// 네이버 복붙 시스템 — 서식(text/html) 유지 복사
function copied(btn){var o=btn.textContent;btn.textContent='✅ 복사됨';btn.disabled=true;
  setTimeout(function(){btn.textContent=o;btn.disabled=false},1600)}
function copyText(btn,t){navigator.clipboard.writeText(t).then(function(){copied(btn)})
  .catch(function(){prompt('자동 복사가 막혔습니다. 아래 내용을 직접 복사하세요.',t)})}
async function copyDraft(btn,slug){
  try{
    var r=await fetch('naver/'+slug+'.frag.html',{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    var html=await r.text();
    var tmp=document.createElement('div');tmp.innerHTML=html;
    var plain=tmp.innerText;
    if(window.ClipboardItem&&navigator.clipboard.write){
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':new Blob([html],{type:'text/html'}),
        'text/plain':new Blob([plain],{type:'text/plain'})})]);
    }else{await navigator.clipboard.writeText(plain);}
    copied(btn);
  }catch(e){window.open('naver/'+slug+'.html','_blank');}
}
// 네이버 발행 할 일 — [발행완료] 체크(localStorage)로 오늘 할 일만 노출
function nvDone(cb,slug){try{localStorage.setItem('nvdone_'+slug,cb.checked?'1':'0')}catch(e){};nvLayout();}
function nvLayout(){
  var all=document.getElementById('nv-allbody'),todo=document.getElementById('nv-todobody');
  if(!all||!todo)return;
  var rows=[].slice.call(todo.querySelectorAll('tr')).concat([].slice.call(all.querySelectorAll('tr')));
  rows.sort(function(a,b){return (+a.getAttribute('data-idx'))-(+b.getAttribute('data-idx'))});
  rows.forEach(function(r){all.appendChild(r)});
  var picked=0,done='';
  rows.forEach(function(r){
    var s=r.getAttribute('data-slug');
    try{done=localStorage.getItem('nvdone_'+s)||''}catch(e){done=''}
    var cb=r.querySelector('.nvcb');if(cb)cb.checked=(done==='1');
    if(done!=='1'&&picked<4){todo.appendChild(r);picked++;}
  });
  var em=document.getElementById('nv-todoempty');if(em)em.style.display=picked?'none':'block';
  var cnt=document.getElementById('nv-allcount');
  if(cnt)cnt.textContent=all.querySelectorAll('tr').length;
}
nvLayout();
function showTab(key, btn){
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active')});
  document.querySelectorAll('.tabs button').forEach(function(b){b.classList.remove('active')});
  var el=document.getElementById('t-'+key); if(el) el.classList.add('active');
  if(!btn) btn=document.querySelector('.tabs button[data-tab="'+key+'"]');
  if(btn) btn.classList.add('active');
  if(history.replaceState) history.replaceState(null,'','#'+key);
}
document.addEventListener('DOMContentLoaded',function(){
  var h=(location.hash||'').replace('#','');
  showTab(document.querySelector('.tabs button[data-tab="'+h+'"]') ? h : 'all');
  // 위성 사이트 실시간 현황 조회 (해당 도메인의 /dashboard/data.json)
  document.querySelectorAll('.sitefetch').forEach(function(el){
    var base=el.getAttribute('data-url');
    fetch(base+'/dashboard/data.json',{cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error(r.status); return r.json();
    }).then(function(j){
      var s=j.summary||{};
      el.querySelector('.s-today').textContent='오늘 '+(s.today!=null?s.today:'?')+'편';
      el.querySelector('.s-week').textContent='최근7일 '+(s.last7d!=null?s.last7d:'?')+'편';
      el.querySelector('.s-posts').textContent='누적 '+(s.totalPosts!=null?s.totalPosts:'?')+'편';
      el.querySelector('.s-pool').textContent='남은주제 '+(s.poolTotal!=null?s.poolTotal:'?')+'개';
      var st=el.querySelector('.s-status');
      st.textContent='정상 운영 · 갱신 '+(s.generatedAt||'');
      st.className='s-status badge b-done';
    }).catch(function(){
      var st=el.querySelector('.s-status');
      st.textContent='접속 대기 (DNS 연결 전)';
      st.className='s-status badge b-todo';
    });
  });
});
</script>
</div></body></html>`;
}

// 발행 스케줄/기획안 → 다운로드용 파일 생성
function writePlanFiles(dir, plan, generatedAt) {
  const rows = plan.map((t, i) =>
    `| ${i + 1} | ${t.date} | ${t.title} | ${catName(t.category)} | ${(t.keywords || []).join(", ")} | ${t.source} |`
  );
  const md = `# 발행 기획안 · 스케줄 — ${site.name}\n\n생성일: ${generatedAt} · 매일 09:00·15:00·21:00(KST) 자동 발행 기준 예상 일정(하루 3편)\n\n` +
    `| # | 예정일 | 제목 | 카테고리 | 핵심 키워드 | 구분 |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
  fs.writeFileSync(path.join(dir, "plan.md"), md, "utf8");

  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = "﻿" + ["순번,예정일,제목,카테고리,핵심키워드,구분"]
    .concat(plan.map((t, i) =>
      [i + 1, t.date, t.title, catName(t.category), (t.keywords || []).join(" "), t.source].map(esc).join(",")
    )).join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "plan.csv"), csv, "utf8");
}

// 발행된 글의 원고(.md) — 수동 발행/검토/네이버용 복사
function writeDrafts(dir, posts) {
  const draftsDir = path.join(dir, "drafts");
  ensureDir(draftsDir);
  for (const p of posts) {
    const head = `# ${p.title}\n\n> ${p.description || ""}\n\n- 카테고리: ${catName(p.category)}\n- 게시일: ${p.date}\n- 키워드: ${(p.keywords || []).join(", ")}\n\n---\n\n`;
    fs.writeFileSync(path.join(draftsDir, `${p.slug}.md`), head + (p.body || "").trim() + "\n", "utf8");
  }
}

// 네이버용 통합 기획안 팩(스케줄 + 전체 원고를 한 파일로)
function writeNaverPack(dir, plan, posts) {
  let out = `# ${site.name} — 네이버 블로그용 기획안 & 원고 모음\n\n생성일: ${todayKST()}\n네이버는 자동 발행 API가 없어, 아래 원고를 복사해 네이버 에디터에 붙여넣어 발행하세요.\n\n`;
  out += `## 1) 발행 예정 스케줄\n\n| 예정일 | 제목 | 카테고리 | 구분 |\n|---|---|---|---|\n` +
    plan.map((t) => `| ${t.date} | ${t.title} | ${catName(t.category)} | ${t.source} |`).join("\n") + "\n\n";
  out += `## 2) 발행 완료 원고 (복사용)\n\n`;
  for (const p of posts) {
    out += `\n\n---\n\n### ${p.title}\n\n- 카테고리: ${catName(p.category)} · 게시일: ${p.date}\n- 키워드: ${(p.keywords || []).join(", ")}\n\n${(p.body || "").trim()}\n`;
  }
  fs.writeFileSync(path.join(dir, "naver-content-pack.md"), out, "utf8");
}

export function buildDashboard() {
  const data = collect();
  const dir = path.join(PUBLIC_DIR, "dashboard");
  ensureDir(dir);

  // 네이버 복붙 원고를 먼저 생성해 목록을 렌더에 전달
  const posts = loadPosts();
  data.naverDrafts = writeNaverDrafts(dir, posts);

  fs.writeFileSync(path.join(dir, "index.html"), render(data), "utf8");
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 2), "utf8");

  // 다운로드 산출물 (기획안·스케줄·원고)
  writePlanFiles(dir, data.plan, data.generatedAt);
  writeDrafts(dir, posts);
  writeNaverPack(dir, data.plan, posts);

  console.log(
    `[dashboard] 생성: /dashboard/ — 진척도 ${data.progress.pct}% ` +
    `(자동 ${data.progress.autoPass}/${data.progress.autoTotal}), 발행 ${data.publishing.totalPosts}편`
  );
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) buildDashboard();
