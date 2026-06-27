// Watchmode API Service

const BASE_URL = "https://api.watchmode.com/v1/";
const CACHE_PREFIX = "cinefind_cache_";

// Mock Data for fallback when API keys are not supplied
const MOCK_TITLES = [
  {
    id: "1",
    name: "Dune: Part Two",
    year: 2024,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/czemb4211NYKgViAI42WJAdAL31.jpg",
    genre_names: ["Sci-Fi", "Adventure", "Drama"],
    plot_overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    user_rating: 4.8,
    release_date: "2024-03-01",
  },
  {
    id: "2",
    name: "Stranger Things",
    year: 2016,
    type: "tv_series",
    poster: "https://image.tmdb.org/t/p/w500/49Wk21Z1jOCC727ZJcY6P6gJ1Sg.jpg",
    genre_names: ["Drama", "Sci-Fi", "Mystery"],
    plot_overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
    user_rating: 4.7,
    release_date: "2016-07-15",
  },
  {
    id: "3",
    name: "Oppenheimer",
    year: 2023,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv2Z7HqD61sbf7aZKVgBkzzgB.jpg",
    genre_names: ["Biography", "Drama", "History"],
    plot_overview: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    user_rating: 4.9,
    release_date: "2023-07-21",
  },
  {
    id: "4",
    name: "The Last of Us",
    year: 2023,
    type: "tv_series",
    poster: "https://image.tmdb.org/t/p/w500/uKVKSjgd2jL0tD56JgX687r7HGX.jpg",
    genre_names: ["Action", "Adventure", "Drama"],
    plot_overview: "After a global pandemic destroys civilization, a hardened survivor takes charge of a 14-year-old girl who may be humanity's last hope.",
    user_rating: 4.6,
    release_date: "2023-01-15",
  },
  {
    id: "5",
    name: "Spider-Man: Across the Spider-Verse",
    year: 2023,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/8VtB7vJDzCS6t74EgRLZ5aVE1r4.jpg",
    genre_names: ["Animation", "Action", "Adventure"],
    plot_overview: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.",
    user_rating: 4.7,
    release_date: "2023-06-02",
  },
  {
    id: "6",
    name: "Breaking Bad",
    year: 2008,
    type: "tv_series",
    poster: "https://image.tmdb.org/t/p/w500/ztkUQv63MzC36VWcc27e05Czg50.jpg",
    genre_names: ["Drama", "Crime", "Thriller"],
    plot_overview: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student.",
    user_rating: 5.0,
    release_date: "2008-01-20",
  }
];

const MOCK_SOURCES = {
  "1": [
    { source_id: 387, name: "Max", type: "sub", region: "US", deeplink_android: "hdomax://play", deeplink_ios: "hbomax://play" },
    { source_id: 26, name: "Prime Video", type: "rent", region: "US", deeplink_android: "amazonvideo://play", deeplink_ios: "amazonvideo://play" },
    { source_id: 400, name: "Apple TV", type: "buy", region: "US", deeplink_android: "appletv://play", deeplink_ios: "videos://" }
  ],
  "2": [
    { source_id: 203, name: "Netflix", type: "sub", region: "US", deeplink_android: "nflx://title/80057281", deeplink_ios: "nflx://title/80057281" }
  ],
  "3": [
    { source_id: 26, name: "Prime Video", type: "sub", region: "US", deeplink_android: "amazonvideo://play", deeplink_ios: "amazonvideo://play" },
    { source_id: 400, name: "Apple TV", type: "rent", region: "US", deeplink_android: "appletv://play", deeplink_ios: "videos://" }
  ],
  "4": [
    { source_id: 387, name: "Max", type: "sub", region: "US", deeplink_android: "hdomax://play", deeplink_ios: "hbomax://play" }
  ],
  "5": [
    { source_id: 203, name: "Netflix", type: "sub", region: "US", deeplink_android: "nflx://play", deeplink_ios: "nflx://play" },
    { source_id: 26, name: "Prime Video", type: "rent", region: "US", deeplink_android: "amazonvideo://play", deeplink_ios: "amazonvideo://play" }
  ],
  "6": [
    { source_id: 203, name: "Netflix", type: "sub", region: "US", deeplink_android: "nflx://title/70143825", deeplink_ios: "nflx://title/70143825" }
  ]
};

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

