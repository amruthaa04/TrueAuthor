
const fs = require("fs");
const crypto = require("crypto");
const Purchase = require("../models/Purchase");
const Work = require("../models/Work");
const User = require("../models/User");
const Notification = require("../models/Notification");

const {
  calculateSimilarity,
} = require("../services/similarityService");

const {
  uploadToIPFS,
} = require("../services/ipfsService");

const {
  registerWorkOnBlockchain,
  verifyWorkOnBlockchain,
  CONTRACT_ADDRESS,
} = require("../services/blockchainService");

// ============================================================
// SIMILARITY POLICY
// ============================================================

// Any calculated score at or above this value is blocked.
// Keep AI_VIDEO_SIMILARITY_THRESHOLD=30 in backend/.env as well.
const SIMILARITY_BLOCK_THRESHOLD = 30;

const isSimilarityBlocked = (result) => {
  const score = Number(result?.similarityScore || 0);

  return (
    result?.isSimilar === true ||
    score >= SIMILARITY_BLOCK_THRESHOLD
  );
};

// ============================================================
// TEMPORARY PENDING WORKS
// ============================================================

const pendingWorks = new Map();

// ============================================================
// GENERATE REGISTRATION ID
// ============================================================

const generateRegistrationId = async () => {
  let registrationId;
  let exists = true;

  while (exists) {
    const randomPart = Math.floor(
      100000 + Math.random() * 900000
    );

    registrationId =
      `TA-${new Date().getFullYear()}-${randomPart}`;

    exists = await Work.findOne({ registrationId });
  }

  return registrationId;
};

// ============================================================
// SHARED UPLOAD CHECKS
// ============================================================

const calculateUploadSimilarity = async (file) => {
  const fileBuffer = fs.readFileSync(file.path);

  const fileHash = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  const exactMatch = await Work.findOne({ fileHash });

  if (exactMatch) {
    return {
      fileHash,
      result: {
        similarityScore: 100,
        isSimilar: true,
        existingWork: exactMatch,
      },
    };
  }

  const result = await calculateSimilarity(
    file.path,
    fileHash,
    file.mimetype
  );

  return {
    fileHash,
    result: {
      ...result,
      similarityScore: Number(result?.similarityScore || 0),
    },
  };
};

const notifySimilarityBlock = async (
  ownerEmail,
  similarityResult
) => {
  const existingWork = similarityResult.existingWork;
  const score = Number(similarityResult.similarityScore || 0);

  if (existingWork) {
    await Notification.create({
      recipientEmail: existingWork.ownerEmail,
      message:
        `Your work "${existingWork.title}" has been detected as similar to a new upload.`,
      type: "SIMILARITY_WARNING",
      similarityScore: score,
      workId: existingWork._id,
    });
  }

  await Notification.create({
    recipientEmail: ownerEmail,
    message:
      "Upload blocked because its similarity score reached the blocking threshold.",
    type: "UPLOAD_BLOCKED",
    similarityScore: score,
    workId: existingWork ? existingWork._id : null,
  });
};

const sendSimilarityBlock = async (
  res,
  similarityResult
) => {
  const score = Number(similarityResult.similarityScore || 0);
  const existingWork = similarityResult.existingWork;

  return res.status(409).json({
    message:
      score >= 100
        ? "This work is already registered."
        : `Upload blocked. Similarity score ${score}% meets or exceeds the ${SIMILARITY_BLOCK_THRESHOLD}% blocking threshold.`,
    similarityScore: score,
    threshold: SIMILARITY_BLOCK_THRESHOLD,
    existingWork: existingWork
      ? {
          title: existingWork.title,
          ownerEmail: existingWork.ownerEmail,
          registrationId: existingWork.registrationId,
        }
      : null,
  });
};

// ============================================================
// REGISTER WORK
// ============================================================

