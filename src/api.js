// ─────────────────────────────────────────────────────────────────────
//  Fitness Pacific — API client
// ─────────────────────────────────────────────────────────────────────
// All backend talk goes through this module so we have ONE place to:
//   1. Configure the base URL (per environment via VITE_API_URL)
//   2. Inject the auth header
//   3. Add Open Food Facts as a fallback for missing barcodes
//   4. Handle network errors gracefully
//
// Build-time env vars (set in .github/workflows/deploy.yml or .env.local):
//   VITE_API_URL   — base URL of the No Rules backend (e.g. https://norules-api.up.railway.app)
//                    If unset, the app runs in "stub mode" using the local mock data.
//   VITE_APP_ID    — identifies this app to the backend (default: "fitness-pacific")
//
// Auth tokens are stored in memory only (not localStorage — see artifact rules).
// When real auth is wired up, replace setAuthToken() callers with the real flow.
// ─────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "";
const APP_ID  = import.meta.env.VITE_APP_ID  || "fitness-pacific";

// In-memory token. When auth is built, the login flow sets this once.
let authToken = null;
export const setAuthToken = (token) => { authToken = token; };
export const getAuthToken = () => authToken;

// True when the app is configured to talk to a real backend.
export const isLive = () => !!API_URL;

// Internal: build standard headers for an API call
function headers(extra = {}) {
  const h = {
    "Content-Type": "application/json",
    "X-App-Id": APP_ID,
    ...extra,
  };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

// Internal: wrap fetch with sensible defaults and consistent error shape
async function api(path, opts = {}) {
  if (!API_URL) {
    // Stub mode — caller should fall back to local data
    const err = new Error("API not configured (VITE_API_URL is unset)");
    err.code = "no_api";
    throw err;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: headers(opts.headers),
  });
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
  return res.json();
}

// ── Foods ────────────────────────────────────────────────────────────

// Lookup by barcode, falling back to Open Food Facts if not in our DB.
// Returns a normalised food object or null.
export async function lookupBarcode(code) {
  // 1. Try our own backend cache first
  if (isLive()) {
    try {
      const food = await api(`/foods/barcode/${encodeURIComponent(code)}`);
      return normaliseFood(food);
    } catch (e) {
      if (e.code !== "not_found") {
        // Network/auth error — log but still try OFF
        console.warn("Backend barcode lookup failed:", e.message);
      }
    }
  }

  // 2. Fallback to Open Food Facts (works without API key, no auth)
  try {
    const off = await fetchOpenFoodFacts(code);
    if (off) {
      // 3. Best-effort: cache it back to our DB so next time it's instant
      if (isLive() && authToken) {
        addFood(off).catch(() => { /* caching is best-effort */ });
      }
      return off;
    }
  } catch (e) {
    console.warn("Open Food Facts lookup failed:", e.message);
  }

  return null;
}

// Normalise a backend food row into the shape the UI expects
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
    source: "fp",          // came from our backend
    reportCount: Number(row.report_count) || 0,
  };
}

// Open Food Facts public API — no key required.
// Free, ~3M products, includes most UK supermarket items.
async function fetchOpenFoodFacts(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, {
    headers: {
      // OFF asks for a UA so they can identify traffic and contact you if needed
      "User-Agent": "FitnessPacific/1.0 (https://gerardqueen.github.io/fitness-pacific)",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  // OFF reports per-100g; that's exactly what we want as the canonical serving
  const n = p.nutriments || {};
  const cals =
    n["energy-kcal_100g"] ??
    n["energy-kcal_value"] ??
    (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : null);

  if (cals == null) return null; // no useful nutrition data

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
    source: "off",  // came from Open Food Facts
  };
}

// Search for foods by name (autocomplete).
// Returns the live backend results, or [] in stub mode.
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

// Add a new food to the shared backend database.
// Used both directly (manual entry) and as a write-through cache after OFF lookups.
export async function addFood(food) {
  if (!isLive()) {
    // Stub mode — pretend we saved it
    return { ...food, id: `stub-${Date.now()}` };
  }
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
    // 409 = barcode already exists — that's fine, it just means someone beat us to it
    if (e.status === 409) return null;
    throw e;
  }
}

// Report a food entry as incorrect (increments the backend's report_count).
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
