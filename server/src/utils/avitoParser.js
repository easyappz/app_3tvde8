"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");

// 24 hours TTL for in-memory caches
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory caches by normalized URL
const parseCache = new Map(); // { url: { data: {title,image,url}, expiresAt } }
const adResultCache = new Map(); // { url: { data: adDoc, expiresAt } }

// Desktop User-Agent pool (Windows/macOS, Chrome/Firefox)
const USER_AGENTS = [
  // Chrome on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  // Chrome/Firefox on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13.5; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6_9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

function pickUserAgent() {
  const idx = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[idx];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff with jitter: base * (2^(attempt+1) - 1) + random(0..base)
function backoffMs(base, attempt) {
  const exp = Math.pow(2, attempt + 1) - 1; // 1,3,7,...
  const jitter = Math.floor(Math.random() * base);
  return base * exp + jitter;
}

/**
 * Validate and normalize a URL. Ensures it's a valid Avito URL.
 * Normalization: protocol + '//' + hostname(lowercased) + pathname (no query/hash).
 * @param {string} urlString
 * @returns {string} normalized URL string
 */
function normalizeUrl(urlString) {
  if (!urlString || typeof urlString !== "string") {
    throw new Error("URL must be a non-empty string");
  }
  let parsed;
  try {
    const candidate = /^(https?:)?\/\//i.test(urlString) ? urlString : `https://${urlString}`;
    parsed = new URL(candidate);
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes("avito")) {
    throw new Error("URL must point to an Avito listing page");
  }
  const pathname = parsed.pathname || "/";
  return `${parsed.protocol}//${host}${pathname}`;
}

/**
 * Resolve possibly relative image URL against base URL.
 * @param {string} base
 * @param {string} src
 * @returns {string|null}
 */
function resolveImageUrl(base, src) {
  if (!src || typeof src !== "string") return null;
  const s = src.trim();
  if (!s || s.startsWith("data:") || s.startsWith("blob:")) return null;
  try {
    return new URL(s, base).toString();
  } catch (e) {
    return null;
  }
}

/**
 * Fetch HTML with retries, exponential backoff, and realistic headers.
 * Retries on statuses 429/503/403 and on timeouts/network errors.
 * @param {string} url
 * @param {{ retries?: number, baseDelayMs?: number, timeoutMs?: number }} options
 * @returns {Promise<string>} HTML string
 */
async function fetchHtmlWithRetries(url, { retries = 4, baseDelayMs = 500, timeoutMs = 15000 } = {}) {
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = {
        "User-Agent": pickUserAgent(),
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        Referer: "https://www.avito.ru/",
        "Upgrade-Insecure-Requests": "1",
        DNT: "1",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      };

      const response = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        responseType: "text",
        headers,
        // Always resolve; we'll handle statuses below
        validateStatus: () => true,
      });

      const { status, data } = response;
      if (status >= 200 && status < 400 && typeof data === "string") {
        return data;
      }

      // Retry on common rate-limit / temporary errors
      if (status === 429 || status === 503 || status === 403) {
        lastErr = new Error(`HTTP ${status} from source`);
      } else {
        // Non-retryable status
        throw new Error(`Unexpected HTTP status ${status}`);
      }
    } catch (err) {
      // Network/timeout or explicit thrown above
      const code = err && (err.code || err.name);
      const isTimeout = code === "ECONNABORTED" || code === "ETIMEDOUT";
      const isDns = code === "EAI_AGAIN" || code === "ENOTFOUND";
      const retryable = isTimeout || isDns || !!lastErr;
      lastErr = err;

      if (!retryable) {
        // Non-retryable (e.g., 4xx non-403)
        throw err;
      }
    }

    // If not last attempt, wait with backoff
    if (attempt < retries) {
      await delay(backoffMs(baseDelayMs, attempt));
      continue;
    }
  }

  const e = new Error(`Failed to fetch page after ${retries + 1} attempts: ${lastErr ? lastErr.message : "unknown error"}`);
  e.retryExhausted = true;
  throw e;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function isString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function pickFirstStringByKeys(obj, keys) {
  let result = null;
  const K = new Set(keys.map((k) => k.toLowerCase()));
  function walk(node) {
    if (result) return;
    if (Array.isArray(node)) {
      for (const it of node) walk(it);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (result) break;
        if (K.has(k.toLowerCase()) && isString(v)) {
          result = String(v).trim();
          break;
        }
        walk(v);
      }
    }
  }
  walk(obj);
  return result;
}