const registerWork = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a file",
      });
    }

    const file = req.file;
    const { title, ownerEmail } = req.body;

    if (!ownerEmail) {
      return res.status(400).json({
        message: "Owner email is required",
      });
    }

    const normalizedEmail = ownerEmail.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    const { fileHash, result } =
      await calculateUploadSimilarity(file);

    console.log("Upload similarity result:", {
      fileName: file.originalname,
      score: result.similarityScore,
      threshold: SIMILARITY_BLOCK_THRESHOLD,
      isSimilar: result.isSimilar,
      existingWork: result.existingWork?.title || null,
    });

    // Block before IPFS, blockchain, or database registration.
    if (isSimilarityBlocked(result)) {
      await notifySimilarityBlock(normalizedEmail, result);
      return sendSimilarityBlock(res, result);
    }

    console.log("Uploading accepted work to IPFS...");

    const ipfsCid = await uploadToIPFS(
      file.path,
      file.originalname
    );

    console.log("IPFS CID:", ipfsCid);
    console.log("Registering work on blockchain...");

    const blockchainWorkHash = `0x${fileHash}`;

    const blockchainResult = await registerWorkOnBlockchain(
      blockchainWorkHash,
      ipfsCid
    );

    const registrationId = await generateRegistrationId();

    const newWork = await Work.create({
      registrationId,
      title: title || file.originalname,
      fileName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      fileHash,
      ipfsCid,
      blockchainTxHash: blockchainResult.transactionHash,
      blockchainNetwork: "Hardhat Local",
      contractAddress: CONTRACT_ADDRESS,
      blockchainOwner: blockchainResult.owner,
      blockchainRegistered: true,
      ownerEmail: normalizedEmail,
      status: "Registered",
    });

    return res.status(201).json({
      message: "Work registered successfully",
      similarityScore: result.similarityScore,
      work: {
        id: newWork._id,
        registrationId: newWork.registrationId,
        title: newWork.title,
        fileName: newWork.fileName,
        fileType: newWork.fileType,
        fileSize: newWork.fileSize,
        fileHash: newWork.fileHash,
        ipfsCid: newWork.ipfsCid,
        blockchainTxHash: newWork.blockchainTxHash,
        blockchainNetwork: newWork.blockchainNetwork,
        contractAddress: newWork.contractAddress,
        blockchainOwner: newWork.blockchainOwner,
        blockchainRegistered: newWork.blockchainRegistered,
        ownerEmail: newWork.ownerEmail,
        username: user.username,
        status: newWork.status,
      },
    });
  } catch (error) {
    console.error("Work registration error:", error);

    return res.status(500).json({
      message: "Failed to register work",
      error: error.message,
    });
  }
};

// ============================================================
// PREPARE WORK FOR METAMASK REGISTRATION
// ============================================================

const prepareWork = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a file",
      });
    }

    const file = req.file;
    const { title, ownerEmail } = req.body;

    if (!ownerEmail) {
      return res.status(400).json({
        message: "Owner email is required",
      });
    }

    const normalizedEmail = ownerEmail.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    const { fileHash, result } =
      await calculateUploadSimilarity(file);

    console.log("MetaMask preparation similarity result:", {
      fileName: file.originalname,
      score: result.similarityScore,
      threshold: SIMILARITY_BLOCK_THRESHOLD,
      isSimilar: result.isSimilar,
      existingWork: result.existingWork?.title || null,
    });

    // Do not upload to IPFS or create a pending transaction if blocked.
    if (isSimilarityBlocked(result)) {
      await notifySimilarityBlock(normalizedEmail, result);
      return sendSimilarityBlock(res, result);
    }

    console.log("Uploading accepted work to IPFS...");

    const ipfsCid = await uploadToIPFS(
      file.path,
      file.originalname
    );

    const prepareId = crypto.randomUUID();

    pendingWorks.set(prepareId, {
      filePath: file.path,
      fileHash,
      ipfsCid,
      title: title || file.originalname,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      ownerEmail: normalizedEmail,
      username: user.username,
      similarityScore: result.similarityScore,
      existingWork: result.existingWork || null,
      createdAt: Date.now(),
    });

    return res.status(200).json({
      message: "Work prepared successfully.",
      prepareId,
      fileHash,
      ipfsCid,
      title: title || file.originalname,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      ownerEmail: normalizedEmail,
      username: user.username,
      similarityScore: result.similarityScore,
      threshold: SIMILARITY_BLOCK_THRESHOLD,
    });
  } catch (error) {
    console.error("Prepare work error:", error);

    return res.status(500).json({
      message: "Failed to prepare work",
      error: error.message,
    });
  }
};

