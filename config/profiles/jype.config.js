// =============================================================
//  사이트 프로필: jype — jype.ai.kr
//  컨셉: 해외(영어권) 대상 한국 콘텐츠 — K-pop/드라마, 음식, 여행, 문화, 트렌드
//  모든 포스팅은 영어로 발행한다. 영어는 애드센스 광고주 풀·CPC 가 가장 큰
//  언어권(미국 등)을 커버해 글당 기대 수익이 가장 높다.
//
//  사용법: 이 레포를 템플릿으로 복제한 레포에서 Variables 에
//    SITE_PROFILE=jype, SITE_URL=https://jype.ai.kr,
//    SITE_CNAME=jype.ai.kr 를 등록하면 이 프로필로 동작한다.
// =============================================================

export default {
  // SITE_URL 환경변수가 없을 때 사용할 이 프로필의 기본 배포 URL
  url: "https://jype.ai.kr",

  overrides: {
    name: "Korea Unboxed",
    tagline: "K-culture, food, travel & trends — everything Korea, unboxed",
    // 네이버 서치어드바이저 권장 길이(≤80자)에 맞춘 짧은 설명. og:description 도 이 값을 씀.
    description:
      "Your English guide to Korea: K-pop, K-drama, food, travel & daily life.",
    lang: "en",
    locale: "en_US",
    author: "Korea Unboxed Editorial Team",

    niche: "Korean culture, travel & trends",
    // 사칭·혼동 방지 고지 — 도메인(jype.ai.kr)이 JYP 엔터테인먼트로 오인될 수 있어 비제휴 명시
    disclaimerExtra:
      "Korea Unboxed is an independent media site. We are not affiliated with, endorsed by, or connected to JYP Entertainment or any other entertainment company.",
    categories: [
      { slug: "entertainment", name: "K-Pop & K-Drama", desc: "K-pop groups and agencies (auditions, tours, tickets, fandom how-tos), K-dramas and celebrities" },
      { slug: "food", name: "Korean Food", desc: "Korean dishes, recipes, street food, and where to eat like a local" },
      { slug: "travel", name: "Travel Korea", desc: "Itineraries, hidden gems, transport tips, and seasonal travel guides" },
      { slug: "culture", name: "Culture & Life", desc: "Korean customs, language, etiquette, and everyday life explained" },
      { slug: "trends", name: "Trends & Buzz", desc: "What's trending in Korea right now — beauty, tech, lifestyle, and viral topics" },
    ],

    // 분석/검증 값은 이 도메인 전용으로 새로 발급 — 기본(starship) 값이 새 도메인에
    // 새어 들어가지 않도록 환경변수 없으면 비움
    analytics: {
      ga4: process.env.GA4_ID || "",
      naverWebmaster: process.env.NAVER_SITE_VERIFICATION || "",
      naverVerificationFile: process.env.NAVER_VERIFICATION_FILE || "",
      googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || "",
      bingVerification: process.env.BING_VERIFICATION || "",
    },

    authorProfile: {
      name: "Korea Unboxed Editorial Team",
      jobTitle: "Korea Culture & Travel Editor",
      bio: "We cover Korean culture, food, travel, and trends for a global audience, fact-checked against official sources like VisitKorea and Korea.net.",
    },

    // 해외 대상 사이트 — 국내 제휴(쿠팡/네이버)는 사용하지 않음
    affiliate: {
      naverConnect: { enabled: false, partnerId: "" },
      coupang: { enabled: false, partnerId: "" },
    },

    channels: {
      blogger: {
        enabled: !!process.env.BLOGGER_BLOG_ID,
        defaultLabels: ["Korea", "K-culture"],
      },
      wordpress: { enabled: false },
    },

    publishing: {
      // 영어 글 목표 분량 (단어 수 기준)
      targetWords: 1400,
    },

    // 영어 발행용 고정 작성 기준 (생성 프롬프트에 삽입)
    editorialBaseline: [
      "Use at least 4 images per post (hero + one per section — the system inserts them automatically; write descriptive section headings).",
      "Always cite sources: name + https link to official/reputable sites (VisitKorea, Korea.net, official artist/brand pages), with an 'as of' date for figures.",
      "Put the key takeaway/conclusion at the very top, then expand with details.",
      "Write in a natural, first-person native-English voice (like a friend who lives in Korea), not a machine-generated listicle tone.",
    ],

    brandmark: { emoji: "🇰🇷", line1: "KOREA", line2: "UNBOXED", chip: "EST. 2026", logoWord: "KU" },
  },
};
