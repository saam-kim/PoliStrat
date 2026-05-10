import { layout, studentLayout } from "./data.js?v=20260510-polistrat-flow10";

export const state = {
  app: null,
  auth: null,
  db: null,
  currentSessionId: null,
  currentTeamId: null,
  selectedAction: null,
  selectedTile: null,
  selectedTeamId: null,
  currentTeamData: null,
  currentSessionData: null,
  unsubs: [],
  teamNameByKey: {},
  teamIdByKey: {},
  tileOwnerMap: {},
  activeLayout: layout,
  activeStudentLayout: studentLayout
};

export function cleanup() {
  state.unsubs.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {}
  });
  state.unsubs = [];
}
