import {
  actionDefinitions,
  countryTypes,
  diplomacyTypes,
  displayPhaseName,
  eventDefinitions,
  maxTurns,
  phaseDescriptions,
  phaseDurations,
  phases,
  resourceLabels,
  teacherChecklist
} from "./data.js?v=20260510-polistrat-flow11";
import {
  addDoc,
  addLog,
  collection,
  deleteCollectionDocs,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "./firebase.js?v=20260510-polistrat-flow11";
import { actionByName, buildActionDelta, checkAction, formatDeltaSummary } from "./gameRules.js?v=20260510-polistrat-flow11";
import {
  redrawMaps,
  setActiveLayoutByTeamCount,
  updateTeamNameMap,
  watchTeamNames,
  watchTiles
} from "./map.js?v=20260510-polistrat-flow11";
import { cleanup, state } from "./state.js?v=20260510-polistrat-flow11";
import { $, bar, displayName, fullCountryName, isTeacherPinValid, randomCode, renderSessionTimer, score, show, victoryTitles } from "./utils.js?v=20260510-polistrat-flow11";

let teacherTeamsCache = [];

function renderTeamLockState() {
  const locked = !!state.currentSessionData?.teamsLocked;
  $("teamLockBadge").innerHTML = locked ? "<span class='locked-badge'>확정됨</span>" : "";
  $("confirmTeamsBtn").disabled = locked;
  $("confirmNote").textContent = locked
    ? "참여 모둠이 확정되었습니다. 확정된 모둠 수에 맞게 지도가 재배치되었습니다."
    : "학생 모둠이 모두 입장하면 참여 모둠을 확정하세요. 확정 후 모둠 수에 맞게 지도가 재배치됩니다.";
}

function renderTeacherSessionState(data) {
  const box = $("teacherSessionState");
  if (!box) return;

  const processed = data.resultsProcessedTurn === (data.turn || 1);
  const submitClass = data.submissionLocked ? "locked" : "open";
  const resultClass = processed ? "done" : "wait";
  const submitText = data.submissionLocked ? "제출 마감" : "제출 가능";
  const resultText = processed ? "결과 처리 완료" : "결과 처리 대기";

  box.innerHTML = `<span class="state-chip ${submitClass}">${submitText}</span><span class="state-chip ${resultClass}">${resultText}</span>`;
}

function backupKey(code) {
  return `polistrat_backup_${code}`;
}

function mergeDeltas(...deltas) {
  const merged = {};
  deltas.forEach((delta) => {
    Object.entries(delta || {}).forEach(([field, amount]) => {
      merged[field] = (merged[field] || 0) + amount;
    });
  });
  return merged;
}

function reverseDelta(delta) {
  const reversed = {};
  Object.entries(delta || {}).forEach(([field, amount]) => {
    reversed[field] = -amount;
  });
  return reversed;
}

function applyDeltaSnapshot(team, delta) {
  const snapshot = { ...team };
  Object.entries(delta || {}).forEach(([field, amount]) => {
    snapshot[field] = (snapshot[field] || 0) + amount;
  });
  return snapshot;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function currentEventDefinition() {
  const title = state.currentSessionData?.event;
  return eventDefinitions.find((event) => event.title === title) || null;
}

function endingComment(team, teams) {
  const titles = victoryTitles(team, teams);
  if (titles.includes("종합 패권국")) return "종합 국력 우위로 국제 질서를 주도했습니다.";
  if (titles.includes("핵심 거점 장악국")) return "핵심 거점 확보에 성공해 지정학적 영향력이 큽니다.";
  if (titles.includes("외교 중재국")) return "외교 네트워크를 바탕으로 안정적인 협상력을 확보했습니다.";
  if (titles.includes("경제 강국")) return "경제 성장 전략이 뚜렷한 성과를 냈습니다.";
  if (titles.includes("국내 결속 우수국")) return "국내 지지 기반이 탄탄해 장기 전략을 이어갈 수 있습니다.";
  if (titles.includes("생존 안정국")) return "식량과 에너지 기반을 지켜 장기 생존력이 돋보였습니다.";
  if ((team.strategicPoints || 0) >= 6) return "핵심 거점 확보에 성공해 지정학적 영향력이 큽니다.";
  return "다음 라운드에서는 자원 균형과 행동 타이밍을 더 정교하게 조정해볼 만합니다.";
}

function renderTeacherChecklist(phase) {
  const box = $("teacherChecklistItems");
  if (!box) return;

  const phaseName = displayPhaseName(phase);
  const items = teacherChecklist[phaseName] || ["현재 페이즈의 운영 목표를 확인하세요."];
  box.innerHTML = `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function phaseDuration(phase) {
  return phaseDurations[displayPhaseName(phase)] || 180;
}

function renderSessionHealth(teams) {
  const box = $("sessionHealth");
  if (!box) return;

  const turn = state.currentSessionData?.turn || 1;
  const submitted = teams.filter((team) => team.submittedTurn === turn).length;
  const processed = teams.filter((team) => team.processedTurn === turn).length;
  box.textContent = `상태: ${teams.length}개국 · 제출 ${submitted}/${teams.length} · 처리 ${processed}/${teams.length}`;
}

function renderTurnSummary(teams) {
  const list = $("turnSummaryList");
  if (!list) return;

  const turn = state.currentSessionData?.turn || 1;
  const summaries = teams
    .map((team) => ({ team, summary: team.lastTurnSummary }))
    .filter((item) => item.summary?.turn === turn);

  list.innerHTML =
    summaries
      .map(
        ({ team, summary }) => `<div class="summary-item">
          <strong>${displayName(team, team.id)}</strong> · ${summary.action || "행동 미제출"}
          <div>행동 효과: ${summary.actionDeltaText || "없음"}</div>
          <div>이벤트 효과: ${summary.eventDeltaText || "없음"}</div>
          <div>외교 효과: ${summary.diplomacyDeltaText || "별도 협정 현황 참조"}</div>
          <div class="summary-delta">합계: ${summary.deltaText || "변화 없음"}</div>
        </div>`
      )
      .join("") || "결과 처리 후 이번 턴 변화가 표시됩니다.";
}

function renderFinalResults(teams) {
  const box = $("finalResultsList");
  if (!box) return;

  if (!state.currentSessionData?.gameEnded) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const ranked = [...teams].sort((a, b) => score(b) - score(a));
  box.classList.remove("hidden");
  box.innerHTML = ranked
    .map(
      (team, index) => `<div class="final-card">
        <span class="place">${index + 1}위</span> <b>${displayName(team, team.id)}</b>
        <div>최종 점수 ${score(team)} · 핵심 ${team.strategicPoints || 0} · 점령 ${team.conqueredTiles || 0}</div>
        <div class="title-badges">${victoryTitles(team, ranked).map((title) => `<span class="title-badge">${title}</span>`).join("")}</div>
        <div class="muted">${endingComment(team, ranked)}</div>
      </div>`
    )
    .join("");
}

function renderFinalPresentation(teams) {
  const box = $("finalPresentationContent");
  if (!box) return;

  const ranked = [...teams].sort((a, b) => score(b) - score(a));
  if (!ranked.length) {
    box.textContent = "발표할 참가 국가가 아직 없습니다.";
    return;
  }

  const winner = ranked[0];
  const ended = !!state.currentSessionData?.gameEnded;
  box.innerHTML = `<div class="presentation-hero">
      <span>${ended ? "최종 결과" : "현재 순위 미리보기"} · 턴 ${state.currentSessionData?.turn || 1} / ${maxTurns}</span>
      <strong>1위 ${escapeHtml(displayName(winner, winner.id))} · ${score(winner)}점</strong>
      <div>${escapeHtml(endingComment(winner, ranked))}</div>
    </div>
    <div class="presentation-grid">
      ${ranked
        .map(
          (team, index) => `<div class="presentation-card ${index === 0 ? "winner" : ""}">
            <div class="presentation-rank">${index + 1}위 · ${score(team)}점</div>
            <b>${escapeHtml(displayName(team, team.id))}</b>
            <div>핵심 ${team.strategicPoints || 0} · 점령 ${team.conqueredTiles || 0} · 방어 ${team.defensePosture || 0}</div>
            <div class="title-badges">${victoryTitles(team, ranked)
              .map((title) => `<span class="title-badge">${escapeHtml(title)}</span>`)
              .join("")}</div>
            <div class="muted">${escapeHtml(endingComment(team, ranked))}</div>
          </div>`
        )
        .join("")}
    </div>`;
}

function showPhaseGuide(phase) {
  const guide = $("phaseGuide");
  if (!guide) return;

  const info = phaseDescriptions[displayPhaseName(phase)];
  if (!info) return;

  guide.innerHTML = `<b>${info.title}</b><br>${info.body}<div class="guide-keywords">${info.keywords}</div>`;
}

function renderPhaseSteps(phase) {
  if (!$("phaseSteps")) return;

  const phaseName = displayPhaseName(phase);
  $("phaseSteps").innerHTML = phases
    .map((item) => `<div class="phase-step ${item === phaseName ? "active" : ""}" data-phase="${item}">${item}</div>`)
    .join("");

  document.querySelectorAll("#phaseSteps .phase-step").forEach((el) => {
    el.addEventListener("mouseenter", () => showPhaseGuide(el.dataset.phase));
    el.addEventListener("focus", () => showPhaseGuide(el.dataset.phase));
  });

  showPhaseGuide(phaseName);
}

function renderSubmissions(teams) {
  if (!$("submissionList")) return;

  $("submissionList").innerHTML =
    teams
      .map((team) => {
        const done = team.submittedTurn === (state.currentSessionData?.turn || 1);
        const processed = team.processedTurn === (state.currentSessionData?.turn || 1);
        const label = processed ? (done ? "처리 완료" : "이벤트 처리") : done ? "제출 완료" : "대기";
        return `<div class="submission-row ${processed ? "done" : done ? "pending" : "wait"}"><span>${displayName(
          team,
          team.id
        )}</span><b>${label}</b></div>`;
      })
      .join("") || "<p class='muted'>참가 모둠 없음</p>";
}

function renderTeamCard(team, id) {
  const name = displayName(team, id);
  const selectedClass = state.selectedTeamId === id ? " selected-team" : "";

  return `<div class="country-card${selectedClass}" data-team-id="${id}">
    <div class="country-row"><span class="team-card-name">${escapeHtml(name)}</span><span class="score">+ ${score(team)}</span></div>
    <div class="muted team-meta">${team.typeLabel || "국가 유형 미지정"}</div>
    <div class="mini-bars">
      <div class="bar"><span class="pink" style="width:${bar(team.military, 100)}%"></span></div>
      <div class="bar"><span class="yellow" style="width:${bar(team.gdp, 160)}%"></span></div>
      <div class="bar"><span class="green" style="width:${team.food || 70}%"></span></div>
      <div class="bar"><span class="cyan" style="width:${team.energy || 50}%"></span></div>
    </div>
    <div class="muted team-meta">
      ${team.pendingActionName ? "제출 대기: " + team.pendingActionName : team.lastAction ? "최근 행동: " + team.lastAction : "행동 대기"} ·
      ${team.lastTile !== null && team.lastTile !== undefined ? "대상 타일: " + team.lastTile : "대상 타일 없음"} ·
      핵심 +${team.strategicPoints || 0} · 점령 ${team.conqueredTiles || 0} · 방어 ${team.defensePosture || 0}
    </div>
  </div>`;
}

function renderDetail(team) {
  $("detailTeamName").textContent = fullCountryName(team, "선택 국가");
  $("detailStats").innerHTML = `<div class="detail-meta">유형: ${
    team.typeLabel || "미지정"
  } · ${team.typeDesc || ""}</div>
  <div class="statline"><span>군사력</span><div class="bar"><span class="pink" style="width:${bar(
    team.military,
    100
  )}%"></span></div><b>${team.military || 50}</b></div>
  <div class="statline"><span>GDP</span><div class="bar"><span class="yellow" style="width:${bar(
    team.gdp,
    160
  )}%"></span></div><b>${team.gdp || 100}</b></div>
  <div class="statline"><span>외교</span><div class="bar"><span class="cyan" style="width:${bar(
    team.diplomacy,
    80
  )}%"></span></div><b>${team.diplomacy || 30}</b></div>
  <div class="statline"><span>식량</span><div class="bar"><span class="green" style="width:${
    team.food || 70
  }%"></span></div><b>${team.food || 70}%</b></div>
  <div class="statline"><span>에너지</span><div class="bar"><span class="yellow" style="width:${
    team.energy || 50
  }%"></span></div><b>${team.energy || 50}%</b></div>
  <div class="statline"><span>★ 핵심</span><div class="bar"><span class="cyan" style="width:${bar(
    team.strategicPoints || 0,
    15
  )}%"></span></div><b>+${team.strategicPoints || 0}</b></div>
  <div class="statline"><span>방어</span><div class="bar"><span class="purple" style="width:${bar(
    team.defensePosture || 0,
    5
  )}%"></span></div><b>${team.defensePosture || 0}</b></div>
  <div class="statline"><span>점령</span><div class="bar"><span class="green" style="width:${bar(
    team.conqueredTiles || 0,
    8
  )}%"></span></div><b>${team.conqueredTiles || 0}</b></div>`;
}

