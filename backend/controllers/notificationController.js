const Notification = require("../models/Notification");

// Get notifications for a user
const getNotifications = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const notifications = await Notification.find({
      recipientEmail: email,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification error:", error);

    res.status(500).json({
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
};