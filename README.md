# 오늘의 꿀팁 — 생활정보 SEO 수익화 사이트 (100% 자동 발행)

생활정보/꿀팁 니치의 **SEO 최적화 콘텐츠를 자동 생성·발행**하고, 배너 광고
(애드센스·타뷸라 등)로 수익화하는 정적 사이트 + 자동화 파이프라인입니다.

- **채널 연결 우선순위**: ① 네이버 블로그(수동) → ② 구글 블로거(Blogger API) → ③ 워드프레스(REST API)
- **수익화(수익 도달 속도 순, 병렬 시작)**: ① 네이버 쇼핑커넥트(심사 없음, 즉시) → ② 쿠팡 파트너스(가입 즉시) → ③ AdSense(커스텀 도메인 필수, 심사 2~4주) → ④ 네이버 애드포스트(블로그 90일+ 운영)
- **콘텐츠**: 월별 **시즌성/시의성** 주제를 Claude API로 자동 생성
- **자동화**: GitHub Actions 크론으로 생성→빌드→배포→발행까지 무인 운영(하루 3회)
- **네이버 블로그**: 공식 글쓰기 API 부재로 대시보드에서 원고 다운로드 후 다듬어 수동 발행(그대로 복붙 금지 — 유사문서·애드포스트 심사 리스크)

> 📌 **처음 설정하시나요?** → [docs/SETUP.md](docs/SETUP.md) 에 사용자가 해야 할
> 단계(GitHub Pages 활성화·시크릿 등록·애드센스·검색엔진 등록·블로거 연동·도메인)가
> 순서대로 정리돼 있습니다.
>
> 🦴 **전체 구조 보기** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (데이터 흐름·디렉터리·채널·자동화)
> · 뼈대 상태 점검: `npm run check` (설정·콘텐츠·산출물·SEO/GEO·채널 준비도 리포트)

```
config/
  site.config.js              # 사이트/광고/채널/SEO/브랜드/작성자 전역 설정
  topics/seasonal-topics.json # 월별 시즌성 주제 풀 (1~12월)
  geo-checklist.json          # SEO+GEO 체크리스트 (자동/수동 항목)
automation/
  topic-picker.mjs            # 날짜 기반 시즌 주제 선택
  generate.mjs                # Claude API 글 생성 → content/posts/*.md
  build.mjs                   # 마크다운 → public/ 정적 사이트 + SEO 산출물 + 대시보드
  publish-blogger.mjs         # 구글 블로거 발행
  trend.mjs                   # (선택) 네이버 DataLab 트렌드로 주제 우선순위 보정
  indexnow.mjs                # IndexNow 즉시 인덱싱 핑
  audit.mjs                   # 빌드 결과물 실시간 SEO/GEO 자동 검사
  dashboard.mjs               # 발행/SEO·GEO 모니터링 대시보드 생성
  run-all.mjs                 # 전체 파이프라인 오케스트레이터
  render.mjs / lib.mjs        # 렌더링(스키마/광고)/유틸
src/styles/main.css           # 사이트 스타일
content/posts/*.md            # 생성된 글 (frontmatter + 본문)
public/                       # 빌드 결과물 (배포 대상, git 미추적)
  dashboard/                  # 운영 대시보드 (noindex)
  llms.txt / sitemap.xml / robots.txt / rss.xml
.github/workflows/publish.yml # 자동 발행 워크플로우
```

## 빠른 시작 (로컬)

```bash
npm install
cp .env.example .env        # 값 채우기 (최소 ANTHROPIC_API_KEY)

npm run topic               # 오늘 뽑힐 시즌 주제 미리보기
npm run generate            # 글 1편 자동 생성 (ANTHROPIC_API_KEY 필요)
npm run build               # 정적 사이트 빌드 → public/
npm run serve               # http://localhost:8080 미리보기
```

`ANTHROPIC_API_KEY` 없이도 `npm run build`는 동작합니다(샘플 글로 빌드 확인 가능).

## 배포: GitHub Pages 설정

