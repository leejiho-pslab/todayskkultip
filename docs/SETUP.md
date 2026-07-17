# 셋업 & 운영 가이드 (사용자용)

이 문서는 **사용자가 직접 해야 하는 작업**을 순서대로 정리한 가이드입니다.
코드/자동화는 이미 구축되어 있으니, 아래 단계만 따라 하면 사이트가 100% 자동으로
발행·배포됩니다. (소요 시간: 필수 단계만 약 15~20분)

> 용어: **Secret**(민감값, 노출 금지) / **Variable**(공개돼도 되는 값).
> 둘 다 GitHub 저장소 **Settings → Secrets and variables → Actions** 에서 등록합니다.

---

## ✅ 한눈에 보는 체크리스트

| 단계 | 작업 | 필수? | 소요 |
| --- | --- | --- | --- |
| 1 | GitHub Pages 활성화 | **필수** | 1분 |
| 2 | 사이트 주소 변수 설정 | **필수** | 2분 |
| 3 | Claude API 키 등록(자동 글 생성) | **필수** | 3분 |
| 4 | 첫 발행(수동 실행)으로 동작 확인 | **필수** | 2분 |
| 5 | 네이버 블로그 연결 (1순위) | 권장 | 5분 |
| 6 | 구글 블로거 연동 (2순위) | 선택 | 15분 |
| 7 | 워드프레스 연동 (3순위) | 선택 | 10분 |
| 8 | 광고사이트 연결 — 애드센스·쇼핑커넥트·쿠팡파트너스 (4순위) | 권장 | 승인 별도 |
| 9 | Google/Bing 검색엔진 등록 | 권장 | 10분 |
| 10 | 커스텀 도메인 연결 | **애드센스에 필수** | 10분+DNS |

> **채널 연결**은 네이버 블로그 → 구글 블로거 → 워드프레스 순으로 진행하되,
> **광고사이트(STEP 8)는 뒤로 미루지 말고 오늘 병렬로 시작**하세요. 수익화 채널마다
> 승인 리드타임(애드센스 2~4주 심사, 애드포스트 90일 운영 요건)이 있어, 먼저 신청해 두어야
> 총 대기시간이 최소화됩니다. 네이버 쇼핑커넥트(심사 없음)와 쿠팡파트너스(즉시 링크 발급)는
> 오늘 바로 시작할 수 있는 가장 빠른 수익원입니다.
> 워드프레스는 유료 호스팅이 선행되어야 하므로 수익이 발생한 뒤 확장을 권장합니다.

---

## STEP 1. GitHub Pages 활성화 (필수)

1. 저장소 → **Settings → Pages**
2. **Build and deployment → Source** 를 **`GitHub Actions`** 로 선택
3. 끝. (별도 브랜치 지정 불필요 — 워크플로우가 배포를 담당)

> 현재 기본 브랜치가 `claude/seo-monetization-site-0g52e1` 이라 **매일 자동 발행 크론**도
> 이 브랜치 기준으로 동작합니다. 별도 PR/머지 없이 바로 운영됩니다.

---

## STEP 2. 사이트 주소 변수 설정 (필수)

**Settings → Secrets and variables → Actions → Variables 탭 → New repository variable**

| 변수 이름 | 값(예시) | 설명 |
| --- | --- | --- |
| `SITE_URL` | `https://leejiho-pslab.github.io/site` | 배포 주소(끝 슬래시 없이) — 미등록 시 이 값이 기본값 |

> 하위 경로(basePath)는 `SITE_URL` 에서 **자동 계산**되므로 별도 설정이 필요 없습니다.
> (`SITE_BASE_PATH` 는 특수한 경우에만 명시 — 루트 배포를 강제하려면 `/`)

---

## STEP 3. Claude API 키 등록 — 자동 글 생성 (필수)

100% 자동 발행의 핵심입니다. 키가 없으면 글이 생성되지 않고 빌드/배포만 됩니다.

