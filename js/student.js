import {
  actionDefinitions,
  displayPhaseName,
  diplomacyTypes,
  phaseDescriptions
} from "./data.js";
import {
  addDoc,
  addLog,
  assignRandomCountryType,
  collection,
  doc,
  getDoc,
  getDocs,
  getMyTeamData,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "./firebase.js";
import {
  actionByName,
  checkAction,
  formatActionCosts,
  formatActionEffects,
  isStrategicIndex
} from "./gameRules.js";
import { isStrategicTile, redrawMaps, setActiveLayoutByTeamCount, watchTeamNames, watchTiles } from "./map.js";
import { cleanup, state } from "./state.js";
import { $, bar, displayName, fullCountryName, notice, renderSessionTimer, score, show, teamKeyForIndex, victoryTitles } from "./utils.js";

let sessionTeams = [];
let sessionDiplomacy = [];
let pendingSubmitAction = null;

function setActionBox(msg, type = "") {
  const box = $("actionResultBox");
  if (!box) return;

  box.textContent = msg;
  box.style.borderColor = type === "err" ? "var(--pink)" : type === "ok" ? "var(--green)" : "#24496f";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindStudentTabs() {
  document.querySelectorAll(".student-tab").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".student-tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".student-pane").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`.student-pane[data-pane="${button.dataset.studentTab}"]`)?.classList.add("active");
    };
  });
}

function showStudentTab(name) {
  const button = document.querySelector(`.student-tab[data-student-tab="${name}"]`);
  if (button) button.click();
}

function updateStudentGuide(phase) {
  const guide = $("studentQuickGuide");
  if (!guide) return;

  if (localStorage.getItem("polistrat_student_guide_dismissed") === "1") {
    guide.classList.add("hidden-guide");
    return;
  }

  guide.classList.remove("hidden-guide");
  const activeStep =
    phase === "외교 페이즈"
      ? "diplomacy"
      : phase === "행동 입력"
        ? "actions"
        : phase === "결과 처리"
          ? "results"
          : "resources";
  const order = ["resources", "diplomacy", "actions", "results"];
  const activeIndex = order.indexOf(activeStep);
  guide.querySelectorAll("[data-guide-step]").forEach((item) => {
    const index = order.indexOf(item.dataset.guideStep);
    item.classList.toggle("active", item.dataset.guideStep === activeStep);
    item.classList.toggle("done", index >= 0 && index < activeIndex);
  });
}

function renderStudentPhaseGuide(phase) {
  const box = $("studentPhaseGuide");
  if (!box) return;

  const info = phaseDescriptions[displayPhaseName(phase)];
  if (!info) {
    box.innerHTML = "<b>페이즈 안내</b><span>교사의 페이즈 진행에 맞춰 모둠 활동을 준비하세요.</span>";
    return;
  }

  box.innerHTML = `<b>${info.title}</b><span>${info.keywords}</span>`;
}

function renderActionCards() {
  const list = $("actionList");
  if (!list) return;

  list.innerHTML = actionDefinitions
    .map(
      (action) => `<div class="action" data-action="${action.name}">
        <div class="action-main">
          <div class="action-head">
            <span>${action.icon} <b>${action.name}</b></span>
            <small>${action.phase}</small>
          </div>
          <span class="muted">${action.summary}</span>
          <div class="action-flow">
            <span class="action-cost"><b>소모</b> ${formatActionCosts(action)}</span>
            <span class="action-gain"><b>효과</b> ${formatActionEffects(action)}</span>
          </div>
          <div class="action-reason">세션 정보를 불러오는 중입니다.</div>
        </div>
        <div class="check"></div>
      </div>`
    )
    .join("");
}

function applyActionFilter() {
  const filter = $("actionFilter")?.value || "current";
  const phase = state.currentSessionData?.phase;

  document.querySelectorAll(".action").forEach((el) => {
    const action = actionByName(el.dataset.action);
    const phaseMatch = !!action && action.phase === phase;
    const available = !el.classList.contains("unavailable");
    const hidden = filter === "current" ? !phaseMatch : filter === "available" ? !available : false;
    el.classList.toggle("filtered-out", hidden);
  });
}

function currentTurn() {
  return state.currentSessionData?.turn || 1;
}

function hasSubmittedThisTurn() {
  return state.currentTeamData?.submittedTurn === currentTurn();
}

function setStudentSubmitState(message, variant = "wait") {
  const box = $("studentSubmitState");
  if (!box) return;

  box.className = `student-submit-state ${variant}`;
  box.textContent = message;
}

