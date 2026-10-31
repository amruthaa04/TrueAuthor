const express = require("express");

const {
  getNotifications,
  markAsRead,
} = require("../controllers/notificationController");

const router = express.Router();

// Get notifications for a user
router.get("/", getNotifications);

// Mark a notification as read
router.patch("/:id/read", markAsRead);

module.exports = router;