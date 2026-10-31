import { ethers } from "ethers";

// ============================================================
// TRUEAUTHOR CONTRACT
// ============================================================

export const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// ============================================================
// ABI
// ============================================================

export const CONTRACT_ABI = [

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
  // GET WORK CREATOR
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
  //
  // NEW CONTRACT:
  // royaltyAccounts = artist/collaborator wallet addresses
  // royaltyShares   = shares of the 95% creator pool
  //
  // Example:
  // Creator       = 7000
  // Collaborator  = 2500
  //
  // Total = 9500 = 95%
  // Platform automatically gets 500 = 5%
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

  // ==========================================================
  // PLATFORM FEE
  // ==========================================================

  {
    inputs: [],
    name: "PLATFORM_FEE_BPS",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // CREATOR POOL
  // ==========================================================

  {
    inputs: [],
    name: "CREATOR_POOL_BPS",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ==========================================================
  // PLATFORM WALLET
  // ==========================================================

  {
    inputs: [],
    name: "platformWallet",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ============================================================
// METAMASK PROVIDER
// ============================================================

export const getMetaMaskProvider = () => {

  if (!window.ethereum) {
    throw new Error(
      "MetaMask is not installed."
    );
  }

  return new ethers.BrowserProvider(
    window.ethereum
  );
};

// ============================================================
// CONNECT WALLET
// ============================================================

export const connectWallet = async () => {

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
      "No MetaMask account found."
    );
  }

  const signer =
    await provider.getSigner();

  const address =
    await signer.getAddress();

  return {
    provider,
    signer,
    address,
  };
};

// ============================================================
// CONTRACT WITH SIGNER
// ============================================================

export const getContractWithSigner =
  async () => {

    const {
      signer,
    } = await connectWallet();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

    return {
      contract,
      signer,
    };
  };

// ============================================================
// NORMALIZE HASH
// ============================================================

export const normalizeWorkHash =
  (hash) => {

    if (!hash) {
      throw new Error(
        "Work hash is missing."
      );
    }

    let normalized =
      hash.toString().trim();

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
        "Invalid work hash. Expected a 64-character SHA-256 hash."
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

// ============================================================
// REGISTER WORK
// ============================================================

export const registerWork =
  async (
    workHash,
    ipfsCid
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    if (!ipfsCid) {
      throw new Error(
        "IPFS CID is required."
      );
    }

    const {
      contract,
      signer,
    } =
      await getContractWithSigner();

    const owner =
      await signer.getAddress();

    console.log(
      "Registering work..."
    );

    console.log(
      "Work hash:",
      normalizedHash
    );

    console.log(
      "IPFS CID:",
      ipfsCid
    );

    console.log(
      "Owner:",
      owner
    );

    const transaction =
      await contract.registerWork(
        normalizedHash,
        ipfsCid
      );

    console.log(
      "Registration transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    console.log(
      "✅ Work registered successfully"
    );

    return {
      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,

      owner,
    };
  };

// ============================================================
// VERIFY WORK
// ============================================================

export const verifyWorkOnBlockchain =
  async (
    workHash
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    const result =
      await contract.verifyWork(
        normalizedHash
      );

    return {

      exists:
        result[0],

      ipfsCid:
        result[1],

      owner:
        result[2],

      timestamp:
        result[3].toString(),
    };
  };

// ============================================================
// GET WORK CREATOR
// ============================================================

export const getWorkCreator =
  async (
    workHash
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    return await contract.getWorkCreator(
      normalizedHash
    );
  };

// ============================================================
// LIST WORK FOR LICENSE
//
// IMPORTANT:
// The platform fee is ALWAYS 5%.
//
// The user chooses how the remaining 95% is divided.
//
// Example:
// Price = 0.01 ETH
//
// Platform = 5%
//
// Creator = 70% of creator pool
// Collaborator = 30% of creator pool
//
// Creator pool = 95%
//
// Therefore:
// Creator gets 66.5% of total price
// Collaborator gets 28.5% of total price
// Platform gets 5% of total price
//
// 66.5 + 28.5 + 5 = 100%
// ============================================================

export const listWorkForLicense =
  async (
    workHash,
    priceEth = "0.01",
    durationDays = 30,
    royaltyAccounts = [],
    royaltyPercentages = []
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    // ----------------------------------------------------------
    // VALIDATE ROYALTY ARRAYS
    // ----------------------------------------------------------

    if (
      !Array.isArray(
        royaltyAccounts
      ) ||
      !Array.isArray(
        royaltyPercentages
      )
    ) {
      throw new Error(
        "Royalty accounts and percentages must be arrays."
      );
    }

    if (
      royaltyAccounts.length === 0
    ) {
      throw new Error(
        "At least one royalty recipient is required."
      );
    }

    if (
      royaltyAccounts.length !==
      royaltyPercentages.length
    ) {
      throw new Error(
        "Royalty accounts and percentages must have the same length."
      );
    }

    // ----------------------------------------------------------
    // VALIDATE ROYALTY PERCENTAGES
    //
    // These percentages represent the distribution
    // INSIDE THE 95% creator pool.
    //
    // Therefore they must total exactly 100%.
    // ----------------------------------------------------------

    let totalPercentage = 0;

    for (
      let i = 0;
      i < royaltyPercentages.length;
      i++
    ) {

      const percentage =
        Number(
          royaltyPercentages[i]
        );

      if (
        !Number.isFinite(
          percentage
        )
      ) {
        throw new Error(
          "Invalid royalty percentage."
        );
      }

      if (
        percentage <= 0
      ) {
        throw new Error(
          "Royalty percentage must be greater than zero."
        );
      }

      totalPercentage +=
        percentage;
    }

    if (
      Math.abs(
        totalPercentage - 100
      ) > 0.000001
    ) {
      throw new Error(
        `Royalty percentages must total 100%. Current total: ${totalPercentage}%`
      );
    }

    // ----------------------------------------------------------
    // CONNECT WALLET
    // ----------------------------------------------------------

    const {
      contract,
      signer,
    } =
      await getContractWithSigner();

    const seller =
      await signer.getAddress();

    // ----------------------------------------------------------
    // PRICE
    // ----------------------------------------------------------

    const price =
      ethers.parseEther(
        priceEth.toString()
      );

    if (
      price <= 0n
    ) {
      throw new Error(
        "Price must be greater than zero."
      );
    }

    // ----------------------------------------------------------
    // DURATION
    // ----------------------------------------------------------

    if (
      Number(durationDays) <= 0
    ) {
      throw new Error(
        "License duration must be greater than zero."
      );
    }

    const duration =
      BigInt(
        Math.floor(
          Number(durationDays) *
          24 *
          60 *
          60
        )
      );

    // ----------------------------------------------------------
    // CONVERT USER PERCENTAGES TO BPS
    //
    // Solidity expects the shares to total 9500.
    //
    // User enters:
    //
    // Creator       70%
    // Collaborator  30%
    //
    // We convert to:
    //
    // Creator       6650 BPS
    // Collaborator  2850 BPS
    //
    // Total = 9500 BPS
    // ----------------------------------------------------------

    const royaltyShares =
      royaltyPercentages.map(
        (percentage) => {

          const share =
            Math.round(
              Number(
                percentage
              ) * 95 * 100
            );

          return BigInt(
            share
          );
        }
      );

    // ----------------------------------------------------------
    // FINAL BPS VALIDATION
    // ----------------------------------------------------------

    const totalBps =
      royaltyShares.reduce(
        (
          total,
          current
        ) =>
          total + current,
        0n
      );

    if (
      totalBps !== 9500n
    ) {
      throw new Error(
        "Royalty shares must total exactly 9500 BPS."
      );
    }

    // ----------------------------------------------------------
    // LOG DETAILS
    // ----------------------------------------------------------

    console.log(
      "========================================"
    );

    console.log(
      "Listing TrueAuthor work"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Work hash:",
      normalizedHash
    );

    console.log(
      "Seller:",
      seller
    );

    console.log(
      "Price:",
      priceEth,
      "ETH"
    );

    console.log(
      "Duration:",
      durationDays,
      "days"
    );

    console.log(
      "Platform fee:",
      "5%"
    );

    console.log(
      "Creator pool:",
      "95%"
    );

    console.log(
      "Royalty accounts:",
      royaltyAccounts
    );

    console.log(
      "User royalty percentages:",
      royaltyPercentages
    );

    console.log(
      "Blockchain royalty shares:",
      royaltyShares.map(
        (value) =>
          value.toString()
      )
    );

    // ----------------------------------------------------------
    // SEND TRANSACTION
    // ----------------------------------------------------------

    const transaction =
      await contract.listWork(
        normalizedHash,
        price,
        duration,
        royaltyAccounts,
        royaltyShares
      );

    console.log(
      "Listing transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    console.log(
      "✅ Work listed successfully"
    );

    return {

      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,

      seller,

      price,

      duration,

      platformFeeBps:
        500n,

      creatorPoolBps:
        9500n,

      royaltyAccounts,

      royaltyShares,
    };
  };

// ============================================================
// CANCEL LICENSE OFFER
// ============================================================

export const cancelLicenseOffer =
  async (
    workHash
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const {
      contract,
    } =
      await getContractWithSigner();

    const transaction =
      await contract.cancelLicense(
        normalizedHash
      );

    console.log(
      "Cancel transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    console.log(
      "✅ License offer cancelled"
    );

    return {

      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,
    };
  };

// ============================================================
// GET LICENSE OFFER
// ============================================================

export const getLicenseOfferFromBlockchain =
  async (
    workHash
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    const result =
      await contract.getLicenseOffer(
        normalizedHash
      );

    return {

      seller:
        result[0],

      price:
        result[1],

      duration:
        result[2],

      totalRoyaltyBps:
        result[3],

      active:
        result[4],
    };
  };

// ============================================================
// GET ROYALTY SHARES
// ============================================================

export const getRoyaltySharesFromBlockchain =
  async (
    workHash
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    const result =
      await contract.getRoyaltyShares(
        normalizedHash
      );

    const accounts =
      result[0];

    const shares =
      result[1];

    return {

      accounts,

      shares,

      // Convert the 95% pool shares back into
      // percentages of the creator pool.
      percentages:
        shares.map(
          (share) =>
            Number(
              share
            ) / 95
        ),
    };
  };

// ============================================================
// GET PLATFORM FEE
// ============================================================

export const getPlatformFee =
  async () => {

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    const fee =
      await contract.PLATFORM_FEE_BPS();

    return {

      bps:
        fee,

      percentage:
        Number(fee) / 100,
    };
  };

// ============================================================
// GET CREATOR POOL
// ============================================================

export const getCreatorPool =
  async () => {

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    const pool =
      await contract.CREATOR_POOL_BPS();

    return {

      bps:
        pool,

      percentage:
        Number(pool) / 100,
    };
  };

// ============================================================
// GET PLATFORM WALLET
// ============================================================

export const getPlatformWallet =
  async () => {

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    return await contract.platformWallet();
  };

// ============================================================
// PURCHASE LICENSE
// ============================================================

export const purchaseLicense =
  async (
    workHash,
    price
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const {
      contract,
      signer,
    } =
      await getContractWithSigner();

    const buyer =
      await signer.getAddress();

    // ----------------------------------------------------------
    // PRICE CAN BE:
    //
    // 1. BigInt
    // 2. BigNumber-compatible value
    // 3. ETH string
    // ----------------------------------------------------------

    let paymentValue;

    if (
      typeof price === "string"
    ) {

      paymentValue =
        ethers.parseEther(
          price
        );

    } else {

      paymentValue =
        price;
    }

    console.log(
      "Purchasing license..."
    );

    console.log(
      "Buyer:",
      buyer
    );

    console.log(
      "Work:",
      normalizedHash
    );

    console.log(
      "Payment:",
      ethers.formatEther(
        paymentValue
      ),
      "ETH"
    );

    const transaction =
      await contract.purchaseLicense(
        normalizedHash,
        {
          value:
            paymentValue,
        }
      );

    console.log(
      "Purchase transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    console.log(
      "✅ License purchased successfully"
    );

    return {

      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,

      buyer,
    };
  };

// ============================================================
// CHECK LICENSE
// ============================================================

export const checkValidLicense =
  async (
    workHash,
    userAddress
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    return await contract.hasValidLicense(
      normalizedHash,
      userAddress
    );
  };

// ============================================================
// GET USER LICENSE
// ============================================================

export const getUserLicense =
  async (
    workHash,
    userAddress
  ) => {

    const normalizedHash =
      normalizeWorkHash(workHash);

    const provider =
      getMetaMaskProvider();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    const result =
      await contract.getLicense(
        normalizedHash,
        userAddress
      );

    return {

      licensee:
        result[0],

      licensor:
        result[1],

      pricePaid:
        result[2],

      startTime:
        result[3],

      expiryTime:
        result[4],

      exists:
        result[5],

      active:
        result[6],
    };
  };

// ============================================================
// FORMAT ETH
// ============================================================

export const formatEth =
  (value) => {

    if (
      value === undefined ||
      value === null
    ) {
      return "0";
    }

    try {

      return ethers.formatEther(
        value
      );

    } catch {

      return "0";
    }
  };

// ============================================================
// FORMAT BPS
// ============================================================

export const formatBpsAsPercentage =
  (bps) => {

    if (
      bps === undefined ||
      bps === null
    ) {
      return "0%";
    }

    return `${Number(bps) / 100}%`;
  };