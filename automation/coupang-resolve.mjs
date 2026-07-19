// =============================================================
//  쿠팡 파트너스 딥링크 사전 생성기 (빌드 전 실행)
//  - COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 있을 때만 동작
//  - 모든 추천 상품 검색어를 쿠팡 오픈API(deeplink)로 추적 링크로 변환해
//    config/coupang-links-cache.json 에 저장 → 빌드 시 coupang.mjs 가 사용
//  - 키가 없으면 아무 것도 하지 않고 종료(파이프라인 계속)
//  - 실패해도 파이프라인을 막지 않도록 run-all 에서 runSoft 로 호출
//  ※ 오픈API 발급: partners.coupang.com → 기술지원 → OpenAPI 키 발급
// =============================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "./lib.mjs";
import { allSearchTargets } from "./coupang.mjs";

const ACCESS = process.env.COUPANG_ACCESS_KEY || "";
const SECRET = process.env.COUPANG_SECRET_KEY || "";
const SUBID = process.env.COUPANG_SUBID || process.env.COUPANG_PARTNER_ID || "";
const DOMAIN = "https://api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
const CACHE_FILE = path.join(ROOT, "config", "coupang-links-cache.json");

// 쿠팡 HMAC 서명: signed-date(yyMMdd'T'HHmmss'Z', GMT) + method + path
function authHeader(method, urlpath) {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const signedDate =
    `${p(now.getUTCFullYear() % 100)}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
  const message = signedDate + method + urlpath;
  const signature = crypto.createHmac("sha256", SECRET).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS}, signed-date=${signedDate}, signature=${signature}`;
}

async function deeplinkBatch(urls) {
  const body = JSON.stringify(SUBID ? { coupangUrls: urls, subId: SUBID } : { coupangUrls: urls });
  const res = await fetch(DOMAIN + PATH, {
    method: "POST",
    headers: {
      Authorization: authHeader("POST", PATH),
      "Content-Type": "application/json;charset=UTF-8",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`쿠팡 API ${res.status}: ${text.slice(0, 200)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`응답 파싱 실패: ${text.slice(0, 120)}`); }
  if (json.rCode && json.rCode !== "0") throw new Error(`rCode ${json.rCode}: ${json.rMessage || ""}`);
  return json.data || [];
}

async function main() {
  if (!ACCESS || !SECRET) {
    console.log("[coupang-resolve] COUPANG_ACCESS_KEY/SECRET_KEY 없음 — 딥링크 생성 건너뜀(검색 링크로 대체).");
    return;
  }
  const targets = allSearchTargets();
  const urlToKw = new Map(targets.map((t) => [t.url, t.kw]));
  const cache = {};
  // 오픈API는 한 번에 여러 URL 허용 — 안전하게 배치로 나눠 호출
  const CHUNK = 10;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const batch = targets.slice(i, i + CHUNK).map((t) => t.url);
    try {
      const data = await deeplinkBatch(batch);
      for (const d of data) {
        const kw = urlToKw.get(d.originalUrl);
        const link = d.shortenUrl || d.landingUrl;
        if (kw && link) cache[kw] = link;
      }
    } catch (e) {
      console.warn(`[coupang-resolve] ⚠ 배치 실패(${i}~): ${e.message}`);
    }
  }
  const n = Object.keys(cache).length;
  if (!n) {
    console.warn("[coupang-resolve] 생성된 링크 없음 — 키/권한을 확인하세요(검색 링크로 대체됨).");
    return;
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n", "utf8");
  console.log(`[coupang-resolve] 딥링크 ${n}개 생성 → config/coupang-links-cache.json`);
}

main().catch((e) => {
  console.warn("[coupang-resolve] ⚠ 오류(파이프라인 계속):", e.message);
});