function bindTeamCardClicks(teams) {
  document.querySelectorAll(".country-card[data-team-id]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedTeamId = card.dataset.teamId;
      const team = teams.find((item) => item.id === state.selectedTeamId);
      if (team) renderDetail(team);

      $("countryCards").innerHTML = teams.map((item) => renderTeamCard(item, item.id)).join("");
      bindTeamCardClicks(teams);
    });
  });
}

async function resetCurrentSession() {
  if (!state.currentSessionId) return alert("초기화할 세션이 없습니다.");

  const ok = confirm("현재 세션의 참가 모둠, 점령 타일, 로그, 국가 유형 배정 기록을 모두 초기화할까요?");
  if (!ok) return;

  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "teams"));
  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "tiles"));
  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "logs"));
  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "diplomacy"));

  try {
    await deleteDoc(doc(state.db, "sessions", state.currentSessionId, "meta", "typeUsage"));
  } catch (error) {}

  state.tileOwnerMap = {};
  state.teamNameByKey = {};
  state.teamIdByKey = {};
  state.selectedTeamId = null;

  await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
    phase: phases[0],
    phaseIndex: 0,
    turn: 1,
    submissionLocked: false,
    teamsLocked: false,
    confirmedTeamCount: 0,
    event: "",
    eventAppliedTurn: 0,
    resultsProcessedTurn: 0,
    gameEnded: false,
    endedAt: null,
    timerSeconds: phaseDuration(phases[0]),
    timerRunning: false,
    timerEndAtMs: null
  });

  redrawMaps();
  await addLog("교사가 세션을 초기화했습니다.");
  alert("세션 초기화가 완료되었습니다. 학생들은 같은 코드로 다시 입장할 수 있습니다.");
}

