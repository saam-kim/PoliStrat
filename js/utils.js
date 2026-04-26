export const $ = (id) => document.getElementById(id);

export function isTeacherPinValid(value) {
  return String(value || "").trim() === "1234";
}

export function notice(msg, type = "") {
  $("notice").textContent = msg;
  $("notice").className = "notice " + type;
}

export function show(id) {
  ["setup", "teacherUI", "studentUI"].forEach((viewId) =>
    $(viewId).classList.toggle("hidden", viewId !== id)
  );
}

export function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function parseConfig(raw) {
  const trimmed = raw.trim();
  const match =
    trimmed.match(/firebaseConfig\s*=\s*({[\s\S]*?});?\s*$/) ||
    trimmed.match(/({[\s\S]*})/);

  if (!match) throw new Error("firebaseConfig 객체를 찾지 못했습니다.");

  return JSON.parse(
    match[1]
      .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
  );
}

export function score(team) {
  return Math.round(
    (team.gdp || 100) * 0.4 +
      (team.military || 50) * 0.3 +
      (team.diplomacy || 30) * 0.2 +
      (team.support || 60) * 0.1 +
      (team.defensePosture || 0) * 2 +
      (team.strategicPoints || 0)
  );
}

export function victoryTitles(team, rankedTeams = []) {
  const titles = [];
  const top = (field) => rankedTeams.length && rankedTeams.every((item) => (team[field] || 0) >= (item[field] || 0));

  if (rankedTeams[0]?.id === team.id) titles.push("종합 패권국");
  if (top("military")) titles.push("군사 패권국");
  if (top("diplomacy")) titles.push("외교 중재국");
  if (top("gdp")) titles.push("경제 강국");
  if (top("strategicPoints")) titles.push("핵심 거점 장악국");
  if ((team.food || 0) >= 80 && (team.energy || 0) >= 70) titles.push("생존 안정국");
  if ((team.support || 0) >= 75) titles.push("국내 결속 우수국");

  return titles.length ? titles : ["균형 추구국"];
}

export function teamKeyForIndex(index) {
  return ["a", "b", "c", "d", "e", "f"][index] || "a";
}

export function bar(value, max = 150) {
  return Math.max(5, Math.min(100, (value / max) * 100));
}

export function shortName(name) {
  const clean = String(name || "").replace(/\s+/g, "").trim();
  return clean ? clean.slice(0, 2) : "";
}

export function displayName(team, id) {
  return team.name && String(team.name).trim() ? team.name : id;
}

export function fullCountryName(team, id) {
  const name = displayName(team, id);
  return team.typeLabel ? `${name} - ${team.typeLabel}` : name;
}

export function renderSessionTimer(sessionData) {
  const seconds = sessionData?.timerRunning && sessionData?.timerEndAtMs
    ? Math.max(0, Math.ceil((sessionData.timerEndAtMs - Date.now()) / 1000))
    : sessionData?.timerSeconds || 300;
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  document.querySelectorAll(".timer").forEach((timer) => {
    timer.textContent = `${minutes}:${rest}`;
  });
}
