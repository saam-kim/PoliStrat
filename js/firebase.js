import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { countryTypes } from "./data.js?v=20260510-polistrat-flow9";
import { state } from "./state.js?v=20260510-polistrat-flow9";
import { notice } from "./utils.js?v=20260510-polistrat-flow9";

export {
  addDoc,
  collection,
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
};

export async function initFirebase() {
  if (state.db) return true;

  const saved =
    localStorage.getItem("polistrat_firebase_config") ||
    localStorage.getItem(["geo", "strat"].join("") + "_firebase_config");
  if (!saved) {
    notice("Firebase 설정을 먼저 저장하세요.", "err");
    return false;
  }

  const config = JSON.parse(saved);
  state.app = getApps().length ? getApps()[0] : initializeApp(config);
  state.auth = getAuth(state.app);
  state.db = getFirestore(state.app);
  await signInAnonymously(state.auth);
  return true;
}

export async function addLog(msg) {
  if (!state.currentSessionId) return;
  await addDoc(collection(state.db, "sessions", state.currentSessionId, "logs"), {
    message: msg,
    createdAt: serverTimestamp()
  });
}

export async function deleteCollectionDocs(colRef) {
  const snap = await getDocs(colRef);
  for (const item of snap.docs) {
    await deleteDoc(item.ref);
  }
}

export async function assignRandomCountryType(code) {
  const used = new Set();
  const teamsSnap = await getDoc(doc(state.db, "sessions", code, "meta", "typeUsage"));
  if (teamsSnap.exists()) {
    Object.keys(teamsSnap.data() || {}).forEach((key) => used.add(key));
  }

  const keys = Object.keys(countryTypes);
  const available = keys.filter((key) => !used.has(key));
  const pool = available.length ? available : keys;
  const typeKey = pool[Math.floor(Math.random() * pool.length)];

  await setDoc(doc(state.db, "sessions", code, "meta", "typeUsage"), { [typeKey]: true }, { merge: true });
  return { typeKey, type: countryTypes[typeKey] };
}

export async function getMyTeamData() {
  if (!state.currentSessionId || !state.currentTeamId) return null;

  const snap = await getDoc(
    doc(state.db, "sessions", state.currentSessionId, "teams", state.currentTeamId)
  );
  return snap.exists() ? snap.data() : null;
}
