import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const projectThumbnailQueryMap: Record<string, string> = {
  note: "productivity workspace notes planner desk",
  notes: "productivity workspace notes planner desk",
  todo: "task management productivity dashboard",
  task: "task management productivity dashboard",
  reminder: "calendar reminder productivity app",
  calendar: "calendar scheduling productivity app",
  calculator: "calculator finance math workspace",
  calc: "calculator finance math workspace",
  math: "mathematics calculator workspace",
  chat: "team chat messaging app interface",
  message: "team chat messaging app interface",
  messenger: "team chat messaging app interface",
  social: "social media app interface",
  forum: "online community discussion app",
  blog: "editorial blog writing workspace",
  shop: "online shopping ecommerce website",
  store: "online shopping ecommerce website",
  cart: "online shopping ecommerce website",
  ecommerce: "online shopping ecommerce website",
  marketplace: "online marketplace ecommerce app",
  wallet: "fintech wallet mobile app",
  finance: "fintech banking mobile app",
  bank: "digital banking finance app",
  payment: "digital payment fintech app",
  budget: "personal finance budgeting app",
  food: "food delivery restaurant app",
  restaurant: "restaurant ordering app",
  recipe: "cooking recipe food app",
  delivery: "delivery logistics app",
  music: "music streaming app",
  video: "video streaming app",
  movie: "movie streaming entertainment app",
  game: "gaming app interface",
  gaming: "gaming app interface",
  photo: "photo gallery app",
  gallery: "photo gallery app",
  chess: "chess strategy game app",
  education: "online learning education platform",
  learning: "online learning education platform",
  course: "online course education dashboard",
  quiz: "quiz learning education app",
  exam: "student education exam dashboard",
  health: "healthcare wellness app",
  fitness: "fitness workout app",
  workout: "fitness workout app",
  meditation: "meditation wellness app",
  weather: "weather forecast app",
  map: "maps navigation app",
  travel: "travel booking app",
  location: "maps navigation app",
  dashboard: "analytics business dashboard interface",
  analytics: "analytics business dashboard interface",
  report: "business reporting analytics dashboard",
  crm: "customer relationship management dashboard",
  invoice: "invoice finance dashboard",
  portfolio: "portfolio website creative showcase",
  code: "software development coding workspace",
  api: "developer api dashboard",
  database: "database admin dashboard",
  admin: "admin panel software dashboard",
  cms: "content management system dashboard",
  book: "digital reading library app",
  timer: "timer productivity app",
  clock: "clock productivity app",
  news: "news reader app",
  search: "search engine dashboard",
  home: "smart home dashboard app",
  car: "automotive dashboard app",
  bike: "cycling fitness tracking app",
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
};

const buildThumbnailSearchQuery = (projectName: string) => {
  const normalizedName = projectName.toLowerCase().trim();
  const cleanedName = normalizedName.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (!cleanedName || isGenericName(cleanedName)) {
    return "modern software application interface";
  }

  for (const [keyword, query] of Object.entries(projectThumbnailQueryMap)) {
    if (cleanedName.includes(keyword)) {
      return query;
    }
  }

  return `${cleanedName} app interface`;
};

// Fetch project thumbnail image from Unsplash based on project name
export const fetchProjectThumbnail = async (projectName: string): Promise<string | null> => {
  const cacheKey = "project_thumbnail_cache_v2";
  const normalizedName = projectName.toLowerCase().trim();

  if (!normalizedName) return null;

  try {
    const cacheRaw = localStorage.getItem(cacheKey);
    const cache = cacheRaw ? (JSON.parse(cacheRaw) as Record<string, string>) : {};
    if (cache[normalizedName]) {
      return cache[normalizedName];
    }

    const unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || "YOUR_UNSPLASH_ACCESS_KEY";
    if (!unsplashAccessKey || unsplashAccessKey === "YOUR_UNSPLASH_ACCESS_KEY") {
      console.warn("Unsplash API key not configured");
      return null;
    }

    const primaryQuery = buildThumbnailSearchQuery(projectName);
    const fallbackQuery = isGenericName(normalizedName)
      ? "software product interface"
      : `${normalizedName.replace(/[^a-z0-9\s]/g, " ").trim()} technology product`;

    const fetchSearchResults = async (query: string) => {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&per_page=12&order_by=relevant`,
        {
          headers: {
            Authorization: `Client-ID ${unsplashAccessKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Unsplash API error:", response.status, errorText);
        return [];
      }

      const data = (await response.json()) as { results?: Array<{ urls?: { small?: string; regular?: string } }> };
      return Array.isArray(data.results) ? data.results : [];
    };

    let results = await fetchSearchResults(primaryQuery);
    if (results.length === 0 && fallbackQuery !== primaryQuery) {
      results = await fetchSearchResults(fallbackQuery);
    }

    if (results.length === 0) {
      return null;
    }

    const selectedPhoto = results[hashString(normalizedName) % results.length];
    const imageUrl = selectedPhoto?.urls?.regular || selectedPhoto?.urls?.small || null;

    if (imageUrl) {
      const updatedCache = { ...cache, [normalizedName]: imageUrl };
      localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
    }

    return imageUrl;
  } catch (error) {
    console.error("Failed to fetch Unsplash image:", error);
    return null;
  }
};

