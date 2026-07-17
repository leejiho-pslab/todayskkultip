// =============================================================
//  사이트 프로필: kkultip — todayskkultip.co.kr
//  컨셉: 재테크·절약·금융 "머니 꿀팁" (한국어)
//  기존 오늘의 꿀팁(생활정보 전반)과 구조는 동일, 니치만 '돈' 중심으로 차별화.
//  국내 애드센스 CPC 최상위 분야(금융·보험·카드·재테크)를 겨냥한다.
//
//  사용법: 이 레포를 템플릿으로 복제한 레포에서 Variables 에
//    SITE_PROFILE=kkultip, SITE_URL=https://todayskkultip.co.kr,
//    SITE_CNAME=todayskkultip.co.kr 를 등록하면 이 프로필로 동작한다.
// =============================================================

export default {
  // SITE_URL 환경변수가 없을 때 사용할 이 프로필의 기본 배포 URL
  url: "https://todayskkultip.co.kr",

  overrides: {
    name: "오늘의 머니꿀팁",
    tagline: "돈이 모이는 재테크·절약·금융 꿀팁",
    description:
      "예적금·카드 혜택, 세금 환급, 연말정산, 절약 노하우, 정부 금융지원까지 — 내 돈을 지키고 불리는 재테크 정보를 매일 발행합니다.",
    author: "오늘의 머니꿀팁 편집부",

    niche: "재테크/금융/절약",
    // 기본(starship 도메인용) 비제휴 고지문은 이 도메인과 무관하므로 제거
    disclaimerExtra: "",
    categories: [
      { slug: "invest", name: "재테크·투자", desc: "예적금, 파킹통장, ISA, 연금, 초보 투자 가이드" },
      { slug: "save", name: "절약·알뜰", desc: "고정비 줄이기, 통신비·구독료 다이어트, 알뜰 소비" },
      { slug: "card", name: "카드·금융상품", desc: "신용·체크카드 혜택, 페이 적립, 금융상품 비교" },
      { slug: "tax", name: "세금·연말정산", desc: "연말정산 공제, 세금 환급, 절세 방법" },
      { slug: "benefit", name: "금융지원·혜택", desc: "정부 금융지원, 청년·서민 금융상품, 숨은 돈 찾기" },
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
      name: "오늘의 머니꿀팁 편집부",
      jobTitle: "재테크·금융 에디터",
      bio: "재테크·세금·금융상품 정보를 공식 자료(금융감독원·국세청 등) 기반으로 검증해 쉽게 전달합니다.",
    },

    channels: {
      // 이 레포(사이트)만 우선 운영 — 블로거는 이 사이트용 블로그를 만들고
      // BLOGGER_BLOG_ID 시크릿을 등록하면 자동 활성화된다
      blogger: {
        enabled: !!process.env.BLOGGER_BLOG_ID,
        defaultLabels: ["재테크", "머니꿀팁"],
      },
      wordpress: { enabled: false },
    },

    brandmark: { emoji: "💰", line1: "오늘의", line2: "머니꿀팁", chip: "편집부", logoWord: "머니" },
  },
};
