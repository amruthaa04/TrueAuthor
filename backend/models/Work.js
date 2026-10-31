const mongoose = require("mongoose");

// ============================================================
// COLLABORATOR SUB-SCHEMA
// ============================================================

const collaboratorSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    name: {
      type: String,
      default: "",
    },

    // pending / accepted / rejected
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
      ],
      default: "pending",
    },

    // Percentage of the creator royalty pool
    // Example:
    // 20 = collaborator receives 20% of the 5% royalty
    royaltyShare: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    invitedAt: {
      type: Date,
      default: Date.now,
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

// ============================================================
// WORK SCHEMA
// ============================================================

const workSchema = new mongoose.Schema(
  {
    // ========================================================
    // REGISTRATION
    // ========================================================

    registrationId: {
      type: String,
      required: true,
      unique: true,
    },

    title: {
      type: String,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    fileType: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    // SHA-256 hash of original file
    fileHash: {
      type: String,
      required: true,
      unique: true,
    },

    // ========================================================
    // IPFS
    // ========================================================

    ipfsCid: {
      type: String,
      default: null,
    },

    // ========================================================
    // BLOCKCHAIN
    // ========================================================

    blockchainTxHash: {
      type: String,
      default: null,
    },

    blockchainNetwork: {
      type: String,
      default: "Hardhat Local",
    },

    contractAddress: {
      type: String,
      default: null,
    },

    blockchainOwner: {
      type: String,
      default: null,
    },

    blockchainRegistered: {
      type: Boolean,
      default: false,
    },

    // ========================================================
    // OWNER
    // ========================================================

    ownerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // ========================================================
    // COLLABORATORS
    // ========================================================

    collaborators: {
      type: [collaboratorSchema],
      default: [],
    },

    // ========================================================
    // STATUS
    // ========================================================

    status: {
      type: String,
      default: "Registered",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "Work",
    workSchema
  );