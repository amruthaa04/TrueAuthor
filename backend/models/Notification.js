
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "SIMILARITY_WARNING",
        "UPLOAD_BLOCKED",
        "UPLOAD_APPROVED",
        "COLLABORATION_INVITE",
        "COLLABORATION_ACCEPTED",
        "COLLABORATION_REJECTED",
        "WORK_PURCHASED",
      ],
      required: true,
    },

    similarityScore: {
      type: Number,
      default: 0,
    },

    workId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      default: null,
    },

    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
