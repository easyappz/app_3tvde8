"use strict";

const mongoose = require("mongoose");
const { Types } = mongoose;
const Ad = require("@src/models/Ad");
const { parseAvito, normalizeUrl, getCachedAdResult, setCachedAdResult } = require("@src/utils/avitoParser");

// In-memory storage (24h TTL) for resilient operation when DB is down
const MEM_TTL_MS = 24 * 60 * 60 * 1000;
const memById = new Map(); // id -> ad
const memByUrl = new Map(); // url -> ad

function nowMs() {
  return Date.now();
}

function pruneMemory() {
  const now = nowMs();
  for (const [id, obj] of memById) {
    if (obj && obj._expiresAt && obj._expiresAt <= now) {
      memById.delete(id);
      if (obj.url) memByUrl.delete(obj.url);
    }
  }
}

function clonePublic(obj) {
  if (!obj) return null;
  const { _expiresAt, ...rest } = obj;
  return { ...rest };
}

function memFindByUrl(url) {
  pruneMemory();
  const obj = memByUrl.get(url);
  return obj || null;
}

function memFindById(id) {
  pruneMemory();
  const obj = memById.get(id);
  return obj || null;
}

function memCreate({ url, title, image }) {
  pruneMemory();
  const id = new Types.ObjectId().toString();
  const obj = {
    _id: id,
    url,
    title,
    image: image || "",
    views: 0,
    createdAt: new Date(),
    _expiresAt: nowMs() + MEM_TTL_MS,
  };
  memById.set(id, obj);
  memByUrl.set(url, obj);
  return clonePublic(obj);
}

function memIncViews(id) {
  const obj = memFindById(id);
  if (!obj) return null;
  obj.views = (obj.views || 0) + 1;
  obj._expiresAt = nowMs() + MEM_TTL_MS;
  return clonePublic(obj);
}

function memUpdate(id, updates) {
  const obj = memFindById(id);
  if (!obj) return null;
  if (updates && typeof updates === "object") {
    if (typeof updates.title === "string" && updates.title.trim()) obj.title = updates.title.trim();
    if (typeof updates.image === "string") obj.image = updates.image;
  }
  obj._expiresAt = nowMs() + MEM_TTL_MS;
  return clonePublic(obj);
}

function memList(limit, offset) {
  pruneMemory();
  const arr = Array.from(memById.values());
  arr.sort((a, b) => {
    if ((b.views || 0) !== (a.views || 0)) return (b.views || 0) - (a.views || 0);
    const ba = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const aa = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    return ba - aa;
  });
  const total = arr.length;
  const slice = arr.slice(offset, offset + limit).map(clonePublic);
  return { total, data: slice };
}

function isDatabaseUp() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * POST /api/ads/resolve
 * Body: { url: string }
 * Always strives to return 200 with an Ad object for valid Avito URL.
 * Falls back to in-memory object when DB is unavailable or Avito is rate-limiting.
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

    const dbUp = isDatabaseUp();

    // 1) Check in-memory first
    const memExisting = memFindByUrl(normalized);
    if (memExisting) {
      try { setCachedAdResult(normalized, memExisting); } catch (_) {}
      return res.status(200).json({ success: true, created: false, ad: memExisting });
    }

    // 2) Check DB if available
    if (dbUp) {
      try {
        const existing = await Ad.findOne({ url: normalized });
        if (existing) {
          try { setCachedAdResult(normalized, existing.toObject()); } catch (_) {}
          return res.status(200).json({ success: true, created: false, ad: existing });
        }
      } catch (dbErr) {
        // DB issue: fall through to memory path
      }
    }

    // 3) Check final ad cache (from parser utils)
    const cachedAd = getCachedAdResult(normalized);
    if (cachedAd) {
      // Put into memory for future when DB is down
      const memAd = memCreate({ url: cachedAd.url, title: cachedAd.title, image: cachedAd.image || "" });
      return res.status(200).json({ success: true, created: true, ad: memAd });
    }

    // 4) Parse Avito (robust, returns degraded on fetch/parse issues)
    const parsed = await parseAvito(normalized);

    if (parsed && parsed.ok) {
      const createPayload = {
        url: normalized,
        title: parsed.title,
        image: parsed.image || "",
        views: 0,
      };

      // Prefer DB when up; otherwise create in-memory
      if (dbUp) {
        try {
          const ad = await Ad.create(createPayload);
          try { setCachedAdResult(normalized, ad.toObject()); } catch (_) {}
          return res.status(200).json({ success: true, created: true, ad });
        } catch (e) {
          if (e && e.code === 11000) {
            try {
              const doc = await Ad.findOne({ url: normalized });
              if (doc) {
                try { setCachedAdResult(normalized, doc.toObject()); } catch (_) {}
                return res.status(200).json({ success: true, created: false, ad: doc });
              }
            } catch (inner) {
              // fall back to memory
            }
          }
          // DB unavailable or failed — create in-memory
          const memAd = memCreate(createPayload);
          try { setCachedAdResult(normalized, memAd); } catch (_) {}
          return res.status(200).json({ success: true, created: true, ad: memAd });
        }
      } else {
        const memAd = memCreate(createPayload);
        try { setCachedAdResult(normalized, memAd); } catch (_) {}
        return res.status(200).json({ success: true, created: true, ad: memAd });
      }
    }

    if (parsed && parsed.degraded) {
      const createPayload = {
        url: normalized,
        title: "Объявление Avito",
        image: "",
        views: 0,
      };

      if (dbUp) {
        try {
          const ad = await Ad.create(createPayload);
          try { setCachedAdResult(normalized, ad.toObject()); } catch (_) {}
          return res.status(200).json({ success: true, created: true, ad, degraded: true, warnings: parsed.warnings || [] });
        } catch (e) {
          if (e && e.code === 11000) {
            try {
              const doc = await Ad.findOne({ url: normalized });
              if (doc) {
                try { setCachedAdResult(normalized, doc.toObject()); } catch (_) {}
                return res.status(200).json({ success: true, created: false, ad: doc, degraded: true, warnings: parsed.warnings || [] });
              }
            } catch (inner) {
              // fall back to memory
            }
          }
          const memAd = memCreate(createPayload);
          try { setCachedAdResult(normalized, memAd); } catch (_) {}
          return res.status(200).json({ success: true, created: true, ad: memAd, degraded: true, warnings: parsed.warnings || [] });
        }
      } else {
        const memAd = memCreate(createPayload);
        try { setCachedAdResult(normalized, memAd); } catch (_) {}
        return res.status(200).json({ success: true, created: true, ad: memAd, degraded: true, warnings: parsed.warnings || [] });
      }
    }

    // Unknown parser result shape — create minimal placeholder in-memory to avoid 5xx
    const fallback = memCreate({ url: normalized, title: "Объявление Avito", image: "" });
    return res.status(200).json({ success: true, created: true, ad: fallback, degraded: true, warnings: ["Parsing failed"] });
  } catch (err) {
    // Only unexpected exceptions end up here
    return res.status(500).json({ success: false, error: `Resolve error: ${err.message}` });
  }
}

