const express = require("express");
const multer = require("multer");

const {
  registerWork,
  prepareWork,
  finalizeWork,
  getUserWorks,
  getMarketplaceWorks,
  verifyWork,
  createPurchaseNotification,
  getPurchasedWorks,
  addCollaborator,
  acceptCollaborator,
  rejectCollaborator,
  getCollaboratorInvites,
  getWorkCollaborators,
} = require("../controllers/workController");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
});

// ============================================================
// PURCHASED WORKS
// ============================================================

router.get(
  "/purchased",
  getPurchasedWorks
);

// ============================================================
// PURCHASE NOTIFICATION
// ============================================================

router.post(
  "/purchase-notification",
  createPurchaseNotification
);

// ============================================================
// REGISTER WORK
// ============================================================

router.post(
  "/register",
  upload.single("file"),
  registerWork
);

// ============================================================
// PREPARE WORK
// ============================================================

router.post(
  "/prepare",
  upload.single("file"),
  prepareWork
);

// ============================================================
// FINALIZE WORK
// ============================================================

router.post(
  "/finalize",
  finalizeWork
);

// ============================================================
// MARKETPLACE
// ============================================================

router.get(
  "/marketplace",
  getMarketplaceWorks
);

// ============================================================
// USER WORKS
// ============================================================

router.get(
  "/user",
  getUserWorks
);

// ============================================================
// VERIFY
// ============================================================

router.get(
  "/verify",
  verifyWork
);

// ============================================================
// COLLABORATORS
// ============================================================

router.post(
  "/collaborators/add",
  addCollaborator
);

router.post(
  "/collaborators/accept",
  acceptCollaborator
);

router.post(
  "/collaborators/reject",
  rejectCollaborator
);

router.get(
  "/collaborators/invitations",
  getCollaboratorInvites
);

router.get(
  "/collaborators",
  getWorkCollaborators
);

module.exports = router;