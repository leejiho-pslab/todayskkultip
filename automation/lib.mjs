// =============================================================
//  공통 유틸 (파일 IO, slug, 날짜, frontmatter 읽기)
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { site } from "../config/site.config.js";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const POSTS_DIR = path.join(ROOT, "content", "posts");
export const PUBLIC_DIR = path.join(ROOT, "public");

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** 한국시간(KST) 기준 현재 시각 */
export function nowKST() {
  const now = new Date();
  // UTC+9
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

/** YYYY-MM-DD (KST) */
export function todayKST() {
  return nowKST().toISOString().slice(0, 10);
}

/** 한글 제목 -> URL slug. 한글은 유지하되 공백/특수문자 정리 */
export function slugify(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s-]/g, "") // 한글/영문/숫자/공백/하이픈만
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** marked 가 놓친 **굵게** 잔여 패턴 보정 (예: "**50~60%**입니다" — % 뒤 닫힘을
 *  marked 가 강조로 인식 못함). HTML 변환 후 남은 리터럴 별표쌍을 <strong> 으로 치환. */
export function fixLeftoverBold(html) {
  return html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

/** 본문에서 발췌(excerpt) 추출 */
export function excerpt(markdown, len = 110) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`\-\[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, len) + (text.length > len ? "…" : "");
}

/** 모든 발행글 로드 (frontmatter + 본문).
 *  멀티 사이트: 글 frontmatter 의 profile 이 현재 SITE_PROFILE 과 일치하는 글만 —
 *  이 레포를 템플릿으로 복제해 다른 프로필로 돌릴 때, 원본 사이트의 글이
 *  새 사이트에 섞여 빌드되는 것을 막는다 (profile 없는 기존 글 = default). */
export function loadPosts() {
  ensureDir(POSTS_DIR);
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  const posts = files
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, content } = matter(raw);
      return { ...data, body: content, file };
    })
    .filter((p) => (p.profile || "default") === (site.profile || "default"));
  // 최신순
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** 이미 다룬 제목 + 원천 주제 목록 (중복 발행 방지).
 *  글 제목은 생성 시 모델이 새로 짓기 때문에, 주제 풀과의 비교에는
 *  반드시 source_topic 도 포함해야 한다 (제목만 비교하면 같은 주제가 무한 재생성됨). */
export function existingTitles() {
  const used = new Set();
  for (const p of loadPosts()) {
    if (p.title) used.add(p.title);
    if (p.source_topic) used.add(p.source_topic);
  }
  return used;
}
