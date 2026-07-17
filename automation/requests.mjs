// =============================================================
//  사용자 요청/의견 로더
//  - config/requests.json 에서 사용자가 직접 넣은 주제·편집 의견을 읽음
//  - 자동 발행이 시즌 주제보다 '먼저' 사용자 요청을 처리
//  - 발행 후 해당 요청의 status 를 done 으로 기록
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { site } from "../config/site.config.js";

const FILE = path.join(ROOT, "config", "requests.json");
const VALID_CATS = new Set(site.categories.map((c) => c.slug));

export function loadRequests() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return {
      notes: (data.notes || "").trim(),
      topics: Array.isArray(data.topics) ? data.topics : [],
      _raw: data,
    };
  } catch {
    return { notes: "", topics: [], _raw: { notes: "", topics: [] } };
  }
}

/** 전역 편집 지침(모든 글 공통) */
export function editorialNotes() {
  return loadRequests().notes;
}

/** 발행 대기(pending) 사용자 주제 목록 — 카테고리 검증/정규화 포함 */
export function pendingTopics() {
  return loadRequests()
    .topics.filter((t) => (t.status || "").toLowerCase() === "pending" && t.title)
    .map((t) => ({
      title: t.title.trim(),
      category: VALID_CATS.has(t.category) ? t.category : "life",
      keywords: Array.isArray(t.keywords) ? t.keywords : [],
      note: (t.note || "").trim(),
      fromUser: true,
    }));
}

/** 대시보드 표시용: 모든 사용자 주제(상태 포함, example 제외) */
export function listTopicsForDashboard() {
  return loadRequests()
    .topics.filter((t) => (t.status || "").toLowerCase() !== "example" && t.title)
    .map((t) => ({
      title: t.title.trim(),
      category: VALID_CATS.has(t.category) ? t.category : "life",
      status: (t.status || "pending").toLowerCase(),
      note: (t.note || "").trim(),
    }));
}

/** 발행 완료 표시: 해당 title 의 요청 status 를 done 으로 갱신 */
export function markRequestDone(title) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return false;
  }
  let changed = false;
  for (const t of data.topics || []) {
    if (t.title && t.title.trim() === title.trim() && (t.status || "").toLowerCase() === "pending") {
      t.status = "done";
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
  return changed;
}