// ============================================================
// FINALIZE WORK AFTER METAMASK TRANSACTION
// ============================================================

const finalizeWork = async (req, res) => {
  try {
    const {
      prepareId,
      transactionHash,
      walletAddress,
    } = req.body;

    if (!prepareId || !transactionHash || !walletAddress) {
      return res.status(400).json({
        message:
          "Preparation ID, blockchain transaction hash and wallet address are required.",
      });
    }

    const pendingWork = pendingWorks.get(prepareId);

    if (!pendingWork) {
      return res.status(404).json({
        message: "Prepared work not found or has expired.",
      });
    }

    // Pending preparations should not be usable indefinitely.
    const maxAgeMs = 30 * 60 * 1000;

    if (Date.now() - pendingWork.createdAt > maxAgeMs) {
      pendingWorks.delete(prepareId);

      return res.status(410).json({
        message: "Prepared work has expired. Please upload it again.",
      });
    }

    // Prevent duplicate finalization of the same content.
    const existingWork = await Work.findOne({
      fileHash: pendingWork.fileHash,
    });

    if (existingWork) {
      pendingWorks.delete(prepareId);

      return res.status(409).json({
        message: "This work is already registered.",
        similarityScore: 100,
        existingWork: {
          title: existingWork.title,
          ownerEmail: existingWork.ownerEmail,
        },
      });
    }

    console.log("Verifying MetaMask blockchain registration...");

    const blockchainWorkHash = `0x${pendingWork.fileHash}`;

    const blockchainResult = await verifyWorkOnBlockchain(
      blockchainWorkHash
    );

    if (!blockchainResult.exists) {
      return res.status(400).json({
        message: "Blockchain registration was not found.",
      });
    }

    if (
      !blockchainResult.owner ||
      blockchainResult.owner.toLowerCase() !==
        walletAddress.toLowerCase()
    ) {
      return res.status(403).json({
        message:
          "Connected wallet does not match the blockchain owner.",
      });
    }

    const registrationId = await generateRegistrationId();

    const newWork = await Work.create({
      registrationId,
      title: pendingWork.title,
      fileName: pendingWork.fileName,
      filePath: pendingWork.filePath,
      fileType: pendingWork.fileType,
      fileSize: pendingWork.fileSize,
      fileHash: pendingWork.fileHash,
      ipfsCid: pendingWork.ipfsCid,
      blockchainTxHash: transactionHash,
      blockchainNetwork: "Hardhat Local",
      contractAddress: CONTRACT_ADDRESS,
      blockchainOwner: blockchainResult.owner,
      blockchainRegistered: true,
      ownerEmail: pendingWork.ownerEmail,
      status: "Registered",
    });

    if (pendingWork.similarityScore > 0 && pendingWork.existingWork) {
      await Notification.create({
        recipientEmail: pendingWork.existingWork.ownerEmail,
        message:
          `Your work "${pendingWork.existingWork.title}" has been detected as similar to a newly registered work.`,
        type: "SIMILARITY_WARNING",
        similarityScore: pendingWork.similarityScore,
        workId: newWork._id,
      });
    }

    pendingWorks.delete(prepareId);

    return res.status(201).json({
      message: "Work registered successfully",
      similarityScore: pendingWork.similarityScore,
      work: {
        id: newWork._id,
        registrationId: newWork.registrationId,
        title: newWork.title,
        fileName: newWork.fileName,
        fileType: newWork.fileType,
        fileSize: newWork.fileSize,
        fileHash: newWork.fileHash,
        ipfsCid: newWork.ipfsCid,
        blockchainTxHash: newWork.blockchainTxHash,
        blockchainNetwork: newWork.blockchainNetwork,
        contractAddress: newWork.contractAddress,
        blockchainOwner: newWork.blockchainOwner,
        blockchainRegistered: newWork.blockchainRegistered,
        ownerEmail: newWork.ownerEmail,
        username: pendingWork.username,
        status: newWork.status,
      },
    });
  } catch (error) {
    console.error("Finalize work error:", error);

    return res.status(500).json({
      message: "Failed to finalize work",
      error: error.message,
    });
  }
};

