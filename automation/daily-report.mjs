// =============================================================
//  데일리 발행 리포트 생성기 (구글 메일 발송용)
//  - 3개 사이트의 배포된 /dashboard/data.json 을 가져와 하루 발행 현황을 집계
//  - HTML 리포트를 stdout(그리고 report.html) 로 출력 → daily-report.yml 이
//    이 결과를 운영자 Gmail 로 발송
//  - 위성 레포(SITE_PROFILE 지정)에서는 실행하지 않는다(메인 site 레포 전용)
//  - 네트워크 실패한 사이트는 "확인 실패"로 표시하고 계속 진행(리포트는 항상 나감)
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, todayKST } from "./lib.mjs";

const SITES = [
  { name: "오늘의 꿀팁 (스타쉽)", url: "https://starship-ent.ai.kr" },
  { name: "오늘의 머니꿀팁", url: "https://todayskkultip.co.kr" },
  { name: "Korea Unboxed (jype)", url: "https://jype.ai.kr" },
];

async function fetchSummary(site) {
  try {
    const res = await fetch(`${site.url}/dashboard/data.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    return { ...site, ok: true, s: j.summary || {} };
  } catch (e) {
    return { ...site, ok: false, err: e.message };
  }
}

function num(v) { return v == null ? "?" : v; }

function row(r) {
  if (!r.ok) {
    return `<tr><td>${r.name}</td><td colspan="5" style="color:#c00">확인 실패 (${r.err}) — 배포 지연/일시 오류일 수 있음</td></tr>`;
  }
  const s = r.s;
  const todayCell = (s.today || 0) > 0
    ? `<b style="color:#1a7f37">${s.today}편</b>`
    : `<span style="color:#999">0편</span>`;
  return `<tr>
    <td><a href="${r.url}">${r.name}</a></td>
    <td style="text-align:center">${todayCell}</td>
    <td style="text-align:center">${num(s.last7d)}편</td>
    <td style="text-align:center">${num(s.totalPosts)}편</td>
    <td style="text-align:center">${num(s.poolTotal)}개</td>
    <td style="text-align:center">${s.paused ? "⏸ 정지" : "▶ 가동"}</td></tr>`;
}

async function main() {
  if (process.env.SITE_PROFILE && process.env.SITE_PROFILE !== "default") {
    console.error("[daily-report] 위성 레포에서는 리포트를 보내지 않습니다.");
    process.exit(78); // 특별 종료코드: 워크플로우가 발송을 건너뛰도록
  }
  const results = await Promise.all(SITES.map(fetchSummary));
  const okSites = results.filter((r) => r.ok);
  const todayTotal = okSites.reduce((a, r) => a + (r.s.today || 0), 0);
  const weekTotal = okSites.reduce((a, r) => a + (r.s.last7d || 0), 0);
  const anyPaused = okSites.some((r) => r.s.paused);
  const lowPool = okSites.filter((r) => (r.s.poolTotal || 0) < 6);

  const date = todayKST();
  const notes = [];
  if (anyPaused) notes.push("⏸ 현재 <b>발행 일시정지</b> 상태입니다(전략 대기). 새 글 생성·채널 발행이 멈춰 있고 배포만 유지됩니다.");
  if (lowPool.length) notes.push(`🔻 주제 풀 부족: ${lowPool.map((r) => r.name).join(", ")} — 발행 재개 시 자동 보충됩니다.`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) notes.push(`⚠️ 데이터 확인 실패: ${failed.map((r) => r.name).join(", ")} — 사이트가 잠시 응답하지 않았을 수 있습니다.`);

  const html = `<!doctype html><html lang="ko"><body style="font-family:-apple-system,'Malgun Gothic',sans-serif;color:#1f2937;max-width:640px;margin:0 auto;padding:8px">
<h2 style="margin:0 0 4px">📊 데일리 발행 리포트</h2>
<div style="color:#6b7280;font-size:13px;margin-bottom:14px">${date} 기준 · 3개 사이트 자동 집계</div>

<div style="display:flex;gap:10px;margin-bottom:16px">
  <div style="flex:1;background:#eef6ff;border-radius:10px;padding:12px 14px">
    <div style="font-size:12px;color:#6b7280">오늘 발행</div>
    <div style="font-size:24px;font-weight:800">${todayTotal}<span style="font-size:13px;font-weight:400"> 편</span></div></div>
  <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:12px 14px">
    <div style="font-size:12px;color:#6b7280">최근 7일</div>
    <div style="font-size:24px;font-weight:800">${weekTotal}<span style="font-size:13px;font-weight:400"> 편</span></div></div>
</div>

<table style="width:100%;border-collapse:collapse;font-size:14px">
  <thead><tr style="background:#f9fafb;text-align:center">
    <th style="text-align:left;padding:8px">사이트</th><th style="padding:8px">오늘</th><th style="padding:8px">7일</th>
    <th style="padding:8px">누적</th><th style="padding:8px">남은주제</th><th style="padding:8px">상태</th></tr></thead>
  <tbody>${results.map(row).join("")}</tbody>
</table>

${notes.length ? `<div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7">
  ${notes.map((n) => `• ${n}`).join("<br>")}</div>` : ""}

<div style="margin-top:18px;font-size:13px">
  <a href="https://starship-ent.ai.kr/dashboard/" style="background:#2563eb;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:700">대시보드에서 자세히 보기 →</a></div>
<div style="margin-top:20px;color:#9ca3af;font-size:11px">이 메일은 매일 자동 발송됩니다. GitHub Actions daily-report.yml</div>
</body></html>`;

  const out = path.join(ROOT, "report.html");
  fs.writeFileSync(out, html, "utf8");
  // 워크플로우가 제목에 쓸 수 있게 요약 한 줄을 GITHUB_OUTPUT/stdout 으로도 노출
  const subject = `[데일리 발행] ${date} · 오늘 ${todayTotal}편 / 7일 ${weekTotal}편${anyPaused ? " · ⏸정지" : ""}`;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `subject=${subject}\n`);
  }
  console.log(subject);
}

main().catch((e) => { console.error("[daily-report] 오류:", e.message); process.exit(1); });
