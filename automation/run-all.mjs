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
import { ROOT } from "./lib.mjs";
import { site } from "../config/site.config.js";

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
  const doGenerate = process.env.GENERATE !== "false";
  const doBlogger =
    process.env.PUBLISH_BLOGGER === "true" && site.channels.blogger.enabled;

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
  runSoft("automation/coupang-resolve.mjs", "1.5) 쿠팡 추적 링크 생성");

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
  if (site.channels.wordpress.enabled && wpReady) {
    runSoft("automation/publish-wordpress.mjs", "4) 워드프레스 발행");
  }

  // 5) IndexNow 인덱싱 요청 (키 있을 때만, 기본 키 내장)
  if (site.indexNowKey) {
    runSoft("automation/indexnow.mjs", "5) IndexNow 인덱싱 요청");
  }

  console.log("\n[run-all] 파이프라인 완료.");
})();
