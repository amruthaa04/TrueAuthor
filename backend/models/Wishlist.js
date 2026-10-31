const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent the same user from saving the same work twice
wishlistSchema.index(
  { user: 1, work: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "Wishlist",
  wishlistSchema
);