function buildIncrementPatch(delta) {
  const patch = {};
  Object.entries(delta).forEach(([field, amount]) => {
    if (amount !== 0) patch[field] = increment(amount);
  });
  return patch;
}

async function getSessionTeams() {
  const snap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "teams"));
  const teams = [];
  snap.forEach((item) => teams.push({ id: item.id, ...item.data() }));
  return teams;
}

async function getPendingDiplomacy() {
  const snap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "diplomacy"));
  const pending = [];
  snap.forEach((item) => {
    const data = item.data();
    if (data.status === "pending") pending.push({ id: item.id, ...data });
  });
  return pending;
}

async function confirmBeforeProcessing(teams, targets) {
  const turn = state.currentSessionData?.turn || 1;
  const warnings = [];
  const missing = teams.filter((team) => team.submittedTurn !== turn);
  const pendingDiplomacy = await getPendingDiplomacy();

  if (missing.length) warnings.push(`미제출 국가: ${missing.map((team) => displayName(team, team.id)).join(", ")}`);
  if (pendingDiplomacy.length) warnings.push(`검토 대기 협정: ${pendingDiplomacy.length}건`);
  if (!targets.length && teams.length) warnings.push("제출된 행동이 없어서 이벤트 효과만 처리됩니다.");
  if (!warnings.length) return true;

  return confirm(`결과 처리 전 확인이 필요합니다.\n\n${warnings.join("\n")}\n\n그래도 결과 처리를 진행할까요?`);
}

async function processCurrentResults({ auto = false } = {}) {
  if (!state.currentSessionId || !state.currentSessionData) {
    alert("처리할 세션이 없습니다.");
    return false;
  }

  const turn = state.currentSessionData.turn || 1;
  const teams = await getSessionTeams();

  const event = currentEventDefinition();
  const shouldApplyEvent = !!event && state.currentSessionData.eventAppliedTurn !== turn;
  const targets = teams.filter((team) => team.submittedTurn === turn && team.processedTurn !== turn);

  if (!targets.length && !shouldApplyEvent) {
    if (!auto) alert("이번 턴에 처리할 제출 행동이나 이벤트가 없습니다.");
    return true;
  }

  if (!(await confirmBeforeProcessing(teams, targets))) return false;

  for (const team of teams) {
    const hasActionToProcess = team.submittedTurn === turn && team.processedTurn !== turn;
    if (!hasActionToProcess && !shouldApplyEvent) continue;

    const action = hasActionToProcess ? actionByName(team.pendingActionName) : null;
    const teamRef = doc(state.db, "sessions", state.currentSessionId, "teams", team.id);
    const eventDelta = shouldApplyEvent ? event.effects || {} : {};
    let actionDelta = {};
    let actionResult = hasActionToProcess ? "행동 미제출" : "행동 없음";
    let validAction = false;

    if (hasActionToProcess) {
      if (!action) {
        actionResult = "처리 실패: 알 수 없는 행동";
        await addLog(`${displayName(team, team.id)} 결과 처리 실패: 알 수 없는 행동`);
      } else {
        const tileIndex = action.requiresTile ? team.pendingTile : null;
        const check = checkAction(action, team, tileIndex);
        if (!check.ok) {
          actionResult = "처리 실패: " + check.msg;
          await addLog(`${displayName(team, team.id)} 결과 처리 실패: ${action.name} · ${check.msg}`);
        } else {
          validAction = true;
          actionDelta = buildActionDelta(action, tileIndex);
          actionResult = `${check.msg} · ${formatDeltaSummary(actionDelta)}`;

          if (action.tileOwnership) {
            await setDoc(
              doc(state.db, "sessions", state.currentSessionId, "tiles", String(tileIndex)),
              {
                tileIndex,
                ownerTeamId: team.id,
                ownerKey: team.mapKey || "a",
                ownerName: team.name || displayName(team, team.id),
                strategic: !!team.pendingStrategic,
                updatedAt: serverTimestamp()
              },
              { merge: true }
            );
          }

          await addLog(`${displayName(team, team.id)} 결과 처리: ${action.name} · ${formatDeltaSummary(actionDelta)}`);
        }
      }
    }

    const totalDelta = mergeDeltas(actionDelta, eventDelta);
    const projected = applyDeltaSnapshot(team, totalDelta);
    const deltaText = formatDeltaSummary(totalDelta);

    await updateDoc(teamRef, {
      ...buildIncrementPatch(totalDelta),
      processedTurn: turn,
      lastAction: validAction ? action.name : team.lastAction || "",
      lastTile: validAction && action?.requiresTile ? team.pendingTile : team.lastTile ?? null,
      actionResult: shouldApplyEvent ? `${actionResult} · 이벤트: ${event.title}` : actionResult,
      lastTurnDelta: totalDelta,
      lastTurnSummary: {
        turn,
        action: validAction ? action.name : hasActionToProcess ? team.pendingActionName || "알 수 없는 행동" : "행동 미제출",
        result: actionResult,
        actionDeltaText: formatDeltaSummary(actionDelta),
        eventDeltaText: shouldApplyEvent ? formatDeltaSummary(eventDelta) : "없음",
        diplomacyDeltaText: "협정 승인 시 즉시 반영",
        deltaText,
        event: shouldApplyEvent ? event.title : "",
        scoreAfter: score(projected)
      },
      pendingActionId: "",
      pendingActionName: "",
      pendingTile: null,
      pendingStrategic: false,
      pendingResultText: ""
    });
  }

  await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
    submissionLocked: true,
    resultsProcessedTurn: turn,
    eventAppliedTurn: shouldApplyEvent ? turn : state.currentSessionData.eventAppliedTurn || 0,
    gameEnded: turn >= maxTurns,
    endedAt: turn >= maxTurns ? serverTimestamp() : null
  });

  if (turn >= maxTurns) {
    await addLog("최종 턴 결과 처리가 완료되어 게임이 종료되었습니다.");
  }

  const message = `결과 처리 완료: ${targets.length}개 제출 행동${shouldApplyEvent ? "과 이벤트 효과" : ""}를 반영했습니다.`;
  await addLog(auto ? `자동 ${message}` : message);
  if (!auto) alert(message);
  return true;
}