function updateActionAvailability() {
  const phase = displayPhaseName(state.currentSessionData?.phase);
  const locked = !!state.currentSessionData?.submissionLocked;
  const submitted = hasSubmittedThisTurn();
  const resultProcessed = state.currentTeamData?.processedTurn === currentTurn();
  const canSubmitInPhase = actionDefinitions.some((action) => action.phase === phase);

  document.querySelectorAll(".action").forEach((el) => {
    const action = actionByName(el.dataset.action);
    const wrongPhase = !!phase && !!action && action.phase !== phase;
    let reason = "선택 가능";
    let resourceBlocked = false;

    if (submitted) reason = "이번 턴 제출 완료";
    else if (locked) reason = "교사가 제출을 마감했습니다.";
    else if (wrongPhase && action) reason = `${action.phase} 단계에서 선택 가능`;
    else if (action && state.currentTeamData) {
      const check = checkAction(action, state.currentTeamData, state.selectedTile);
      resourceBlocked = !check.ok;
      reason = check.ok ? "선택 가능" : check.msg;
    }

    const unavailable = locked || submitted || wrongPhase || resourceBlocked;
    const reasonBox = el.querySelector(".action-reason");

    el.classList.toggle("unavailable", unavailable);
    el.classList.toggle("submitted", submitted);
    el.title = reason;
    if (reasonBox) {
      reasonBox.textContent = reason;
      reasonBox.classList.toggle("ok", !unavailable);
    }
  });

  const submit = $("submitAction");
  const canSubmit = canSubmitInPhase && !locked && !submitted;
  if (submit) {
    submit.disabled = !canSubmit;
    submit.textContent = submitted ? "제출 완료" : locked ? "제출 마감" : canSubmit ? "⚡ 모둠 최종 결정 제출" : "현재 페이즈 제출 불가";
  }

  if (submitted) {
    const message = resultProcessed ? "이번 턴 결과가 처리되었습니다." : "이번 턴 행동 제출 완료 · 교사 처리 대기";
    setStudentSubmitState(message, resultProcessed ? "done" : "wait");
    setActionBox(message, "ok");
  } else if (locked) {
    setStudentSubmitState("교사가 제출을 마감했습니다.", "locked");
    setActionBox("교사가 제출을 마감했습니다.", "err");
  } else if (canSubmitInPhase) {
    setStudentSubmitState(`${phase}: 선택 가능한 행동을 제출하세요.`, "open");
    setActionBox("행동을 선택하고 제출하세요.", "ok");
  } else {
    setStudentSubmitState(`${phase || "대기"}: 제출 페이즈가 아닙니다.`, "wait");
    if (phase) setActionBox(`${phase} 단계입니다. 외교/행동 페이즈에 제출할 수 있습니다.`);
  }

  applyActionFilter();
}

function renderStudentResultPanel() {
  const box = $("studentResultPanel");
  const team = state.currentTeamData;
  if (!box || !team) return;

  if (state.currentSessionData?.gameEnded) {
    const ranked = [...sessionTeams].sort((a, b) => score(b) - score(a));
    const titles = victoryTitles({ id: state.currentTeamId, ...team }, ranked);
    box.className = "result-box result-panel final";
    box.innerHTML = `<b>게임 종료</b><br>최종 점수 ${score(team)} · 핵심 ${team.strategicPoints || 0} · 점령 ${
      team.conqueredTiles || 0
    }<div class="title-badges">${titles.map((title) => `<span class="title-badge">${title}</span>`).join("")}</div>`;
    $("studentVictoryPanel").innerHTML = `<b>우리 국가 타이틀</b><br>${titles.join(" · ")}`;
    $("studentVictoryPanel").className = "result-box result-panel final";
    return;
  }

  const summary = team.lastTurnSummary;
  if (!summary) {
    box.className = "result-box result-panel";
    box.textContent = "아직 처리된 턴 결과가 없습니다.";
    return;
  }

  box.className = "result-box result-panel done";
  box.innerHTML = `<b>턴 ${summary.turn} 결과</b><br>${summary.action || "행동 미제출"}
    <br>행동 효과: ${summary.actionDeltaText || "없음"}
    <br>이벤트 효과: ${summary.eventDeltaText || "없음"}
    <br>합계: <span class="summary-delta">${summary.deltaText || "변화 없음"}</span>${
      team.lastDiplomacySummary ? `<br>최근 외교: ${team.lastDiplomacySummary.type} · ${team.lastDiplomacySummary.deltaText}` : ""
    }`;
  $("studentVictoryPanel").className = "result-box result-panel";
  $("studentVictoryPanel").textContent = "점수 기준: GDP 40% · 군사 30% · 외교 20% · 지지율 10% · 방어/핵심 가산";
}