function pickImageFromUnknown(val, baseUrl) {
  function pickFromObject(o) {
    if (!o || typeof o !== "object") return null;
    const directKeys = ["url", "contentUrl", "image", "src"];
    for (const k of directKeys) {
      if (typeof o[k] === "string") {
        const resolved = resolveImageUrl(baseUrl, o[k]);
        if (resolved) return resolved;
      }
    }
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && /image|photo|picture|img/i.test(k)) {
        const resolved = resolveImageUrl(baseUrl, v);
        if (resolved) return resolved;
      }
      if (v && typeof v === "object") {
        const nested = pickImageFromUnknown(v, baseUrl);
        if (nested) return nested;
      }
    }
    return null;
  }

  if (!val) return null;
  if (typeof val === "string") return resolveImageUrl(baseUrl, val);
  if (Array.isArray(val)) {
    for (const it of val) {
      const found = pickImageFromUnknown(it, baseUrl);
      if (found) return found;
    }
    return null;
  }
  return pickFromObject(val);
}

function extractFromJsonLd(rawText, baseUrl) {
  const out = { title: null, image: null };
  const data = safeJsonParse(rawText);
  if (!data) return out;
  const items = [];
  if (Array.isArray(data)) items.push(...data);
  else if (data && typeof data === "object") {
    if (Array.isArray(data["@graph"])) items.push(...data["@graph"]);
    items.push(data);
  }
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    if (!out.title) {
      const t = pickFirstStringByKeys(it, ["name", "headline", "title"]);
      if (t) out.title = t;
    }
    if (!out.image) {
      const img = pickImageFromUnknown(it.image || it.imageUrl || it.imageURL || it.img, baseUrl);
      if (img) out.image = img;
    }
    if (out.title && out.image) break;
  }
  return out;
}

