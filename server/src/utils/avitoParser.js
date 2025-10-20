"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");

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
    // Add protocol if missing
    const candidate = /^(https?:)?\/\//i.test(urlString) ? urlString : `https://${urlString}`;
    parsed = new URL(candidate);
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  const host = parsed.hostname.toLowerCase();
  // Allow avito.* domains (e.g., avito.ru, m.avito.ru)
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
 * Fetch HTML of URL using axios.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchHtml(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EasyappzBot/1.0; +https://easyappz.example)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    });
    if (typeof data !== "string") {
      throw new Error("Received non-HTML response");
    }
    return data;
  } catch (err) {
    const msg = err?.message || "Network error";
    throw new Error(`Failed to fetch page: ${msg}`);
  }
}

/**
 * Parse Avito page to extract title and image URL.
 * Priority: og:title, og:image -> fallback to <title> and first suitable <img>.
 * @param {string} inputUrl
 * @returns {Promise<{ title: string, image: string|null, url: string }>}
 */
async function parseAvito(inputUrl) {
  const url = normalizeUrl(inputUrl);
  const html = await fetchHtml(url);

  try {
    const $ = cheerio.load(html);

    // Title extraction
    let title =
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='og:title']").attr("content") ||
      $("title").first().text();

    if (title) title = title.trim();
    if (!title) {
      throw new Error("Unable to parse title from the page");
    }

    // Image extraction
    let image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='og:image']").attr("content") ||
      null;

    if (!image) {
      let found = null;
      $("img").each((_, img) => {
        if (found) return;
        const cand =
          $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-original");
        const resolved = resolveImageUrl(url, cand);
        if (resolved) found = resolved;
      });
      image = found;
    } else {
      image = resolveImageUrl(url, image);
    }

    return { title, image: image || null, url };
  } catch (e) {
    const msg = e?.message || "Parsing error";
    throw new Error(`Failed to parse page: ${msg}`);
  }
}

module.exports = {
  parseAvito,
  normalizeUrl,
};
