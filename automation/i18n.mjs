// =============================================================
//  i18n — 사이트 UI 문자열 (프로필 언어에 따라 한국어/영어 선택)
//  build.mjs / render.mjs / publish-*.mjs 가 사용한다.
//  문자열 자체는 automation/locales/{ko,en}.mjs 에 정의.
// =============================================================
import { site } from "../config/site.config.js";
import { ko } from "./locales/ko.mjs";
import { en } from "./locales/en.mjs";

export const t = String(site.lang || "ko").toLowerCase().startsWith("en") ? en : ko;
export default t;