function extractInitialDataJson(html) {
  const patterns = [
    /window\.__initialData__\s*=\s*(\{[\s\S]*?\})\s*[;<]/,
    /window\.__initialData\s*=\s*(\{[\s\S]*?\})\s*[;<]/,
    /window\.__data\s*=\s*(\{[\s\S]*?\})\s*[;<]/,
    /avito\.[A-Za-z_$][\w$]*\s*=\s*(\{[\s\S]*?\})\s*[;<]/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const parsed = safeJsonParse(m[1]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function pickTitleFromObject(obj) {
  return pickFirstStringByKeys(obj, ["name", "headline", "title"]);
}

function pickImageFromObject(obj, baseUrl) {
  if (!obj || typeof obj !== "object") return null;
  const order = ["image", "imageUrl", "imageURL", "img", "photo", "picture"]; 
  for (const k of order) {
    if (k in obj) {
      const cand = pickImageFromUnknown(obj[k], baseUrl);
      if (cand) return cand;
    }
  }
  let result = null;
  (function walk(node, parentKey) {
    if (result) return;
    if (Array.isArray(node)) {
      for (const it of node) walk(it, parentKey);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (result) break;
        const key = String(k);
        if (typeof v === "string" && /image|photo|picture|img/i.test(key)) {
          const resolved = resolveImageUrl(baseUrl, v);
          if (resolved) {
            result = resolved;
            break;
          }
        }
        if (key.toLowerCase() === "url" && parentKey && /image|photo|picture|img/i.test(parentKey)) {
          const resolved = resolveImageUrl(baseUrl, v);
          if (resolved) {
            result = resolved;
            break;
          }
        }
        walk(v, key);
      }
    }
  })(obj, "");
  return result;
}

/**
 * Parse Avito page to extract title and image URL.
 * Uses in-memory cache and graceful degradation.
 * @param {string} inputUrl
 * @returns {Promise<{ ok: true, title: string, image: string|null, url: string, cached?: boolean } | { ok: false, degraded: true, url: string, reason: string, warnings: string[] }>}
 */
async function parseAvito(inputUrl) {
  const url = normalizeUrl(inputUrl);

  // Check cache first
  const cached = parseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, url, title: cached.data.title, image: cached.data.image || null, cached: true };
  }

  let html;
  try {
    html = await fetchHtmlWithRetries(url, { retries: 4, baseDelayMs: 500, timeoutMs: 15000 });
  } catch (err) {
    // Graceful degradation on fetch problems (rate limits, timeouts, etc.)
    return {
      ok: false,
      degraded: true,
      url,
      reason: "fetch-failed",
      warnings: [
        "Avito rate-limited or blocked or unreachable",
        `Details: ${err && err.message ? err.message : "unknown"}`,
      ],
    };
  }

  try {
    const $ = cheerio.load(html);

    // Candidates
    let titleFromMeta = $("meta[property='og:title']").attr("content") || $("meta[name='og:title']").attr("content") || null;
    let titleFromTitle = $("title").first().text() || null;
    titleFromMeta = titleFromMeta ? String(titleFromMeta).trim() : null;
    titleFromTitle = titleFromTitle ? String(titleFromTitle).trim() : null;

    let imageFromMeta = $("meta[property='og:image']").attr("content") || $("meta[name='og:image']").attr("content") || null;
    imageFromMeta = imageFromMeta ? resolveImageUrl(url, imageFromMeta) : null;

    // JSON-LD blocks
    let jsonLdTitle = null;
    let jsonLdImage = null;
    $("script[type='application/ld+json']").each((_, el) => {
      if (jsonLdTitle && jsonLdImage) return;
      const raw = $(el).contents().text();
      if (!raw || typeof raw !== "string") return;
      const { title, image } = extractFromJsonLd(raw, url);
      if (!jsonLdTitle && isString(title)) jsonLdTitle = title.trim();
      if (!jsonLdImage && isString(image)) jsonLdImage = resolveImageUrl(url, image);
    });

    // window.__initialData / similar
    let initTitle = null;
    let initImage = null;
    const initialJson = extractInitialDataJson(html);
    if (initialJson) {
      const t = pickTitleFromObject(initialJson);
      if (isString(t)) initTitle = t.trim();
      const img = pickImageFromObject(initialJson, url);
      if (isString(img)) initImage = resolveImageUrl(url, img);
    }

    // <link rel="image_src">
    let linkImage = $("link[rel='image_src']").attr("href");
    linkImage = linkImage ? resolveImageUrl(url, linkImage) : null;

    // <img> fallbacks
    let firstImg = null;
    $("img").each((_, img) => {
      if (firstImg) return;
      const cand = $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-original");
      const resolved = resolveImageUrl(url, cand);
      if (resolved) firstImg = resolved;
    });

    const title = (jsonLdTitle || initTitle || titleFromMeta || titleFromTitle || "").trim();
    const image = jsonLdImage || initImage || imageFromMeta || linkImage || firstImg || null;

    if (title) {
      const result = { title, image: image || null, url };
      parseCache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return { ok: true, ...result };
    }

    const warnings = [];
    if (!titleFromMeta && !titleFromTitle) warnings.push("Failed to extract <title>/og:title");
    if (!jsonLdTitle) warnings.push("JSON-LD title not found or unparsable");
    if (!initialJson) warnings.push("window.__initialData not found or unparsable");

    return {
      ok: false,
      degraded: true,
      url,
      reason: "parse-failed",
      warnings: warnings.length ? warnings : ["Unable to parse title from the page"],
    };
  } catch (e) {
    return {
      ok: false,
      degraded: true,
      url,
      reason: "parse-exception",
      warnings: [
        "Parsing failed due to unexpected structure",
        `Details: ${e && e.message ? e.message : "unknown"}`,
      ],
    };
  }
}

// Final Ad result cache helpers (by normalized URL)
function getCachedAdResult(url) {
  const normalized = normalizeUrl(url);
  const cached = adResultCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) adResultCache.delete(normalized);
  return null;
}

function setCachedAdResult(url, adDoc) {
  const normalized = normalizeUrl(url);
  adResultCache.set(normalized, { data: adDoc, expiresAt: Date.now() + CACHE_TTL_MS });
}

module.exports = {
  normalizeUrl,
  fetchHtmlWithRetries,
  parseAvito,
  getCachedAdResult,
  setCachedAdResult,
};