// ============================================================
// GET USER WORKS
// ============================================================

const getUserWorks = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const works = await Work.find({
      ownerEmail: email.trim().toLowerCase(),
    }).sort({ createdAt: -1 });

    return res.status(200).json({ works });
  } catch (error) {
    console.error("Get user works error:", error);

    return res.status(500).json({
      message: "Failed to fetch works",
      error: error.message,
    });
  }
};

// ============================================================
// VERIFY WORK
// ============================================================

const verifyWork = async (req, res) => {
  try {
    const { hash, registrationId, username } = req.query;

    if (registrationId) {
      const work = await Work.findOne({
        registrationId: registrationId.trim(),
      });

      if (!work) {
        return res.status(404).json({
          message:
            "No registered work found for this Registration ID.",
        });
      }

      return await sendVerifiedWork(work, res);
    }

    if (username) {
      const cleanUsername = username.trim().toLowerCase();

      const user = await User.findOne({
        username: cleanUsername,
      });

      if (!user) {
        return res.status(404).json({
          message: "No user found with this username.",
        });
      }

      const works = await Work.find({
        ownerEmail: user.email,
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        message: "Creator works found",
        creator: {
          username: user.username,
          fullName: user.fullName,
        },
        works,
      });
    }

    if (hash) {
      const cleanHash = hash.trim().toLowerCase();

      if (!/^[a-f0-9]{64}$/.test(cleanHash)) {
        return res.status(400).json({
          message:
            "Invalid SHA-256 hash. Please enter a valid 64-character hexadecimal hash.",
        });
      }

      const work = await Work.findOne({
        fileHash: cleanHash,
      });

      if (!work) {
        return res.status(404).json({
          message:
            "No registered work found for this SHA-256 hash.",
        });
      }

      return await sendVerifiedWork(work, res);
    }

    return res.status(400).json({
      message:
        "Please provide a username, Registration ID, or SHA-256 hash.",
    });
  } catch (error) {
    console.error("Work verification error:", error);

    return res.status(500).json({
      message: "Failed to verify work",
      error: error.message,
    });
  }
};

// ============================================================
// SEND VERIFIED WORK
// ============================================================

const sendVerifiedWork = async (work, res) => {
  const blockchainWorkHash = `0x${work.fileHash}`;

  console.log("Verifying work on blockchain...");

  const blockchainResult = await verifyWorkOnBlockchain(
    blockchainWorkHash
  );

  const user = await User.findOne({
    email: work.ownerEmail,
  });

  return res.status(200).json({
    message: "Work verified successfully",
    creator: {
      username: user ? user.username : null,
      fullName: user ? user.fullName : null,
    },
    work: {
      id: work._id,
      registrationId: work.registrationId,
      title: work.title,
      fileName: work.fileName,
      fileType: work.fileType,
      fileSize: work.fileSize,
      fileHash: work.fileHash,
      ipfsCid: work.ipfsCid,
      ownerEmail: work.ownerEmail,
      status: work.status,
      blockchainTxHash: work.blockchainTxHash,
      blockchainNetwork: work.blockchainNetwork,
      contractAddress: work.contractAddress,
      blockchainOwner: work.blockchainOwner,
      blockchainRegistered: work.blockchainRegistered,
      registeredAt: work.createdAt,
    },
    blockchain: {
      exists: blockchainResult.exists,
      ipfsCid: blockchainResult.ipfsCid,
      owner: blockchainResult.owner,
      timestamp: blockchainResult.timestamp,
    },
    blockchainTxHash: work.blockchainTxHash,
    contractAddress: work.contractAddress || CONTRACT_ADDRESS,
  });
};