function renderDiplomacyTargets() {
  const select = $("diplomacyTarget");
  if (!select) return;

  const others = sessionTeams.filter((team) => team.id !== state.currentTeamId);
  select.innerHTML = others
    .map((team) => `<option value="${team.id}">${escapeHtml(displayName(team, team.id))}</option>`)
    .join("");
  if (!others.length) select.innerHTML = "<option value=''>대상 국가 없음</option>";
}

function renderDiplomacyPreview() {
  const box = $("diplomacyPreview");
  if (!box) return;

  const type = diplomacyTypes[$("diplomacyType")?.value];
  if (!type) {
    box.textContent = "협정 효과를 선택하면 미리보기가 표시됩니다.";
    return;
  }

  box.innerHTML = `<b>${type.label}</b><br>${type.desc}<br>제안국: ${formatActionEffects({
    effects: type.proposerEffects
  })}<br>상대국: ${formatActionEffects({ effects: type.partnerEffects })}`;
}

function renderStudentDiplomacyList() {
  const box = $("studentDiplomacyList");
  if (!box) return;

  const mine = sessionDiplomacy.filter(
    (item) => item.fromTeamId === state.currentTeamId || item.toTeamId === state.currentTeamId
  );
  const sent = mine.filter((item) => item.fromTeamId === state.currentTeamId);
  const received = mine.filter((item) => item.toTeamId === state.currentTeamId);

  const renderGroup = (title, items) =>
    items.length
      ? `<div class="diplomacy-section-title">${title}</div>${items
          .map((item) => {
        const type = diplomacyTypes[item.type] || { label: item.type || "협정" };
        const statusText = item.status === "approved" ? "승인" : item.status === "rejected" ? "거절" : "교사 검토 대기";
        return `<div class="diplomacy-card ${item.status || "pending"}">
          <b>${type.label}</b>
          <div>${escapeHtml(item.fromName)} → ${escapeHtml(item.toName)}</div>
          <div>상태: ${statusText}</div>
          <div class="muted">${escapeHtml(item.note || type.desc || "")}</div>
          ${item.effectText ? `<div class="summary-delta">${escapeHtml(item.effectText)}</div>` : ""}
        </div>`;
      })
          .join("")}`
      : "";

  box.innerHTML = mine.length
    ? `${renderGroup("받은 제안", received)}${renderGroup("보낸 제안", sent)}`
    : "외교 제안이 아직 없습니다.";
}

function renderSelectedCountryIntel(team, tileIndex) {
  const box = $("selectedCountryPanel");
  if (!box) return;

  if (!team) {
    box.innerHTML = `<b>타국 상세 현황</b><div class="muted">선택한 타일은 국가 소유지가 아닙니다. 외교 대상국의 타일을 누르면 상세 현황이 표시됩니다.</div>`;
    return;
  }

  const isMine = team.id === state.currentTeamId;
  const ranked = [...sessionTeams].sort((a, b) => score(b) - score(a));
  const titles = victoryTitles(team, ranked);
  box.innerHTML = `<b>${escapeHtml(displayName(team, team.id))}${isMine ? " · 우리 국가" : ""}</b>
    <div class="muted">${escapeHtml(team.typeLabel || "국가 유형 미지정")} · 타일 ${tileIndex}</div>
    <div class="intel-grid">
      <div class="intel-stat"><span>GDP / 예산</span><strong>${team.gdp || 0} / ${team.budget || 0}</strong></div>
      <div class="intel-stat"><span>군사력</span><strong>${team.military || 0}</strong></div>
      <div class="intel-stat"><span>외교</span><strong>${team.diplomacy || 0}</strong></div>
      <div class="intel-stat"><span>지지율</span><strong>${team.support || 0}%</strong></div>
      <div class="intel-stat"><span>식량</span><strong>${team.food || 0}%</strong></div>
      <div class="intel-stat"><span>에너지</span><strong>${team.energy || 0}%</strong></div>
    </div>
    <div class="title-badges">${titles.map((title) => `<span class="title-badge">${title}</span>`).join("")}</div>
    <div class="muted" style="margin-top:8px">최근 행동: ${escapeHtml(team.lastAction || "없음")} · 핵심 ${
      team.strategicPoints || 0
    } · 점령 ${team.conqueredTiles || 0}</div>`;
}

