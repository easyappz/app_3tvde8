"use strict";

const mongoose = require("mongoose");
const Ad = require("@src/models/Ad");
const { parseAvito, normalizeUrl } = require("@src/utils/avitoParser");

/**
 * POST /api/ads/resolve
 * Body: { url: string }
 * If Ad with url exists -> return it. Otherwise parse and create with views=0.
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

    // Try to find existing
    const existing = await Ad.findOne({ url: normalized });
    if (existing) {
      return res.status(200).json({ success: true, created: false, ad: existing });
    }

    // Parse from Avito
    let parsed;
    try {
      parsed = await parseAvito(normalized);
    } catch (e) {
      return res.status(422).json({ success: false, error: e.message });
    }

    try {
      const ad = await Ad.create({
        url: normalized,
        title: parsed.title,
        image: parsed.image || "",
        views: 0,
      });
      return res.status(200).json({ success: true, created: true, ad });
    } catch (e) {
      // Handle possible race condition on unique url
      if (e && e.code === 11000) {
        const doc = await Ad.findOne({ url: normalized });
        if (doc) {
          return res.status(200).json({ success: true, created: false, ad: doc });
        }
      }
      return res.status(500).json({ success: false, error: `Failed to create ad: ${e.message}` });
    }
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

module.exports = {
  resolveOrCreate,
  listTop,
  getById,
};