// ============================================================
// GET MARKETPLACE WORKS
// ============================================================

const getMarketplaceWorks = async (req, res) => {
  try {
    const works = await Work.find({
      blockchainRegistered: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const worksWithAuthors = await Promise.all(
      works.map(async (work) => {
        const user = await User.findOne({
          email: work.ownerEmail,
        }).lean();

        return {
          ...work,
          authorName: user?.fullName || "Unknown Author",
        };
      })
    );

    return res.status(200).json({
      works: worksWithAuthors,
    });
  } catch (error) {
    console.error("Get marketplace works error:", error);

    return res.status(500).json({
      message: "Failed to fetch marketplace works",
      error: error.message,
    });
  }
};

// ============================================================
// ADD COLLABORATOR
// ============================================================

const addCollaborator = async (req, res) => {
  try {
    const {
      workId,
      ownerEmail,
      collaboratorEmail,
      royaltyShare,
    } = req.body;

    if (!workId || !ownerEmail || !collaboratorEmail) {
      return res.status(400).json({
        message:
          "Work ID, owner email and collaborator email are required.",
      });
    }

    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const normalizedCollaboratorEmail =
      collaboratorEmail.trim().toLowerCase();

    if (normalizedOwnerEmail === normalizedCollaboratorEmail) {
      return res.status(400).json({
        message: "You cannot add yourself as a collaborator.",
      });
    }

    const work = await Work.findById(workId);

    if (!work) {
      return res.status(404).json({
        message: "Work not found.",
      });
    }

    if (work.ownerEmail.toLowerCase() !== normalizedOwnerEmail) {
      return res.status(403).json({
        message: "Only the owner of the work can add collaborators.",
      });
    }

    const collaborator = await User.findOne({
      email: normalizedCollaboratorEmail,
    });

    if (!collaborator) {
      return res.status(404).json({
        message:
          "No TrueAuthor account exists for this collaborator email.",
      });
    }

    const share = Number(royaltyShare);

    if (Number.isNaN(share) || share < 0 || share > 100) {
      return res.status(400).json({
        message: "Royalty share must be between 0 and 100.",
      });
    }

    const existingCollaborator = work.collaborators.find(
      (item) =>
        item.email.toLowerCase() === normalizedCollaboratorEmail
    );

    if (existingCollaborator) {
      if (existingCollaborator.status === "accepted") {
        return res.status(409).json({
          message: "This user is already an accepted collaborator.",
        });
      }

      if (existingCollaborator.status === "pending") {
        return res.status(409).json({
          message: "A collaboration invitation is already pending.",
        });
      }

      existingCollaborator.status = "pending";
      existingCollaborator.royaltyShare = share;
      existingCollaborator.invitedAt = new Date();
      existingCollaborator.respondedAt = null;
    } else {
      work.collaborators.push({
        email: normalizedCollaboratorEmail,
        name: collaborator.fullName || collaborator.username || "",
        status: "pending",
        royaltyShare: share,
        invitedAt: new Date(),
        respondedAt: null,
      });
    }

    await work.save();

    await Notification.create({
      recipientEmail: normalizedCollaboratorEmail,
      message:
        `You have been invited to collaborate on "${work.title}". Royalty share: ${share}% of the creator royalty pool.`,
      type: "COLLABORATION_INVITE",
      workId: work._id,
    });

    return res.status(201).json({
      message: "Collaboration invitation sent successfully.",
      collaborator: {
        email: normalizedCollaboratorEmail,
        name: collaborator.fullName || collaborator.username || "",
        status: "pending",
        royaltyShare: share,
      },
    });
  } catch (error) {
    console.error("Add collaborator error:", error);

    return res.status(500).json({
      message: "Failed to add collaborator.",
      error: error.message,
    });
  }
};

// ============================================================
// ACCEPT COLLABORATOR INVITATION
// ============================================================

const acceptCollaborator = async (req, res) => {
  try {
    const { workId, collaboratorEmail } = req.body;

    if (!workId || !collaboratorEmail) {
      return res.status(400).json({
        message: "Work ID and collaborator email are required.",
      });
    }

    const email = collaboratorEmail.trim().toLowerCase();
    const work = await Work.findById(workId);

    if (!work) {
      return res.status(404).json({
        message: "Work not found.",
      });
    }

    const collaborator = work.collaborators.find(
      (item) => item.email.toLowerCase() === email
    );

    if (!collaborator) {
      return res.status(404).json({
        message: "Collaboration invitation not found.",
      });
    }

    if (collaborator.status === "accepted") {
      return res.status(400).json({
        message: "Collaboration invitation is already accepted.",
      });
    }

    collaborator.status = "accepted";
    collaborator.respondedAt = new Date();

    await work.save();

    await Notification.create({
      recipientEmail: work.ownerEmail,
      message:
        `${email} accepted the collaboration invitation for "${work.title}".`,
      type: "COLLABORATION_ACCEPTED",
      workId: work._id,
    });

    return res.status(200).json({
      message: "Collaboration invitation accepted.",
      collaborator: {
        email: collaborator.email,
        status: collaborator.status,
        royaltyShare: collaborator.royaltyShare,
      },
    });
  } catch (error) {
    console.error("Accept collaborator error:", error);

    return res.status(500).json({
      message: "Failed to accept collaboration invitation.",
      error: error.message,
    });
  }
};

// ============================================================
// REJECT COLLABORATOR INVITATION
// ============================================================

const rejectCollaborator = async (req, res) => {
  try {
    const { workId, collaboratorEmail } = req.body;

    if (!workId || !collaboratorEmail) {
      return res.status(400).json({
        message: "Work ID and collaborator email are required.",
      });
    }

    const email = collaboratorEmail.trim().toLowerCase();
    const work = await Work.findById(workId);

    if (!work) {
      return res.status(404).json({
        message: "Work not found.",
      });
    }

    const collaborator = work.collaborators.find(
      (item) => item.email.toLowerCase() === email
    );

    if (!collaborator) {
      return res.status(404).json({
        message: "Collaboration invitation not found.",
      });
    }

    collaborator.status = "rejected";
    collaborator.respondedAt = new Date();

    await work.save();

    await Notification.create({
      recipientEmail: work.ownerEmail,
      message:
        `${email} rejected the collaboration invitation for "${work.title}".`,
      type: "COLLABORATION_REJECTED",
      workId: work._id,
    });

    return res.status(200).json({
      message: "Collaboration invitation rejected.",
      collaborator: {
        email: collaborator.email,
        status: collaborator.status,
        royaltyShare: collaborator.royaltyShare,
      },
    });
  } catch (error) {
    console.error("Reject collaborator error:", error);

    return res.status(500).json({
      message: "Failed to reject collaboration invitation.",
      error: error.message,
    });
  }
};

// ============================================================
// GET COLLABORATION INVITATIONS
// ============================================================

const getCollaboratorInvites = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const works = await Work.find({
      collaborators: {
        $elemMatch: {
          email: normalizedEmail,
          status: "pending",
        },
      },
    })
      .sort({ createdAt: -1 })
      .lean();

    const invitations = await Promise.all(
      works.map(async (work) => {
        const owner = await User.findOne({
          email: work.ownerEmail,
        }).lean();

        const collaborator = work.collaborators.find(
          (item) => item.email.toLowerCase() === normalizedEmail
        );

        return {
          workId: work._id,
          registrationId: work.registrationId,
          title: work.title,
          ownerEmail: work.ownerEmail,
          ownerName: owner?.fullName || owner?.username || "Unknown",
          royaltyShare: collaborator?.royaltyShare || 0,
          status: collaborator?.status || "pending",
          invitedAt: collaborator?.invitedAt || null,
        };
      })
    );

    return res.status(200).json({ invitations });
  } catch (error) {
    console.error("Get collaborator invites error:", error);

    return res.status(500).json({
      message: "Failed to fetch collaboration invitations.",
      error: error.message,
    });
  }
};