// Check if keys are active
function getAPIKeys() {
  const keys = {
    primary: window.CONFIG?.WATCHMODE_API_KEY_1 || "",
    fallback: window.CONFIG?.WATCHMODE_API_KEY_2 || "",
    region: window.CONFIG?.DEFAULT_REGION || "US"
  };
  return keys;
}

function hasKeys() {
  const keys = getAPIKeys();
  return keys.primary && !keys.primary.startsWith("your_");
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
  if (!hasKeys()) {
    console.log("CineFind: Using high-fidelity mock data for trending titles.");
    return MOCK_TITLES;
  }

  const cacheKey = "trending";
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchFromWatchmode("list-titles/", {
      sort_by: "popularity_desc",
      limit: 10
    });
    
    // Standardize structure
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

    setCachedData(cacheKey, titles, 24); // Cache trending list for 24 hours
    return titles;
  } catch (error) {
    console.warn("Fetch trending failed, falling back to mock data:", error);
    return MOCK_TITLES;
  }
}

export async function searchTitles(query, typeFilter = "") {
  if (!query || !query.trim()) return [];
  const normalizedQuery = query.toLowerCase().trim();

  if (!hasKeys()) {
    // Search mock data
    let results = MOCK_TITLES.filter(t => t.name.toLowerCase().includes(normalizedQuery));
    if (typeFilter) {
      results = results.filter(t => t.type === typeFilter);
    }
    return results;
  }

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

    setCachedData(cacheKey, results, 1); // Cache search for 1 hour
    return results;
  } catch (error) {
    console.warn("Search API failed, searching mock data:", error);
    let results = MOCK_TITLES.filter(t => t.name.toLowerCase().includes(normalizedQuery));
    if (typeFilter) {
      results = results.filter(t => t.type === typeFilter);
    }
    return results;
  }
}

export async function getTitleDetails(id) {
  const stringId = String(id);
  
  if (!hasKeys() || stringId.length < 3) { // Mock IDs are short (1, 2, etc.)
    const mock = MOCK_TITLES.find(t => String(t.id) === stringId);
    if (mock) return mock;
  }

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
      release_date: details.release_date || "",
    };

    setCachedData(cacheKey, formatted, 24); // Cache details for 24 hours
    return formatted;
  } catch (error) {
    console.warn(`Details API failed for ${id}, falling back to mock data:`, error);
    const mock = MOCK_TITLES.find(t => String(t.id) === stringId);
    if (mock) return mock;
    
    // Generic fallback if not in mocks
    return {
      id: stringId,
      name: `Title ${stringId}`,
      year: new Date().getFullYear(),
      type: "movie",
      poster: "",
      genre_names: ["Unknown"],
      plot_overview: "Streaming information is loaded dynamically. Connect your Watchmode API key for full details.",
      user_rating: 4.0,
      release_date: "",
    };
  }
}

export async function getTitleSources(id) {
  const stringId = String(id);
  const keys = getAPIKeys();
  const region = keys.region;

  if (!hasKeys() || stringId.length < 3) {
    const mock = MOCK_SOURCES[stringId];
    return mock || [];
  }

  const cacheKey = `sources_${id}_${region}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchFromWatchmode(`title/${id}/sources/`, { region });
    
    // Map response structure to our standard format
    const sources = (response || []).map(s => ({
      source_id: s.source_id,
      name: s.name,
      type: s.type, // sub, rent, buy, free
      region: s.region,
      deeplink_android: s.android_url || "",
      deeplink_ios: s.ios_url || "",
    }));

    setCachedData(cacheKey, sources, 24); // Cache sources for 24 hours
    return sources;
  } catch (error) {
    console.warn(`Sources API failed for ${id}, using mock if available:`, error);
    const mock = MOCK_SOURCES[stringId];
    return mock || [];
  }
}