export function watchTeacher(code) {
  cleanup();
  state.currentSessionId = code;
  $("sessionCodeText").textContent = code;

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

      $("teacherPhase").textContent = displayPhaseName(data.phase);
      $("teacherTurn").textContent = data.turn || 1;
      $("eventCard").classList.toggle("is-empty", !data.event);
      $("eventText").textContent = data.event
        ? `${data.event} · ${formatDeltaSummary(data.eventEffects || {})}`
        : "없음";
      renderSessionTimer(data);
      renderPhaseSteps(data.phase);
      renderTeamLockState();
      renderTeacherSessionState(data);
      renderTeacherChecklist(data.phase);
      if (teacherTeamsCache.length) {
        renderSubmissions(teacherTeamsCache);
        renderSessionHealth(teacherTeamsCache);
        renderTurnSummary(teacherTeamsCache);
        renderFinalResults(teacherTeamsCache);
        renderFinalPresentation(teacherTeamsCache);
      }
    })
  );

  state.unsubs.push(
    onSnapshot(collection(state.db, "sessions", code, "teams"), (snap) => {
      const teams = [];
      snap.forEach((item) => teams.push({ id: item.id, ...item.data() }));
      teams.sort((a, b) => score(b) - score(a));
      teacherTeamsCache = teams;

      if (state.currentSessionData?.teamsLocked) {
        setActiveLayoutByTeamCount(state.currentSessionData.confirmedTeamCount);
      }

      updateTeamNameMap(teams);
      renderSubmissions(teams);
      renderSessionHealth(teams);
      renderTurnSummary(teams);
      renderFinalResults(teams);
      renderFinalPresentation(teams);

      if (teams.length && (!state.selectedTeamId || !teams.find((team) => team.id === state.selectedTeamId))) {
        state.selectedTeamId = teams[0].id;
      }

      $("countryCards").innerHTML =
        teams.map((team) => renderTeamCard(team, team.id)).join("") || "<p class='muted'>학생 참가 대기 중</p>";
      bindTeamCardClicks(teams);

      $("rankList").innerHTML = teams
        .map(
          (team, index) =>
            `<div class="rank-row"><b>${index + 1}</b><span class="flag">국가</span><span>${displayName(
              team,
              team.id
            )}</span><span class="spacer"></span><b class="score-value">${score(team)}</b></div>`
        )
        .join("");

      $("bottomCards").innerHTML = teams
        .map(
          (team) =>
            `<div class="bottom-card"><b>${displayName(team, team.id)}</b><div class="muted team-meta">${
              team.typeLabel || ""
            }</div><div class="bar" style="margin-top:10px"><span class="pink" style="width:${bar(
              team.military,
              100
            )}%"></span></div><div class="bar" style="margin-top:7px"><span class="yellow" style="width:${bar(
              team.gdp,
              160
            )}%"></span></div><div class="action-badge">${team.pendingActionName ? "제출: " + team.pendingActionName : team.lastAction || "행동 대기"} ${
              team.lastTile !== null && team.lastTile !== undefined ? "· 타일 " + team.lastTile : ""
            }</div></div>`
        )
        .join("");

      const selectedTeam = teams.find((team) => team.id === state.selectedTeamId) || teams[0];
      if (selectedTeam) renderDetail(selectedTeam);
    })
  );

  const logQuery = query(collection(state.db, "sessions", code, "logs"), orderBy("createdAt", "desc"));
  state.unsubs.push(
    onSnapshot(logQuery, (snap) => {
      $("logList").innerHTML = "";
      snap.forEach((item) => {
        const div = document.createElement("div");
        div.className = "log-item";
        div.textContent = item.data().message;
        $("logList").appendChild(div);
      });
    })
  );

  state.unsubs.push(
    onSnapshot(collection(state.db, "sessions", code, "diplomacy"), (snap) => {
      const agreements = [];
      snap.forEach((item) => agreements.push({ id: item.id, ...item.data() }));
      agreements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderDiplomacyList(agreements);
    })
  );
}

