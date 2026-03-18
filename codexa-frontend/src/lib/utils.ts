import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fetch project thumbnail image from Unsplash based on project name
export const fetchProjectThumbnail = async (projectName: string): Promise<string | null> => {
  const cacheKey = "project_thumbnail_cache";
  const normalizedName = projectName.toLowerCase().trim();

  if (!normalizedName) return null;

  try {
    const cacheRaw = localStorage.getItem(cacheKey);
    const cache = cacheRaw ? (JSON.parse(cacheRaw) as Record<string, string>) : {};
    if (cache[normalizedName]) {
      return cache[normalizedName];
    }

    // Unsplash Access Key - You should add this to your .env file
    const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || 'YOUR_UNSPLASH_ACCESS_KEY';
    
    if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === 'YOUR_UNSPLASH_ACCESS_KEY') {
      console.warn('Unsplash API key not configured');
      return null;
    }

    // Extract keywords from project name for better search results
    const searchQuery = normalizedName.replace(/[^a-z0-9\s]/g, ' ').trim() || 'technology';
    
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(searchQuery)}&orientation=landscape&content_filter=high`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unsplash API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.urls?.regular || null;

    if (imageUrl) {
      const updatedCache = { ...cache, [normalizedName]: imageUrl };
      localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
    }

    return imageUrl;
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error);
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
