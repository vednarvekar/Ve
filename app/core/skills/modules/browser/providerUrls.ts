export type SearchProvider =
  | "google"
  | "duckduckgo"
  | "bing"
  | "youtube"
  | "netflix"
  | "github"
  | "reddit"
  | "wikipedia"
  | (string & {});

const SEARCH_TEMPLATES: Record<string, (query: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  netflix: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  github: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
  reddit: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  wikipedia: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
};

export const COMMON_DOMAIN_ALIASES: Record<string, string> = {
  youtube: "https://www.youtube.com",
  netflix: "https://www.netflix.com",
  github: "https://github.com",
  reddit: "https://www.reddit.com",
  twitter: "https://twitter.com",
  x: "https://x.com",
  gmail: "https://mail.google.com",
  google: "https://www.google.com",
  chatgpt: "https://chatgpt.com",
};

export function buildSearchUrl(query: string, provider: string = "google"): string {
  const cleanProvider = provider.toLowerCase().trim();
  const builder = SEARCH_TEMPLATES[cleanProvider] || SEARCH_TEMPLATES.google;
  return builder!(query.trim());
}

export function normalizeBrowserTarget(target: string): string {
  const clean = target.trim().toLowerCase();
  if (COMMON_DOMAIN_ALIASES[clean]) {
    return COMMON_DOMAIN_ALIASES[clean]!;
  }
  if (!/^https?:\/\//i.test(target.trim())) {
    return `https://${target.trim()}`;
  }
  return target.trim();
}
