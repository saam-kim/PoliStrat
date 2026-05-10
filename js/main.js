import { bindStudentEvents, watchStudent } from "./student.js?v=20260510-polistrat-flow9";
import { bindTeacherEvents, watchTeacher } from "./teacher.js?v=20260510-polistrat-flow9";
import { doc, getDoc, initFirebase } from "./firebase.js?v=20260510-polistrat-flow9";
import { redrawMaps } from "./map.js?v=20260510-polistrat-flow9";
import { clearResume, getResume, renderResumeBox, saveResume } from "./resume.js?v=20260510-polistrat-flow9";
import { cleanup, state } from "./state.js?v=20260510-polistrat-flow9";
import { $, isTeacherPinValid, notice, parseConfig, renderSessionTimer, show } from "./utils.js?v=20260510-polistrat-flow9";

async function resumeGame() {
  const data = getResume();
  if (!data || !data.sessionId) {
    return notice("복구할 이전 게임 기록이 없습니다.", "err");
  }

  if (data.mode === "teacher" && !isTeacherPinValid($("teacherPin")?.value)) {
    $("teacherPin")?.focus();
    return notice("교사용 PIN이 올바르지 않습니다.", "err");
  }

  if (!(await initFirebase())) return;

  const sessionSnap = await getDoc(doc(state.db, "sessions", data.sessionId));
  if (!sessionSnap.exists()) {
    clearResume();
    return notice("이전 세션이 Firebase에 존재하지 않습니다. 기록을 지웠습니다.", "err");
  }

  cleanup();
  state.currentSessionId = data.sessionId;

  if (data.mode === "teacher") {
    show("teacherUI");
    watchTeacher(data.sessionId);
    notice(`교사용 세션 ${data.sessionId}으로 복구했습니다.`, "ok");
    return;
  }

  if (data.mode === "student") {
    if (!data.teamId) {
      clearResume();
      return notice("학생 모둠 정보가 없어 복구할 수 없습니다.", "err");
    }

    const teamSnap = await getDoc(doc(state.db, "sessions", data.sessionId, "teams", data.teamId));
    if (!teamSnap.exists()) {
      clearResume();
      return notice("이전 모둠 정보가 Firebase에 없습니다. 다시 참가해주세요.", "err");
    }

    show("studentUI");
    watchStudent(data.sessionId, data.teamId);
    notice(`학생 모둠 세션 ${data.sessionId}으로 복구했습니다.`, "ok");
    return;
  }

  notice("알 수 없는 복구 기록입니다.", "err");
}

function bindSettingsEvents() {
  $("saveConfig").onclick = async () => {
    try {
      const config = parseConfig($("configInput").value);
      localStorage.setItem("polistrat_firebase_config", JSON.stringify(config));
      await initFirebase();
      notice("Firebase 연결 완료.", "ok");
    } catch (error) {
      notice("설정 저장 실패: " + error.message, "err");
    }
  };

  $("clearConfig").onclick = () => {
    localStorage.removeItem("polistrat_firebase_config");
    localStorage.removeItem(["geo", "strat"].join("") + "_firebase_config");
    $("configInput").value = "";
    $("settingsPanel").classList.remove("hidden");
    notice("설정을 지웠습니다.");
  };

  $("toggleSettings").onclick = () => {
    $("settingsPanel").classList.toggle("hidden");
  };
}

function hydrateSavedConfig() {
  const saved =
    localStorage.getItem("polistrat_firebase_config") ||
    localStorage.getItem(["geo", "strat"].join("") + "_firebase_config");
  if (saved) {
    $("configInput").value = "const firebaseConfig = " + JSON.stringify(JSON.parse(saved), null, 2) + ";";
    $("settingsPanel").classList.add("hidden");
    notice("저장된 Firebase 설정을 불러왔습니다. 바로 시작할 수 있습니다.", "ok");
    return;
  }

  $("settingsPanel").classList.remove("hidden");
  notice("처음 사용이라면 Firebase 설정을 먼저 저장하세요.", "");
}

bindSettingsEvents();
bindTeacherEvents({ initFirebase, saveResume });
bindStudentEvents({ initFirebase, saveResume });

$("resumeGameBtn").onclick = resumeGame;
$("clearResumeBtn").onclick = clearResume;

hydrateSavedConfig();
renderResumeBox();
redrawMaps();
setInterval(() => renderSessionTimer(state.currentSessionData), 1000);
