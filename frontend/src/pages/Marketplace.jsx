import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";

import { getMetaMaskProvider } from "../blockchain/trueAuthorContract";

// ============================================================
// BLOCKCHAIN CONFIGURATION
// ============================================================

const RPC_URL = "http://127.0.0.1:8545";

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// ============================================================
// PLATFORM PAYMENT RULES
// ============================================================

const PLATFORM_FEE_PERCENT = 5;
const CREATOR_POOL_PERCENT = 95;

const DEFAULT_LICENSE_PRICE = "0.01";
const DEFAULT_LICENSE_DAYS = 30;

// ============================================================
// TRUEAUTHOR CONTRACT ABI
// ============================================================

const LICENSE_ABI = [
  // ==========================================================
  // REGISTER WORK
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
      {
        internalType: "string",
        name: "ipfsCid",
        type: "string",
      },
    ],
    name: "registerWork",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ==========================================================
  // VERIFY WORK
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
    ],
    name: "verifyWork",
    outputs: [
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
      {
        internalType: "string",
        name: "ipfsCid",
        type: "string",
      },
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // GET CREATOR
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
    ],
    name: "getWorkCreator",
    outputs: [
      {
        internalType: "address",
        name: "creator",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // LIST WORK
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "duration",
        type: "uint256",
      },
      {
        internalType: "address[]",
        name: "royaltyAccounts",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "royaltyShares",
        type: "uint256[]",
      },
    ],
    name: "listWork",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ==========================================================
  // CANCEL LICENSE
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
    ],
    name: "cancelLicense",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ==========================================================
  // GET LICENSE OFFER
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
    ],
    name: "getLicenseOffer",
    outputs: [
      {
        internalType: "address",
        name: "seller",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "duration",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalRoyaltyBps",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "active",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // GET ROYALTY SHARES
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
    ],
    name: "getRoyaltyShares",
    outputs: [
      {
        internalType: "address[]",
        name: "accounts",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "shares",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // PURCHASE LICENSE
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
    ],
    name: "purchaseLicense",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },

  // ==========================================================
  // CHECK LICENSE
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "hasValidLicense",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // GET LICENSE
  // ==========================================================

  {
    inputs: [
      {
        internalType: "bytes32",
        name: "workHash",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "getLicense",
    outputs: [
      {
        internalType: "address",
        name: "licensee",
        type: "address",
      },
      {
        internalType: "address",
        name: "licensor",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "pricePaid",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "startTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "expiryTime",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "active",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ============================================================
// MARKETPLACE
// ============================================================

function Marketplace() {
  // ==========================================================
  // WORKS
  // ==========================================================

  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedWork, setSelectedWork] = useState(null);

  // ==========================================================
  // USER
  // ==========================================================

  const [user, setUser] = useState(null);
  const userEmail = user?.email;

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("user");

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (err) {
      console.error(
        "Unable to read logged-in user:",
        err
      );

      setUser(null);
    }
  }, []);

  // ==========================================================
  // BOOKMARKS
  // ==========================================================

  const [savedIds, setSavedIds] = useState([]);

  useEffect(() => {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(
            "trueauthorBookmarks"
          )
        ) || [];

      setSavedIds(saved);
    } catch (err) {
      console.error(
        "Unable to load saved works:",
        err
      );

      setSavedIds([]);
    }
  }, []);

  // ==========================================================
  // BLOCKCHAIN LICENSE
  // ==========================================================

  const [licenseOffer, setLicenseOffer] =
    useState(null);

  const [royaltyAccounts, setRoyaltyAccounts] =
    useState([]);

  const [royaltyShares, setRoyaltyShares] =
    useState([]);

  const [licenseLoading, setLicenseLoading] =
    useState(false);

  const [licenseError, setLicenseError] =
    useState("");

  const [purchasing, setPurchasing] =
    useState(false);

  const [listing, setListing] =
    useState(false);

  // ==========================================================
  // LICENSE FORM
  // ==========================================================

  const [licensePrice, setLicensePrice] =
    useState(DEFAULT_LICENSE_PRICE);

  const [licenseDays, setLicenseDays] =
    useState(DEFAULT_LICENSE_DAYS);

  // ==========================================================
  // WALLET
  // ==========================================================

  const [walletAddress, setWalletAddress] =
    useState("");

  const [purchasedLicenses, setPurchasedLicenses] = useState([]);
  const [loadingPurchasedLicenses, setLoadingPurchasedLicenses] = useState(false);
  const [lastPurchaseReceipt, setLastPurchaseReceipt] = useState(null);

  // ==========================================================
  // CONNECT METAMASK
  // ==========================================================

  const connectMetaMaskForUI = async () => {
    try {
      const provider =
        getMetaMaskProvider();

      const accounts =
        await provider.send(
          "eth_requestAccounts",
          []
        );

      if (
        accounts &&
        accounts.length > 0
      ) {
        setWalletAddress(accounts[0]);

        return accounts[0];
      }

      return "";
    } catch (err) {
      console.error(
        "MetaMask connection failed:",
        err
      );

      throw err;
    }
  };

  // ==========================================================
  // WORK ID
  // ==========================================================

  const getWorkId = (work) => {
    return String(
      work?._id ||
        work?.registrationId ||
        ""
    );
  };

  // ==========================================================
  // BOOKMARK
  // ==========================================================

  const isSaved = (work) => {
    const id = getWorkId(work);

    return savedIds.includes(id);
  };

  const toggleBookmark = (work) => {
    const id = getWorkId(work);

    if (!id) {
      return;
    }

    setSavedIds((currentIds) => {
      let updatedIds;

      if (currentIds.includes(id)) {
        updatedIds =
          currentIds.filter(
            (savedId) =>
              savedId !== id
          );
      } else {
        updatedIds = [
          ...currentIds,
          id,
        ];
      }

      localStorage.setItem(
        "trueauthorBookmarks",
        JSON.stringify(updatedIds)
      );

      return updatedIds;
    });
  };

  // ==========================================================
  // FETCH MARKETPLACE WORKS
  // ==========================================================

  const fetchWorks = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "http://localhost:5000/api/works/marketplace"
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to load marketplace."
        );
      }

      setWorks(data.works || []);
    } catch (err) {
      console.error(
        "Marketplace error:",
        err
      );

      setError(
        err.message ||
          "Unable to load marketplace."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorks();
  }, []);

  // ==========================================================
  // CATEGORY
  // ==========================================================

  const getCategory = (
    fileType = ""
  ) => {
    const type =
      fileType.toLowerCase();

    if (
      type.startsWith("image/")
    ) {
      return "Images";
    }

    if (
      type.startsWith("audio/")
    ) {
      return "Audio";
    }

    if (
      type.startsWith("video/")
    ) {
      return "Videos";
    }

    return "Documents";
  };

  const getCategoryIcon = (
    fileType = ""
  ) => {
    const currentCategory =
      getCategory(fileType);

    if (
      currentCategory === "Images"
    ) {
      return "🖼️";
    }

    if (
      currentCategory === "Audio"
    ) {
      return "🎵";
    }

    if (
      currentCategory === "Videos"
    ) {
      return "🎬";
    }

    return "📄";
  };

  // ==========================================================
  // IPFS URL
  // ==========================================================

  const getIPFSUrl = (cid) => {
    if (!cid) {
      return "";
    }

    return `https://rose-obedient-bobolink-651.mypinata.cloud/ipfs/${cid}`;
  };

  // ==========================================================
  // NORMALIZE HASH
  // ==========================================================

  const normalizeWorkHash = (
    hash
  ) => {
    if (!hash) {
      throw new Error(
        "Work hash is missing."
      );
    }

    let normalized =
      String(hash).trim();

    if (
      normalized.startsWith("0x")
    ) {
      normalized =
        normalized.slice(2);
    }

    if (
      normalized.length !== 64
    ) {
      throw new Error(
        "Invalid SHA-256 work hash."
      );
    }

    if (
      !/^[0-9a-fA-F]+$/.test(
        normalized
      )
    ) {
      throw new Error(
        "Invalid work hash format."
      );
    }

    return `0x${normalized}`;
  };

  // ==========================================================
  // FETCH LICENSE OFFER
  // ==========================================================

  const fetchLicenseOffer =
    async (work) => {
      if (!work?.fileHash) {
        setLicenseOffer(null);
        setRoyaltyAccounts([]);
        setRoyaltyShares([]);

        return;
      }

      try {
        setLicenseLoading(true);
        setLicenseError("");

        const provider =
          new ethers.JsonRpcProvider(
            RPC_URL
          );

        const contract =
          new ethers.Contract(
            CONTRACT_ADDRESS,
            LICENSE_ABI,
            provider
          );

        const normalizedHash =
          normalizeWorkHash(
            work.fileHash
          );

        // ----------------------------------------------
        // GET BASIC OFFER
        // ----------------------------------------------

        const offerResult =
          await contract.getLicenseOffer(
            normalizedHash
          );

        const offer = {
          seller: offerResult[0],
          price: offerResult[1],
          duration: offerResult[2],
          totalRoyaltyBps:
            offerResult[3],
          active: offerResult[4],
        };

        // ----------------------------------------------
        // GET ROYALTY SHARES
        // ----------------------------------------------

        const royaltyResult =
          await contract.getRoyaltyShares(
            normalizedHash
          );

        const accounts =
          royaltyResult[0] || [];

        const shares =
          royaltyResult[1] || [];

        if (
          offer.active &&
          offer.price > 0n
        ) {
          setLicenseOffer(offer);

          setRoyaltyAccounts(
            accounts
          );

          // Convert blockchain BPS into percentage
          setRoyaltyShares(
            shares.map(
              (share) =>
                Number(share) / 100
            )
          );
        } else {
          setLicenseOffer(null);
          setRoyaltyAccounts([]);
          setRoyaltyShares([]);
        }
      } catch (err) {
        console.error(
          "Unable to fetch license offer:",
          err
        );

        setLicenseOffer(null);
        setRoyaltyAccounts([]);
        setRoyaltyShares([]);

        setLicenseError(
          "This work has not been listed for licensing yet."
        );
      } finally {
        setLicenseLoading(false);
      }
    };

  // ==========================================================
  // PURCHASED LICENSES AND RECEIPTS
  // ==========================================================

  const loadPurchasedLicenses = async (address = walletAddress) => {
    if (!address || !works.length) { setPurchasedLicenses([]); return; }
    setLoadingPurchasedLicenses(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LICENSE_ABI, provider);
      const results = await Promise.all(works.filter((work) => work?.fileHash).map(async (work) => {
        try {
          const license = await contract.getLicense(normalizeWorkHash(work.fileHash), address);
          if (!Boolean(license[5])) return null;
          const receiptKey = `trueauthorLicenseReceipt:${address.toLowerCase()}:${String(work.fileHash).toLowerCase()}`;
          let saved = null;
          try { saved = JSON.parse(localStorage.getItem(receiptKey) || "null"); } catch {}
          return { work, buyerWallet: license[0], sellerWallet: license[1], pricePaid: license[2], startTime: Number(license[3]), expiryTime: Number(license[4]), exists: Boolean(license[5]), active: Boolean(license[6]), transactionHash: saved?.transactionHash || "", receiptKey };
        } catch (err) { console.warn("Could not check license for", work.title, err); return null; }
      }));
      setPurchasedLicenses(results.filter(Boolean).sort((a, b) => b.startTime - a.startTime));
    } catch (err) { console.error("Could not load purchased licenses:", err); }
    finally { setLoadingPurchasedLicenses(false); }
  };

  useEffect(() => {
    if (walletAddress && works.length) loadPurchasedLicenses(walletAddress);
    else setPurchasedLicenses([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, works]);

  const downloadLicenseReceipt = (license) => {
    const startDate = new Date(license.startTime * 1000);
    const expiryDate = new Date(license.expiryTime * 1000);
    const stillActive =
      Boolean(license.active) && license.expiryTime * 1000 > Date.now();

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const receiptNumber = [
      "TA",
      String(license.work?.registrationId || license.work?._id || license.work?.fileHash || "LICENSE")
        .replace(/[^a-z0-9]/gi, "")
        .slice(-10)
        .toUpperCase(),
      String(license.startTime || Math.floor(Date.now() / 1000)),
    ].join("-");

    const receiptHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TrueAuthor License Receipt - ${escapeHtml(license.work?.title || "Creative Work")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #172033; margin: 0; padding: 32px; background: #f3f6fb; }
  .receipt { max-width: 820px; margin: 0 auto; background: white; border: 1px solid #d8deea; border-radius: 16px; overflow: hidden; }
  header { padding: 28px 32px; background: #0f172a; color: white; }
  header h1 { margin: 0 0 8px; font-size: 26px; }
  header p { margin: 0; color: #cbd5e1; }
  main { padding: 30px 32px; }
  .status { display: inline-block; padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; color: ${stillActive ? "#047857" : "#b91c1c"}; background: ${stillActive ? "#d1fae5" : "#fee2e2"}; }
  .amount { margin: 18px 0 24px; padding: 20px; border: 1px solid #a7f3d0; background: #ecfdf5; border-radius: 12px; }
  .amount small, .field small { display: block; color: #64748b; font-size: 12px; margin-bottom: 7px; }
  .amount strong { font-size: 30px; color: #047857; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .field { min-width: 0; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow-wrap: anywhere; }
  .field span { font-size: 13px; }
  .wide { grid-column: 1 / -1; }
  .hash { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px !important; }
  .note { margin-top: 24px; color: #64748b; font-size: 12px; line-height: 1.5; }
  .actions { max-width: 820px; margin: 16px auto 0; display: flex; gap: 12px; }
  button { border: 0; border-radius: 8px; padding: 12px 18px; font-weight: bold; cursor: pointer; }
  .print { background: #2563eb; color: white; }
  .close { background: #e2e8f0; color: #172033; }
  @media (max-width: 600px) { body { padding: 10px; } main, header { padding: 20px; } .grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
  @media print { body { padding: 0; background: white; } .receipt { border: 0; border-radius: 0; } .actions { display: none; } }
</style>
</head>
<body>
<div class="receipt">
<header>
  <h1>🛡️ TrueAuthor</h1>
  <p>Digital License Purchase Receipt</p>
</header>
<main>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div><small style="color:#64748b">Receipt number</small><div><strong>${escapeHtml(receiptNumber)}</strong></div></div>
    <span class="status">${stillActive ? "LICENSE ACTIVE" : "LICENSE EXPIRED OR INACTIVE"}</span>
  </div>
  <div class="amount"><small>Amount paid on blockchain</small><strong>${escapeHtml(ethers.formatEther(license.pricePaid))} ETH</strong></div>
  <div class="grid">
    <div class="field"><small>Licensed work</small><span>${escapeHtml(license.work?.title || "Untitled Work")}</span></div>
    <div class="field"><small>Registration ID</small><span>${escapeHtml(license.work?.registrationId || "Not available")}</span></div>
    <div class="field"><small>Purchase date</small><span>${escapeHtml(startDate.toLocaleString())}</span></div>
    <div class="field"><small>License duration</small><span>${escapeHtml(formatDuration(license.expiryTime - license.startTime))}</span></div>
    <div class="field"><small>Expiry date</small><span>${escapeHtml(expiryDate.toLocaleString())}</span></div>
    <div class="field"><small>Network</small><span>Hardhat Local</span></div>
    <div class="field wide"><small>Buyer wallet</small><span class="hash">${escapeHtml(license.buyerWallet)}</span></div>
    <div class="field wide"><small>Creator / seller wallet</small><span class="hash">${escapeHtml(license.sellerWallet)}</span></div>
    <div class="field wide"><small>Transaction hash</small><span class="hash">${escapeHtml(license.transactionHash || "Not saved in this browser. License details were read from the contract.")}</span></div>
    <div class="field wide"><small>SHA-256 work fingerprint</small><span class="hash">${escapeHtml(license.work?.fileHash || "Not available")}</span></div>
    <div class="field wide"><small>IPFS content identifier</small><span class="hash">${escapeHtml(license.work?.ipfsCid || "Not available")}</span></div>
    <div class="field wide"><small>Smart contract</small><span class="hash">${escapeHtml(CONTRACT_ADDRESS)}</span></div>
  </div>
  <p class="note">This receipt summarizes the license data available from the configured blockchain. It is proof of the recorded transaction details, not a transfer of copyright ownership. The license agreement determines permitted use. Hardhat Local is a development network; its history depends on the local node and chain data being preserved.</p>
</main>
</div>
<div class="actions">
  <button class="print" onclick="window.print()">Print / Save as PDF</button>
  <button class="close" onclick="window.close()">Close</button>
</div>
</body>
</html>`;

    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) {
      setLicenseError("Your browser blocked the receipt window. Allow pop-ups for localhost and try again.");
      return;
    }
    receiptWindow.document.open();
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
  };

  // ==========================================================
  // SELECTED WORK CHANGED
  // ==========================================================

  useEffect(() => {
    if (!selectedWork) {
      return;
    }

    setLicenseOffer(null);
    setLicenseError("");

    // Reset listing form.
    setLicensePrice(
      DEFAULT_LICENSE_PRICE
    );

    setLicenseDays(
      DEFAULT_LICENSE_DAYS
    );

    // Start with the blockchain owner as
    // the artist/creator.
    setRoyaltyAccounts([
      selectedWork.blockchainOwner || "",
    ]);

    setRoyaltyShares(["95"]);

    // IMPORTANT:
    // Check the blockchain for an existing
    // license offer whenever a work is opened.
    fetchLicenseOffer(
      selectedWork
    );
  }, [selectedWork]);

  // ==========================================================
  // FORMAT DURATION
  // ==========================================================

  const formatDuration = (
    seconds
  ) => {
    const value =
      Number(seconds || 0);

    if (value <= 0) {
      return "Not specified";
    }

    const days =
      Math.floor(
        value /
          (60 * 60 * 24)
      );

    const hours =
      Math.floor(
        (
          value %
          (60 * 60 * 24)
        ) /
          (60 * 60)
      );

    if (days > 0) {
      return `${days} day${
        days !== 1
          ? "s"
          : ""
      }`;
    }

    return `${hours} hour${
      hours !== 1
        ? "s"
        : ""
    }`;
  };

  // ==========================================================
  // CHECK CURRENT USER OWNER
  // ==========================================================

  const isCurrentUserOwner =
    () => {
      if (
        !walletAddress ||
        !selectedWork?.blockchainOwner
      ) {
        return false;
      }

      return (
        walletAddress.toLowerCase() ===
        selectedWork.blockchainOwner.toLowerCase()
      );
    };

  // ==========================================================
  // TOTAL CREATOR SHARES
  // ==========================================================

  const totalRoyaltyPercent =
    useMemo(() => {
      return royaltyShares.reduce(
        (
          total,
          share
        ) =>
          total +
          Number(share || 0),
        0
      );
    }, [royaltyShares]);

  // ==========================================================
  // CREATE LICENSE OFFER
  // ==========================================================

  const createLicenseOffer =
    async () => {
      try {
        setListing(true);
        setLicenseError("");

        // ----------------------------------------------
        // VALIDATE WORK
        // ----------------------------------------------

        if (
          !selectedWork?.fileHash
        ) {
          throw new Error(
            "This work does not have a valid SHA-256 hash."
          );
        }

        // ----------------------------------------------
        // CONNECT WALLET
        // ----------------------------------------------

        const address =
          walletAddress ||
          (await connectMetaMaskForUI());

        if (!address) {
          throw new Error(
            "Please connect MetaMask."
          );
        }

        // ----------------------------------------------
        // CHECK OWNER
        // ----------------------------------------------

        if (
          selectedWork.blockchainOwner &&
          address.toLowerCase() !==
            selectedWork.blockchainOwner.toLowerCase()
        ) {
          throw new Error(
            "Only the registered owner can create a license offer."
          );
        }

        // ----------------------------------------------
        // PRICE
        // ----------------------------------------------

        const price =
          ethers.parseEther(
            String(licensePrice)
          );

        if (price <= 0n) {
          throw new Error(
            "License price must be greater than 0 ETH."
          );
        }

        // ----------------------------------------------
        // DURATION
        // ----------------------------------------------

        const duration =
          Number(licenseDays) *
          24 *
          60 *
          60;

        if (duration <= 0) {
          throw new Error(
            "License duration must be greater than 0."
          );
        }

        // ----------------------------------------------
        // VALIDATE ROYALTY RECIPIENTS
        // ----------------------------------------------

        const effectiveRoyaltyAccounts =
          [
            (
              royaltyAccounts[0] ||
              address
            ).trim(),
            ...royaltyAccounts.slice(
              1
            ),
          ];

        console.log(
          "DEBUG royaltyAccounts:",
          royaltyAccounts
        );

        console.log(
          "DEBUG royaltyShares:",
          royaltyShares
        );

        console.log(
          "DEBUG effectiveRoyaltyAccounts:",
          effectiveRoyaltyAccounts
        );

        console.log(
          "DEBUG account length:",
          effectiveRoyaltyAccounts.length
        );

        console.log(
          "DEBUG share length:",
          royaltyShares.length
        );

        if (
          effectiveRoyaltyAccounts.length !==
          royaltyShares.length
        ) {
          throw new Error(
            "Royalty accounts and shares do not match."
          );
        }

        // ----------------------------------------------
        // VALIDATE TOTAL = 95%
        // ----------------------------------------------

        const totalShares =
          royaltyShares.reduce(
            (
              total,
              value
            ) =>
              total +
              Number(value || 0),
            0
          );

        if (
          Math.abs(
            totalShares -
              CREATOR_POOL_PERCENT
          ) > 0.000001
        ) {
          throw new Error(
            `Artist and collaborator shares must total exactly 95%. Current total: ${totalShares}%.`
          );
        }

        // ----------------------------------------------
        // VALIDATE ADDRESSES
        // ----------------------------------------------

        const normalizedAccounts =
          effectiveRoyaltyAccounts.map(
            (account) =>
              account.trim()
          );

        const normalizedShares =
          royaltyShares.map(
            (share) =>
              Math.round(
                Number(share) * 100
              )
          );

        const seen = new Set();

        for (
          let i = 0;
          i <
          normalizedAccounts.length;
          i++
        ) {
          const account =
            normalizedAccounts[i];

          const share =
            Number(
              royaltyShares[i]
            );

          if (
            !ethers.isAddress(
              account
            )
          ) {
            throw new Error(
              `Royalty recipient ${i + 1} has an invalid wallet address.`
            );
          }

          if (
            share <= 0 ||
            share > 95
          ) {
            throw new Error(
              `Royalty share ${i + 1} must be greater than 0%.`
            );
          }

          const lower =
            account.toLowerCase();

          if (
            seen.has(lower)
          ) {
            throw new Error(
              "The same wallet address cannot be added twice."
            );
          }

          seen.add(lower);
        }

        // ----------------------------------------------
        // CREATE CONTRACT
        // ----------------------------------------------

        const provider =
          getMetaMaskProvider();

        const signer =
          await provider.getSigner();

        const contract =
          new ethers.Contract(
            CONTRACT_ADDRESS,
            LICENSE_ABI,
            signer
          );

        // ----------------------------------------------
        // BLOCKCHAIN TRANSACTION
        // ----------------------------------------------

        console.log(
          "Creating TrueAuthor license listing..."
        );

        console.log(
          "Price:",
          licensePrice,
          "ETH"
        );

        console.log(
          "Duration:",
          licenseDays,
          "days"
        );

        console.log(
          "Platform fee:",
          `${PLATFORM_FEE_PERCENT}%`
        );

        console.log(
          "Creator pool:",
          `${CREATOR_POOL_PERCENT}%`
        );

        console.log(
          "Royalty accounts:",
          normalizedAccounts
        );

        console.log(
          "Royalty shares:",
          normalizedShares
        );

        const transaction =
          await contract.listWork(
            normalizeWorkHash(
              selectedWork.fileHash
            ),
            price,
            duration,
            normalizedAccounts,
            normalizedShares
          );

        console.log(
          "Listing transaction:",
          transaction.hash
        );

        await transaction.wait();

        alert(
          "✅ License offer created successfully!"
        );

        await fetchLicenseOffer(
          selectedWork
        );
      } catch (err) {
        console.error(
          "License listing failed:",
          err
        );

        let message =
          err?.reason ||
          err?.shortMessage ||
          err?.message ||
          "Unable to create license offer.";

        if (
          message
            .toLowerCase()
            .includes("user rejected")
        ) {
          message =
            "MetaMask transaction was rejected.";
        }

        setLicenseError(
          message
        );

        alert(
          `❌ ${message}`
        );
      } finally {
        setListing(false);
      }
    };

  // ==========================================================
  // PURCHASE LICENSE
  // ==========================================================

  const handlePurchaseLicense =
    async () => {
      try {
        if (
          !selectedWork?.fileHash
        ) {
          throw new Error(
            "Work hash is missing."
          );
        }

        if (!licenseOffer) {
          throw new Error(
            "This work is not currently available for licensing."
          );
        }

        setPurchasing(true);
        setLicenseError("");

        const price =
          ethers.formatEther(
            licenseOffer.price
          );

        const confirmed =
          window.confirm(
            `Purchase this license for ${price} ETH?`
          );

        if (!confirmed) {
          setPurchasing(false);
          return;
        }

        // ----------------------------------------------
        // CONNECT WALLET
        // ----------------------------------------------

        const provider =
          getMetaMaskProvider();

        const accounts =
          await provider.send(
            "eth_requestAccounts",
            []
          );

        if (
          !accounts ||
          accounts.length === 0
        ) {
          throw new Error(
            "Please connect MetaMask."
          );
        }

        const buyerWallet =
          accounts[0];
        setWalletAddress(buyerWallet);

        const signer =
          await provider.getSigner();

        const contract =
          new ethers.Contract(
            CONTRACT_ADDRESS,
            LICENSE_ABI,
            signer
          );

        // ----------------------------------------------
        // PURCHASE
        // ----------------------------------------------

        const transaction =
          await contract.purchaseLicense(
            normalizeWorkHash(
              selectedWork.fileHash
            ),
            {
              value:
                licenseOffer.price,
            }
          );

        console.log(
          "Purchase transaction:",
          transaction.hash
        );

        const receipt =
          await transaction.wait();

        console.log(
          "License purchased:",
          transaction.hash,
          receipt
        );

        const receiptKey = `trueauthorLicenseReceipt:${buyerWallet.toLowerCase()}:${String(selectedWork.fileHash).toLowerCase()}`;
        const purchaseReceipt = { transactionHash: transaction.hash, blockNumber: receipt?.blockNumber ?? null, workTitle: selectedWork.title || "Untitled Work", fileHash: selectedWork.fileHash, buyerWallet, pricePaidWei: licenseOffer.price.toString(), durationSeconds: licenseOffer.duration.toString(), purchasedAt: new Date().toISOString() };
        localStorage.setItem(receiptKey, JSON.stringify(purchaseReceipt));
        setLastPurchaseReceipt(purchaseReceipt);

        // ----------------------------------------------
        // NOTIFY ARTIST
        // ----------------------------------------------

        try {
          await fetch(
            "http://localhost:5000/api/works/purchase-notification",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                workHash:
                  selectedWork.fileHash,

                buyerEmail:
                  userEmail,

                buyerWallet:
                  buyerWallet,

                price:
                  licenseOffer.price.toString(),

                duration:
                  licenseOffer.duration.toString(),

                transactionHash:
                  transaction.hash,
              }),
            }
          );
        } catch (
          notificationError
        ) {
          console.error(
            "Purchase succeeded but notification failed:",
            notificationError
          );
        }

        alert(`✅ License purchased successfully!\n\nWork: ${selectedWork.title || "Untitled Work"}\nAmount: ${price} ETH\nTransaction: ${transaction.hash}\n\nYour license will appear under My Purchased Licenses.`);
        await fetchLicenseOffer(selectedWork);
        await loadPurchasedLicenses(buyerWallet);
      } catch (err) {
        console.error(
          "License purchase failed:",
          err
        );

        let message =
          err?.reason ||
          err?.shortMessage ||
          err?.message ||
          "Unable to purchase license.";

        if (
          message
            .toLowerCase()
            .includes("user rejected")
        ) {
          message =
            "MetaMask transaction was rejected.";
        }

        setLicenseError(
          message
        );

        alert(
          `❌ ${message}`
        );
      } finally {
        setPurchasing(false);
      }
    };

  // ==========================================================
  // WORK PREVIEW
  // ==========================================================

  const WorkPreview = ({ work }) => {
    if (!work?.ipfsCid) {
      return (
        <div className="h-64 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-gray-400">Preview unavailable</p>
            <p className="text-gray-600 text-xs mt-1">IPFS content is not available.</p>
          </div>
        </div>
      );
    }

    const url = getIPFSUrl(work.ipfsCid);
    const type = work.fileType?.toLowerCase() || "";
    const isDocument =
      type === "application/pdf" ||
      type.includes("pdf") ||
      type.includes("word") ||
      type.includes("officedocument") ||
      type.startsWith("text/") ||
      /\.(pdf|docx|txt|md|csv|json|xml|html?)$/i.test(work.fileName || "");

    const Watermark = ({ faint = false }) => (
      <div className={`absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center ${faint ? "opacity-30" : "opacity-50"}`}>
        <div className="text-purple-200/70 text-2xl sm:text-3xl font-extrabold tracking-widest rotate-[-28deg] select-none whitespace-nowrap">
          TRUEAUTHOR • PREVIEW
        </div>
      </div>
    );

    // Images: retain the existing protected preview.
    if (type.startsWith("image/")) {
      return (
        <div
          className="relative bg-black rounded-xl overflow-hidden border border-slate-700"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="h-72 flex items-center justify-center p-3">
            <img
              src={url}
              alt={work.title || "Creative work"}
              draggable="false"
              className="max-h-full max-w-full object-contain select-none"
            />
          </div>
          <Watermark faint />
          <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/70 text-center">
              © {work.authorName || "Author"} • {work.registrationId || "Registered Work"}
            </div>
          </div>
        </div>
      );
    }

    // Video: retain the existing protected preview.
    if (type.startsWith("video/")) {
      return (
        <div
          className="relative bg-black rounded-xl overflow-hidden border border-slate-700"
          onContextMenu={(e) => e.preventDefault()}
        >
          <video
            src={url}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            className="w-full h-72 object-contain bg-black"
          />
          <Watermark faint />
          <div className="absolute bottom-14 left-3 right-3 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/70 text-center">
              © {work.authorName || "Author"} • {work.registrationId || "Registered Work"}
            </div>
          </div>
        </div>
      );
    }

    // Audio: retain the existing player.
    if (type.startsWith("audio/")) {
      return (
        <div
          className="relative bg-slate-950 rounded-xl border border-slate-700 p-8"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="text-center mb-6">
            <div className="text-6xl">🎵</div>
            <p className="text-white font-semibold mt-3">{work.title || "Audio Work"}</p>
            <p className="text-gray-500 text-sm">by {work.authorName || "Unknown Author"}</p>
          </div>
          <audio src={url} controls controlsList="nodownload" className="w-full" />
          <div className="text-center text-xs text-gray-600 mt-5">
            © {work.authorName || "Author"} • {work.registrationId || "Registered Work"}
          </div>
        </div>
      );
    }

    // Document preview: intentionally show only a short preview excerpt.
    // This keeps the original file URL out of a document iframe.
    if (isDocument) {
      return (
        <ProtectedDocumentPreview
          url={url}
          fileName={work.fileName || work.title || "Document"}
          fileType={type}
          authorName={work.authorName || "Author"}
          registrationId={work.registrationId || "Registered Work"}
        />
      );
    }

    return (
      <div className="h-64 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-white font-semibold">Document Preview</p>
          <p className="text-gray-500 text-sm mt-2">{work.fileName}</p>
          <p className="text-gray-600 text-xs mt-3">This file type cannot be displayed directly.</p>
        </div>
      </div>
    );
  };

  // Compact document preview: show the total page count and thumbnails of pages 1-2 only.
  // Install dependencies in the frontend folder: npm install pdfjs-dist mammoth
  const ProtectedDocumentPreview = ({
    url,
    fileName,
    fileType,
    authorName,
    registrationId,
  }) => {
    const [pages, setPages] = useState([]);
    const [pageCount, setPageCount] = useState(0);
    const [previewError, setPreviewError] = useState("");
    const [previewLoading, setPreviewLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;

      const loadPreview = async () => {
        setPreviewLoading(true);
        setPreviewError("");
        setPages([]);
        setPageCount(0);

        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Document fetch failed (${response.status})`);
          const buffer = await response.arrayBuffer();
          const lowerName = fileName.toLowerCase();
          const isPdf = fileType.includes("pdf") || lowerName.endsWith(".pdf");
          const isDocx = fileType.includes("wordprocessingml") || lowerName.endsWith(".docx");
          let previewPages = [];
          let totalPages = 0;

          if (isPdf) {
            // Use PDF.js's legacy ESM build for Vite/browser compatibility.
            const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            totalPages = pdf.numPages;

            // Render only the first two pages, at thumbnail scale.
            for (let pageNumber = 1; pageNumber <= Math.min(2, totalPages); pageNumber++) {
              const page = await pdf.getPage(pageNumber);
              const viewport = page.getViewport({ scale: 0.42 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              if (!context) throw new Error("Could not create preview canvas");
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              await page.render({ canvasContext: context, viewport }).promise;
              previewPages.push({
                kind: "image",
                content: canvas.toDataURL("image/jpeg", 0.78),
              });
              canvas.width = 0;
              canvas.height = 0;
            }
          } else if (isDocx) {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            const chunks = splitPreviewText(result.value);
            totalPages = chunks.length;
            previewPages = chunks.slice(0, 2);
          } else {
            const text = new TextDecoder("utf-8").decode(buffer);
            const chunks = splitPreviewText(text);
            totalPages = chunks.length;
            previewPages = chunks.slice(0, 2);
          }

          if (!cancelled) {
            setPages(previewPages);
            setPageCount(totalPages);
          }
        } catch (error) {
          console.error("Document preview error:", error);
          if (!cancelled) {
            setPreviewError(
              "Could not generate the preview. Check that the IPFS file is reachable and the format is supported."
            );
          }
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      };

      loadPreview();
      return () => { cancelled = true; };
    }, [url, fileName, fileType]);

    const splitPreviewText = (text) => {
      const clean = String(text || "").replace(/\r/g, "").trim();
      if (!clean) return [{ kind: "text", content: "No readable text found in this document." }];
      const chunkSize = 1800;
      const chunks = [];
      for (let index = 0; index < clean.length; index += chunkSize) {
        chunks.push({ kind: "text", content: clean.slice(index, index + chunkSize) });
      }
      return chunks;
    };

    if (previewLoading) {
      return (
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-5 text-center text-sm text-gray-400">
          Loading document preview…
        </div>
      );
    }

    if (previewError || !pages.length) {
      return (
        <div className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-5 text-center text-sm text-gray-400">
          {previewError || "No preview content is available."}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3" onContextMenu={(event) => event.preventDefault()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">Document preview</p>
          <span className="text-xs text-gray-400">{pageCount} page{pageCount === 1 ? "" : "s"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {pages.map((page, index) => (
            <div key={`preview-page-${index}`} className="relative mx-auto w-full max-w-[180px] overflow-hidden rounded border border-slate-600 bg-white shadow-sm">
              {page.kind === "image" ? (
                <img src={page.content} alt={`Page ${index + 1} thumbnail`} draggable="false" className="block h-[190px] w-full object-contain" />
              ) : (
                <div className="h-[190px] overflow-hidden p-2 text-[9px] leading-3 text-slate-900">
                  <pre className="whitespace-pre-wrap break-words font-sans">{page.content}</pre>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <span className="rotate-[-28deg] whitespace-nowrap text-[10px] font-bold tracking-wide text-purple-800/30">
                  TRUEAUTHOR • PREVIEW
                </span>
              </div>
              <div className="bg-slate-950/90 px-2 py-1 text-center text-[10px] text-white/80">Page {index + 1}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          Showing up to 2 preview pages • © {authorName} • {registrationId}
        </p>
      </div>
    );
  };

  // ==========================================================
  // FILTER WORKS
  // ==========================================================

  const filteredWorks =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return works.filter(
        (work) => {
          const matchesCategory =
            category === "All" ||
            getCategory(
              work.fileType
            ) === category;

          const matchesSearch =
            !searchText ||
            (
              work.title ||
              ""
            )
              .toLowerCase()
              .includes(
                searchText
              ) ||
            (
              work.authorName ||
              ""
            )
              .toLowerCase()
              .includes(
                searchText
              );

          return (
            matchesCategory &&
            matchesSearch
          );
        }
      );
    }, [
      works,
      search,
      category,
    ]);

  // ==========================================================
  // DISPLAY USER NAME
  // ==========================================================

  const displayName =
    user?.username ||
    user?.name ||
    user?.fullName ||
    user?.email?.split("@")[0] ||
    "Account";

  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <nav className="bg-slate-900 border-b border-slate-800">

        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">

          <Link
            to={
              user
                ? "/dashboard"
                : "/"
            }
            className="text-2xl font-bold text-blue-500"
          >
            🛡️ TrueAuthor
          </Link>

          <div className="flex items-center gap-6">

            <Link
              to={
                user
                  ? "/dashboard"
                  : "/"
              }
              className="text-gray-300 hover:text-blue-400 transition"
            >
              Home
            </Link>

            <Link
              to="/marketplace"
              className="text-blue-400 font-semibold"
            >
              Marketplace
            </Link>

            <Link
              to="/verify"
              className="text-gray-300 hover:text-blue-400 transition"
            >
              Verify
            </Link>

            {user ? (
              <>
                <Link
                  to="/saved"
                  className="text-gray-300 hover:text-blue-400 transition flex items-center gap-1"
                >
                  🔖
                  <span className="hidden md:inline">
                    Saved
                  </span>
                </Link>

                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl transition"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                    {displayName
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="text-left hidden sm:block">
                    <p className="text-white text-sm font-semibold">
                      {displayName}
                    </p>

                    <p className="text-gray-500 text-xs">
                      My Account
                    </p>
                  </div>
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                state={{
                  from: "/marketplace",
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold transition"
              >
                Login
              </Link>
            )}

          </div>

        </div>

      </nav>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="max-w-7xl mx-auto px-6 py-12">

        <div className="text-center mb-10">

          <div className="text-5xl mb-4">
            🛒
          </div>

          <h1 className="text-4xl font-bold">
            TrueAuthor Marketplace
          </h1>

          <p className="text-gray-400 mt-3 text-lg">
            Discover creative works registered through TrueAuthor.
          </p>

        </div>

        {/* SEARCH */}

        <div className="max-w-3xl mx-auto mb-7">

          <div className="relative">

            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
              🔎
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search by work name or author name..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 pl-12 pr-5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />

          </div>

        </div>

        {/* CATEGORY */}

        <div className="flex flex-wrap justify-center gap-3 mb-10">

          {[
            ["All", "📚"],
            ["Images", "🖼️"],
            ["Audio", "🎵"],
            ["Videos", "🎬"],
            ["Documents", "📄"],
          ].map(
            ([name, icon]) => (
              <button
                key={name}
                onClick={() =>
                  setCategory(name)
                }
                className={`px-5 py-2.5 rounded-full border transition font-medium ${
                  category === name
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-900 border-slate-700 text-gray-400 hover:border-blue-500 hover:text-white"
                }`}
              >
                {icon} {name}
              </button>
            )
          )}

        </div>

        {/* LOADING */}

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">

            <div className="text-4xl mb-4">
              ⏳
            </div>

            <p className="text-gray-400">
              Loading creative works...
            </p>

          </div>
        )}

        {/* ERROR */}

        {!loading &&
          error && (
            <div className="bg-slate-900 border border-red-700 rounded-2xl p-10 text-center">

              <div className="text-4xl mb-4">
                ⚠️
              </div>

              <h3 className="text-xl font-semibold text-red-400">
                Unable to load marketplace
              </h3>

              <p className="text-gray-400 mt-3">
                {error}
              </p>

              <button
                onClick={
                  fetchWorks
                }
                className="mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Try Again
              </button>

            </div>
          )}

        {/* COUNT */}

        {!loading &&
          !error && (
            <div className="flex items-center justify-between mb-6">

              <div>

                <h2 className="text-2xl font-semibold">
                  Creative Works
                </h2>

                <p className="text-gray-500 text-sm mt-1">
                  {filteredWorks.length} work
                  {filteredWorks.length !==
                  1
                    ? "s"
                    : ""}{" "}
                  found
                </p>

              </div>

              <button
                onClick={
                  fetchWorks
                }
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                🔄 Refresh
              </button>

            </div>
          )}

        {/* NO RESULTS */}

        {!loading &&
          !error &&
          filteredWorks.length ===
            0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">

              <div className="text-5xl mb-4">
                🔍
              </div>

              <h3 className="text-xl font-semibold">
                No works found
              </h3>

              <p className="text-gray-400 mt-3">
                Try another search or category.
              </p>

            </div>
          )}

        {/* WORK CARDS */}

        {!loading &&
          !error &&
          filteredWorks.length >
            0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {filteredWorks.map(
                (work) => {
                  const workId =
                    getWorkId(
                      work
                    );

                  const icon =
                    getCategoryIcon(
                      work.fileType
                    );

                  const workCategory =
                    getCategory(
                      work.fileType
                    );

                  const previewUrl =
                    work.ipfsCid
                      ? getIPFSUrl(
                          work.ipfsCid
                        )
                      : "";

                  const isImage =
                    work.fileType
                      ?.toLowerCase()
                      .startsWith(
                        "image/"
                      );

                  const isVideo =
                    work.fileType
                      ?.toLowerCase()
                      .startsWith(
                        "video/"
                      );

                  const saved =
                    isSaved(work);

                  return (
                    <div
                      key={workId}
                      className="bg-slate-900 border border-slate-800 hover:border-blue-600 rounded-2xl overflow-hidden transition-all"
                    >

                      {/* THUMBNAIL */}

                      <div className="h-44 bg-slate-800 flex items-center justify-center relative overflow-hidden">

                        {isImage &&
                        previewUrl ? (
                          <img
                            src={
                              previewUrl
                            }
                            alt={
                              work.title ||
                              "Creative work"
                            }
                            className="w-full h-full object-cover"
                            draggable="false"
                          />
                        ) : isVideo &&
                          previewUrl ? (
                          <video
                            src={
                              previewUrl
                            }
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <div className="text-7xl">
                            {icon}
                          </div>
                        )}

                        {isVideo && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                            <div className="w-12 h-12 rounded-full bg-black/60 border border-white/30 flex items-center justify-center">

                              <span className="text-xl ml-1">
                                ▶
                              </span>

                            </div>

                          </div>
                        )}

                        <span className="absolute bottom-4 left-4 text-xs bg-slate-950/80 text-gray-300 px-3 py-1.5 rounded-full">
                          {workCategory}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            toggleBookmark(
                              work
                            )
                          }
                          className={`absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all border ${
                            saved
                              ? "bg-blue-600 border-blue-400 text-white"
                              : "bg-slate-950/80 border-slate-600 text-gray-300 hover:bg-blue-600 hover:border-blue-400 hover:text-white"
                          }`}
                        >
                          🔖
                        </button>

                      </div>

                      {/* CONTENT */}

                      <div className="p-6">

                        <h3 className="text-xl font-semibold break-words">
                          {work.title ||
                            "Untitled Work"}
                        </h3>

                        <p className="text-gray-400 mt-2">
                          by{" "}
                          <span className="text-blue-400">
                            {work.authorName ||
                              "Unknown Author"}
                          </span>
                        </p>

                        <div className="flex justify-between items-center mt-5">

                          <span className="text-xs text-green-400">
                            ● Registered
                          </span>

                          {saved && (
                            <span className="text-xs text-blue-400">
                              🔖 Saved
                            </span>
                          )}

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedWork(
                              work
                            )
                          }
                          className="w-full mt-5 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition"
                        >
                          View Details →
                        </button>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        <section className="mt-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div><h2 className="text-2xl font-semibold">🎟️ My Purchased Licenses</h2><p className="text-gray-400 text-sm mt-1">Licenses verified against the configured blockchain and connected wallet.</p></div>
            <div className="flex gap-3"><button type="button" onClick={connectMetaMaskForUI} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm">🦊 Connect Wallet</button><button type="button" onClick={() => loadPurchasedLicenses(walletAddress)} disabled={!walletAddress || loadingPurchasedLicenses} className="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50">{loadingPurchasedLicenses ? "Checking..." : "Refresh"}</button></div>
          </div>
          {!walletAddress ? <p className="text-gray-400 bg-slate-800 rounded-xl p-4">Connect the wallet used to purchase your license.</p> : loadingPurchasedLicenses ? <p className="text-gray-400 bg-slate-800 rounded-xl p-4">Checking blockchain licenses...</p> : purchasedLicenses.length === 0 ? <p className="text-gray-400 bg-slate-800 rounded-xl p-4">No purchased licenses were found for this wallet on the configured network.</p> : <div className="space-y-4">{purchasedLicenses.map((license) => { const valid = license.active && license.expiryTime * 1000 > Date.now(); return <article key={`${license.work?._id || license.work?.fileHash}-${license.buyerWallet}`} className="bg-slate-800 border border-slate-700 rounded-xl p-5"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div className="min-w-0"><h3 className="text-lg font-semibold">{license.work?.title || "Untitled Work"}</h3><p className="text-gray-400 text-sm mt-1">by {license.work?.authorName || "Unknown Author"}</p><p className="text-gray-400 text-sm mt-3">Amount paid: <span className="text-emerald-400 font-semibold">{ethers.formatEther(license.pricePaid)} ETH</span></p><p className="text-gray-400 text-sm mt-1">Purchased: {new Date(license.startTime * 1000).toLocaleString()}</p><p className="text-gray-400 text-sm mt-1">Expires: <span className={valid ? "text-emerald-300" : "text-red-300"}>{new Date(license.expiryTime * 1000).toLocaleString()}</span></p><p className={`text-xs mt-2 ${valid ? "text-emerald-400" : "text-red-400"}`}>{valid ? "● License Active" : "● License Expired or Inactive"}</p>{license.transactionHash && <p className="text-gray-500 text-xs mt-3 break-all">Transaction: {license.transactionHash}</p>}</div><div className="flex flex-col gap-2 shrink-0">{license.work?.ipfsCid && <a href={getIPFSUrl(license.work.ipfsCid)} target="_blank" rel="noopener noreferrer" className="text-center bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm font-semibold">Open Licensed Work ↗</a>}<button type="button" onClick={() => downloadLicenseReceipt(license)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">View / Print Receipt</button>{license.transactionHash && <button type="button" onClick={() => navigator.clipboard?.writeText(license.transactionHash)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm">Copy Transaction Hash</button>}</div></div></article>; })}</div>}
          <p className="text-gray-600 text-xs mt-4">The license is tied to the connected wallet and the configured local Hardhat network. The license terms determine permitted use.</p>
        </section>

      </main>

      {/* ======================================================
          DETAILS MODAL
      ====================================================== */}

      {selectedWork && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          onClick={() =>
            setSelectedWork(null)
          }
        >

          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="p-6 border-b border-slate-800 flex items-start justify-between">

              <div>

                <div className="text-4xl mb-3">
                  {getCategoryIcon(
                    selectedWork.fileType
                  )}
                </div>

                <h3 className="text-2xl font-bold">
                  {selectedWork.title ||
                    "Untitled Work"}
                </h3>

                <p className="text-gray-400 mt-1">
                  by{" "}
                  <span className="text-blue-400">
                    {selectedWork.authorName ||
                      "Unknown Author"}
                  </span>
                </p>

                {Array.isArray(selectedWork.collaborators) && selectedWork.collaborators.some((person) => ["accepted", "approved", "active"].includes(String(person?.status || person?.invitationStatus || "").toLowerCase())) && (
                  <div className="mt-3">
                    <p className="text-gray-500 text-xs mb-1">Accepted co-authors</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedWork.collaborators.filter((person) => ["accepted", "approved", "active"].includes(String(person?.status || person?.invitationStatus || "").toLowerCase())).map((person, index) => (
                        <span key={person._id || person.email || person.userEmail || index} className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800 rounded-full px-3 py-1">🤝 {person.fullName || person.name || person.username || person.email || person.userEmail || "Co-author"}</span>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedWork(
                    null
                  )
                }
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>

            </div>

            {/* PREVIEW */}

            <div className="p-6 border-b border-slate-800">

              <div className="flex items-center justify-between mb-3">

                <div>

                  <h4 className="text-lg font-semibold">
                    👁️ Work Preview
                  </h4>

                  <p className="text-xs text-gray-500 mt-1">
                    Preview is displayed securely within TrueAuthor.
                  </p>

                </div>

                <span className="text-xs bg-green-950/40 border border-green-800 text-green-400 px-3 py-1.5 rounded-full">
                  ● Registered Work
                </span>

              </div>

              <WorkPreview
                work={
                  selectedWork
                }
              />

            </div>

            {/* DETAILS */}

            <div className="p-6 space-y-5">

              <div className="grid grid-cols-2 gap-4">

                <div className="bg-slate-800 rounded-lg p-4">

                  <p className="text-gray-500 text-xs">
                    Category
                  </p>

                  <p className="text-white mt-1">
                    {getCategory(
                      selectedWork.fileType
                    )}
                  </p>

                </div>

                <div className="bg-slate-800 rounded-lg p-4">

                  <p className="text-gray-500 text-xs">
                    File Type
                  </p>

                  <p className="text-white mt-1 break-all">
                    {selectedWork.fileType}
                  </p>

                </div>

              </div>

              <div>

                <p className="text-gray-500 text-xs mb-1">
                  Registration ID
                </p>

                <p className="bg-slate-800 rounded-lg p-3 text-sm text-blue-400 break-all">
                  {selectedWork.registrationId ||
                    "Not available"}
                </p>

              </div>

              <div>

                <p className="text-gray-500 text-xs mb-1">
                  SHA-256 Digital Fingerprint
                </p>

                <p className="bg-slate-800 rounded-lg p-3 text-xs text-blue-400 break-all">
                  {selectedWork.fileHash ||
                    "Not available"}
                </p>

              </div>

              <div>

                <p className="text-gray-500 text-xs mb-1">
                  IPFS Content Identifier
                </p>

                <p className="bg-slate-800 rounded-lg p-3 text-xs text-purple-400 break-all">
                  {selectedWork.ipfsCid ||
                    "Not available"}
                </p>

              </div>

              {/* ==================================================
                  LICENSE MARKETPLACE
              ================================================== */}

              {lastPurchaseReceipt && String(lastPurchaseReceipt.fileHash).toLowerCase() === String(selectedWork.fileHash).toLowerCase() && <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-4"><h4 className="font-semibold text-emerald-300">✓ Purchase receipt saved</h4><p className="text-gray-300 text-sm mt-2">Paid {ethers.formatEther(lastPurchaseReceipt.pricePaidWei)} ETH</p><p className="text-gray-400 text-xs mt-1 break-all">Transaction: {lastPurchaseReceipt.transactionHash}</p></div>}

              <div className="border-t border-slate-800 pt-6">

                <h4 className="text-xl font-semibold text-emerald-400 mb-4">
                  💰 License Marketplace
                </h4>

                {licenseLoading ? (
                  <div className="bg-slate-800 rounded-xl p-8 text-center">

                    <div className="text-3xl mb-3">
                      ⏳
                    </div>

                    <p className="text-gray-400">
                      Checking blockchain license offer...
                    </p>

                  </div>
                ) : licenseOffer ? (

                  /* ==================================================
                     ACTIVE LICENSE
                  ================================================== */

                  <div className="bg-slate-800 border border-emerald-800 rounded-xl p-6">

                    <div className="grid grid-cols-2 gap-5">

                      <div>

                        <p className="text-gray-500 text-xs">
                          License Price
                        </p>

                        <p className="text-emerald-400 text-2xl font-bold mt-1">
                          {ethers.formatEther(
                            licenseOffer.price
                          )}{" "}
                          ETH
                        </p>

                      </div>

                      <div>

                        <p className="text-gray-500 text-xs">
                          Duration
                        </p>

                        <p className="text-white text-lg font-semibold mt-1">
                          {formatDuration(
                            licenseOffer.duration
                          )}
                        </p>

                      </div>

                    </div>

                    {/* ROYALTY INFORMATION */}

                    {royaltyAccounts.length >
                      0 && (
                      <div className="mt-5 border-t border-slate-700 pt-4">

                        <p className="text-gray-400 text-xs mb-3">
                          Creator Distribution
                        </p>

                        <div className="space-y-2">

                          {royaltyAccounts.map(
                            (
                              account,
                              index
                            ) => (
                              <div
                                key={
                                  `${account}-${index}`
                                }
                                className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
                              >

                                <span className="text-gray-400 text-xs break-all mr-3">
                                  {account}
                                </span>

                                <span className="text-emerald-400 text-xs font-semibold whitespace-nowrap">
                                  {Number(
                                    royaltyShares[
                                      index
                                    ] ||
                                      0
                                  )}
                                  %
                                </span>

                              </div>
                            )
                          )}

                        </div>

                        <div className="flex justify-between text-xs mt-3">

                          <span className="text-gray-500">
                            Platform Fee
                          </span>

                          <span className="text-yellow-400">
                            {PLATFORM_FEE_PERCENT}%
                          </span>

                        </div>

                      </div>
                    )}

                    {/* PURCHASE */}

                    <button
                      type="button"
                      disabled={
                        purchasing
                      }
                      onClick={
                        handlePurchaseLicense
                      }
                      className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition ${
                        purchasing
                          ? "bg-slate-700 text-gray-500 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {purchasing
                        ? "⏳ Processing Transaction..."
                        : `💳 Purchase License for ${ethers.formatEther(
                            licenseOffer.price
                          )} ETH`}
                    </button>

                    <p className="text-center text-gray-600 text-xs mt-3">
                      Payment is automatically divided by the TrueAuthor smart contract.
                    </p>

                  </div>

                ) : (

                  /* ==================================================
                     NO ACTIVE OFFER
                  ================================================== */

                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">

                    <div className="text-center mb-6">

                      <div className="text-4xl mb-3">
                        🏷️
                      </div>

                      <h5 className="text-lg font-semibold text-white">
                        Not currently listed
                      </h5>

                      <p className="text-gray-500 text-sm mt-2">
                        This work does not currently have an active license offer on the blockchain.
                      </p>

                    </div>

                    {/* OWNER LISTING */}

                    <div className="border-t border-slate-700 pt-5">

                      <div className="flex items-center justify-between mb-5">

                        <div>

                          <h5 className="text-lg font-semibold text-blue-400">
                            List this work
                          </h5>

                          <p className="text-gray-500 text-xs mt-1">
                            You can choose how the 95% creator pool is divided.
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={
                            connectMetaMaskForUI
                          }
                          className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm"
                        >
                          🦊 Connect
                        </button>

                      </div>

                      {/* WALLET */}

                      {walletAddress && (
                        <div className="mb-5 bg-slate-900 border border-slate-700 rounded-lg p-3">

                          <p className="text-gray-500 text-xs">
                            Connected Wallet
                          </p>

                          <p className="text-green-400 text-xs break-all mt-1">
                            {walletAddress}
                          </p>

                        </div>
                      )}

                      {/* PRICE + DURATION */}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div>

                          <label className="block text-gray-500 text-xs mb-2">
                            License Price (ETH)
                          </label>

                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={
                              licensePrice
                            }
                            onChange={(e) =>
                              setLicensePrice(
                                e.target.value
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-blue-500"
                          />

                        </div>

                        <div>

                          <label className="block text-gray-500 text-xs mb-2">
                            License Duration (days)
                          </label>

                          <input
                            type="number"
                            min="1"
                            value={
                              licenseDays
                            }
                            onChange={(e) =>
                              setLicenseDays(
                                e.target.value
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-blue-500"
                          />

                        </div>

                      </div>

                      {/* ==================================================
                          ARTIST SHARE
                      ================================================== */}

                      <div className="mt-5 bg-slate-900 border border-blue-800 rounded-xl p-4">

                        <div className="flex items-start gap-3">

                          <div className="text-2xl">
                            🎨
                          </div>

                          <div>

                            <h6 className="text-sm font-semibold text-white">
                              Artist / Creator
                            </h6>

                            <p className="text-xs text-gray-500 mt-1">
                              Your wallet is the original seller. Add your wallet here and choose how much of the 95% creator pool you want to receive.
                            </p>

                          </div>

                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3 mt-4">

                          <input
                            type="text"
                            placeholder="Your artist wallet address"
                            value={
                              royaltyAccounts[0] ||
                              walletAddress
                            }
                            onChange={(e) => {
                              const value =
                                e.target.value;

                              setRoyaltyAccounts(
                                (
                                  current
                                ) => {
                                  const updated =
                                    [
                                      ...current,
                                    ];

                                  updated[0] =
                                    value;

                                  return updated;
                                }
                              );
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                          />

                          <input
                            type="number"
                            min="0"
                            max="95"
                            step="0.5"
                            placeholder="Share %"
                            value={
                              royaltyShares[0] ||
                              ""
                            }
                            onChange={(e) => {
                              const value =
                                e.target.value;

                              setRoyaltyShares(
                                (
                                  current
                                ) => {
                                  const updated =
                                    [
                                      ...current,
                                    ];

                                  updated[0] =
                                    value;

                                  return updated;
                                }
                              );
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                          />

                        </div>

                      </div>

                      {/* ==================================================
                          COLLABORATORS
                      ================================================== */}

                      <div className="mt-5 bg-slate-900 border border-slate-700 rounded-xl p-4">

                        <div className="flex items-center justify-between mb-3">

                          <div>

                            <h6 className="text-sm font-semibold text-white">
                              Collaborators
                            </h6>

                            <p className="text-xs text-gray-500 mt-1">
                              Decide how much of the 95% creator pool each collaborator receives.
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setRoyaltyAccounts(
                                (
                                  current
                                ) => [
                                  ...current,
                                  "",
                                ]
                              );

                              setRoyaltyShares(
                                (
                                  current
                                ) => [
                                  ...current,
                                  "",
                                ]
                              );
                            }}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-semibold"
                          >
                            + Add Collaborator
                          </button>

                        </div>

                        {royaltyAccounts.length <=
                        1 ? (
                          <p className="text-gray-600 text-xs">
                            No collaborators added.
                          </p>
                        ) : (
                          <div className="space-y-3">

                            {royaltyAccounts
                              .slice(1)
                              .map(
                                (
                                  account,
                                  index
                                ) => {
                                  const actualIndex =
                                    index +
                                    1;

                                  return (
                                    <div
                                      key={
                                        actualIndex
                                      }
                                      className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3"
                                    >

                                      <input
                                        type="text"
                                        placeholder="0x collaborator wallet address"
                                        value={
                                          royaltyAccounts[
                                            actualIndex
                                          ] ||
                                          ""
                                        }
                                        onChange={(
                                          e
                                        ) => {
                                          const value =
                                            e
                                              .target
                                              .value;

                                          setRoyaltyAccounts(
                                            (
                                              current
                                            ) => {
                                              const updated =
                                                [
                                                  ...current,
                                                ];

                                              updated[
                                                actualIndex
                                              ] =
                                                value;

                                              return updated;
                                            }
                                          );
                                        }}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                                      />

                                      <input
                                        type="number"
                                        min="0"
                                        max="95"
                                        step="0.5"
                                        placeholder="Share %"
                                        value={
                                          royaltyShares[
                                            actualIndex
                                          ] ||
                                          ""
                                        }
                                        onChange={(
                                          e
                                        ) => {
                                          const value =
                                            e
                                              .target
                                              .value;

                                          setRoyaltyShares(
                                            (
                                              current
                                            ) => {
                                              const updated =
                                                [
                                                  ...current,
                                                ];

                                              updated[
                                                actualIndex
                                              ] =
                                                value;

                                              return updated;
                                            }
                                          );
                                        }}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRoyaltyAccounts(
                                            (
                                              current
                                            ) =>
                                              current.filter(
                                                (
                                                  _,
                                                  itemIndex
                                                ) =>
                                                  itemIndex !==
                                                  actualIndex
                                              )
                                          );

                                          setRoyaltyShares(
                                            (
                                              current
                                            ) =>
                                              current.filter(
                                                (
                                                  _,
                                                  itemIndex
                                                ) =>
                                                  itemIndex !==
                                                  actualIndex
                                              )
                                          );
                                        }}
                                        className="bg-red-950/50 hover:bg-red-900 border border-red-800 text-red-400 px-3 py-2 rounded-lg text-sm"
                                      >
                                        Remove
                                      </button>

                                    </div>
                                  );
                                }
                              )}

                          </div>
                        )}

                      </div>

                      {/* ==================================================
                          PAYMENT SUMMARY
                      ================================================== */}

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">

                        <div className="bg-slate-800 rounded-lg p-3">

                          <p className="text-gray-500">
                            Mandatory Platform Fee
                          </p>

                          <p className="text-yellow-400 font-semibold mt-1">
                            {PLATFORM_FEE_PERCENT}%
                          </p>

                        </div>

                        <div className="bg-slate-800 rounded-lg p-3">

                          <p className="text-gray-500">
                            Artist Share
                          </p>

                          <p className="text-emerald-400 font-semibold mt-1">
                            {Number(
                              royaltyShares[0] ||
                                0
                            )}
                            %
                          </p>

                        </div>

                        <div className="bg-slate-800 rounded-lg p-3">

                          <p className="text-gray-500">
                            Total Creator Pool
                          </p>

                          <p
                            className={`font-semibold mt-1 ${
                              Math.abs(
                                totalRoyaltyPercent -
                                  CREATOR_POOL_PERCENT
                              ) <
                              0.000001
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {totalRoyaltyPercent}
                            % /{" "}
                            {
                              CREATOR_POOL_PERCENT
                            }
                            %
                          </p>

                        </div>

                      </div>

                      {/* ==================================================
                          ERROR
                      ================================================== */}

                      {licenseError && (
                        <div className="mt-4 bg-red-950/30 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
                          ⚠️{" "}
                          {licenseError}
                        </div>
                      )}

                      {/* ==================================================
                          CREATE LISTING
                      ================================================== */}

                      <button
                        type="button"
                        disabled={
                          listing
                        }
                        onClick={
                          createLicenseOffer
                        }
                        className={`w-full mt-5 py-3 rounded-lg font-semibold transition ${
                          listing
                            ? "bg-slate-700 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        {listing
                          ? "⏳ Creating Blockchain Listing..."
                          : "🏷️ Create License Offer"}
                      </button>

                      <p className="text-gray-600 text-xs text-center mt-3">
                        Mandatory platform fee: 5% • Artist + collaborators: 95%
                      </p>

                    </div>

                  </div>
                )}

              </div>

              {/* ==================================================
                  BLOCKCHAIN REGISTRATION
              ================================================== */}

              <div className="border-t border-slate-800 pt-5">

                <h4 className="text-lg font-semibold text-blue-400 mb-4">
                  ⛓️ Blockchain Registration
                </h4>

                <div className="space-y-3">

                  <div>

                    <p className="text-gray-500 text-xs">
                      Network
                    </p>

                    <p className="text-gray-300 text-sm mt-1">
                      {selectedWork.blockchainNetwork ||
                        "Hardhat Local"}
                    </p>

                  </div>

                  <div>

                    <p className="text-gray-500 text-xs">
                      Owner Wallet
                    </p>

                    <p className="bg-slate-800 rounded-lg p-3 text-xs text-green-400 break-all mt-1">
                      {selectedWork.blockchainOwner ||
                        "Not available"}
                    </p>

                  </div>

                  <div>

                    <p className="text-gray-500 text-xs">
                      Transaction Hash
                    </p>

                    <p className="bg-slate-800 rounded-lg p-3 text-xs text-yellow-400 break-all mt-1">
                      {selectedWork.blockchainTxHash ||
                        "Not available"}
                    </p>

                  </div>

                  <div>

                    <p className="text-gray-500 text-xs">
                      Smart Contract
                    </p>

                    <p className="bg-slate-800 rounded-lg p-3 text-xs text-blue-400 break-all mt-1">
                      {selectedWork.contractAddress ||
                        CONTRACT_ADDRESS}
                    </p>

                  </div>

                </div>

              </div>

              {/* STATUS */}

              <div className="bg-green-950/30 border border-green-800 rounded-lg p-4">

                <p className="text-green-400 font-semibold">
                  ✓ Ownership Registration Verified
                </p>

                <p className="text-gray-400 text-sm mt-1">
                  This work has been registered through TrueAuthor.
                </p>

              </div>

            </div>

            {/* FOOTER */}

            <div className="p-6 border-t border-slate-800 space-y-3">

              <button
                type="button"
                onClick={() =>
                  toggleBookmark(
                    selectedWork
                  )
                }
                className={`w-full py-3 rounded-lg font-semibold transition border ${
                  isSaved(
                    selectedWork
                  )
                    ? "bg-blue-950/60 hover:bg-blue-950 border-blue-700 text-blue-400"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white"
                }`}
              >
                {isSaved(
                  selectedWork
                )
                  ? "🔖 Remove from Saved Works"
                  : "🔖 Save to Wishlist"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedWork(
                    null
                  )
                }
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition"
              >
                Close Preview
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Marketplace;