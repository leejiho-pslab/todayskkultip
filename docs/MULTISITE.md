# 멀티 사이트 운영 (SITE_PROFILE)

같은 코드(이 레포)로 도메인별로 다른 사이트를 운영한다.
GitHub Pages 는 **레포 1개당 사이트 1개**이므로, 사이트마다 레포를 하나씩 둔다
(이 레포를 **Template** 으로 지정 → "Use this template" 으로 복제).

## 프로필 목록

| 프로필 | 도메인 | 컨셉 | 언어 |
|---|---|---|---|
| `default` | starship-ent.ai.kr | 생활정보/꿀팁 (오늘의 꿀팁) | 한국어 |
| `kkultip` | todayskkultip.co.kr | 재테크·절약·금융 (오늘의 머니꿀팁) | 한국어 |
| `jype` | jype.ai.kr | 해외 대상 K-culture/여행/트렌드 (Korea Unboxed) | **영어** (애드센스 CPC 최고 언어권) |

프로필 정의: `config/profiles/*.config.js` — 사이트명/카테고리/작성 기준/브랜드 이미지 문안 등
프로필이 지정한 값만 기본 설정(`config/site.config.js`)을 덮어쓴다.

## 프로필이 바꾸는 것

- **콘텐츠**: 주제 풀(`config/topics/<프로필>-seasonal-topics.json`), 주제 자동 발굴·글 생성 프롬프트(jype 는 영어 프롬프트/영어 발행)
- **사이트 UI**: 언어별 문자열(`automation/locales/{ko,en}.mjs`), 카테고리, 정적 페이지(소개/약관/방침 등)
- **브랜드 이미지**: 로고/프로필/커버 문안(`brandmark`), 카테고리 색상
- **글 격리**: 생성 글 frontmatter 에 `profile` 이 찍히고, 빌드 시 현재 프로필 글만 포함
  (템플릿 복제 직후 남아있는 원본 사이트의 글은 새 사이트에 **빌드되지 않는다** — 지우지 않아도 됨)
- **검증/분석 기본값**: 새 프로필은 GA4/서치콘솔/네이버 인증값이 비어 있음(도메인별 재발급 필요).
  애드센스 게시자 ID(ca-pub-…)는 **같은 계정을 공유**하므로 그대로 두면 된다
  (애드센스에서 "사이트 추가"만 하면 됨).

## 새 사이트 레포에 등록할 것 (최소)

Variables (Settings → Secrets and variables → Actions → Variables):

| 이름 | 값 (예: kkultip) |
|---|---|
| `SITE_PROFILE` | `kkultip` |
| `SITE_URL` | `https://todayskkultip.co.kr` |
| `SITE_CNAME` | `todayskkultip.co.kr` |

Secrets:

| 이름 | 값 |
|---|---|
| `ANTHROPIC_API_KEY` | (글 생성용 — 기존 레포와 같은 키 사용 가능) |

이후 레포 Settings → Pages → Source = **GitHub Actions**, 커스텀 도메인 DNS(가비아 A/CNAME) 설정.
블로거 채널을 붙이려면 해당 사이트용 블로그를 만들고 `BLOGGER_BLOG_ID` 등 Secrets 4종을 추가하면
자동 활성화된다(`channels.blogger.enabled = !!BLOGGER_BLOG_ID`).

## 코드 자동 동기화 (원본 → 위성 레포)

템플릿 복제는 "그 시점의 스냅샷"이라 이후 코드 개선이 위성 레포에 반영되지 않는다.
`.github/workflows/sync-sites.yml` 이 이 문제를 해결한다:

- **원본(이 레포)에 코드 푸시** → 위성 레포들에 코드만 자동 반영(커밋·푸시) → 위성 사이트 자동 재배포
- 동기화 범위: automation/, src/styles/, src/assets/brand/, .github/, docs/, config(프로필·시즌 주제) 등 **코드만**
- 보존(절대 안 건드림): content/posts, 커버 이미지, `*-generated-topics.json`, requests.json, revenue.json
- 활성화 조건 — **이 레포(원본)에만** 등록:
  - Secret `SYNC_TOKEN`: fine-grained PAT (대상 레포 선택, 권한: **Contents R/W + Workflows R/W**)
  - Variable `SYNC_TARGETS`: `leejiho-pslab/todayskkultip leejiho-pslab/jype` (공백 구분)
- 미등록 시 조용히 건너뛴다. 위성 레포에 복사된 이 워크플로우도 SYNC_TARGETS 가 없어 동작하지 않는다.

## 로컬 테스트

```bash
SITE_PROFILE=kkultip node automation/build.mjs   # 머니꿀팁으로 빌드
SITE_PROFILE=jype node automation/build.mjs      # 영어 사이트로 빌드
SITE_PROFILE=jype node automation/images.mjs brand  # 영어 브랜드 이미지 생성
```
