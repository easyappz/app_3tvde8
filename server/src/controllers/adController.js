"use strict";

const mongoose = require("mongoose");
const Ad = require("@src/models/Ad");
const { parseAvito, normalizeUrl, getCachedAdResult, setCachedAdResult } = require("@src/utils/avitoParser");

/**
 * POST /api/ads/resolve
 * Body: { url: string }
 * If Ad with url exists -> return it. Otherwise parse and create with views=0.
 * Implements resilient parsing with retries, caching and graceful degradation.
 */
async function resolveOrCreate(req, res) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    let normalized;
    try {
      normalized = normalizeUrl(url.trim());
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }

    // Try to find existing in DB first
    const existing = await Ad.findOne({ url: normalized });
    if (existing) {
      // Put into in-memory ad cache for faster subsequent requests
      try { setCachedAdResult(normalized, existing.toObject()); } catch (_) {}
      return res.status(200).json({ success: true, created: false, ad: existing });
    }

    // Try in-memory final ad cache (if any)
    const cachedAd = getCachedAdResult(normalized);
    if (cachedAd) {
      return res.status(200).json({ success: true, created: false, ad: cachedAd });
    }

    // Parse from Avito with retries and cache
    let parsedOrDegraded;
    try {
      parsedOrDegraded = await parseAvito(normalized);
    } catch (e) {
      // Non-degradation, non-retryable parsing setup errors
      return res.status(422).json({ success: false, error: e.message });
    }

    // If parsing was successful -> create a normal ad
    if (parsedOrDegraded && parsedOrDegraded.ok) {
      try {
        const ad = await Ad.create({
          url: normalized,
          title: parsedOrDegraded.title,
          image: parsedOrDegraded.image || "",
          views: 0,
        });
        try { setCachedAdResult(normalized, ad.toObject()); } catch (_) {}
        return res.status(200).json({ success: true, created: true, ad });
      } catch (e) {
        // Handle possible race condition on unique url
        if (e && e.code === 11000) {
          const doc = await Ad.findOne({ url: normalized });
          if (doc) {
            try { setCachedAdResult(normalized, doc.toObject()); } catch (_) {}
            return res.status(200).json({ success: true, created: false, ad: doc });
          }
        }
        return res.status(500).json({ success: false, error: `Failed to create ad: ${e.message}` });
      }
    }

    // Graceful degradation: create placeholder ad if fetch/parse failed due to rate limiting/blocks
    if (parsedOrDegraded && parsedOrDegraded.degraded) {
      try {
        const ad = await Ad.create({
          url: normalized,
          title: "Объявление Avito",
          image: "",
          views: 0,
        });
        try { setCachedAdResult(normalized, ad.toObject()); } catch (_) {}
        return res.status(200).json({
          success: true,
          created: true,
          ad,
          degraded: true,
          warnings: parsedOrDegraded.warnings || ["Avito rate-limited or blocked"],
        });
      } catch (e) {
        if (e && e.code === 11000) {
          const doc = await Ad.findOne({ url: normalized });
          if (doc) {
            try { setCachedAdResult(normalized, doc.toObject()); } catch (_) {}
            return res.status(200).json({ success: true, created: false, ad: doc, degraded: true, warnings: parsedOrDegraded.warnings || [] });
          }
        }
        return res.status(500).json({ success: false, error: `Failed to create degraded ad: ${e.message}` });
      }
    }

    // Fallback: unknown parsing result shape
    return res.status(422).json({ success: false, error: "Parsing failed" });
  } catch (err) {
    return res.status(500).json({ success: false, error: `Resolve error: ${err.message}` });
  }
}

/**
 * GET /api/ads?limit=&offset=
 * Returns list of ads sorted by views desc
 */
async function listTop(req, res) {
  try {
    const l = parseInt(req.query.limit, 10);
    const o = parseInt(req.query.offset, 10);
    let limit = Number.isFinite(l) ? l : 20;
    let offset = Number.isFinite(o) ? o : 0;

    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;
    if (offset < 0) offset = 0;

    const [total, ads] = await Promise.all([
      Ad.countDocuments({}),
      Ad.find({})
        .sort({ views: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit),
    ]);

    return res.status(200).json({ success: true, data: ads, pagination: { total, limit, offset } });
  } catch (err) {
    return res.status(500).json({ success: false, error: `List error: ${err.message}` });
  }
}

/**
 * GET /api/ads/:id
 * Increments views and returns updated document
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid ad id" });
    }

    const ad = await Ad.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
    if (!ad) {
      return res.status(404).json({ success: false, error: "Ad not found" });
    }

    return res.status(200).json({ success: true, ad });
  } catch (err) {
    return res.status(500).json({ success: false, error: `GetById error: ${err.message}` });
  }
}

/**
 * POST /api/ads/:id/refresh
 * Refresh ad title/image from source URL using robust parser. Does not worsen stored data.
 */
async function refreshById(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid ad id" });
    }

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, error: "Ad not found" });
    }

    let parsed;
    try {
      parsed = await parseAvito(ad.url);
    } catch (e) {
      return res.status(500).json({ success: false, error: `Refresh parse error: ${e.message}` });
    }

    if (parsed && parsed.ok) {
      const updates = {};
      if (parsed.title && parsed.title !== ad.title) updates.title = parsed.title;
      if (parsed.image && parsed.image !== ad.image) updates.image = parsed.image; // only update if parser found image

      let updated = ad;
      if (Object.keys(updates).length > 0) {
        try {
          updated = await Ad.findByIdAndUpdate(id, { $set: updates }, { new: true });
        } catch (e) {
          return res.status(500).json({ success: false, error: `Failed to update ad: ${e.message}` });
        }
      }
      return res.status(200).json({ success: true, refreshed: true, ad: updated });
    }

    if (parsed && parsed.degraded) {
      // Do not change current data in degraded mode
      return res.status(200).json({ success: true, refreshed: false, degraded: true, warnings: parsed.warnings || [], ad });
    }

    return res.status(500).json({ success: false, error: "Unknown refresh result" });
  } catch (err) {
    return res.status(500).json({ success: false, error: `Refresh error: ${err.message}` });
  }
}

module.exports = {
  resolveOrCreate,
  listTop,
  getById,
  refreshById,
};
