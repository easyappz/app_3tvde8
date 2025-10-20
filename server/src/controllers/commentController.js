"use strict";

const mongoose = require("mongoose");
const Ad = require("@src/models/Ad");
const Comment = require("@src/models/Comment");

// POST /api/ads/:id/comments
// Requires verifyAuth middleware
exports.addComment = async (req, res) => {
  try {
    const adId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({ success: false, error: "Invalid ad id" });
    }

    const ad = await Ad.findById(adId).lean();
    if (!ad) {
      return res.status(404).json({ success: false, error: "Ad not found" });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const created = await Comment.create({
      ad: adId,
      user: userId,
      text,
      createdAt: new Date(),
    });

    const populated = await Comment.findById(created._id)
      .populate({ path: "user", select: "email _id" })
      .lean();

    return res.status(201).json({ success: true, comment: populated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to add comment" });
  }
};

// GET /api/ads/:id/comments
// Public
exports.listComments = async (req, res) => {
  try {
    const adId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({ success: false, error: "Invalid ad id" });
    }

    let { limit, offset, sort } = req.query;
    const sortParam = String(sort || "DESC").toUpperCase();
    const sortOrder = sortParam === "ASC" ? 1 : -1;

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    const safeLimit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100);
    const safeOffset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    const [total, items] = await Promise.all([
      Comment.countDocuments({ ad: adId }),
      Comment.find({ ad: adId })
        .sort({ createdAt: sortOrder, _id: sortOrder })
        .skip(safeOffset)
        .limit(safeLimit)
        .populate({ path: "user", select: "email _id" })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        limit: safeLimit,
        offset: safeOffset,
        sort: sortParam,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Failed to list comments" });
  }
};
