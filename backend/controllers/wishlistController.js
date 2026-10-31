const Wishlist = require("../models/Wishlist");
const Work = require("../models/Work");

// ============================================================
// GET USER WISHLIST
// ============================================================

const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.find({
      user: req.user.userId,
    })
      .populate("work")
      .sort({ createdAt: -1 });

    res.status(200).json({
      wishlist,
    });

  } catch (error) {
    console.error("Get wishlist error:", error);

    res.status(500).json({
      message: "Failed to load wishlist.",
    });
  }
};


// ============================================================
// ADD WORK TO WISHLIST
// ============================================================

const addToWishlist = async (req, res) => {
  try {
    const { workId } = req.body;

    if (!workId) {
      return res.status(400).json({
        message: "Work ID is required.",
      });
    }

    // Check whether work exists
    const work = await Work.findById(workId);

    if (!work) {
      return res.status(404).json({
        message: "Work not found.",
      });
    }

    // Check if already saved
    const existingWishlist = await Wishlist.findOne({
      user: req.user.userId,
      work: workId,
    });

    if (existingWishlist) {
      return res.status(400).json({
        message: "Work is already in your wishlist.",
      });
    }

    // Create wishlist entry
    const wishlistItem = await Wishlist.create({
      user: req.user.userId,
      work: workId,
    });

    // Return populated work
    await wishlistItem.populate("work");

    res.status(201).json({
      message: "Work added to wishlist.",
      wishlistItem,
    });

  } catch (error) {
    console.error("Add wishlist error:", error);

    res.status(500).json({
      message: "Failed to add work to wishlist.",
    });
  }
};


// ============================================================
// REMOVE WORK FROM WISHLIST
// ============================================================

const removeFromWishlist = async (req, res) => {
  try {
    const { workId } = req.params;

    const deletedItem = await Wishlist.findOneAndDelete({
      user: req.user.userId,
      work: workId,
    });

    if (!deletedItem) {
      return res.status(404).json({
        message: "Work is not in your wishlist.",
      });
    }

    res.status(200).json({
      message: "Work removed from wishlist.",
    });

  } catch (error) {
    console.error("Remove wishlist error:", error);

    res.status(500).json({
      message: "Failed to remove work from wishlist.",
    });
  }
};


module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};