function openSubmitConfirm(action, check, tileIndex) {
  pendingSubmitAction = { action, check, tileIndex };
  const tileText = action.requiresTile
    ? `<br>대상 타일: ${tileIndex}${isStrategicIndex(tileIndex) ? " · 핵심 지역" : ""}`
    : "";
  $("submitConfirmContent").innerHTML = `<b>${escapeHtml(action.name)}</b><br>${escapeHtml(
    check.msg
  )}${tileText}<br><span class="muted">제출 후 변경하려면 교사에게 제출 취소를 요청해야 합니다.</span>`;
  $("submitConfirmModal").classList.remove("hidden");
}

function closeSubmitConfirm() {
  pendingSubmitAction = null;
  $("submitConfirmModal").classList.add("hidden");
}

async function submitSelectedAction(action, check, tileIndex) {
  const patch = {
    pendingActionId: action.id,
    pendingActionName: action.name,
    pendingTile: tileIndex,
    pendingStrategic: action.requiresTile ? isStrategicIndex(tileIndex) : false,
    pendingResultText: check.msg,
    submittedTurn: state.currentSessionData.turn || 1,
    processedTurn: 0,
    actionResult: "제출 완료 · 결과 처리 대기"
  };

  await updateDoc(doc(state.db, "sessions", state.currentSessionId, "teams", state.currentTeamId), patch);

  state.currentTeamData = { ...state.currentTeamData, ...patch };
  updateActionAvailability();
  setActionBox("제출 완료: 교사가 결과 처리 페이즈에서 일괄 반영합니다. " + check.msg, "ok");

  const tileText = action.requiresTile
    ? isStrategicTile(state.selectedTile)
      ? ` · ★ 핵심 타일 ${state.selectedTile}`
      : ` · 일반 타일 ${state.selectedTile}`
    : "";

  await addLog(`${$("studentCountry").textContent} 행동 제출: ${action.name}${tileText} · 결과 처리 대기`);
}

function bindStudentTileIntel() {
  window.addEventListener("polistrat:student-tile-selected", (event) => {
    const { ownerTeamId, tileIndex } = event.detail || {};
    const team = sessionTeams.find((item) => item.id === ownerTeamId);
    renderSelectedCountryIntel(team, tileIndex);
  });
}

export function showCountryTypeModal(name, type) {
  $("modalCountryName").textContent = name;
  $("modalTypeName").textContent = `${type.label} — ${type.desc}`;
  $("modalTypeDesc").textContent = "이 유형에 맞는 전략을 모둠에서 먼저 논의해 보세요.";
  $("modalGdp").textContent = `${type.gdp} / ${type.budget}`;
  $("modalMil").textContent = type.military;
  $("modalDip").textContent = type.diplomacy;
  $("modalEnergy").textContent = `${type.energy}%`;
  $("modalTip").textContent = "전략 팁: " + (type.tip || "모둠원과 역할을 나누어 국가 전략을 세워보세요.");
  $("typeModal").classList.remove("hidden");
}

