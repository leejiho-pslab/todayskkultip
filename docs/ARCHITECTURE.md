# 아키텍처 · 전체 뼈대 (Architecture)

생활정보/꿀팁 SEO 수익화 사이트의 전체 구조와 데이터 흐름을 한눈에 정리합니다.

## 1. 데이터 흐름 (100% 자동 발행)

```
[월별 시즌 주제 풀]            [운영자 요청/의견]
 config/topics/*.json          config/requests.json
        │                              │
        └──────────┬───────────────────┘   (운영자 요청 우선)
                   ▼
        automation/topic-picker.mjs  ──(풀 부족 시)── automation/topic-generate.mjs
                   │                                  (Claude 가 시의성 주제 자동 발굴·보충)
                   ├──(선택)── automation/trend.mjs (네이버 DataLab)
                   ▼
        automation/generate.mjs  ── Claude API ──▶ content/posts/<date>-<slug>.md
                   │                              + 고정 작성기준 4종 주입
                   ▼
        automation/images.mjs ──▶ 대표 + 소제목 카드 이미지 (src/assets/covers/)
                   ▼
        automation/build.mjs ──▶ public/  (정적 사이트 + SEO 산출물 + 대시보드)
                   ├── render.mjs (HTML·스키마·광고)
                   ├── audit.mjs (SEO/GEO 자동검사)
                   └── dashboard.mjs (채널별 모니터링 + 다운로드)
                   ▼
        ┌──────────┼──────────────┬────────────┐
        ▼          ▼              ▼            ▼
   GitHub Pages  publish-blogger.mjs  publish-wordpress.mjs  indexnow.mjs
   (자체 사이트)  (구글 블로거, 2순위)  (워드프레스, 3순위)     (즉시 인덱싱)
   네이버(1순위): 수동(대시보드에서 기획안/원고 다운로드 → 다듬어 발행)
   수익화: 쿠팡파트너스(제휴, 최속) + 애드센스(배너, 도메인 필수) + 애드포스트(네이버) — render.mjs
```

전체를 `automation/run-all.mjs` 가 오케스트레이션하고,
`.github/workflows/publish.yml` 이 매일 09:00·15:00·21:00(KST) 크론으로 3회 실행합니다(하루 3편).

## 2. 디렉터리 구조

```
config/
  site.config.js        # 사이트·광고·채널·브랜드·작성자·고정작성기준·GitHub 정보
  topics/seasonal-topics.json   # 1~12월 시즌성 주제 풀
  geo-checklist.json    # SEO+GEO 체크리스트(자동/수동)
  requests.json         # 운영자 직접 입력(주제·편집의견)  ← 운영자 편집
automation/
  topic-picker.mjs  trend.mjs  requests.mjs   # 주제 선정
  generate.mjs                                 # Claude API 글 생성
  images.mjs  pngcrop.mjs                       # 대표/소제목 이미지
  build.mjs  render.mjs  lib.mjs               # 정적 사이트 빌드
  audit.mjs  dashboard.mjs                      # 검사·대시보드
  publish-blogger.mjs  indexnow.mjs            # 발행·인덱싱
  run-all.mjs  serve.mjs                        # 오케스트레이션·로컬서버
content/posts/*.md      # 생성된 글(원본)
src/assets/, src/styles # 브랜드 이미지·CSS
public/                 # 빌드 산출물(배포 대상, git 미추적)
docs/                   # SETUP.md(셋업) · ARCHITECTURE.md(본 문서)
.github/workflows/publish.yml  # 자동 발행 파이프라인
```

## 3. 채널 연결 우선순위 (4종)

| 순위 | 채널 | 발행 방식 | 상태 | 필요 설정 |
| --- | --- | --- | --- | --- |
| 1 | 네이버 블로그 | 수동(공식 API 없음) | ✅ 기획안/원고 다운로드 제공 | (수동 발행) |
| 2 | 구글 블로거 | Blogger API v3 | 🟡 코드 완성, 연동 대기 | `BLOGGER_*` Secrets |
| 3 | 워드프레스 | WP REST API | 🟡 코드 완성, 연동 대기 | `WORDPRESS_*` |
| — | 자체 사이트 | GitHub Pages 정적 배포 | ✅ 운영(기준 채널) | (없음) |