1. 저장소 **Settings → Pages → Source** 를 **"GitHub Actions"** 로 설정
2. **Settings → Secrets and variables → Actions** 에 값 등록
   - **Secrets** (민감값): `ANTHROPIC_API_KEY`, (블로거 사용 시) `BLOGGER_*`
   - **Variables** (공개 가능값): `SITE_URL`, `SITE_BASE_PATH`, `ADSENSE_CLIENT`,
     `ADSENSE_SLOT_*`, `TABOOLA_PUBLISHER`, `GA4_ID`, `GOOGLE_SITE_VERIFICATION` 등
3. `publish.yml` 이 **기본 브랜치**에 있어야 크론(매일 09:00·15:00·21:00 KST)이 동작합니다.
4. 수동 실행: **Actions → 자동 발행 → Run workflow** (생성 글 수/발행 여부 선택)

> 프로젝트 페이지(`<user>.github.io/site`)는 `SITE_BASE_PATH=/site`.
> 커스텀 도메인 사용 시 `SITE_CNAME` 설정 + `SITE_BASE_PATH=` (빈 값).

## 수익화 설정 (수익 도달 속도 순 — 오늘 병렬 시작 권장)

| 순서 | 채널 | 수익까지 | 설정 항목 |
| --- | --- | --- | --- |
| ① | **네이버 쇼핑커넥트** (제휴) | 즉시 — 심사 없이 가입, 수수료 최대 30~50% | `NAVER_CONNECT_ID` |
| ② | **쿠팡 파트너스** (제휴) | 수일 — 가입 즉시 링크 발급 | `COUPANG_PARTNER_ID` |
| ③ | **Google AdSense** (배너) | 2~4주 심사 · **커스텀 도메인 필수** | `ADSENSE_CLIENT`, `ADSENSE_SLOT_*` |
| ④ | **네이버 애드포스트** (네이버 블로그) | 90일+ 운영 실적 심사 | (사이트 코드 불필요) |
| 후순위 | **Taboola** (추천위젯) | 트래픽 요건(월 수만 PV+) | `TABOOLA_PUBLISHER` |

- ⚠️ **AdSense는 루트 도메인만 등록 가능** — `github.io` 하위 주소로는 신청 불가.
  커스텀 도메인 연결(SETUP STEP 10)이 애드센스의 전제조건입니다.
- ℹ️ 네이버 블로거용 제휴의 정식 명칭은 **쇼핑커넥트**(브랜드커넥트 크리에이터 스페이스에서
  심사 없이 가입)입니다. "쇼핑파트너센터"는 스마트스토어 **판매자**용 입점 센터로 별개입니다.
- ID가 비어있거나 `XXXX` placeholder면 해당 광고는 렌더링되지 않습니다(빈 슬롯 없음).
  본문 중간 광고는 두 번째 소제목(H2) 앞에 자동 삽입, AdSense 자동광고(`autoAds`)는 기본 활성화.
- **제휴 고지 자동화**: 글 frontmatter에 `affiliate: ["coupang"]`을 추가하면 정책상 필수인
  고지 문구가 글 상단에 자동 삽입됩니다(`automation/render.mjs`의 `affiliateDisclosure()`,
  `config/site.config.js > affiliate`에 네트워크 추가 시 자동 지원).
- 블로거/워드프레스 발행본에는 **원문 링크**가 자동 포함되어 자체 사이트가 원본으로
  인식되도록 합니다(중복 콘텐츠 상호 잠식 방지).
- 상품 추천형 콘텐츠 기획·자동 태깅은 다음 라운드(주제·자동화 재기획)에서 다룹니다.

## 구글 블로거 연동 (선택)

블로거는 사용자 OAuth2(refresh token)가 필요합니다.

1. Google Cloud Console에서 프로젝트 생성 → **Blogger API v3** 사용 설정
2. OAuth 클라이언트(데스크톱 앱) 생성 → `client_id`, `client_secret` 확보
3. `https://www.googleapis.com/auth/blogger` 스코프로 동의 후 **refresh token** 발급
   (OAuth Playground 또는 일회성 스크립트 사용)
