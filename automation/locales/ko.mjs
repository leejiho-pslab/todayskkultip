// =============================================================
//  UI 문자열 — 한국어 (default / kkultip 프로필)
//  ※ 기존 하드코딩 문자열을 그대로 옮긴 것 — 문구 변경 시 빌드 결과가 바뀐다.
// =============================================================

export const ko = {
  // ---- 내비게이션/공통 ----
  navSearch: "🔍 검색",
  breadcrumbAria: "현재 위치",
  breadcrumbHome: "홈",
  footerLinks: {
    about: "소개",
    author: "작성자",
    contact: "문의",
    privacy: "개인정보처리방침",
    terms: "이용약관",
    sitemap: "사이트맵",
  },
  footerDisclaimer:
    "본 사이트의 정보는 일반적인 참고용이며, 제도·요금·신청 기준은 변경될 수 있으니\n      반드시 해당 기관의 공식 안내를 확인하시기 바랍니다.\n      본 사이트는 제휴 광고를 통해 수익을 얻을 수 있습니다.",

  // ---- 글 페이지 ----
  toc: "목차",
  faqHeading: "자주 묻는 질문",
  summaryLabel: "핵심 요약",
  publishedOn: "게시일",
  reviewedOn: "최종 검토",
  relatedInline: "📌 함께 보면 좋은 글",
  relatedHeading: "함께 보면 좋은 글",
  newerPost: "← 다음 글",
  olderPost: "이전 글 →",
  recentPosts: "🕐 최신 글",
  categoriesWidget: "🗂 카테고리",

  // ---- 목록/페이저 ----
  pagerPrev: "‹ 이전",
  pagerNext: "다음 ›",
  pageTitleSuffix: (page) => ` (${page}페이지)`,
  emptyIndex: "아직 발행된 글이 없습니다. 곧 새로운 정보로 찾아뵙겠습니다.",
  categoryTitle: (name) => `${name} 정보 모음`,
  emptyCategory: "이 카테고리에는 아직 글이 없습니다.",
  tagTitle: (tag) => `${tag} 관련 글`,
  tagDesc: (tag, niche) => `${tag} 태그가 붙은 ${niche} 글 모음`,

  // ---- 검색 ----
  search: {
    title: "검색",
    desc: (siteName) => `${siteName} 사이트 내 검색`,
    heading: "검색",
    placeholder: "찾고 싶은 정보를 입력하세요 (예: 전기요금, 지원금)",
    hint: "검색어를 입력하면 결과가 표시됩니다.",
    noResults: "'{q}' 검색 결과가 없습니다.",
  },

  // ---- 404 ----
  notFound: {
    title: "페이지를 찾을 수 없습니다 (404)",
    desc: "요청하신 페이지를 찾을 수 없습니다.",
    body: "요청하신 페이지를 찾을 수 없습니다.",
    home: "홈으로 돌아가기",
  },

  // ---- 발행 채널(블로거/WP) 공용 푸터 ----
  syndicationFooter: (canonical, siteName) =>
    `※ 제도·요금·신청 기준은 변경될 수 있으니 공식 누리집을 확인하세요.<br>\n이 글의 원문은 <a href="${canonical}">${siteName}</a>에 처음 게시되었습니다.`,

  // ---- llms.txt ----
  llms: ({ site, absUrl }, cats, recent) => `# ${site.name}

> ${site.description}

${site.name}는 ${site.niche} 분야의 정보를 공식 자료 기반으로 검증해 제공합니다.
운영: ${site.author}. 언어: 한국어.

## 카테고리
${cats}

## 최근 콘텐츠
${recent}

## 안내
- 모든 콘텐츠는 공식 기관 자료 확인을 권장합니다(제도·요금은 변동 가능).
- 인용 시 출처로 ${site.name}(${absUrl("/")})를 표기해 주세요.
`,

  // ---- 정적 페이지 본문 ----
  pages: {
    about: ({ site, esc }) => ({
      title: "사이트 소개",
      desc: `${site.name} 소개`,
      html: `<article class="post"><h1>사이트 소개</h1>
      <p>${esc(site.name)}는 ${esc(site.description)}</p>
      <p>${esc(site.niche)} 분야의 정보를 쉽고 정확하게 전달하는 것을 목표로 합니다.</p>
      <h2>운영 원칙</h2>
      <ul>
        <li>정확한 정보 제공을 위해 공식 출처 확인을 권장합니다.</li>
        <li>제도·요금 정보는 변경될 수 있어 최신 공식 안내를 함께 안내합니다.</li>
        <li>독자에게 도움이 되는 콘텐츠를 최우선으로 합니다.</li>
      </ul>
    </article>`,
    }),

    author: ({ site, esc }) => {
      const ap = site.authorProfile || {};
      return {
        title: `${ap.name} - 작성자 소개`,
        desc: ap.bio,
        html: `<article class="post"><h1>${esc(ap.name)}</h1>
      <p class="meta">${esc(ap.jobTitle || "")}</p>
      <p>${esc(ap.bio || "")}</p>
      <h2>편집 원칙</h2>
      <ul>
        <li>공식 기관(정부·지자체·공공기관) 자료를 우선 확인합니다.</li>
        <li>제도·요금 등 변동 정보는 기준 시점과 출처를 함께 안내합니다.</li>
        <li>독자가 바로 활용할 수 있도록 실용성과 정확성을 우선합니다.</li>
      </ul>
    </article>`,
      };
    },

    privacy: ({ site, url, esc }) => ({
      title: "개인정보처리방침",
      desc: `${site.name} 개인정보처리방침`,
      html: `<article class="post"><h1>개인정보처리방침</h1>
      <p>${esc(site.name)}(이하 "사이트")는 이용자의 개인정보를 소중히 다루며, 회원가입·직접적인 개인정보
         수집 절차를 두지 않습니다. 다만 광고 및 트래픽 분석을 위해 아래와 같이 쿠키가 사용될 수 있습니다.</p>

      <h2>1. 수집하는 정보</h2>
      <p>사이트는 이름·연락처 등 개인식별정보를 직접 수집하지 않습니다. 방문 분석·광고 게재 과정에서
         브라우저 종류, 방문 페이지, 대략적 위치 등 비식별 정보가 쿠키를 통해 수집될 수 있습니다.</p>

      <h2>2. 쿠키(Cookie) 사용</h2>
      <p>쿠키는 이용자 브라우저에 저장되는 작은 텍스트 파일입니다. 이용자는 브라우저 설정에서 쿠키 저장을
         거부하거나 삭제할 수 있으며, 이 경우 일부 기능 이용에 제한이 있을 수 있습니다.</p>

      <h2>3. 제3자 광고 및 DART 쿠키 (Google AdSense)</h2>
      <ul>
        <li>본 사이트는 Google 등 제3자 광고 사업자의 광고를 게재합니다.</li>
        <li>Google을 포함한 제3자 광고 사업자는 <strong>쿠키(DART 쿠키 등)</strong>를 사용하여 이용자의
            이전 방문 기록을 바탕으로 맞춤형 광고를 제공합니다.</li>
        <li>이용자는 <a href="https://policies.google.com/technologies/ads" rel="nofollow" target="_blank">Google 광고 정책</a> 및
            <a href="https://www.google.com/settings/ads" rel="nofollow" target="_blank">Google 광고 설정</a>에서
            맞춤형 광고를 해제할 수 있습니다.</li>
        <li>제3자 공급업체의 쿠키 사용은 <a href="https://www.aboutads.info" rel="nofollow" target="_blank">aboutads.info</a>에서
            일괄 해제할 수 있습니다.</li>
      </ul>

      <h2>4. 분석 도구</h2>
      <p>본 사이트는 방문 통계 분석을 위해 Google Analytics(GA4)를 사용합니다. 수집된 데이터는 통계 목적의
         비식별 정보이며, 개인을 특정하지 않습니다.</p>

      <h2>5. 아동의 개인정보</h2>
      <p>본 사이트는 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 고의로 수집하지 않습니다.</p>

      <h2>6. 방침 변경 및 문의</h2>
      <p>본 방침은 관련 법령 및 서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해 고지합니다.
         개인정보 관련 문의는 <a href="${url("/contact/")}">문의 페이지</a>를 이용해 주세요.</p>
    </article>`,
    }),

    terms: ({ site, url, esc }) => ({
      title: "이용약관 및 면책조항",
      desc: `${site.name} 이용약관 및 면책조항`,
      html: `<article class="post"><h1>이용약관 및 면책조항</h1>
      <h2>1. 목적</h2>
      <p>본 약관은 ${esc(site.name)}(이하 "사이트")가 제공하는 콘텐츠 이용에 관한 조건을 규정합니다.</p>
      <h2>2. 콘텐츠의 성격 및 면책</h2>
      <ul>
        <li>사이트의 모든 정보는 <strong>일반적인 참고용</strong>이며, 법률·세무·의료·금융 등 전문적 조언을 대체하지 않습니다.</li>
        <li>제도·요금·지원금·신청 기준 등은 수시로 변경될 수 있으므로, 실제 이용 전 반드시 <strong>해당 기관의 공식 안내</strong>를 확인하시기 바랍니다.</li>
        <li>사이트는 정보의 정확성·완전성을 위해 노력하지만, 이를 보증하지 않으며 정보 이용으로 발생한 손해에 대해 책임지지 않습니다.</li>
      </ul>
      <h2>3. 저작권</h2>
      <p>사이트에 게시된 콘텐츠의 저작권은 ${esc(site.name)}에 있으며, 무단 복제·배포를 금합니다. 인용 시 출처를 표기해 주세요.</p>
      <h2>4. 광고</h2>
      <p>사이트는 제3자 광고를 게재하며, 이를 통해 운영 수익을 얻을 수 있습니다. 광고 관련 쿠키 정책은
         <a href="${url("/privacy/")}">개인정보처리방침</a>을 참고하세요.</p>
      <h2>5. 문의</h2>
      <p>약관 관련 문의는 <a href="${url("/contact/")}">문의 페이지</a>를 이용해 주세요.</p>
    </article>`,
    }),

    contact: ({ site, esc }) => ({
      title: "문의하기",
      desc: `${site.name} 문의 안내`,
      html: `<article class="post"><h1>문의하기</h1>
      <p>${esc(site.name)}에 대한 문의, 정보 정정 요청, 제휴 제안은 아래로 연락해 주세요.</p>
      ${site.contactEmail
        ? `<p><strong>이메일:</strong> <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a></p>`
        : `<p>이메일: 준비 중입니다. (운영자가 곧 연락처를 안내할 예정입니다.)</p>`}
      <h2>정보 정정 안내</h2>
      <p>본 사이트의 정보는 공식 자료를 바탕으로 작성하지만, 제도·요금·신청 기준은 수시로 바뀔 수 있습니다.
         잘못된 정보를 발견하시면 알려주시면 신속히 확인·수정하겠습니다.</p>
    </article>`,
    }),
  },
};

export default ko;
