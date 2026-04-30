// ─────────────────────────────────────────────────────────────────────
//  Fitness Pacific — API client
// ─────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "";
const APP_ID  = import.meta.env.VITE_APP_ID  || "fitness-pacific";
const TOKEN_KEY = "fp_auth_token";

export const isLive = () => !!API_URL;

// ── Auth token management ───────────────────────────────────────────
export function getAuthToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || null; }
  catch { return null; }
}
export function setAuthToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else       sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode */ }
}

function headers(extra = {}) {
  const h = {
    "Content-Type": "application/json",
    "X-App-Id": APP_ID,
    ...extra,
  };
  const token = getAuthToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function api(path, opts = {}) {
  if (!API_URL) {
    const err = new Error("API not configured (VITE_API_URL is unset)");
    err.code = "no_api";
    throw err;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: headers(opts.headers),
  });
  if (res.status === 401) {
    setAuthToken(null);
    const err = new Error("Session expired — please log in again");
    err.code = "auth_required";
    err.status = 401;
    throw err;
  }
  if (res.status === 404) {
    const err = new Error("Not found");
    err.code = "not_found";
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch {}
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ────────────────────────────────────────────────────────────
export async function login(email, password) {
  const r = await api(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password, app_id: APP_ID }),
  });
  if (r.token) setAuthToken(r.token);
  return r.user || null;
}

export async function fetchMe() {
  return api(`/auth/me`);
}

export function logout() {
  setAuthToken(null);
}

// ── Coach: athletes ─────────────────────────────────────────────────
export async function listAthletes() {
  return api(`/fp/coach/athletes`);
}

export async function createAthlete({ email, name, password, weight, targets }) {
  return api(`/fp/coach/athletes`, {
    method: "POST",
    body: JSON.stringify({ email, name, password, weight, targets }),
  });
}

export async function setAthletePasswordResetAllowed(athleteId, allowed) {
  return api(`/fp/coach/athletes/${athleteId}/password-reset-allowed`, {
    method: "PUT",
    body: JSON.stringify({ allowed: !!allowed }),
  });
}

export async function resetAthletePassword(athleteId, newPassword) {
  return api(`/fp/coach/athletes/${athleteId}/password`, {
    method: "PUT",
    body: JSON.stringify({ password: newPassword }),
  });
}

// ── Admin: coach management ─────────────────────────────────────────
export async function listCoaches() {
  return api(`/fp/admin/coaches`);
}

export async function createCoach({ email, name, password, isAdmin }) {
  return api(`/fp/admin/coaches`, {
    method: "POST",
    body: JSON.stringify({ email, name, password, is_admin: !!isAdmin }),
  });
}

export async function setCoachAdmin(coachId, isAdmin) {
  return api(`/fp/admin/coaches/${coachId}/admin`, {
    method: "PUT",
    body: JSON.stringify({ is_admin: !!isAdmin }),
  });
}

// ── Workouts ────────────────────────────────────────────────────────
export async function listWorkouts(athleteId) {
  return api(`/fp/athletes/${athleteId}/workouts`);
}

export async function upsertWorkout(athleteId, workout) {
  return api(`/fp/athletes/${athleteId}/workouts`, {
    method: "POST",
    body: JSON.stringify(workout),
  });
}

export async function deleteWorkout(athleteId, date) {
  return api(`/fp/athletes/${athleteId}/workouts/${date}`, { method: "DELETE" });
}

// ── Tracking (steps / weight / mood / water / sleep) ────────────────
const TRACKING_KINDS = ["weight", "mood", "steps", "water", "sleep"];

export async function listTracking(athleteId, kind) {
  if (!TRACKING_KINDS.includes(kind)) throw new Error("Invalid tracking kind");
  return api(`/fp/athletes/${athleteId}/tracking/${kind}`);
}

