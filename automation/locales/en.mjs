// =============================================================
//  UI strings — English (jype profile: global audience site)
//  Keep keys in sync with locales/ko.mjs.
// =============================================================

export const en = {
  // ---- Navigation / common ----
  navSearch: "🔍 Search",
  breadcrumbAria: "Breadcrumb",
  breadcrumbHome: "Home",
  footerLinks: {
    about: "About",
    author: "Our Team",
    contact: "Contact",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    sitemap: "Sitemap",
  },
  footerDisclaimer:
    "The information on this site is for general reference only. Schedules, prices, and policies may change —\n      always check official sources before making plans or purchases.\n      This site may earn revenue through advertising.",

  // ---- Post page ----
  toc: "Table of Contents",
  faqHeading: "Frequently Asked Questions",
  summaryLabel: "Key Takeaways",
  publishedOn: "Published",
  reviewedOn: "Last reviewed",
  relatedInline: "📌 You might also like",
  relatedHeading: "You might also like",
  newerPost: "← Newer post",
  olderPost: "Older post →",
  recentPosts: "🕐 Recent posts",
  categoriesWidget: "🗂 Categories",

  // ---- Lists / pager ----
  pagerPrev: "‹ Prev",
  pagerNext: "Next ›",
  pageTitleSuffix: (page) => ` (page ${page})`,
  emptyIndex: "No posts yet — fresh stories about Korea are coming soon.",
  categoryTitle: (name) => `${name} — Articles`,
  emptyCategory: "No posts in this category yet.",
  tagTitle: (tag) => `Posts tagged "${tag}"`,
  tagDesc: (tag, niche) => `Articles about ${niche} tagged "${tag}"`,

  // ---- Search ----
  search: {
    title: "Search",
    desc: (siteName) => `Search ${siteName}`,
    heading: "Search",
    placeholder: "Search for anything about Korea (e.g. Seoul itinerary, K-pop)",
    hint: "Start typing to see results.",
    noResults: 'No results for "{q}".',
  },

  // ---- 404 ----
  notFound: {
    title: "Page not found (404)",
    desc: "The page you requested could not be found.",
    body: "The page you requested could not be found.",
    home: "Back to home",
  },

  // ---- Syndication footer (Blogger/WP republish) ----
  syndicationFooter: (canonical, siteName) =>
    `※ Schedules, prices, and policies may change — please check official sources.<br>\nThis article was originally published on <a href="${canonical}">${siteName}</a>.`,

  // ---- llms.txt ----
  llms: ({ site, absUrl }, cats, recent) => `# ${site.name}

> ${site.description}

${site.name} covers ${site.niche} for a global audience, fact-checked against official sources.
Published by ${site.author}. Language: English.

## Categories
${cats}

## Recent content
${recent}

## Notes
- Details like schedules, prices, and policies can change — always verify with official sources.
- When quoting, please credit ${site.name} (${absUrl("/")}).
`,

  // ---- Static pages ----
  pages: {
    about: ({ site, esc }) => ({
      title: "About",
      desc: `About ${site.name}`,
      html: `<article class="post"><h1>About ${esc(site.name)}</h1>
      <p>${esc(site.description)}</p>
      <p>Our goal is to make ${esc(site.niche)} easy to understand and genuinely useful for readers around the world.</p>
      <h2>Our principles</h2>
      <ul>
        <li>We verify facts against official sources and link to them.</li>
        <li>Schedules, prices, and policies change — we note when information was last checked.</li>
        <li>Reader value comes first, always.</li>
      </ul>
    </article>`,
    }),

    author: ({ site, esc }) => {
      const ap = site.authorProfile || {};
      return {
        title: `${ap.name} — About the Team`,
        desc: ap.bio,
        html: `<article class="post"><h1>${esc(ap.name)}</h1>
      <p class="meta">${esc(ap.jobTitle || "")}</p>
      <p>${esc(ap.bio || "")}</p>
      <h2>Editorial principles</h2>
      <ul>
        <li>We check official sources (government, tourism boards, official artist/brand channels) first.</li>
        <li>Time-sensitive information includes an "as of" date and a source.</li>
        <li>We prioritize accuracy and practical usefulness for international readers.</li>
      </ul>
    </article>`,
      };
    },

    privacy: ({ site, url, esc }) => ({
      title: "Privacy Policy",
      desc: `${site.name} Privacy Policy`,
      html: `<article class="post"><h1>Privacy Policy</h1>
      <p>${esc(site.name)} ("the Site") respects your privacy. We do not require registration and do not
         directly collect personal information. However, cookies may be used for advertising and traffic
         analysis as described below.</p>

      <h2>1. Information we collect</h2>
      <p>The Site does not directly collect personally identifiable information such as names or contact
         details. Non-identifying information — browser type, pages visited, approximate location — may be
         collected via cookies for analytics and ad serving.</p>

      <h2>2. Cookies</h2>
      <p>Cookies are small text files stored in your browser. You can refuse or delete cookies in your
         browser settings; some features may be limited as a result.</p>

      <h2>3. Third-party advertising and DART cookies (Google AdSense)</h2>
      <ul>
        <li>This site displays ads served by third-party vendors, including Google.</li>
        <li>Third-party vendors, including Google, use <strong>cookies (such as the DART cookie)</strong> to serve
            personalized ads based on your prior visits to this and other websites.</li>
        <li>You can opt out of personalized advertising via
            <a href="https://policies.google.com/technologies/ads" rel="nofollow" target="_blank">Google's ads policy</a> and
            <a href="https://www.google.com/settings/ads" rel="nofollow" target="_blank">Google Ads Settings</a>.</li>
        <li>You can opt out of some third-party cookies at
            <a href="https://www.aboutads.info" rel="nofollow" target="_blank">aboutads.info</a>.</li>
      </ul>

      <h2>4. Analytics</h2>
      <p>This site uses Google Analytics (GA4) for aggregate visit statistics. The data collected is
         non-identifying and used for statistical purposes only.</p>

      <h2>5. Children's privacy</h2>
      <p>This site is not directed at children under 14 and does not knowingly collect their personal
         information.</p>

      <h2>6. Changes and contact</h2>
      <p>This policy may be updated as laws or services change; updates will be posted on this page.
         For privacy questions, please use the <a href="${url("/contact/")}">contact page</a>.</p>
    </article>`,
    }),

    terms: ({ site, url, esc }) => ({
      title: "Terms of Use & Disclaimer",
      desc: `${site.name} Terms of Use & Disclaimer`,
      html: `<article class="post"><h1>Terms of Use &amp; Disclaimer</h1>
      <h2>1. Purpose</h2>
      <p>These terms govern the use of content provided by ${esc(site.name)} ("the Site").</p>
      <h2>2. Nature of content &amp; disclaimer</h2>
      <ul>
        <li>All information on the Site is for <strong>general reference only</strong> and is not a substitute for
            professional legal, medical, financial, or travel advice.</li>
        <li>Schedules, prices, opening hours, and policies change frequently — always confirm with
            <strong>official sources</strong> before relying on any information.</li>
        <li>We strive for accuracy and completeness but do not guarantee them, and we are not liable for
            losses arising from the use of this information.</li>
      </ul>
      <h2>3. Copyright</h2>
      <p>Content published on the Site is copyrighted by ${esc(site.name)}. Unauthorized reproduction or
         redistribution is prohibited. Please credit the source when quoting.</p>
      <h2>4. Advertising</h2>
      <p>The Site displays third-party advertising, which may generate revenue. See our
         <a href="${url("/privacy/")}">Privacy Policy</a> for cookie details.</p>
      <h2>5. Contact</h2>
      <p>For questions about these terms, please use the <a href="${url("/contact/")}">contact page</a>.</p>
    </article>`,
    }),

    contact: ({ site, esc }) => ({
      title: "Contact",
      desc: `Contact ${site.name}`,
      html: `<article class="post"><h1>Contact</h1>
      <p>For questions, corrections, or partnership inquiries about ${esc(site.name)}, please reach out below.</p>
      ${site.contactEmail
        ? `<p><strong>Email:</strong> <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a></p>`
        : `<p>Email: coming soon. (A contact address will be published shortly.)</p>`}
      <h2>Corrections</h2>
      <p>We fact-check against official sources, but details can change. If you spot something outdated or
         incorrect, let us know and we'll review and fix it promptly.</p>
    </article>`,
    }),
  },
};

export default en;