export function watchStudent(code, teamId) {
  cleanup();
  state.currentSessionId = code;
  state.currentTeamId = teamId;
  $("studentSessionCode").textContent = code;

  watchTiles(code);
  watchTeamNames(code);

  state.unsubs.push(
    onSnapshot(doc(state.db, "sessions", code), (snap) => {
      const data = snap.data();
      if (!data) return;

      state.currentSessionData = data;
      if (data.teamsLocked) {
        setActiveLayoutByTeamCount(data.confirmedTeamCount || 6);
        redrawMaps();
      }

      $("studentPhase").textContent = "⚡ " + displayPhaseName(data.phase);
      $("studentTurn").textContent = data.turn || 1;
      renderSessionTimer(data);
      renderStudentPhaseGuide(data.phase);
      updateStudentGuide(displayPhaseName(data.phase));
      renderStudentResultPanel();
      $("eventBanner").textContent = data.event
        ? `이벤트: ${data.event}`
        : data.teamsLocked
          ? `참여 모둠 확정: ${data.confirmedTeamCount}모둠`
          : "이벤트 없음";

      updateActionAvailability();
    })
  );

  state.unsubs.push(
    onSnapshot(doc(state.db, "sessions", code, "teams", teamId), (snap) => {
      const team = snap.data();
      if (!team) return;

      state.currentTeamData = team;
      $("studentCountry").textContent = fullCountryName(team, state.currentTeamId);
      $("studentRole").textContent = team.role;
      redrawMaps();

      $("sGdp").textContent = `${team.gdp} / ${team.budget}`;
      $("sMil").textContent = team.military;
      $("sDip").textContent = team.diplomacy;
      $("sSupport").textContent = team.support + "%";
      $("sFood").textContent = team.food + "%";
      $("sEnergy").textContent = team.energy + "%";
      $("sGdpBar").style.width = bar(team.gdp, 160) + "%";
      $("sMilBar").style.width = bar(team.military, 100) + "%";
      $("sDipBar").style.width = bar(team.diplomacy, 80) + "%";
      $("sSupportBar").style.width = team.support + "%";
      $("sFoodBar").style.width = team.food + "%";
      $("sEnergyBar").style.width = team.energy + "%";
      updateActionAvailability();
      renderStudentResultPanel();
    })
  );

  state.unsubs.push(
    onSnapshot(collection(state.db, "sessions", code, "teams"), (snap) => {
      sessionTeams = [];
      snap.forEach((item) => sessionTeams.push({ id: item.id, ...item.data() }));
      renderDiplomacyTargets();
      renderStudentResultPanel();
    })
  );

  state.unsubs.push(
    onSnapshot(collection(state.db, "sessions", code, "diplomacy"), (snap) => {
      sessionDiplomacy = [];
      snap.forEach((item) => sessionDiplomacy.push({ id: item.id, ...item.data() }));
      sessionDiplomacy.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderStudentDiplomacyList();
    })
  );
}