네이버는 공식 글쓰기 API가 없어 완전 자동화가 불가능하지만, 별도 설정 없이
바로 시작할 수 있어 1순위로 둔다. 구글 블로거·워드프레스는 OAuth/REST API
연동이 완료되면 자동 발행된다.

## 4. 수익화 (수익 도달 속도 순 — 병렬 시작)

| 순서 | 채널 | 방식 | 리드타임 | 비고 |
| --- | --- | --- | --- | --- |
| ① | 네이버 쇼핑커넥트 | 제휴(스마트스토어 상품 수수료 최대 30~50%) | 즉시(심사 없음) | `NAVER_CONNECT_ID` · 브랜드커넥트 스페이스에서 가입 |
| ② | 쿠팡 파트너스 | 제휴(상품 링크 수수료) | 가입 즉시 링크 발급 | `COUPANG_PARTNER_ID` |
| ③ | Google AdSense | 배너(상단·본문중간·하단+자동광고) | 심사 2~4주 | **커스텀 도메인 필수** — github.io 하위 주소 등록 불가 |
| ④ | 네이버 애드포스트 | 네이버 블로그 광고 | 개설 90일+ · 원본 글 50개+ | 사이트 코드 불필요, 복사 콘텐츠 시 탈락 |
| 후순위 | Taboola | 추천 위젯 | 트래픽 요건(월 수만 PV+) | `TABOOLA_PUBLISHER` |

- ID 미설정 시 렌더 생략(빈 슬롯 없음). 설정 상태는 대시보드 '💰 광고사이트' 탭에서 점검.
- **제휴 고지 자동화**: 글 frontmatter `affiliate: ["coupang"]` → `render.mjs`의
  `affiliateDisclosure()`가 정책상 필수 고지 문구를 글 상단에 자동 삽입
  (`site.affiliate`에 네트워크를 추가하면 자동 지원).
- **중복 콘텐츠 방지**: 블로거/워드프레스 발행본 하단에 원문 링크 자동 포함 —
  검색엔진이 자체 사이트를 원본으로 인식하도록 유도.
- ℹ️ 네이버 블로거용 제휴의 정식 명칭은 "쇼핑커넥트". "쇼핑파트너센터"는 판매자용 입점 센터로 별개.
- 상품 추천형 콘텐츠 기획은 다음 라운드(주제·자동화 재기획)에서 다룸.

## 5. SEO · GEO

- 기술: sitemap(lastmod)·robots(AI봇 허용)·llms.txt·IndexNow·canonical·OG·파비콘
- 스키마: Organization·WebSite·Article·Breadcrumb·FAQPage·Person(author)
- 콘텐츠: 첫문단 키워드·TL;DR·굵게·표·외부출처2+·정의/방법/비교형
- `audit.mjs` 가 빌드 결과물을 실시간 검사(현재 자동 30/30), 수동 항목은 체크리스트로 추적

## 6. 고정 작성 기준 (모든 글 항상 적용)

`config/site.config.js > editorialBaseline`:
1. 이미지 4장 이상(대표+소제목 카드) 2. 출처 항상 표기
3. 핵심 최상단 배치 4. 사람 경험 기반 어투

## 7. 운영 대시보드 (`/dashboard/`, noindex)

탭(연결 우선순위 순): **전체 / 네이버 블로그(1순위) / 구글 블로거(2순위) / 워드프레스(3순위) / 광고사이트(4순위) / 자체 사이트**
- 발행 현황(채널·카테고리·월별), 발행 스케줄(예정일+브리프)
- 내 의견·요청(편집), SEO/GEO 진척도, 채널별 설정 점검
- 광고사이트 탭: 쿠팡파트너스·애드센스·애드포스트 준비도(수익 도달 속도 순) + 가입 링크
- 다운로드: 기획안(plan.md/csv), 글별 원고(drafts/), 네이버 통합팩

## 8. 명령어

```bash
npm run auto      # 전체 파이프라인(생성→빌드→발행)
npm run generate  # 글 생성만   npm run build  # 빌드만
npm run images    # 이미지 생성  npm run dashboard / audit / check
npm run serve     # 로컬 미리보기(http://localhost:8080)
```