// ============================================================
// GET WORK COLLABORATORS
// ============================================================

const getWorkCollaborators = async (req, res) => {
  try {
    const { workId, ownerEmail } = req.query;

    if (!workId || !ownerEmail) {
      return res.status(400).json({
        message: "Work ID and owner email are required.",
      });
    }

    const work = await Work.findById(workId).lean();

    if (!work) {
      return res.status(404).json({
        message: "Work not found.",
      });
    }

    if (
      work.ownerEmail.toLowerCase() !==
      ownerEmail.trim().toLowerCase()
    ) {
      return res.status(403).json({
        message: "Only the work owner can view collaborators.",
      });
    }

    return res.status(200).json({
      collaborators: work.collaborators || [],
    });
  } catch (error) {
    console.error("Get collaborators error:", error);

    return res.status(500).json({
      message: "Failed to fetch collaborators.",
      error: error.message,
    });
  }
};

// ============================================================
// RECORD PURCHASE AND NOTIFY AUTHOR
// ============================================================

const createPurchaseNotification = async (req, res) => {
  try {
    const {
      workHash,
      buyerEmail,
      buyerWallet,
      price,
      duration,
      transactionHash,
    } = req.body;

    if (!workHash || !buyerEmail || !buyerWallet || !transactionHash) {
      return res.status(400).json({
        message: "Missing required purchase information",
      });
    }

    const work = await Work.findOne({
      fileHash: workHash,
    });

    if (!work) {
      return res.status(404).json({
        message: "Work not found",
      });
    }

    const purchase = await Purchase.create({
      workId: work._id,
      buyerEmail: buyerEmail.trim().toLowerCase(),
      buyerWallet,
      price: price || "0",
      duration: duration || "",
      transactionHash,
    });

    await Notification.create({
      recipientEmail: work.ownerEmail,
      type: "WORK_PURCHASED",
      message: `Your work "${work.title}" has been purchased.`,
      workId: work._id,
      read: false,
    });

    return res.status(201).json({
      message: "Purchase recorded and author notified",
      purchase,
    });
  } catch (error) {
    console.error("Purchase notification error:", error);

    return res.status(500).json({
      message: "Failed to record purchase",
      error: error.message,
    });
  }
};

