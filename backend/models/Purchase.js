const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    workId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      required: true,
    },

    buyerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    buyerWallet: {
      type: String,
      required: true,
    },

    price: {
      type: String,
      default: "0",
    },

    duration: {
      type: String,
      default: "",
    },

    transactionHash: {
      type: String,
      default: "",
    },

    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Purchase",
  purchaseSchema
);