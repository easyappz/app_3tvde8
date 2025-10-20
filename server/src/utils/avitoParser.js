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
  return parsed.toString();
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
 * @param {{ retries?: number, baseDelayMs?: number }} options
 * @returns {Promise<string>} HTML string
 */
async function fetchHtmlWithRetries(url, { retries = 3, baseDelayMs = 500 } = {}) {
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
      };

      const response = await axios.get(url, {
        timeout: 12000,
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
    html = await fetchHtmlWithRetries(url, { retries: 3, baseDelayMs: 500 });
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

    let title =
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='og:title']").attr("content") ||
      $("title").first().text();

    if (title) title = title.trim();
    if (!title) {
      return {
        ok: false,
        degraded: true,
        url,
        reason: "parse-failed",
        warnings: ["Unable to parse title from the page"],
      };
    }

    let image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='og:image']").attr("content") ||
      null;

    if (!image) {
      let found = null;
      $("img").each((_, img) => {
        if (found) return;
        const cand = $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-original");
        const resolved = resolveImageUrl(url, cand);
        if (resolved) found = resolved;
      });
      image = found;
    } else {
      image = resolveImageUrl(url, image);
    }

    const result = { title, image: image || null, url };
    // Save to cache
    parseCache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return { ok: true, ...result };
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
