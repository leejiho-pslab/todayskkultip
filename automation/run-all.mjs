// =============================================================
//  전체 파이프라인 오케스트레이터 (100% 자동 발행)
//  1) 시즌성 주제 선택 + Claude API 글 생성
//  2) 정적 사이트 빌드
//  3) (옵션) 구글 블로거 발행
//  GitHub Actions 가 이 스크립트를 크론으로 실행한다.
//
//  환경변수:
//    GENERATE=false  -> 글 생성 건너뛰고 빌드만
//    PUBLISH_BLOGGER=true -> 블로거 발행 수행
// =============================================================
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT, readJson } from "./lib.mjs";
import { site } from "../config/site.config.js";

// 발행 일시정지 스위치 (config/automation-flags.json) — paused=true 면 생성·채널발행을
// 멈추고 빌드·배포만 수행한다(사이트는 계속 살아있음). 전략 변경 대기 등에서 사용.
const FLAGS = (() => {
  try { return readJson(path.join(ROOT, "config", "automation-flags.json")); }
  catch { return {}; }
})();

function run(scriptRelPath, label) {
  console.log(`\n=== ${label} ===`);
  execFileSync("node", [path.join(ROOT, scriptRelPath)], { stdio: "inherit" });
}

/** 발행/인덱싱처럼 한 채널의 실패가 전체 파이프라인(커밋·배포)을 막으면 안 되는 단계용.
 *  실패 시 경고만 남기고 계속 진행한다 — 실패한 채널은 published 플래그가 안 바뀌어
 *  다음 실행에서 자동 재시도된다. */
function runSoft(scriptRelPath, label) {
  try {
    run(scriptRelPath, label);
  } catch (e) {
    console.warn(`[run-all] ⚠ ${label} 실패(파이프라인은 계속): ${e.message}`);
  }
}

(async () => {
  const paused = !!FLAGS.paused;
  if (paused) {
    console.warn("[run-all] ⏸ 발행 일시정지(automation-flags.paused=true) — 새 글 생성·채널 발행을 건너뛰고 빌드·배포만 수행합니다.");
  }
  const doGenerate = process.env.GENERATE !== "false" && !paused;
  const doBlogger =
    process.env.PUBLISH_BLOGGER === "true" && site.channels.blogger.enabled && !paused;

  if (doGenerate) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("[run-all] ANTHROPIC_API_KEY 없음 — 글 생성 건너뜀(빌드만 수행).");
    } else {
      // 소프트 실행: 글 생성이 실패해도(API 한도 초과·일시 오류 등) 기존 글의
      // 빌드·배포·발행(WP 백필/블로거)은 계속 진행되어야 사이트가 멈추지 않는다.
      runSoft("automation/generate.mjs", "1) 콘텐츠 생성");
    }
  }

  // 1.5) 쿠팡 딥링크 사전 생성 (API 키 있을 때만 — 없으면 검색 링크로 대체)


  // 채널별 고유 재작성본 사전 생성 (blogger/wordpress 발행 임박분 + 네이버 최신분)
  // — 빌드(네이버 원고) 전에 실행해 이번 런부터 고유 원고가 반영되게 한다
  // REWRITE=false 면 재작성(LLM) 생략 → 결정적 변형 폴백(무료). 완전 0원 모드용 스위치.
  if (!paused && process.env.REWRITE !== "false") runSoft("automation/rewrite.mjs", "1.7) 채널별 고유 원고 재작성");

  // 쿠팡 딥링크 해석은 재작성(글 맞춤 상품 생성) 뒤에 실행해야
  // 이번 런에 생성된 검색어까지 같은 런에서 정밀 링크로 바뀐다
  runSoft("automation/coupang-resolve.mjs", "1.75) 쿠팡 정밀 딥링크 해석");

  // 네이버 전용 고품질 이미지(사이트 커버와 다른 비주얼) — Chrome 없으면 조용히 건너뜀
  if (!paused) runSoft("automation/naver-images.mjs", "1.8) 네이버 전용 이미지 생성");

  run("automation/build.mjs", "2) 정적 사이트 빌드");

  if (doBlogger) {
    if (!process.env.BLOGGER_BLOG_ID) {
      console.warn("[run-all] BLOGGER_BLOG_ID 없음 — 블로거 발행 건너뜀.");
    } else {
      runSoft("automation/publish-blogger.mjs", "3) 구글 블로거 발행");
    }
  }

  // 4) 워드프레스 발행 — 채널이 config 에서 활성화돼 있고 자격증명이 있을 때만
  //    (환경변수만으로 강제되지 않도록 config enabled 를 단일 스위치로 사용)
  const wpReady = !!(process.env.WPCOM_SITE && process.env.WPCOM_TOKEN) || !!process.env.WORDPRESS_URL;
  if (!paused && site.channels.wordpress.enabled && wpReady) {
    runSoft("automation/publish-wordpress.mjs", "4) 워드프레스 발행");
  }

  // 5) IndexNow 인덱싱 요청 (키 있을 때만, 기본 키 내장)
  if (site.indexNowKey) {
    runSoft("automation/indexnow.mjs", "5) IndexNow 인덱싱 요청");
  }

  console.log("\n[run-all] 파이프라인 완료.");
})();