function renderDiplomacyList(agreements) {
  const box = $("diplomacyList");
  if (!box) return;

  box.innerHTML =
    agreements
      .map((item) => {
        const type = diplomacyTypes[item.type] || { label: item.type || "협정" };
        const statusText = item.status === "approved" ? "승인" : item.status === "rejected" ? "거절" : "대기";
        return `<div class="diplomacy-card ${item.status || "pending"}" data-diplomacy-id="${item.id}">
          <b>${type.label}</b>
          <div>${escapeHtml(item.fromName)} → ${escapeHtml(item.toName)}</div>
          <div class="muted">${escapeHtml(item.note || type.desc || "")}</div>
          <div>상태: ${statusText}${item.effectText ? " · " + escapeHtml(item.effectText) : ""}</div>
          ${
            item.status === "pending"
              ? `<div class="diplomacy-actions"><button class="primary" data-diplomacy-action="approve">승인</button><button class="danger" data-diplomacy-action="reject">거절</button></div>`
              : ""
          }
        </div>`;
      })
      .join("") || "<div class='muted' style='padding:8px'>제안된 협정 없음</div>";

  document.querySelectorAll(".diplomacy-card [data-diplomacy-action]").forEach((button) => {
    button.onclick = () => {
      const card = button.closest(".diplomacy-card");
      const agreement = agreements.find((item) => item.id === card.dataset.diplomacyId);
      if (!agreement) return;
      if (button.dataset.diplomacyAction === "approve") approveDiplomacy(agreement);
      else rejectDiplomacy(agreement);
    };
  });
}

async function approveDiplomacy(agreement) {
  const type = diplomacyTypes[agreement.type];
  if (!type) return alert("알 수 없는 협정 유형입니다.");

  const fromRef = doc(state.db, "sessions", state.currentSessionId, "teams", agreement.fromTeamId);
  const toRef = doc(state.db, "sessions", state.currentSessionId, "teams", agreement.toTeamId);
  const effectText = `제안국 ${formatDeltaSummary(type.proposerEffects)} · 상대국 ${formatDeltaSummary(type.partnerEffects)}`;

  await updateDoc(fromRef, {
    ...buildIncrementPatch(type.proposerEffects),
    lastDiplomacySummary: {
      turn: state.currentSessionData?.turn || 1,
      type: type.label,
      partner: agreement.toName,
      deltaText: formatDeltaSummary(type.proposerEffects)
    }
  });
  await updateDoc(toRef, {
    ...buildIncrementPatch(type.partnerEffects),
    lastDiplomacySummary: {
      turn: state.currentSessionData?.turn || 1,
      type: type.label,
      partner: agreement.fromName,
      deltaText: formatDeltaSummary(type.partnerEffects)
    }
  });
  await updateDoc(doc(state.db, "sessions", state.currentSessionId, "diplomacy", agreement.id), {
    status: "approved",
    effectText,
    decidedAt: serverTimestamp()
  });
  await addLog(`협정 승인: ${agreement.fromName} ↔ ${agreement.toName} · ${type.label} · ${effectText}`);
}

async function rejectDiplomacy(agreement) {
  await updateDoc(doc(state.db, "sessions", state.currentSessionId, "diplomacy", agreement.id), {
    status: "rejected",
    decidedAt: serverTimestamp()
  });
  await addLog(`협정 거절: ${agreement.fromName} → ${agreement.toName}`);
}

async function adjustSelectedResource() {
  if (!state.currentSessionId || !state.selectedTeamId) return alert("먼저 보정할 국가를 선택하세요.");

  const field = $("manualResourceField").value;
  const amount = Number($("manualResourceAmount").value);
  if (!Number.isFinite(amount) || amount === 0) return alert("0이 아닌 보정값을 입력하세요.");

  await updateDoc(doc(state.db, "sessions", state.currentSessionId, "teams", state.selectedTeamId), {
    [field]: increment(amount)
  });
  await addLog(`교사 수동 보정: ${state.selectedTeamId} · ${resourceLabels[field] || field} ${amount > 0 ? "+" : ""}${amount}`);
}

async function cancelSelectedSubmission() {
  if (!state.currentSessionId || !state.selectedTeamId) return alert("먼저 제출을 취소할 국가를 선택하세요.");

  await updateDoc(doc(state.db, "sessions", state.currentSessionId, "teams", state.selectedTeamId), {
    submittedTurn: 0,
    processedTurn: 0,
    pendingActionId: "",
    pendingActionName: "",
    pendingTile: null,
    pendingStrategic: false,
    pendingResultText: "",
    actionResult: "교사가 제출을 취소했습니다."
  });
  await addLog(`교사가 ${state.selectedTeamId} 제출을 취소했습니다.`);
}

async function changeSelectedTileOwner() {
  if (!state.currentSessionId || !state.selectedTeamId) return alert("먼저 타일 소유자로 지정할 국가를 선택하세요.");

  const tileIndex = Number($("manualTileInput").value);
  if (!Number.isInteger(tileIndex) || tileIndex < 0) return alert("변경할 타일 번호를 입력하세요.");

  const teamSnap = await getDoc(doc(state.db, "sessions", state.currentSessionId, "teams", state.selectedTeamId));
  if (!teamSnap.exists()) return alert("선택한 국가 정보를 찾지 못했습니다.");
  const team = teamSnap.data();

  await setDoc(
    doc(state.db, "sessions", state.currentSessionId, "tiles", String(tileIndex)),
    {
      tileIndex,
      ownerTeamId: state.selectedTeamId,
      ownerKey: team.mapKey || "a",
      ownerName: team.name || displayName(team, state.selectedTeamId),
      strategic: false,
      updatedAt: serverTimestamp(),
      manual: true
    },
    { merge: true }
  );
  await addLog(`교사 수동 변경: 타일 ${tileIndex} 소유권을 ${displayName(team, state.selectedTeamId)}에 배정`);
}

async function undoCurrentTurnProcessing() {
  if (!state.currentSessionId || !state.currentSessionData) return alert("되돌릴 세션이 없습니다.");

  const ok = confirm("이번 턴에 처리된 자원 변화와 점령 결과를 되돌릴까요? 제출 기록은 남겨 재처리할 수 있게 합니다.");
  if (!ok) return;

  const turn = state.currentSessionData.turn || 1;
  const snap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "teams"));

  for (const item of snap.docs) {
    const team = item.data();
    if (team.lastTurnSummary?.turn !== turn || !team.lastTurnDelta) continue;

    await updateDoc(item.ref, {
      ...buildIncrementPatch(reverseDelta(team.lastTurnDelta)),
      processedTurn: 0,
      actionResult: "교사가 이번 턴 결과 처리를 되돌렸습니다.",
      lastTurnDelta: {},
      lastTurnSummary: null
    });

    if (team.lastAction === "영토 점령" && team.lastTile !== null && team.lastTile !== undefined) {
      await setDoc(
        doc(state.db, "sessions", state.currentSessionId, "tiles", String(team.lastTile)),
        {
          ownerTeamId: null,
          ownerKey: null,
          ownerName: null,
          clearedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  }

  await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
    resultsProcessedTurn: 0,
    eventAppliedTurn: 0,
    gameEnded: false,
    endedAt: null,
    submissionLocked: false
  });
  await addLog(`교사가 턴 ${turn} 결과 처리를 되돌렸습니다.`);
}