export function bindStudentEvents({ initFirebase, saveResume }) {
  bindStudentTabs();
  bindStudentTileIntel();
  renderDiplomacyPreview();
  $("diplomacyType").onchange = renderDiplomacyPreview;
  $("dismissStudentGuideBtn").onclick = () => {
    localStorage.setItem("polistrat_student_guide_dismissed", "1");
    $("studentQuickGuide").classList.add("hidden-guide");
  };

  $("startStudent").onclick = async () => {
    try {
      if (!(await initFirebase())) return;

      const code = $("joinCode").value.trim().toUpperCase();
      if (!code) return notice("학생 참가 코드를 입력하세요.", "err");

      const sessionSnap = await getDoc(doc(state.db, "sessions", code));
      if (!sessionSnap.exists()) return notice("해당 세션이 없습니다.", "err");
      if (sessionSnap.data().teamsLocked) {
        return notice("이미 참여 모둠이 확정되어 추가 입장이 제한됩니다.", "err");
      }

      const name = $("teamName").value.trim() || "이름 없는 모둠";
      const existingTeamsForName = await getDocs(collection(state.db, "sessions", code, "teams"));
      const duplicate = existingTeamsForName.docs.some((item) => (item.data().name || "").trim() === name);
      if (duplicate) {
        const existing = existingTeamsForName.docs.find((item) => (item.data().name || "").trim() === name);
        const teamId = existing.id;
        show("studentUI");
        saveResume({ mode: "student", sessionId: code, teamId, teamName: name });
        watchStudent(code, teamId);
        notice(`${name} 모둠으로 다시 접속했습니다.`, "ok");
        await addLog(`${name} 모둠이 기존 기록으로 다시 접속했습니다.`);
        return;
      }

      const teamId = "team_" + crypto.randomUUID().slice(0, 8);
      const role = "모둠 공동 화면";
      const assigned = await assignRandomCountryType(code);
      const { typeKey, type } = assigned;
      const existingTeams = await getDocs(collection(state.db, "sessions", code, "teams"));
      const mapKey = teamKeyForIndex(existingTeams.size);

      await setDoc(doc(state.db, "sessions", code, "teams", teamId), {
        name,
        role,
        mapKey,
        typeKey,
        typeLabel: type.label,
        typeDesc: type.desc,
        gdp: type.gdp,
        budget: type.budget,
        military: type.military,
        diplomacy: type.diplomacy,
        support: type.support,
        food: type.food,
        energy: type.energy,
        defensePosture: 0,
        strategicPoints: 0,
        conqueredTiles: 0,
        lastAction: "",
        submittedTurn: 0,
        actionResult: "",
        joinedAt: serverTimestamp()
      });

      show("studentUI");
      saveResume({ mode: "student", sessionId: code, teamId, teamName: name });
      watchStudent(code, teamId);
      showCountryTypeModal(name, type);
      await addLog(`${name} - ${type.label} 참가`);
    } catch (error) {
      notice("학생 참가 실패: " + error.message, "err");
    }
  };

  renderActionCards();
  $("actionFilter").onchange = applyActionFilter;
  updateActionAvailability();

  document.querySelectorAll(".action").forEach((el) => {
    el.onclick = () => {
      const action = actionByName(el.dataset.action);
      if (hasSubmittedThisTurn()) {
        setActionBox("이번 턴에는 이미 행동을 제출했습니다. 교사 결과 처리를 기다리세요.", "ok");
        return;
      }
      if (state.currentSessionData?.submissionLocked) {
        setActionBox("교사가 제출을 마감했습니다.", "err");
        return;
      }
      if (state.currentSessionData && action && state.currentSessionData.phase !== action.phase) {
        setActionBox(
          `${action.name}은(는) '${action.phase}' 단계에서 제출할 수 있습니다. 현재 단계: ${state.currentSessionData.phase}`,
          "err"
        );
        return;
      }

      document.querySelectorAll(".action").forEach((item) => item.classList.remove("selected"));
      el.classList.add("selected");

      state.selectedAction = {
        name: el.dataset.action
      };

      setActionBox(`${state.selectedAction.name} 선택됨. 제출 전 자원 조건을 확인합니다.`);
    };
  });

  $("submitAction").onclick = async () => {
    if (!state.selectedAction) return alert("행동을 선택하세요.");
    if (!state.currentSessionData) return alert("세션 정보를 불러오는 중입니다.");
    if (state.currentSessionData.submissionLocked) return alert("교사가 이번 턴 제출을 마감했습니다.");

    const action = actionByName(state.selectedAction.name);
    if (!action) return alert("알 수 없는 행동입니다.");
    if (state.currentSessionData.phase !== action.phase) {
      return alert(
        `${state.selectedAction.name}은(는) '${action.phase}' 단계에서 제출할 수 있습니다. 현재 단계: ${state.currentSessionData.phase}`
      );
    }

    const team = await getMyTeamData();
    if (!team) return alert("모둠 정보를 불러오지 못했습니다.");
    if (team.submittedTurn === (state.currentSessionData.turn || 1)) {
      return alert("이번 턴에는 이미 행동을 제출했습니다.");
    }

    const check = checkAction(action, team, state.selectedTile);
    if (!check.ok) {
      setActionBox(check.msg, "err");
      return alert(check.msg);
    }

    const tileIndex = action.requiresTile ? state.selectedTile : null;
    state.currentTeamData = team;
    openSubmitConfirm(action, check, tileIndex);
  };

  $("cancelSubmitConfirmBtn").onclick = closeSubmitConfirm;
  $("confirmSubmitActionBtn").onclick = async () => {
    if (!pendingSubmitAction) return closeSubmitConfirm();
    const { action, check, tileIndex } = pendingSubmitAction;
    closeSubmitConfirm();
    await submitSelectedAction(action, check, tileIndex);
  };

  $("sendDiplomacyBtn").onclick = async () => {
    if (!state.currentSessionId || !state.currentTeamId || !state.currentTeamData) {
      return alert("세션과 모둠 정보를 먼저 불러와야 합니다.");
    }
    if (state.currentSessionData?.phase !== "외교 페이즈") {
      return alert("외교 제안은 외교 페이즈에서 보낼 수 있습니다.");
    }

    const targetId = $("diplomacyTarget").value;
    const target = sessionTeams.find((team) => team.id === targetId);
    if (!target) return alert("외교 제안 대상국을 선택하세요.");

    const typeKey = $("diplomacyType").value;
    const type = diplomacyTypes[typeKey];
    const note = $("diplomacyNote").value.trim();

    await addDoc(collection(state.db, "sessions", state.currentSessionId, "diplomacy"), {
      turn: state.currentSessionData.turn || 1,
      type: typeKey,
      typeLabel: type?.label || typeKey,
      fromTeamId: state.currentTeamId,
      fromName: displayName(state.currentTeamData, state.currentTeamId),
      toTeamId: target.id,
      toName: displayName(target, target.id),
      note,
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("diplomacyNote").value = "";
    showStudentTab("diplomacy");
    await addLog(`${displayName(state.currentTeamData, state.currentTeamId)} 외교 제안: ${type?.label || typeKey} → ${displayName(target, target.id)}`);
  };

  $("closeTypeModal").onclick = () => $("typeModal").classList.add("hidden");
}