4. 블로거 관리페이지 URL의 `blogID=` 값이 `BLOGGER_BLOG_ID`
5. Secrets에 `BLOGGER_CLIENT_ID/SECRET/REFRESH_TOKEN/BLOG_ID` 등록 후
   워크플로우 입력 `publish_blogger=true` (또는 변수 `PUBLISH_BLOGGER=true`)

발행된 글은 frontmatter `published.blogger: true`로 표시되어 중복 발행을 막습니다.

## SEO · GEO 최적화 (체크리스트 기반)

업로드된 **SEO + GEO(생성형 엔진 최적화) 체크리스트**를 `config/geo-checklist.json`
으로 구조화하고, 코드로 구현 가능한 항목은 사이트에 반영했습니다.

**자동 반영(코드)** — 빌드 시 적용되고 `audit.mjs`가 실시간 검증:
- 크롤링/인덱싱: sitemap(`<lastmod>` 포함)·robots.txt(AI/LLM 크롤러 명시 허용)·HTML 우선
- 구조화 데이터: Organization·WebSite·Article·BreadcrumbList·FAQPage·Person(author) JSON-LD
- 시맨틱 HTML5(header/nav/main/article/section), H1→H2 계층, 모바일 반응형, HTTPS
- 콘텐츠: 첫 문단 키워드·TL;DR 요약박스·굵게 강조·표·외부출처 2+·내부 CTA·게시/검토일
- GEO: `llms.txt`(LLM 친화 요약), IndexNow 즉시 인덱싱(키 설정 시)

**수동 항목(오프사이트)** — 대시보드에서 진행 상태 관리:
- GSC/Bing 등록·사이트맵 제출, Core Web Vitals 측정, 브랜드 엔티티(SNS/위키),
  리뷰·UGC·백링크·브랜드 멘션, AI 검색 가시성 추적 등
- `config/geo-checklist.json`의 각 항목 `status`를 `todo`→`done`(또는 `na`)으로 수정하면
  대시보드 진척도에 반영됩니다.

## 브랜드/대표 이미지 (자동 생성)

로고·기본 OG·파비콘과 글별 대표(커버) 이미지를 headless Chrome로 생성합니다
(한글은 Pretendard 폰트, 결과 PNG는 `src/assets/`에 커밋).

```bash
npm run images          # 로고 + 기본 OG + 파비콘 + 모든 글 커버 생성
node automation/images.mjs brand    # 브랜드 에셋만
node automation/images.mjs covers   # 글 커버만
```

- 각 글은 `frontmatter.image`/`imageAlt`로 대표 이미지를 가지며, 빌드 시
  실제 파일이 있으면 **히어로 이미지 + og:image + 목록 썸네일 + Article 스키마 image**로 사용됩니다(없으면 기본 OG로 폴백, 깨진 이미지 없음).
- `generate.mjs`는 새 글 생성 시 커버를 자동 생성하려 시도합니다(Chrome 미가용 환경에서는 건너뜀).
- CI(GitHub Actions)에서 커버까지 자동 생성하려면 워크플로우에 Chrome 설치 스텝을 추가하고
  `CHROME_BIN`을 지정하세요. (미설정 시 글은 기본 OG로 정상 발행됩니다.)

## 운영 대시보드 (발행 + SEO/GEO 모니터링)

빌드 시 `public/dashboard/index.html`이 자동 생성됩니다(`noindex`).

```bash
npm run build      # 대시보드 포함 생성
npm run dashboard  # 대시보드만 재생성 (빌드 후)
npm run audit      # 자동 검사 결과를 콘솔로 확인
npm run serve      # http://localhost:8080/dashboard/ 에서 확인
```

대시보드 표시 내용:
- **발행 현황**: 총 글 수, 채널별(사이트/블로거), 카테고리별·월별 추이, 최근 발행 목록
- **SEO·GEO 진척도**: 전체 %, 자동 검사 통과 수, 수동 항목 완료 수, 카테고리별 상세

> 대시보드는 noindex이지만 URL을 알면 접근 가능합니다. 완전 비공개가 필요하면
> 배포에서 제외하거나(빌드 후 `public/dashboard` 삭제) 접근 제어를 적용하세요.

## 고정 작성 기준 (모든 글에 항상 적용)