// ============================================================
// GET PURCHASED WORKS
// ============================================================

const getPurchasedWorks = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const purchases = await Purchase.find({
      buyerEmail: email.trim().toLowerCase(),
    })
      .populate("workId")
      .sort({ purchasedAt: -1 });

    const purchasedWorks = purchases.map((purchase) => ({
      purchaseId: purchase._id,
      title: purchase.workId?.title || "Unknown Work",
      registrationId: purchase.workId?.registrationId || "",
      fileName: purchase.workId?.fileName || "",
      ipfsCid: purchase.workId?.ipfsCid || "",
      ownerEmail: purchase.workId?.ownerEmail || "",
      price: purchase.price,
      duration: purchase.duration,
      buyerWallet: purchase.buyerWallet,
      transactionHash: purchase.transactionHash,
      purchasedAt: purchase.purchasedAt,
    }));

    return res.status(200).json({ purchasedWorks });
  } catch (error) {
    console.error("Get purchased works error:", error);

    return res.status(500).json({
      message: "Failed to fetch purchased works",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  registerWork,
  prepareWork,
  finalizeWork,
  getUserWorks,
  verifyWork,
  getMarketplaceWorks,
  createPurchaseNotification,
  getPurchasedWorks,

  // Collaborator system
  addCollaborator,
  acceptCollaborator,
  rejectCollaborator,
  getCollaboratorInvites,
  getWorkCollaborators,
};