async function backupCurrentSession() {
  if (!state.currentSessionId) return alert("백업할 세션이 없습니다.");

  const sessionSnap = await getDoc(doc(state.db, "sessions", state.currentSessionId));
  const teamsSnap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "teams"));
  const tilesSnap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "tiles"));
  const diplomacySnap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "diplomacy"));
  const backup = {
    savedAt: new Date().toISOString(),
    session: sessionSnap.data(),
    teams: teamsSnap.docs.map((item) => ({ id: item.id, data: item.data() })),
    tiles: tilesSnap.docs.map((item) => ({ id: item.id, data: item.data() })),
    diplomacy: diplomacySnap.docs.map((item) => ({ id: item.id, data: item.data() }))
  };

  localStorage.setItem(backupKey(state.currentSessionId), JSON.stringify(backup));
  alert(`세션 ${state.currentSessionId} 백업 완료: ${backup.teams.length}개국, ${backup.tiles.length}개 타일, ${backup.diplomacy.length}개 협정`);
}

async function restoreCurrentSessionBackup() {
  if (!state.currentSessionId) return alert("복원할 세션이 없습니다.");

  const raw = localStorage.getItem(backupKey(state.currentSessionId));
  if (!raw) return alert("이 브라우저에 저장된 해당 세션 백업이 없습니다.");

  const ok = confirm("저장된 백업으로 현재 세션의 팀/타일 데이터를 덮어쓸까요?");
  if (!ok) return;

  const backup = JSON.parse(raw);
  await setDoc(doc(state.db, "sessions", state.currentSessionId), backup.session, { merge: true });
  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "teams"));
  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "tiles"));
  await deleteCollectionDocs(collection(state.db, "sessions", state.currentSessionId, "diplomacy"));

  for (const team of backup.teams || []) {
    await setDoc(doc(state.db, "sessions", state.currentSessionId, "teams", team.id), team.data);
  }
  for (const tile of backup.tiles || []) {
    await setDoc(doc(state.db, "sessions", state.currentSessionId, "tiles", tile.id), tile.data);
  }
  for (const agreement of backup.diplomacy || []) {
    await setDoc(doc(state.db, "sessions", state.currentSessionId, "diplomacy", agreement.id), agreement.data);
  }

  await addLog(`교사가 로컬 백업을 복원했습니다. 저장 시각: ${backup.savedAt}`);
  alert("백업 복원이 완료되었습니다.");
}

async function createDemoSessionData() {
  if (!state.currentSessionId) return alert("먼저 세션을 생성하세요.");

  const existingTeams = await getSessionTeams();
  const ok = confirm(
    existingTeams.length
      ? "현재 세션에 이미 국가가 있습니다. 리허설용 국가/제출/외교 데이터를 추가하거나 덮어쓸까요?"
      : "리허설용 4개 국가, 샘플 제출, 샘플 외교 제안을 생성할까요?"
  );
  if (!ok) return;

  const typeKeys = ["power", "trade", "resource", "emerging"];
  const names = ["베네수엘라", "우루과이", "파라탈라", "과테말라"];
  const pendingActions = [
    { name: "영토 점령", tile: 12 },
    { name: "산업 투자", tile: null },
    { name: "에너지 수입 협정", tile: null },
    { name: "방어 태세", tile: null }
  ];

  for (let index = 0; index < names.length; index++) {
    const type = countryTypes[typeKeys[index]];
    const action = actionDefinitions.find((item) => item.name === pendingActions[index].name);
    await setDoc(doc(state.db, "sessions", state.currentSessionId, "teams", `demo_${index + 1}`), {
      name: names[index],
      role: "리허설 국가",
      mapKey: ["a", "b", "c", "d"][index],
      typeKey: typeKeys[index],
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
      submittedTurn: state.currentSessionData?.turn || 1,
      processedTurn: 0,
      pendingActionId: action?.id || "",
      pendingActionName: action?.name || "",
      pendingTile: pendingActions[index].tile,
      pendingStrategic: false,
      pendingResultText: "리허설 제출",
      actionResult: "리허설 제출 · 결과 처리 대기",
      confirmed: true,
      confirmedOrder: index + 1,
      joinedAt: serverTimestamp()
    });
  }

  await setDoc(doc(state.db, "sessions", state.currentSessionId, "diplomacy", "demo_trade"), {
    turn: state.currentSessionData?.turn || 1,
    type: "trade",
    typeLabel: diplomacyTypes.trade.label,
    fromTeamId: "demo_2",
    fromName: names[1],
    toTeamId: "demo_3",
    toName: names[2],
    note: "리허설용 무역 협정 제안",
    status: "pending",
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
    phaseIndex: phases.indexOf("행동 입력"),
    phase: "행동 입력",
    turn: state.currentSessionData?.turn || 1,
    teamsLocked: true,
    confirmedTeamCount: names.length,
    submissionLocked: false,
    timerSeconds: phaseDuration("행동 입력"),
    timerRunning: false,
    timerEndAtMs: null
  });

  setActiveLayoutByTeamCount(names.length);
  await addLog("교사가 리허설용 국가/제출/외교 데이터를 생성했습니다.");
  alert("리허설 데이터 생성 완료: 4개 국가, 4개 제출, 1개 외교 제안을 만들었습니다.");
}

async function checkRehearsalReadiness() {
  if (!state.currentSessionId) return alert("먼저 세션을 생성하세요.");

  const teams = await getSessionTeams();
  const pendingDiplomacy = await getPendingDiplomacy();
  const turn = state.currentSessionData?.turn || 1;
  const submitted = teams.filter((team) => team.submittedTurn === turn).length;
  const issues = [];

  if (teams.length < 2) issues.push("참가 국가가 2개 미만입니다.");
  if (!state.currentSessionData?.teamsLocked) issues.push("참여 모둠이 아직 확정되지 않았습니다.");
  if (state.currentSessionData?.phase !== "행동 입력") issues.push("현재 페이즈가 행동 입력이 아닙니다.");
  if (!submitted) issues.push("이번 턴 샘플 제출이 없습니다.");
  if (!pendingDiplomacy.length) issues.push("교사가 검토할 외교 제안이 없습니다.");

  if (issues.length) {
    alert(`리허설 상태 점검\n\n확인 필요:\n- ${issues.join("\n- ")}`);
    return;
  }

  alert(`리허설 준비 완료\n\n국가 ${teams.length}개 · 제출 ${submitted}/${teams.length} · 외교 검토 ${pendingDiplomacy.length}건`);
}