// Helper for deterministic gradient generation
export const generateGradient = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h1 = Math.abs(hash % 360);
  const h2 = Math.abs((hash >> 8) % 360);
  const h3 = Math.abs((hash >> 16) % 360);

  const c1 = `hsl(${h1}, 70%, 65%)`;
  const c2 = `hsl(${h2}, 80%, 75%)`;
  const c3 = `hsl(${h3}, 60%, 80%)`;

  return {
    background: `
      radial-gradient(at top left, ${c1}, transparent 70%),
      radial-gradient(at bottom right, ${c2}, transparent 70%),
      radial-gradient(at center, ${c3}, transparent 50%),
      #f0f0f5
    `,
    backgroundSize: '150% 150%', // To allow for some blurry overlap
  };
};

// Project name to icon key mapping (used by UI to render real icons)
const projectIconMap: Record<string, string> = {
  // Productivity & Notes
  "note": "file-text",
  "notes": "file-text",
  "todo": "list-todo",
  "task": "list-todo",
  "reminder": "clock",
  "calendar": "calendar",

  // Math & Calculation
  "calculator": "calculator",
  "calc": "calculator",
  "math": "calculator",

  // Social & Communication
  "chat": "message-square",
  "message": "message-square",
  "messenger": "message-square",
  "social": "message-square",
  "forum": "message-square",
  "blog": "newspaper",

  // E-commerce & Shopping
  "shop": "shopping-cart",
  "store": "shopping-cart",
  "cart": "shopping-cart",
  "ecommerce": "shopping-cart",
  "marketplace": "shopping-cart",

  // Finance & Money
  "wallet": "wallet",
  "finance": "credit-card",
  "bank": "credit-card",
  "payment": "credit-card",
  "budget": "receipt",

  // Food & Delivery
  "food": "utensils",
  "restaurant": "utensils",
  "recipe": "utensils",
  "delivery": "truck",

  // Entertainment & Media
  "music": "music",
  "video": "video",
  "movie": "video",
  "game": "gamepad-2",
  "gaming": "gamepad-2",
  "photo": "image",
  "gallery": "image",
  "chess": "crown",

  // Education & Learning
  "education": "graduation-cap",
  "learning": "graduation-cap",
  "course": "graduation-cap",
  "quiz": "help-circle",
  "exam": "file-text",

  // Health & Fitness
  "health": "heart-pulse",
  "fitness": "dumbbell",
  "workout": "dumbbell",
  "meditation": "sparkles",

  // Weather & Location
  "weather": "cloud-sun",
  "map": "map-pin",
  "travel": "plane",
  "location": "map-pin",

  // Business & Work
  "dashboard": "layout-dashboard",
  "analytics": "bar-chart-3",
  "report": "bar-chart-3",
  "crm": "briefcase",
  "invoice": "receipt",
  "portfolio": "briefcase",

  // Development & Tech
  "code": "code-2",
  "api": "plug",
  "database": "database",
  "admin": "settings",
  "cms": "file-text",

  // Other
  "book": "book",
  "timer": "timer",
  "clock": "clock",
  "news": "newspaper",
  "search": "search",
  "home": "home",
  "car": "car",
  "bike": "bike",
};

// Check if project name is generic/unnamed
const isGenericName = (name: string): boolean => {
  const normalized = name.toLowerCase().trim();
  return (
    normalized === "" ||
    /^project\s*\d*$/i.test(normalized) ||
    /^unnamed$/i.test(normalized) ||
    /^untitled$/i.test(normalized) ||
    /^new\s*project$/i.test(normalized) ||
    normalized === "test" ||
    normalized === "demo"
  );
};

// Get icon for project based on name
export const getProjectIcon = (name: string): string => {
  const cacheKey = "project_icon_cache";
  const normalized = name.toLowerCase().trim();

  if (normalized) {
    try {
      const cacheRaw = localStorage.getItem(cacheKey);
      const cache = cacheRaw ? (JSON.parse(cacheRaw) as Record<string, string>) : {};
      if (cache[normalized]) {
        return cache[normalized];
      }

      for (const [key, icon] of Object.entries(projectIconMap)) {
        if (normalized.includes(key)) {
          const updatedCache = { ...cache, [normalized]: icon };
          localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
          return icon;
        }
      }
    } catch (error) {
      console.error("Failed to read/write icon cache:", error);
    }
  }

  return "folder"; // Default icon for generic/unknown names
};