`config/site.config.js` 의 `editorialBaseline` 에 정의되어 **모든 글 생성 시 최우선 반영**됩니다.

1. 포스팅 내용과 연결되는 **이미지 4장 이상** (대표 + 소제목별 카드 자동 생성, 각 이미지 alt 포함)
2. **정보 출처 항상 명시** (공식 기관명 + 링크 + 기준 시점)
3. **핵심 결론을 최상단**(요약 박스)에 먼저 배치 후 상세 전개
4. **사람의 경험에서 나오는 자연스러운 어투**로 작성

> 이미지는 빌드/발행 시 대표 이미지 + 각 `##` 소제목 카드가 자동 생성·삽입됩니다
> (`npm run images` 로 수동 재생성 가능, CI 에서는 Chrome 셋업 시 자동). 추후 AI 사진으로
> 교체하려면 `automation/images.mjs` 의 카드 생성부를 이미지 생성 API 호출로 바꾸면 됩니다.

## 내 주제·의견 직접 넣기 (운영자 입력)

직접 발행하고 싶은 주제나 편집 방향을 `config/requests.json` 에 적으면, 자동 발행이
**시즌 주제보다 먼저** 이 요청을 처리합니다. 깃허브 웹에서 바로 편집해 저장하면 됩니다.

```jsonc
{
  "notes": "존댓말로, 정부 공식 출처를 꼭 포함, 표를 적극 활용",   // 모든 글 공통 편집 지침
  "topics": [
    {
      "title": "2026 청년 월세 특별지원 신청 방법과 자격",
      "category": "support",                 // money/support/life/season/howto
      "keywords": ["청년월세지원", "신청방법"],
      "note": "신청 자격·필요 서류 위주로",   // 이 글에만 적용되는 지시
      "status": "pending"                     // pending=발행대기, done=발행됨, skip=무시
    }
  ]
}
```

- 발행이 끝나면 해당 주제의 `status` 가 자동으로 `done` 으로 바뀝니다.
- **대시보드의 "발행 예정(플랜 검토)" 와 "내 의견·요청"** 섹션에서 현황을 확인할 수 있고,
  대시보드의 *✏️ 깃허브에서 바로 편집* 링크로 이 파일을 열 수 있습니다.

## 콘텐츠 주제 관리

- `config/topics/seasonal-topics.json` 에 1~12월 주제 풀이 정의돼 있습니다.
- `topic-picker.mjs` 가 **현재 월 → 다음 달 → 이전 달** 순으로 미발행 주제를 선택합니다.
- 이미 발행한 제목은 자동 제외(중복 방지).
- **실시간 트렌드 반영**: `automation/trend.mjs` 가 네이버 DataLab(REST)로 시의성
  키워드를 끌어와 주제 우선순위를 보정할 수 있습니다(아래 참고).

## 시의성 강화: 네이버 DataLab 트렌드 (선택)

월별 고정 주제 외에 **지금 검색량이 오르는 키워드**를 반영하려면
네이버 DataLab/검색 오픈API 연동을 사용하세요.

- 발급: 네이버 개발자센터에서 애플리케이션 등록 → `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- `automation/trend.mjs` 가 키 존재 시 트렌드 점수를 계산, 없으면 자동 무시(no-op)
- 참고: 이 저장소를 운영하는 Claude 세션에서는 NaverSearch MCP 도구
  (`datalab_search` 등)로 트렌드를 즉석 점검할 수도 있습니다(운영자용).

## 운영 메모 / 주의

- 생성 글은 **사실 확인이 필요한 수치를 단정하지 않도록** 프롬프트가 설계돼 있으나,
  민감한 제도/요금 정보는 발행 전 검수를 권장합니다.
- AdSense 정책상 **충분한 분량·독창적 콘텐츠·개인정보처리방침**이 필요하며,
  본 템플릿은 about/privacy 페이지와 표준 고지를 기본 포함합니다.
- 무인 자동발행은 품질 관리가 핵심입니다. 초기에는 `POSTS_PER_RUN=1`로 시작하여
  색인/수익 추이를 보며 늘리는 것을 권장합니다.
