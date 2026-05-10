import { $ } from "./utils.js?v=20260510-polistrat-flow10";

const resumeKey = "polistrat_resume_v1";
const legacyResumeKey = ["geo", "strat"].join("") + "_resume_v1";

export function saveResume(data) {
  localStorage.setItem(
    resumeKey,
    JSON.stringify({
      ...data,
      savedAt: Date.now()
    })
  );
}

export function getResume() {
  try {
    const saved = localStorage.getItem(resumeKey) || localStorage.getItem(legacyResumeKey);
    return JSON.parse(saved || "null");
  } catch (error) {
    return null;
  }
}

export function clearResume() {
  localStorage.removeItem(resumeKey);
  localStorage.removeItem(legacyResumeKey);
  renderResumeBox();
}

export function renderResumeBox() {
  const data = getResume();
  const box = $("resumeBox");
  if (!box) return;

  if (!data || !data.sessionId) {
    box.classList.add("hidden");
    return;
  }

  box.classList.remove("hidden");
  const roleText = data.mode === "teacher" ? "교사용 대시보드" : "학생 모둠 화면";
  const nameText = data.teamName ? ` · ${data.teamName}` : "";
  $("resumeInfo").textContent = `${roleText} · 세션 ${data.sessionId}${nameText}`;
}
