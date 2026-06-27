// CineFind Constants

export const COLORS = {
  PRIMARY: "#378ADD", // Blue 400
  CONFIRMATION: "#1D9E75", // Teal 400
  BACKGROUND: "#121212",
  SURFACE: "#1E1E1E",
  TEXT_PRIMARY: "#FFFFFF",
  TEXT_SECONDARY: "#A0A0A0",
  BORDER: "#2D2D2D",
};

export const STYLES = {
  BORDER_RADIUS: "6px",
};

// SVG logos for major streaming services to load instantly without external network dependencies
export const STREAMING_LOGOS = {
  203: {
    name: "Netflix",
    color: "#E50914",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.998 1.488v21.024c0 .351.218.665.545.787.094.035.191.052.288.052.247 0 .484-.113.639-.319L17.38 6.273v16.239c0 .449.364.812.812.812h.353a.813.813 0 0 0 .812-.812V1.488c0-.348-.215-.662-.539-.785a.812.812 0 0 0-.931.258L8 17.653V1.488A.813.813 0 0 0 7.188.676H6.81a.812.812 0 0 0-.812.812z"/></svg>`
  },
  80: {
    name: "Disney+",
    color: "#113CCF",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-1-4c0 .55-.45 1-1 1s-1-.45-1-1V9c0-.55.45-1 1-1s1 .45 1 1v3.5z"/></svg>` // Fallback style D
  },
  26: {
    name: "Prime Video",
    color: "#00A8E1",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.18 13.87c-.66.8-1.57 1.3-2.6 1.48-1.02.18-2.07.03-3-.45-.92-.47-1.7-1.22-2.22-2.12-.13-.23-.07-.53.15-.69.22-.16.53-.1.69.12.44.75 1.09 1.37 1.86 1.76.77.39 1.63.51 2.47.36.85-.15 1.6-.57 2.14-1.23.18-.21.49-.24.7-.06.22.18.25.49.07.71l-.26.07zM18 9.5c0 .28-.22.5-.5.5h-11c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h11c.28 0 .5.22.5.5z"/></svg>`
  },
  387: {
    name: "Max",
    color: "#002BE7",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.3 12.3c-.3.3-.7.5-1.1.6v-2.8c.4.1.8.3 1.1.6.3.3.4.7.4 1.1s-.1.8-.4 1.1zm-4.4 0c-.3-.3-.4-.7-.4-1.1s.1-.8.4-1.1c.3-.3.7-.5 1.1-.6v2.8c-.4-.1-.8-.3-1.1-.6zM12 8.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"/></svg>`
  },
  372: {
    name: "Apple TV+",
    color: "#000000",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.7-1.13 1.84-1.01 2.96 1.07.08 2.18-.54 2.84-1.35z"/></svg>`
  },
  133: {
    name: "Hulu",
    color: "#1CE783",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-15C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zM10.2 15.5H8.3v-7h1.9v7zm5.5 0h-1.9v-.7c-.4.5-1 .8-1.7.8-1.4 0-2.3-1.1-2.3-2.5V8.5h1.9v4c0 .6.4.9.9.9.5 0 .9-.3.9-.9v-4h1.9v7l.3.1z"/></svg>`
  },
  140: {
    name: "Paramount+",
    color: "#0064FF",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
  },
  389: {
    name: "Peacock",
    color: "#000000",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" fill="#3C95D2"/><circle cx="9.2" cy="10" r="2" fill="#E8B02B"/><circle cx="13.4" cy="9.2" r="2" fill="#E53A2A"/><circle cx="17.6" cy="10" r="2" fill="#7F3590"/><circle cx="20" cy="12" r="2" fill="#188C43"/><circle cx="13.4" cy="14.8" r="2" fill="#00AEEF"/></svg>`
  },
  400: {
    name: "Apple TV (Buy/Rent)",
    color: "#333333",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.7-1.13 1.84-1.01 2.96 1.07.08 2.18-.54 2.84-1.35z"/></svg>`
  },
  398: {
    name: "Google Play (Buy/Rent)",
    color: "#00C0FF",
    svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.25 2.3c-.11.13-.17.34-.17.6v18.2c0 .26.06.47.17.6l.07.07 10.37-10.37v-.2L3.32 2.23l-.07.07zM17.15 12.5l-3.46-3.46v-.07l3.46-3.46.08.05 4.1 2.33c1.17.66 1.17 1.75 0 2.42l-4.1 2.33-.08.06zM13.69 12.16L3.32 21.77c.38.4 1 .42 1.71.02l11.19-6.36-2.53-2.53-.7.7zM13.69 11.84l2.53-2.53-11.19-6.36c-.71-.4-1.33-.38-1.71.02l10.37 9.67.7.7z"/></svg>`
  }
};

export function getLogoForSource(sourceId, fallbackName = "") {
  const logo = STREAMING_LOGOS[sourceId];
  if (logo) {
    return `<span class="streaming-logo-badge" style="background-color: ${logo.color};" title="${logo.name}">${logo.svg}</span>`;
  }
  
  // Text-based badge showing the service name
  const name = fallbackName || "Streaming";
  return `<span class="streaming-logo-badge fallback" title="${name}"><span class="badge-text">${name}</span></span>`;
}

// User-facing strings
export const STRINGS = {
  APP_NAME: "CineFind",
  SEARCH_PLACEHOLDER: "Search movies and TV shows...",
  TRENDING_TITLE: "Trending Now",
  WATCHLIST_TITLE: "Watch List",
  WATCHED_TITLE: "Watched",
  MY_LISTS_TITLE: "My Lists",
  PROFILE_TITLE: "My Profile",
  REVIEWS_TITLE: "User Reviews",
  WRITE_REVIEW: "Write a Review",
  RATING_LABEL: "Your Rating:",
  BODY_LABEL: "Review Content (Optional):",
  VISIBILITY_LABEL: "Make review public",
  SUBMIT_REVIEW: "Submit Review",
  EMPTY_WATCHLIST: "Your Watch List is empty.",
  EMPTY_WATCHED: "You haven't marked any titles as watched yet.",
  NOT_AVAILABLE: "Not currently available to stream",
};
