import { baseLayouts, layout, strategicTileIndexes, tileNames } from "./data.js?v=20260510-polistrat-flow11";
import { collection, onSnapshot } from "./firebase.js?v=20260510-polistrat-flow11";
import { state } from "./state.js?v=20260510-polistrat-flow11";
import { $, shortName } from "./utils.js?v=20260510-polistrat-flow11";

function buildStudentLayoutFrom(activeLayout) {
  return activeLayout;
}

export function setActiveLayoutByTeamCount(count) {
  const normalized = Math.max(2, Math.min(6, count || 6));
  state.activeLayout = baseLayouts[normalized] || layout;
  state.activeStudentLayout = buildStudentLayoutFrom(state.activeLayout);
}

export function isStrategicTile(index) {
  return strategicTileIndexes.includes(Number(index));
}

function tileLabel(cls, index) {
  if (cls === "empty") return "";
  if (cls === "neutral") return "";
  if (cls === "dispute") return "×";

  const name = state.teamNameByKey[cls];
  const label = name ? shortName(name) : cls.toUpperCase();
  return isStrategicTile(index) && label ? label + "★" : label;
}

function drawHex(targetId, rows) {
  const target = $(targetId);
  if (!target) return;

  target.innerHTML = "";
  rows.flat().forEach((baseCls, index) => {
    const ownerKey = state.tileOwnerMap[index] || baseCls;
    const tile = document.createElement("div");

    tile.className = `hex ${ownerKey}`;
    if (state.tileOwnerMap[index]) tile.classList.add("conquered");

    tile.dataset.tileIndex = index;
    tile.dataset.tileType = baseCls;
    tile.dataset.ownerKey = ownerKey;
    tile.textContent = tileLabel(ownerKey, index);

    if (state.teamNameByKey[ownerKey]) tile.classList.add("named");
    target.appendChild(tile);
  });
}

function renderLegend() {
  const keys = [...new Set(state.activeLayout.flat().filter((key) => ["a", "b", "c", "d", "e", "f"].includes(key)))];
  const items = keys.map(
    (key) => `<span><i class="dot ${key}"></i> ${state.teamNameByKey[key] || key.toUpperCase() + "국"}</span>`
  );
  items.push(`<span><i class="dot dispute"></i> 분쟁지역</span>`);

  const html = items.join("");
  const teacherBox = $("mapLegend");
  const studentBox = $("studentLegend");
  if (teacherBox) teacherBox.innerHTML = html;
  if (studentBox) studentBox.innerHTML = html;
}

export function redrawMaps() {
  drawHex("teacherHex", state.activeLayout);
  drawHex("studentHex", state.activeLayout);
  renderLegend();
  attachStudentTileClicks();
}

export function attachStudentTileClicks() {
  document.querySelectorAll("#studentHex .hex").forEach((hex) => {
    hex.addEventListener("click", () => {
      document.querySelectorAll("#studentHex .hex").forEach((item) => item.classList.remove("selected-tile"));
      hex.classList.add("selected-tile");

      state.selectedTile = Number(hex.dataset.tileIndex);
      const type = hex.dataset.tileType;
      const ownerKey = hex.dataset.ownerKey;
      const ownerName = state.teamNameByKey[ownerKey];

      $("tileInfoTitle").textContent = `${
        ownerName ? ownerName + " 점령지" : tileNames[type] || "알 수 없는 지역"
      } · 타일 ${state.selectedTile}`;
      $("tileInfoBody").textContent =
        type === "dispute"
          ? "분쟁 지역입니다. 영토 점령 행동의 주요 대상입니다."
          : type === "neutral"
            ? "중립 지역입니다. 협상이나 점령 행동 대상으로 사용할 수 있습니다."
            : type === "empty"
              ? "직접 행동 대상보다는 이동·해상로·이벤트 처리용 지역입니다."
              : "특정 국가가 점유 중인 영토입니다. 외교·군사 행동의 대상이 될 수 있습니다.";
      $("tileInfoHint").textContent = isStrategicTile(state.selectedTile)
        ? "★ 핵심 지역입니다. 영토 점령 비용은 군사력 30, 성공 시 핵심 지역 보너스 +3점입니다."
        : "일반 지역입니다. 영토 점령 비용은 군사력 20입니다.";

      window.dispatchEvent(
        new CustomEvent("polistrat:student-tile-selected", {
          detail: {
            tileIndex: state.selectedTile,
            tileType: type,
            ownerKey,
            ownerName,
            ownerTeamId: state.teamIdByKey[ownerKey] || null
          }
        })
      );
    });
  });
}

export function updateTeamNameMap(teams) {
  const keys = ["a", "b", "c", "d", "e", "f"];
  state.teamNameByKey = {};
  state.teamIdByKey = {};

  teams
    .slice()
    .sort((a, b) => {
      const ao = a.confirmedOrder || 999;
      const bo = b.confirmedOrder || 999;
      if (ao !== bo) return ao - bo;
      return (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0);
    })
    .forEach((team, index) => {
      const key = team.mapKey || keys[index];
      if (key && team.name) {
        state.teamNameByKey[key] = team.name;
        state.teamIdByKey[key] = team.id;
      }
    });

  redrawMaps();
}

export function watchTeamNames(code) {
  state.unsubs.push(
    onSnapshot(collection(state.db, "sessions", code, "teams"), (snap) => {
      const teams = [];
      snap.forEach((item) => teams.push({ id: item.id, ...item.data() }));
      updateTeamNameMap(teams);
    })
  );
}

export function watchTiles(code) {
  state.unsubs.push(
    onSnapshot(collection(state.db, "sessions", code, "tiles"), (snap) => {
      state.tileOwnerMap = {};
      snap.forEach((item) => {
        const data = item.data();
        if (data.ownerKey) state.tileOwnerMap[item.id] = data.ownerKey;
      });
      redrawMaps();
    })
  );
}
