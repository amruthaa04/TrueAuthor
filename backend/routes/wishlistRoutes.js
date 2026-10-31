const express = require("express");

const router = express.Router();

const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlistController");

const protect = require("../middleware/authMiddleware");


// ============================================================
// GET USER WISHLIST
// GET /api/wishlist
// ============================================================

router.get("/", protect, getWishlist);


// ============================================================
// ADD WORK TO WISHLIST
// POST /api/wishlist
// ============================================================

router.post("/", protect, addToWishlist);


// ============================================================
// REMOVE WORK FROM WISHLIST
// DELETE /api/wishlist/:workId
// ============================================================

router.delete("/:workId", protect, removeFromWishlist);


module.exports = router;