export async function logTracking(athleteId, kind, entry) {
  if (!TRACKING_KINDS.includes(kind)) throw new Error("Invalid tracking kind");
  return api(`/fp/athletes/${athleteId}/tracking/${kind}`, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

// ── Lift log ────────────────────────────────────────────────────────
export async function listLiftLog(athleteId) {
  return api(`/fp/athletes/${athleteId}/lifts`);
}

export async function logLift(athleteId, exerciseName, entry) {
  return api(`/fp/athletes/${athleteId}/lifts`, {
    method: "POST",
    body: JSON.stringify({ exercise_name: exerciseName, ...entry }),
  });
}

// ── Food log ────────────────────────────────────────────────────────
export async function listFoodLog(athleteId, date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return api(`/fp/athletes/${athleteId}/food-log${q}`);
}

export async function logFood(athleteId, entry) {
  return api(`/fp/athletes/${athleteId}/food-log`, {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

// ── Calendar events (non-workout) ───────────────────────────────────
export async function listEvents(athleteId) {
  return api(`/fp/athletes/${athleteId}/events`);
}

export async function createEvent(athleteId, event) {
  return api(`/fp/athletes/${athleteId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export async function deleteEvent(athleteId, eventId) {
  return api(`/fp/athletes/${athleteId}/events/${eventId}`, { method: "DELETE" });
}

// ── Messages ────────────────────────────────────────────────────────
export async function listMessages(otherUserId) {
  return api(`/fp/messages/${otherUserId}`);
}

export async function sendMessage(toUserId, text) {
  return api(`/fp/messages/${toUserId}`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ── Foods (shared with No Rules) ────────────────────────────────────

function normaliseFood(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand || null,
    barcode: row.barcode || null,
    serving: row.serving_size != null ? Number(row.serving_size) : 100,
    servingUnit: row.serving_unit || "g",
    calories: Number(row.calories) || 0,
    protein: Number(row.protein_g) || 0,
    carbs: Number(row.carbs_g) || 0,
    fat: Number(row.fat_g) || 0,
    fibre: Number(row.fibre_g) || 0,
    source: "fp",
    reportCount: Number(row.report_count) || 0,
  };
}

async function fetchOpenFoodFacts(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "FitnessPacific/1.0 (https://gerardqueen.github.io/fitness-pacific)",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments || {};
  const cals =
    n["energy-kcal_100g"] ??
    n["energy-kcal_value"] ??
    (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : null);
  if (cals == null) return null;
  return {
    id: null,
    name: p.product_name_en || p.product_name || p.generic_name || "Unknown product",
    brand: (p.brands || "").split(",")[0].trim() || null,
    barcode: String(barcode),
    serving: 100,
    servingUnit: "g",
    calories: Math.round(Number(cals) || 0),
    protein:  Math.round(Number(n.proteins_100g)     || 0),
    carbs:    Math.round(Number(n.carbohydrates_100g) || 0),
    fat:      Math.round(Number(n.fat_100g)          || 0),
    fibre:    Math.round(Number(n.fiber_100g)        || 0),
    source: "off",
  };
}

export async function lookupBarcode(code) {
  if (isLive()) {
    try {
      const food = await api(`/foods/barcode/${encodeURIComponent(code)}`);
      return normaliseFood(food);
    } catch (e) {
      if (e.code !== "not_found" && e.code !== "auth_required") {
        console.warn("Backend barcode lookup failed:", e.message);
      }
    }
  }
  try {
    const off = await fetchOpenFoodFacts(code);
    if (off) {
      if (isLive() && getAuthToken()) {
        addFood(off).catch(() => {});
      }
      return off;
    }
  } catch (e) {
    console.warn("Open Food Facts lookup failed:", e.message);
  }
  return null;
}

export async function searchFoods(query) {
  if (!isLive() || !query || query.trim().length < 2) return [];
  try {
    const rows = await api(`/foods/search?q=${encodeURIComponent(query)}`);
    return (rows || []).map(normaliseFood);
  } catch (e) {
    console.warn("Food search failed:", e.message);
    return [];
  }
}

export async function addFood(food) {
  if (!isLive()) return null;
  const payload = {
    barcode: food.barcode || null,
    name: food.name,
    brand: food.brand || null,
    calories: food.calories,
    protein_g: food.protein,
    carbs_g: food.carbs,
    fat_g: food.fat,
    fibre_g: food.fibre || 0,
    serving_size: food.serving || 100,
    serving_unit: food.servingUnit || "g",
  };
  try {
    const row = await api(`/foods`, { method: "POST", body: JSON.stringify(payload) });
    return normaliseFood(row);
  } catch (e) {
    if (e.status === 409) return null;
    throw e;
  }
}

export async function reportFood(foodId, reason) {
  if (!isLive() || !foodId) return;
  try {
    await api(`/foods/${foodId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "" }),
    });
  } catch (e) {
    console.warn("Report food failed:", e.message);
  }
}