async function createTeacherSession(saveResume) {
  const code = randomCode();
  await setDoc(doc(state.db, "sessions", code), {
    code,
    phase: phases[0],
    event: "",
    phaseIndex: 0,
    turn: 1,
    submissionLocked: false,
    teamsLocked: false,
    confirmedTeamCount: 0,
    timerSeconds: phaseDuration(phases[0]),
    timerRunning: false,
    timerEndAtMs: null,
    resultsProcessedTurn: 0,
    eventAppliedTurn: 0,
    gameEnded: false,
    endedAt: null,
    createdAt: serverTimestamp()
  });

  show("teacherUI");
  saveResume({ mode: "teacher", sessionId: code });
  watchTeacher(code);
  await addLog(`교사가 세션 ${code}을 생성했습니다.`);
}

function openFinalPresentation() {
  renderFinalPresentation(teacherTeamsCache);
  $("finalPresentationModal").classList.remove("hidden");
}

function closeFinalPresentation() {
  $("finalPresentationModal").classList.add("hidden");
}

function checkPreflightReadiness() {
  const issues = [];
  const ok = [];
  const session = state.currentSessionData;
  const teams = teacherTeamsCache;

  if (state.db) ok.push("Firebase 연결 확인");
  else issues.push("Firebase 연결이 아직 확인되지 않았습니다.");

  if (state.currentSessionId) ok.push(`교사 세션 생성/복구 완료: ${state.currentSessionId}`);
  else issues.push("교사 세션을 먼저 생성하거나 복구해야 합니다.");

  if (session?.teamsLocked) ok.push(`참여 모둠 확정 완료: ${session.confirmedTeamCount || teams.length}개`);
  else issues.push("학생 모둠 입장 후 참여 모둠을 확정해야 합니다.");

  if (teams.length >= 2) ok.push(`참가 국가 ${teams.length}개 확인`);
  else issues.push("최소 2개 모둠이 참가해야 수업 운영이 안정적입니다.");

  if (session?.phase) ok.push(`현재 페이즈: ${displayPhaseName(session.phase)}`);
  else issues.push("현재 페이즈 정보를 아직 불러오지 못했습니다.");

  try {
    localStorage.setItem("polistrat_preflight_test", "ok");
    localStorage.removeItem("polistrat_preflight_test");
    ok.push("이 브라우저 백업 저장 가능");
  } catch (error) {
    issues.push("이 브라우저에서 백업 저장을 사용할 수 없습니다.");
  }

  const message = [
    "수업 전 점검",
    "",
    ok.length ? `확인됨:\n- ${ok.join("\n- ")}` : "",
    issues.length ? `\n확인 필요:\n- ${issues.join("\n- ")}` : "\n바로 수업을 진행해도 좋습니다."
  ]
    .filter(Boolean)
    .join("\n");
  alert(message);
}

function buildFinalResultText() {
  const ranked = [...teacherTeamsCache].sort((a, b) => score(b) - score(a));
  const session = state.currentSessionData || {};
  const lines = [
    "PoliStrat 최종 결과",
    `세션: ${state.currentSessionId || "-"}`,
    `턴: ${session.turn || 1} / ${maxTurns}`,
    `페이즈: ${displayPhaseName(session.phase || "-")}`,
    `저장 시각: ${new Date().toLocaleString("ko-KR")}`,
    "",
    "순위\t국가\t점수\tGDP\t군사\t외교\t지지율\t식량\t에너지\t핵심\t점령\t타이틀"
  ];

  ranked.forEach((team, index) => {
    lines.push(
      [
        index + 1,
        displayName(team, team.id),
        score(team),
        team.gdp || 0,
        team.military || 0,
        team.diplomacy || 0,
        team.support || 0,
        team.food || 0,
        team.energy || 0,
        team.strategicPoints || 0,
        team.conqueredTiles || 0,
        victoryTitles(team, ranked).join(", ")
      ].join("\t")
    );
  });

  return lines.join("\n");
}

