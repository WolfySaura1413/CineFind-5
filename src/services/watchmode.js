// Watchmode API Service

const BASE_URL = "https://api.watchmode.com/v1/";
const CACHE_PREFIX = "cinefind_cache_v5_";

// Clear any stale cached data from prior versions
try {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("cinefind_cache_") && !key.startsWith("cinefind_cache_v5_")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
} catch (e) { /* ignore */ }

// Caching Helpers
function getCachedData(key) {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;
    
    const { data, expiry } = JSON.parse(cached);
    if (new Date().getTime() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function setCachedData(key, data, durationHours) {
  try {
    const expiry = new Date().getTime() + durationHours * 60 * 60 * 1000;
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry }));
  } catch (e) {
    console.error("Cache set error:", e);
  }
}

function getAPIKeys() {
  const keys = {
    primary: window.CONFIG?.WATCHMODE_API_KEY_1 || "",
    fallback: window.CONFIG?.WATCHMODE_API_KEY_2 || "",
    region: window.CONFIG?.DEFAULT_REGION || "US"
  };
  return keys;
}

// Fetch helper with retry logic on 429
async function fetchFromWatchmode(endpoint, queryParams = {}, useFallback = false) {
  const keys = getAPIKeys();
  const apiKey = useFallback ? keys.fallback : keys.primary;

  if (!apiKey) {
    throw new Error("No API key configured.");
  }

  // Construct URL
  const query = new URLSearchParams({ ...queryParams, apiKey });
  const url = `${BASE_URL}${endpoint}?${query.toString()}`;

  try {
    const response = await fetch(url);
    if (response.status === 429) {
      if (!useFallback && keys.fallback) {
        console.warn("Watchmode rate limit (429) hit. Retrying with fallback API key...");
        return await fetchFromWatchmode(endpoint, queryParams, true);
      }
      throw new Error("Rate limit exceeded on all provisioned Watchmode API keys (429).");
    }
    
    if (!response.ok) {
      throw new Error(`Watchmode API returned error status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Watchmode fetch failed:", error);
    throw error;
  }
}

// API Methods
export async function getTrendingTitles() {
  const cacheKey = "trending";
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchFromWatchmode("list-titles/", {
      sort_by: "popularity_desc",
      limit: 10
    });
    
    const titles = (response.titles || []).map(t => ({
      id: String(t.id),
      name: t.title,
      year: t.year,
      type: t.type === "tv_series" ? "tv_series" : "movie",
      poster: "",
      genre_names: [],
      plot_overview: "Explore streaming details, ratings, and options inside.",
      user_rating: 0,
      release_date: ""
    }));

    setCachedData(cacheKey, titles, 24);
    return titles;
  } catch (error) {
    console.warn("Fetch trending failed:", error);
    return [];
  }
}

export async function searchTitles(query, typeFilter = "") {
  if (!query || !query.trim()) return [];
  const normalizedQuery = query.toLowerCase().trim();

  const cacheKey = `search_${normalizedQuery}_${typeFilter}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    let typesParam = "movie,tv_movie,tv_series";
    if (typeFilter === "movie") {
      typesParam = "movie,tv_movie";
    } else if (typeFilter === "tv_series") {
      typesParam = "tv_series";
    }

    const response = await fetchFromWatchmode("search/", {
      search_field: "name",
      search_value: query,
      types: typesParam
    });

    const results = (response.title_results || []).map(t => ({
      id: String(t.id),
      name: t.name,
      year: t.year,
      type: t.type === "tv_series" ? "tv_series" : "movie",
      poster: "",
      genre_names: [],
      plot_overview: "",
      user_rating: 0,
      release_date: ""
    }));

    setCachedData(cacheKey, results, 1);
    return results;
  } catch (error) {
    console.warn("Search API failed:", error);
    return [];
  }
}

export async function getTitleDetails(id) {
  const cacheKey = `details_${id}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const details = await fetchFromWatchmode(`title/${id}/details/`, {});
    
    const formatted = {
      id: String(details.id),
      name: details.title,
      year: details.year,
      type: details.type === "tv_series" ? "tv_series" : "movie",
      poster: details.poster || "",
      genre_names: details.genre_names || [],
      plot_overview: details.plot_overview || "No description available.",
      user_rating: details.user_rating || 0,
      us_rating: details.us_rating || "",
      release_date: details.release_date || "",
    };

    setCachedData(cacheKey, formatted, 24);
    return formatted;
  } catch (error) {
    console.warn(`Details API failed for ${id}:`, error);
    return null;
  }
}

export async function getTitleSources(id) {
  const keys = getAPIKeys();
  const region = keys.region;

  const cacheKey = `sources_${id}_${region}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchFromWatchmode(`title/${id}/sources/`, { region });
    
    const seen = new Set();
    const sources = (response || []).filter(s => {
      if (seen.has(s.source_id)) return false;
      seen.add(s.source_id);
      return true;
    }).map(s => ({
      source_id: s.source_id,
      name: s.name,
      type: s.type,
      region: s.region,
      deeplink_android: s.android_url || "",
      deeplink_ios: s.ios_url || "",
    }));

    setCachedData(cacheKey, sources, 24);
    return sources;
  } catch (error) {
    console.warn(`Sources API failed for ${id}:`, error);
    return [];
  }
}