/**
 * GET /api/ads?limit=&offset=
 * Returns list of ads sorted by views desc (DB when available; memory otherwise)
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

    const dbUp = isDatabaseUp();

    if (dbUp) {
      try {
        const [total, ads] = await Promise.all([
          Ad.countDocuments({}),
          Ad.find({}).sort({ views: -1, createdAt: -1 }).skip(offset).limit(limit),
        ]);
        return res.status(200).json({ success: true, data: ads, pagination: { total, limit, offset } });
      } catch (dbErr) {
        // Fallback to memory
      }
    }

    const m = memList(limit, offset);
    return res.status(200).json({ success: true, data: m.data, pagination: { total: m.total, limit, offset } });
  } catch (err) {
    return res.status(500).json({ success: false, error: `List error: ${err.message}` });
  }
}

/**
 * GET /api/ads/:id
 * Increments views and returns updated document (DB when available; memory otherwise)
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid ad id" });
    }

    const dbUp = isDatabaseUp();

    if (dbUp) {
      try {
        const ad = await Ad.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
        if (ad) {
          return res.status(200).json({ success: true, ad });
        }
      } catch (dbErr) {
        // Fallback to memory
      }
    }

    const memAd = memIncViews(id);
    if (!memAd) {
      return res.status(404).json({ success: false, error: "Ad not found" });
    }
    return res.status(200).json({ success: true, ad: memAd });
  } catch (err) {
    return res.status(500).json({ success: false, error: `GetById error: ${err.message}` });
  }
}

/**
 * POST /api/ads/:id/refresh
 * Refresh ad title/image from source URL using robust parser. Works with memory store when DB is down.
 */
async function refreshById(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: "Invalid ad id" });
    }

    const dbUp = isDatabaseUp();

    // Find ad either in DB or memory
    let adDoc = null;
    let isMemory = false;

    if (dbUp) {
      try {
        adDoc = await Ad.findById(id);
      } catch (dbErr) {
        // ignore, fallback to memory
      }
    }

    if (!adDoc) {
      const memObj = memFindById(id);
      if (!memObj) {
        return res.status(404).json({ success: false, error: "Ad not found" });
      }
      adDoc = memObj; // plain object
      isMemory = true;
    }

    let parsed;
    try {
      parsed = await parseAvito(adDoc.url);
    } catch (e) {
      // parseAvito should not throw for fetch/parse; but just in case
      return res.status(200).json({ success: true, refreshed: false, degraded: true, warnings: [e.message || "Parse failed"], ad: isMemory ? clonePublic(adDoc) : adDoc });
    }

    if (parsed && parsed.ok) {
      const updates = {};
      if (parsed.title && parsed.title !== adDoc.title) updates.title = parsed.title;
      if (parsed.image && parsed.image !== adDoc.image) updates.image = parsed.image;

      if (Object.keys(updates).length === 0) {
        return res.status(200).json({ success: true, refreshed: false, ad: isMemory ? clonePublic(adDoc) : adDoc });
      }

      if (isMemory) {
        const updated = memUpdate(id, updates);
        return res.status(200).json({ success: true, refreshed: true, ad: updated });
      } else {
        try {
          const updated = await Ad.findByIdAndUpdate(id, { $set: updates }, { new: true });
          return res.status(200).json({ success: true, refreshed: true, ad: updated || adDoc });
        } catch (e) {
          // On DB update failure, don't worsen data; return current ad
          return res.status(200).json({ success: true, refreshed: false, warnings: [e.message], ad: adDoc });
        }
      }
    }

    if (parsed && parsed.degraded) {
      return res.status(200).json({ success: true, refreshed: false, degraded: true, warnings: parsed.warnings || [], ad: isMemory ? clonePublic(adDoc) : adDoc });
    }

    return res.status(200).json({ success: true, refreshed: false, degraded: true, warnings: ["Unknown refresh result"], ad: isMemory ? clonePublic(adDoc) : adDoc });
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