function exportFinalResults() {
  if (!teacherTeamsCache.length) return alert("저장할 결과가 아직 없습니다.");

  const text = buildFinalResultText();
  const blob = new Blob(["\uFEFF" + text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PoliStrat_${state.currentSessionId || "session"}_results.tsv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function verifyTeacherPin() {
  if (isTeacherPinValid($("teacherPin")?.value)) return true;

  alert("교사용 PIN이 올바르지 않습니다.");
  $("teacherPin")?.focus();
  return false;
}

export function bindTeacherEvents({ initFirebase, saveResume }) {
  $("startTeacher").onclick = async () => {
    try {
      if (!verifyTeacherPin()) return;
      if (!(await initFirebase())) return;
      await createTeacherSession(saveResume);
    } catch (error) {
      $("notice").textContent = "교사 화면 시작 실패: " + error.message;
      $("notice").className = "notice err";
    }
  };

  $("resumeTeacherByCodeBtn").onclick = async () => {
    try {
      if (!verifyTeacherPin()) return;
      if (!(await initFirebase())) return;
      const code = $("teacherSessionCode").value.trim().toUpperCase();
      if (!code) return alert("복구할 세션 코드를 입력하세요.");

      const snap = await getDoc(doc(state.db, "sessions", code));
      if (!snap.exists()) return alert("해당 세션이 없습니다.");

      show("teacherUI");
      saveResume({ mode: "teacher", sessionId: code });
      watchTeacher(code);
      await addLog(`교사가 세션 ${code}에 다시 접속했습니다.`);
    } catch (error) {
      alert("세션 복구 실패: " + error.message);
    }
  };

  $("confirmTeamsBtn").onclick = async () => {
    if (!state.currentSessionId) return alert("먼저 세션을 생성하세요.");

    const snap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "teams"));
    const teams = [];
    snap.forEach((item) => teams.push({ id: item.id, ...item.data() }));
    if (teams.length < 2) return alert("최소 2개 모둠이 입장해야 확정할 수 있습니다.");

    const keys = ["a", "b", "c", "d", "e", "f"];
    teams.sort((a, b) => (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0));

    for (let index = 0; index < teams.length; index++) {
      await updateDoc(doc(state.db, "sessions", state.currentSessionId, "teams", teams[index].id), {
        mapKey: keys[index],
        confirmed: true,
        confirmedOrder: index + 1
      });
    }

    const tileSnap = await getDocs(collection(state.db, "sessions", state.currentSessionId, "tiles"));
    for (const tile of tileSnap.docs) {
      await setDoc(
        doc(state.db, "sessions", state.currentSessionId, "tiles", tile.id),
        {
          ownerKey: null,
          ownerTeamId: null,
          ownerName: null,
          clearedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    state.tileOwnerMap = {};

    await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
      teamsLocked: true,
      confirmedTeamCount: teams.length
    });

    setActiveLayoutByTeamCount(teams.length);
    updateTeamNameMap(teams);
    redrawMaps();
    await addLog(`참여 모둠 확정: ${teams.length}개 모둠 · 지도 재배치 완료`);
  };

  $("nextPhaseBtn").onclick = async () => {
    if (!state.currentSessionId) return alert("먼저 세션을 생성하세요.");

    const ref = doc(state.db, "sessions", state.currentSessionId);
    const snap = await getDoc(ref);
      const data = snap.data();
      if (!data) return alert("세션 정보를 불러오지 못했습니다.");
      if (data.gameEnded) return alert("게임이 종료되었습니다. 새 게임을 시작하거나 세션을 초기화하세요.");
      if (data.phase === "결과 처리" && data.resultsProcessedTurn !== (data.turn || 1)) {
        return alert("결과 처리를 완료해야 다음 턴으로 이동할 수 있습니다.");
      }

      let index = ((data.phaseIndex || 0) + 1) % phases.length;
      let turn = data.turn || 1;
      if (index === 0) turn = Math.min(maxTurns, turn + 1);
      if (data.phase === "행동 입력" && phases[index] === "결과 처리") {
        state.currentSessionData = data;
        const processed = await processCurrentResults({ auto: true });
        if (!processed) return;
      }

      await updateDoc(ref, {
      phaseIndex: index,
      phase: phases[index],
      turn,
      submissionLocked: phases[index] === "결과 처리",
      timerSeconds: phaseDuration(phases[index]),
      timerRunning: false,
      timerEndAtMs: null
    });
    await addLog(`턴 ${turn} · 페이즈 변경: ${phases[index]}`);
  };

  $("prevPhaseBtn").onclick = async () => {
    if (!state.currentSessionId) return alert("먼저 세션을 생성하세요.");

    const ref = doc(state.db, "sessions", state.currentSessionId);
    const snap = await getDoc(ref);
    const data = snap.data();
    if (!data) return alert("세션 정보를 불러오지 못했습니다.");
    if (data.gameEnded) return alert("게임이 종료되었습니다. 되돌리려면 먼저 이번 턴 처리 되돌리기를 사용하세요.");

    let index = data.phaseIndex || 0;
    let turn = data.turn || 1;
    if (index === 0) {
      if (turn <= 1) return alert("이미 첫 턴의 첫 페이즈입니다.");
      index = phases.length - 1;
      turn -= 1;
    } else {
      index -= 1;
    }

    await updateDoc(ref, {
      phaseIndex: index,
      phase: phases[index],
      turn,
      submissionLocked: phases[index] === "결과 처리",
      timerSeconds: phaseDuration(phases[index]),
      timerRunning: false,
      timerEndAtMs: null
    });
    await addLog(`교사가 페이즈를 되돌렸습니다: 턴 ${turn} · ${phases[index]}`);
  };

  $("eventBtn").onclick = async () => {
    const event = eventDefinitions[Math.floor(Math.random() * eventDefinitions.length)];
    await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
      event: event.title,
      eventBody: event.body,
      eventEffects: event.effects
    });
    await addLog(`이벤트 발동: ${event.title} · ${formatDeltaSummary(event.effects)}`);
  };

  $("announceBtn").onclick = () => addLog("교사 공지: 다음 페이즈 전 모둠별 최종 결정을 정리하세요.");
  $("resetSessionBtn").onclick = resetCurrentSession;
  $("adjustResourceBtn").onclick = adjustSelectedResource;
  $("cancelSubmissionBtn").onclick = cancelSelectedSubmission;
  $("changeTileOwnerBtn").onclick = changeSelectedTileOwner;
  $("undoTurnBtn").onclick = undoCurrentTurnProcessing;
  $("backupSessionBtn").onclick = backupCurrentSession;
  $("restoreSessionBtn").onclick = restoreCurrentSessionBackup;
  $("preflightCheckBtn").onclick = checkPreflightReadiness;
  $("demoSessionBtn").onclick = createDemoSessionData;
  $("rehearsalCheckBtn").onclick = checkRehearsalReadiness;
  $("finalPresentationBtn").onclick = openFinalPresentation;
  $("closeFinalPresentationBtn").onclick = closeFinalPresentation;
  $("finalBackupBtn").onclick = backupCurrentSession;
  $("finalExportBtn").onclick = exportFinalResults;
  $("newTeacherSessionBtn").onclick = async () => {
    const ok = confirm("새 게임 세션을 생성할까요? 현재 세션 데이터는 삭제하지 않고 그대로 보존됩니다.");
    if (!ok) return;
    if (!(await initFirebase())) return;
    await createTeacherSession(saveResume);
    closeFinalPresentation();
  };
  $("startTimerBtn").onclick = async () => {
    const seconds = state.currentSessionData?.timerSeconds || phaseDuration(state.currentSessionData?.phase || phases[0]);
    await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
      timerSeconds: seconds,
      timerRunning: true,
      timerEndAtMs: Date.now() + seconds * 1000
    });
    await addLog(`타이머 시작: ${Math.ceil(seconds / 60)}분`);
  };
  $("resetTimerBtn").onclick = async () => {
    const seconds = phaseDuration(state.currentSessionData?.phase || phases[0]);
    await updateDoc(doc(state.db, "sessions", state.currentSessionId), {
      timerSeconds: seconds,
      timerRunning: false,
      timerEndAtMs: null
    });
    await addLog(`타이머를 ${Math.ceil(seconds / 60)}분으로 초기화했습니다.`);
  };
  $("closeSubmitBtn").onclick = async () => {
    await updateDoc(doc(state.db, "sessions", state.currentSessionId), { submissionLocked: true });
    await addLog("교사가 이번 턴 제출을 마감했습니다.");
  };
  $("reopenSubmitBtn").onclick = async () => {
    await updateDoc(doc(state.db, "sessions", state.currentSessionId), { submissionLocked: false });
    await addLog("교사가 이번 턴 제출을 다시 열었습니다.");
  };
}