1. [Anthropic Console](https://console.anthropic.com) → API Keys → **Create Key**
2. 결제 수단 등록(소액 사용량 과금) 후 키 복사
3. GitHub **Secrets 탭 → New repository secret**

| Secret 이름 | 값 |
| --- | --- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (복사한 키) |

4. (선택) **Variables 탭**에 모델/발행량 지정

| 변수 | 값(예시) | 설명 |
| --- | --- | --- |
| `CONTENT_MODEL` | `claude-sonnet-4-6` | 글 생성 모델(비용↓). 품질 우선이면 `claude-opus-4-8` |
| `POSTS_PER_RUN` | `1` | 1회 실행당 글 수(초기엔 1 권장) |

---

## STEP 4. 첫 발행으로 동작 확인 (필수)

1. 저장소 → **Actions** 탭 → 왼쪽 **자동 발행** 워크플로우 선택
2. 오른쪽 **Run workflow** 클릭 → 입력값 확인 후 실행
   - `posts`: 생성할 글 수(예: 1)
   - `generate`: `true`
   - `publish_blogger`: `false`(블로거 미설정 시)
3. 실행이 끝나면(초록 체크) 배포 URL에서 새 글 확인
4. **대시보드**: `https://<SITE_URL>/dashboard/` 에서 발행 현황·SEO/GEO 진척도 확인

> 크론은 매일 **09:00·15:00·21:00(KST)** 3회 자동 실행됩니다(하루 3편). 수동 실행은 언제든 가능합니다.

---

## STEP 5. 네이버 블로그 연결 — 1순위 (권장)

네이버는 개인 블로그 글쓰기 **공식 API가 없어** 다른 채널처럼 완전 자동화할 수 없습니다
(비공식 자동화는 이용약관 위반·계정 차단 위험이 있어 적용하지 않았습니다). 대신 아래처럼
"자동 생성 + 수동 붙여넣기"로 가장 먼저, 가장 쉽게 시작할 수 있습니다.

1. **네이버 블로그를 오늘 개설**하세요 — 애드포스트(네이버 광고 수익)는 **개설 90일 이상 +
   공개 글 50개 이상** 운영 실적을 심사하므로, 개설일부터 시계가 돌아갑니다.
2. 대시보드(`https://<SITE_URL>/dashboard/#naver`) → **🟢 네이버 블로그** 탭 이동
3. **📦 통합 기획안+전체 원고 (.md)** 다운로드 (`naver-content-pack.md`)
   - 발행 스케줄 + 현재까지 작성된 모든 글의 원고가 한 파일에 담겨 있습니다
4. 네이버 블로그에서 새 글 작성 → 원고를 뼈대로 **다듬어서** 발행 (글당 10~15분)
5. (선택) 검색 노출을 높이려면 [네이버 서치어드바이저](https://searchadvisor.naver.com)에
   **자체 사이트**를 등록하고 사이트맵을 제출하세요(네이버 블로그 자체와는 별개로,
   자체 사이트의 네이버 검색 노출에 도움이 됩니다).

| 변수 | 값 | 설명 |
| --- | --- | --- |
| `NAVER_SITE_VERIFICATION` | (소유확인 meta content 값) | 네이버 서치어드바이저 소유확인(선택) |

> ⚠️ **그대로 복붙 금지**: 사이트에 이미 게시된 글을 그대로 붙여넣으면 네이버 검색의
> **유사문서 필터**에 걸려 노출이 제한되고, **애드포스트 심사에서 '복사 콘텐츠'로 탈락**할 수
> 있습니다. 도입부·소제목 구성·어투를 바꾸고 본인 경험 한두 문단을 추가해 발행하세요.
>
> 매일 09:00·15:00·21:00 자동 생성되는 원고가 대시보드에 쌓이므로, 하루 한 번 접속해
> 새로 생긴 원고만 다듬어 옮기는 루틴을 권장합니다.

---

## STEP 6. 구글 블로거 연동 — 2순위 (선택)

자체 사이트 외에 **구글 블로거(Blogger)**에도 같은 글을 자동 발행합니다.

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 생성
2. **API 및 서비스 → 라이브러리 → "Blogger API v3" 사용 설정**
3. **OAuth 동의 화면** 구성(외부, 테스트 사용자에 본인 계정 추가)
4. **사용자 인증 정보 → OAuth 클라이언트 ID → 데스크톱 앱** 생성 →
   `client_id`, `client_secret` 확보
5. **refresh token 발급** ([OAuth 2.0 Playground](https://developers.google.com/oauthplayground) 사용):
   - 우측 톱니바퀴 → *Use your own OAuth credentials* 체크 → client id/secret 입력
   - 스코프에 `https://www.googleapis.com/auth/blogger` 입력 → Authorize
   - *Exchange authorization code for tokens* → **Refresh token** 복사
6. 블로거 관리페이지 URL의 `blogID=` 숫자가 **블로그 ID**
7. GitHub **Secrets** 등록

| Secret | 값 |
| --- | --- |
| `BLOGGER_BLOG_ID` | (blogID 숫자) |
| `BLOGGER_CLIENT_ID` | `...apps.googleusercontent.com` |
| `BLOGGER_CLIENT_SECRET` | (클라이언트 시크릿) |
| `BLOGGER_REFRESH_TOKEN` | (5번에서 복사) |

8. **Variables** 에 `PUBLISH_BLOGGER=true` 등록(또는 수동 실행 시 입력값으로 true)

---

## STEP 7. 워드프레스 채널 연동 — 3순위 (선택)

자체 사이트/블로거와 동일한 글을 워드프레스에도 자동 발행합니다. 두 가지 방식을 지원합니다.

### 방식 ① WordPress.com 무료 플랜 (권장 — 비용 0원)

1. [WordPress.com](https://wordpress.com/start) 가입 → 무료 플랜으로 사이트 개설 (주소: `xxx.wordpress.com`)
2. [developer.wordpress.com/apps](https://developer.wordpress.com/apps/) → **Create New Application**
   - Name: `kkultip-publisher` / Website URL: 사이트 주소 / Redirect URL: 자체 사이트 주소
3. 발급된 Client ID/Secret으로 OAuth2 인증 → **액세스 토큰** 확보
   (브라우저에서 authorize URL 접속 → 허용 → 리디렉션 주소의 `code`를 토큰으로 교환. 토큰은 만료되지 않음)
4. GitHub 등록

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Variable | `WPCOM_SITE` | `xxx.wordpress.com` (도메인만) |
| Secret | `WPCOM_TOKEN` | OAuth2 액세스 토큰 |
| Variable | `PUBLISH_WORDPRESS` | `true` |

### 방식 ② 자체 호스팅 / 비즈니스 플랜 (앱 비밀번호)

1. 워드프레스 관리자 → **사용자 → 프로필 → 애플리케이션 비밀번호** 에서 새 비밀번호 발급
2. GitHub 등록

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Variable | `WORDPRESS_URL` | `https://내블로그.com` |
| Variable | `WORDPRESS_USER` | 워드프레스 로그인 아이디 |
| Secret | `WORDPRESS_APP_PASSWORD` | 발급한 애플리케이션 비밀번호 |
| Variable | `WORDPRESS_STATUS` | `publish`(기본) 또는 `draft` |

등록하면 이후 생성되는 글이 자동으로 WP에도 발행됩니다(수동 실행 시 `publish_wordpress=true`).

---

## STEP 8. 광고사이트 연결 — 애드센스 · 네이버 쇼핑커넥트 · 쿠팡 파트너스 (권장, 오늘 병렬 시작)

수익화 채널을 **수익이 발생하기까지 걸리는 시간이 짧은 순서**로 정리했습니다.
각각 승인 리드타임이 다르므로 순서를 기다리지 말고 **오늘 전부 시작**하세요.
값은 모두 **Variables 탭**에 등록합니다(비어 있으면 렌더링 생략).

| 순서 | 채널 | 수익까지 예상 시간 | 오늘 할 일 |
| --- | --- | --- | --- |
| ① | 네이버 쇼핑커넥트 | 즉시 (심사 없음) | 브랜드커넥트 스페이스 개설 + 약관 동의 |
| ② | 쿠팡 파트너스 | 수일 (가입 즉시 링크 발급) | 가입 + ID 등록 |
| ③ | Google AdSense | 2~4주 심사 | **도메인 구매(STEP 10)** + 신청 |
| ④ | 네이버 애드포스트 | 90일+ (블로그 운영 실적) | 네이버 블로그 개설(STEP 5) |

### 8-1. 네이버 쇼핑커넥트 (제휴 마케팅) — 심사 없이 즉시 시작
네이버가 2025년 7월 정식 출시한 크리에이터 제휴 서비스입니다. 스마트스토어 상품 링크를
콘텐츠에 넣고 구매가 발생하면 수수료(판매자 설정, 최대 30~50%)를 받습니다.

1. 네이버 **브랜드커넥트**에서 크리에이터 스페이스 개설 (네이버 계정만 있으면 가능)
2. 스페이스 내 **쇼핑 커넥트** 메뉴 → 이용약관 동의 → 즉시 시작 (사전 심사 없음)
3. 활동 채널 등록 — 네이버 블로그·인스타그램·유튜브·**개인 사이트(본 사이트)** 모두 가능

| 변수 | 값 | 설명 |
| --- | --- | --- |
| `NAVER_CONNECT_ID` | (발급된 크리에이터/스페이스 식별자) | 대시보드 연동 상태 표시용 |

> 💡 네이버 블로그(1순위 채널)와 궁합이 가장 좋습니다 — 네이버 생태계 안에서 콘텐츠→상품→구매가 한 흐름으로 이어집니다.
> 글 frontmatter에 `affiliate: ["naverConnect"]`를 추가하면 고지 문구가 자동 삽입됩니다.
>
> ℹ️ **명칭 주의**: "쇼핑파트너센터"는 스마트스토어 **판매자**용 입점 센터로 별개입니다.
> 블로거·크리에이터용 제휴는 **쇼핑커넥트**가 정식 명칭입니다.

### 8-2. 쿠팡 파트너스 (제휴 마케팅) — 즉시 링크 발급
글에서 소개한 상품에 쿠팡 링크를 걸고, 클릭 후 구매가 발생하면 수수료를 받는 방식입니다.

1. [쿠팡 파트너스](https://partners.coupang.com) 가입(쿠팡 계정 필요) — **가입 즉시 링크 생성 가능**
2. 발급되는 채널(트래킹) ID 확보

| 변수 | 값 | 설명 |
| --- | --- | --- |
| `COUPANG_PARTNER_ID` | (발급된 채널 ID) | 쿠팡 파트너스 트래킹 식별자 |

> ⚠️ **필수 고지**: 쿠팡 파트너스 정책상 링크가 포함된 글에는 "이 포스팅은 쿠팡 파트너스 활동의
> 일환으로, 이에 따른 일정액의 수수료를 제공받습니다." 문구를 반드시 표시해야 합니다.
> 이 값을 등록하고 글 frontmatter에 `affiliate: ["coupang"]`을 추가하면 해당 글에 문구가 **자동 삽입**됩니다.
>
> 💡 **최종 승인**은 누적 판매금액 15만원 도달 시 자동 심사됩니다. 가입 직후부터
> 상품 연관성이 높은 글(제습기, 장마철 용품 등 계절 글)에 링크를 넣어 실적을 쌓으세요.

### 8-3. Google AdSense (배너 광고) — 커스텀 도메인 필수
1. **먼저 커스텀 도메인을 연결하세요(STEP 10)** —
   ⚠️ AdSense는 **루트 도메인만** 사이트로 등록할 수 있어, 현재의 `github.io` 하위 주소로는
   **신청 자체가 불가**합니다. 도메인 비용은 연 1~2만원 수준입니다.
   - 대안: 구글 블로거는 애드센스 **호스트 파트너**라 blogspot 주소 그대로 신청 가능
     (단, 그 승인은 해당 블로그에만 적용되고 자체 사이트에는 별도 도메인이 필요합니다).
2. [AdSense](https://adsense.google.com) 가입 → 사이트 추가 → **승인 대기**
   - 승인에는 **독창적 콘텐츠 + 충분한 글 수 + 개인정보처리방침**이 필요합니다.
     본 사이트는 필수 페이지를 모두 갖췄고 글 30편을 확보했으므로, 도메인 연결 후 바로 신청하세요.
3. 승인 후 발급된 값 등록

| 변수 | 값(예시) | 설명 |
| --- | --- | --- |
| `ADSENSE_CLIENT` | `ca-pub-0000000000000000` | 게시자 ID |
| `ADSENSE_SLOT_TOP` | `1234567890` | 상단 슬롯(선택) |
| `ADSENSE_SLOT_INARTICLE` | `1234567890` | 본문 중간 슬롯(선택) |
| `ADSENSE_SLOT_BOTTOM` | `1234567890` | 하단 슬롯(선택) |

> 슬롯 ID를 비워도 `ADSENSE_CLIENT` 만 있으면 **자동 광고**가 동작합니다.
> 또한 `ADSENSE_CLIENT` 설정 시 **`ads.txt` 가 자동 생성**되어 광고 수익이 보호됩니다.

> ⚠️ **애드센스 승인 원칙**: 심사받은 그 사이트에 그대로 광고를 답니다. 미끼(그림자) 사이트로 승인 후
> 다른 사이트로 바꿔 다는 방식은 정책 위반(계정 정지 위험)이므로, **실제 사이트를 충분한 분량·품질로
> 키운 뒤 그대로 신청**하세요.

### 8-4. 네이버 애드포스트 (네이버 블로그 광고 수익)
네이버 블로그에 광고가 붙는 수익 프로그램입니다. **사이트 코드가 아니라 블로그 운영 실적**으로 심사합니다.

1. 네이버 블로그 개설(STEP 5) 후 **90일 이상 운영 + 공개 글 50개 이상** 축적
2. [애드포스트](https://adpost.naver.com)에서 미디어 등록 신청 (심사 1~2주)

> ⚠️ **복사 콘텐츠는 심사 탈락 사유**입니다 — 사이트 원고를 그대로 복붙하지 말고 반드시 다듬어 발행하세요(STEP 5 참고).
>
> ℹ️ 참고: "네이버 쇼핑파트너센터"는 스마트스토어 **판매자**용 입점 센터로, 쿠팡파트너스 같은
> 블로거 제휴 프로그램이 아닙니다. 네이버 쪽 수익화는 애드포스트가 현실적인 경로입니다.

### 8-5. Taboola (네이티브 추천 위젯) — 후순위
Taboola 등 네이티브 광고 네트워크는 **일정 규모 이상의 트래픽**을 요구해 신규 사이트는
승인되기 어렵습니다. 트래픽이 쌓인 뒤(월 수만 PV+) 신청하세요. 코드는 준비되어 있습니다.

| 변수 | 값 | 설명 |
| --- | --- | --- |
| `TABOOLA_PUBLISHER` | `your-publisher-id` | 발급받은 퍼블리셔 식별자 |

### 8-6. Google Analytics 4 (방문 분석)
1. [GA4](https://analytics.google.com) 속성 생성 → 측정 ID(`G-XXXX`) 확보

| 변수 | 값 |
| --- | --- |
| `GA4_ID` | `G-XXXXXXXXXX` |

> 네이버 디스플레이 광고 스크립트가 있다면 `NAVER_AD_SCRIPT`(Variable)에 raw HTML 로 넣으면 글 하단에 삽입됩니다.
> 문의 이메일을 노출하려면 Variable `CONTACT_EMAIL` 을 설정하세요(승인 심사에 필요한 about/작성자/문의/개인정보처리방침 페이지는 이미 갖춰져 있습니다).

---

## STEP 9. 검색엔진 등록 — SEO/GEO 색인 (권장)

### 9-1. Google Search Console (GSC)
1. [GSC](https://search.google.com/search-console) → 속성 추가 → **URL 접두어**에 `SITE_URL` 입력
2. 소유권 확인: **HTML 태그** 방식 선택 → `content="..."` 값 복사
3. GitHub **Variables** 에 등록 → 재배포되면 메타태그가 자동 삽입됨

| 변수 | 값 |
| --- | --- |
| `GOOGLE_SITE_VERIFICATION` | (HTML 태그의 content 값) |

4. 확인 완료 후 GSC → **Sitemaps** → `sitemap.xml` 제출

### 9-2. Bing 웹마스터 도구 (Perplexity/ChatGPT 노출 기반)
1. [Bing Webmaster](https://www.bing.com/webmasters) → GSC 계정 연동 임포트(가장 쉬움)
2. 또는 사이트 추가 후 `sitemap.xml` 제출

### 9-3. IndexNow (즉시 색인) — 이미 활성화됨 ✅
기본 키가 내장되어 발행 시 자동으로 Bing 등에 알립니다. 직접 키를 쓰려면
`INDEXNOW_KEY`(Secret)를 등록하면 그 값으로 대체됩니다.

---

## STEP 10. 커스텀 도메인 연결 (애드센스 신청에 필수)

> AdSense는 루트 도메인만 사이트로 등록할 수 있어, `github.io` 하위 주소로는 신청이 불가합니다.
> 애드센스 수익화를 하려면 이 단계가 사실상 필수입니다(연 1~2만원).

1. 도메인 등록기관(DNS)에서 레코드 설정
   - 서브도메인(예: `ttip.example.com`): `CNAME` → `leejiho-pslab.github.io`
   - 루트 도메인: GitHub Pages의 A 레코드(IP 4개) 설정
2. GitHub **Variables** 변경 — 딱 2개면 됩니다 (basePath 는 SITE_URL 에서 자동 계산)

| 변수 | 값 |
| --- | --- |
| `SITE_CNAME` | `ttip.example.com` (CNAME 파일 자동 생성) |
| `SITE_URL` | `https://ttip.example.com` |

3. 재배포 후 **Settings → Pages → Custom domain** 에서 HTTPS 적용 확인

---

## 📋 전체 Secret/Variable 요약

**Secrets (민감값)**
- `ANTHROPIC_API_KEY` *(필수)*
- `INDEXNOW_KEY` *(선택, 미설정 시 기본 키 사용)*
- `BLOGGER_BLOG_ID`, `BLOGGER_CLIENT_ID`, `BLOGGER_CLIENT_SECRET`, `BLOGGER_REFRESH_TOKEN` *(블로거 선택)*

**Variables (공개 가능)**
- `SITE_URL` *(권장 — 미등록 시 기본값 사용, basePath 자동 계산)*
- `CONTENT_MODEL`, `POSTS_PER_RUN`
- `ADSENSE_CLIENT`, `ADSENSE_SLOT_TOP`, `ADSENSE_SLOT_INARTICLE`, `ADSENSE_SLOT_BOTTOM`
- `NAVER_CONNECT_ID`, `COUPANG_PARTNER_ID` *(제휴 마케팅)*
- `TABOOLA_PUBLISHER`, `NAVER_AD_SCRIPT`
- `GA4_ID`, `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION`
- `SITE_CNAME` *(도메인 선택)*, `PUBLISH_BLOGGER`/`PUBLISH_WORDPRESS` *(채널 선택)*
- `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_STATUS` *(워드프레스 선택)*

---

## STEP 11. 대시보드 & 수동 체크리스트 운영

- 대시보드: `https://<SITE_URL>/dashboard/`
  - 발행 현황(채널/카테고리/월별) + SEO·GEO 진척도
  - **자동 항목**은 빌드마다 실시간 재검사됩니다(현재 30/30 통과).
  - **수동 항목**(오프사이트)은 직접 진행 후 표시합니다.
- 수동 항목 완료 표시: `config/geo-checklist.json` 에서 해당 항목의
  `"status": "todo"` → `"done"`(또는 해당 없으면 `"na"`)으로 수정 후 커밋하면
  다음 빌드에서 진척도에 반영됩니다.

### 사용자가 직접 해야 하는 GEO 오프사이트 작업(요약)
검색·AI 노출을 키우려면 코드로 할 수 없는 아래 작업이 중요합니다.
- 브랜드 SNS 채널 개설 + 프로필 일관성(설정 후 `config/site.config.js` `brand.sameAs` 에 URL 추가)
- 외부 매체/커뮤니티에서의 브랜드 언급·백링크 확보
- 'Best/추천' 리스트형 콘텐츠 진입, 위키 등재
- ChatGPT/Perplexity/Gemini에 주제 질의 → 인용 여부 주기적 스냅샷
- GA4에서 LLM 리퍼러(chatgpt.com, perplexity.ai 등) 세그먼트 모니터링

---

## STEP 12. 운영 루틴 권장안

- **오늘**: 쿠팡파트너스 가입 + 커스텀 도메인 구매 + 네이버 블로그 개설(애드포스트 90일 시계 시작)
- **이번 주**: 도메인 연결(STEP 10) → 애드센스 신청(글 30편 확보로 요건 충족)
- **매일**: 자동 발행 3편 확인 + 네이버 블로그에 원고 1~2편 다듬어 발행
- **분기마다**: 상위 트래픽 글 정보 갱신(요금·제도 변경 반영) → `updated` 날짜 변경(IndexNow 자동 핑)
- 대시보드로 발행/진척도 점검, 수동 GEO 작업 순차 진행

---

## 🛠 트러블슈팅

- **글이 안 생겨요**: `ANTHROPIC_API_KEY` 등록 여부, Actions 로그의 generate 단계 확인. 키가 없으면 빌드만 됩니다.
- **광고가 안 보여요**: `ADSENSE_CLIENT` 등록 + 애드센스 승인 여부 확인. 미승인 상태에선 광고가 나오지 않습니다.
- **이미지가 안 나와요**: 커버는 빌드 시 실제 파일이 있을 때만 사용됩니다. CI에서 Chrome 설치 스텝이 실패하면 기본 OG로 폴백됩니다(글은 정상 발행).
- **페이지가 404**: Settings→Pages 가 `GitHub Actions` 인지, `SITE_BASE_PATH` 가 실제 경로와 맞는지 확인.
- **크론이 안 돌아요**: 스케줄 워크플로우는 기본 브랜치에 있어야 합니다(현재 충족). Actions 가 비활성화돼 있지 않은지 확인.
