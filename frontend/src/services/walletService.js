import { ethers } from "ethers";

// ============================================================
// TRUEAUTHOR SMART CONTRACT
// ============================================================

// IMPORTANT:
// This must match the contract address from your latest deployment.
//
// Latest deployment:
// 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

export const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// ============================================================
// CONTRACT ABI
// ============================================================

const CONTRACT_ABI = [

  // ----------------------------------------------------------
  // REGISTER WORK
  // ----------------------------------------------------------

  "function registerWork(bytes32 workHash, string calldata ipfsCid) external",

  // ----------------------------------------------------------
  // VERIFY WORK
  // ----------------------------------------------------------

  "function verifyWork(bytes32 workHash) external view returns (bool exists, string memory ipfsCid, address owner, uint256 timestamp)",

  // ----------------------------------------------------------
  // GET CREATOR
  // ----------------------------------------------------------

  "function getWorkCreator(bytes32 workHash) external view returns (address creator)",

  // ----------------------------------------------------------
  // MARKETPLACE
  // ----------------------------------------------------------

  "function listWork(bytes32 workHash, uint256 price, uint256 royaltyBps) external",

  "function cancelListing(bytes32 workHash) external",

  "function getListing(bytes32 workHash) external view returns (address seller, uint256 price, uint256 royaltyBps, bool active)",

  "function buyWork(bytes32 workHash) external payable",
];

// ============================================================
// CHECK METAMASK
// ============================================================

const checkMetaMask = () => {

  if (!window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install MetaMask first."
    );
  }
};

// ============================================================
// CONNECT WALLET
// ============================================================

export const connectWallet = async () => {

  checkMetaMask();

  // Ask MetaMask to connect
  const accounts =
    await window.ethereum.request({
      method: "eth_requestAccounts",
    });

  if (!accounts || accounts.length === 0) {
    throw new Error(
      "No MetaMask account found."
    );
  }

  // Create ethers provider
  const provider =
    new ethers.BrowserProvider(
      window.ethereum
    );

  // Get current network
  const network =
    await provider.getNetwork();

  console.log(
    "Connected wallet:",
    accounts[0]
  );

  console.log(
    "Chain ID:",
    network.chainId.toString()
  );

  // TrueAuthor currently uses Hardhat local network
  if (network.chainId !== 31337n) {

    throw new Error(
      "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
    );
  }

  return {

    address:
      accounts[0],

    chainId:
      network.chainId.toString(),

  };
};

// ============================================================
// REGISTER WORK USING METAMASK
// ============================================================

export const registerWorkWithMetaMask =
  async (
    fileHash,
    ipfsCid
  ) => {

    checkMetaMask();

    // --------------------------------------------------------
    // PROVIDER
    // --------------------------------------------------------

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    // --------------------------------------------------------
    // CHECK NETWORK
    // --------------------------------------------------------

    const network =
      await provider.getNetwork();

    console.log(
      "MetaMask Chain ID:",
      network.chainId.toString()
    );

    if (network.chainId !== 31337n) {

      throw new Error(
        "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
      );
    }

    // --------------------------------------------------------
    // SIGNER
    // --------------------------------------------------------

    const signer =
      await provider.getSigner();

    const owner =
      await signer.getAddress();

    console.log(
      "Wallet:",
      owner
    );

    // --------------------------------------------------------
    // CONTRACT
    // --------------------------------------------------------

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

    // --------------------------------------------------------
    // NORMALIZE FILE HASH
    // --------------------------------------------------------

    let workHash = fileHash;

    // If backend sends SHA-256 without 0x,
    // add 0x because Solidity bytes32 requires it.

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    // Validate bytes32 hash
    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    console.log(
      "================================="
    );

    console.log(
      "Registering work with MetaMask..."
    );

    console.log(
      "Contract:",
      CONTRACT_ADDRESS
    );

    console.log(
      "Wallet:",
      owner
    );

    console.log(
      "Work Hash:",
      workHash
    );

    console.log(
      "IPFS CID:",
      ipfsCid
    );

    console.log(
      "================================="
    );

    // --------------------------------------------------------
    // SEND TRANSACTION
    // --------------------------------------------------------

    const transaction =
      await contract.registerWork(
        workHash,
        ipfsCid
      );

    console.log(
      "Transaction submitted:",
      transaction.hash
    );

    // --------------------------------------------------------
    // WAIT FOR CONFIRMATION
    // --------------------------------------------------------

    const receipt =
      await transaction.wait();

    console.log(
      "Blockchain transaction confirmed."
    );

    console.log(
      "Block number:",
      receipt.blockNumber
    );

    // --------------------------------------------------------
    // RETURN RESULT
    // --------------------------------------------------------

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
    fileHash
  ) => {

    checkMetaMask();

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const network =
      await provider.getNetwork();

    if (network.chainId !== 31337n) {

      throw new Error(
        "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
      );
    }

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    let workHash =
      fileHash;

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    console.log(
      "Verifying work:",
      workHash
    );

    const result =
      await contract.verifyWork(
        workHash
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
    fileHash
  ) => {

    checkMetaMask();

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    let workHash =
      fileHash;

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    return await contract.getWorkCreator(
      workHash
    );
  };

// ============================================================
// LIST WORK FOR SALE
// ============================================================

export const listWorkOnBlockchain =
  async (
    fileHash,
    priceInEth,
    royaltyPercentage
  ) => {

    checkMetaMask();

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const network =
      await provider.getNetwork();

    if (network.chainId !== 31337n) {

      throw new Error(
        "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
      );
    }

    const signer =
      await provider.getSigner();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

    let workHash =
      fileHash;

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    // Convert ETH to wei
    const price =
      ethers.parseEther(
        priceInEth.toString()
      );

    // Example:
    // 10% -> 1000 basis points
    const royaltyBps =
      Math.round(
        Number(royaltyPercentage) * 100
      );

    if (
      royaltyBps < 0 ||
      royaltyBps > 10000
    ) {

      throw new Error(
        "Royalty must be between 0% and 100%."
      );
    }

    const transaction =
      await contract.listWork(
        workHash,
        price,
        royaltyBps
      );

    console.log(
      "Listing transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    return {

      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,

    };
  };

// ============================================================
// GET WORK LISTING
// ============================================================

export const getWorkListing =
  async (
    fileHash
  ) => {

    checkMetaMask();

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const network =
      await provider.getNetwork();

    if (network.chainId !== 31337n) {

      throw new Error(
        "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
      );
    }

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

    let workHash =
      fileHash;

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    const result =
      await contract.getListing(
        workHash
      );

    return {

      seller:
        result[0],

      price:
        ethers.formatEther(
          result[1]
        ),

      royaltyPercentage:
        Number(result[2]) / 100,

      active:
        result[3],

    };
  };

// ============================================================
// BUY WORK
// ============================================================

export const buyWorkOnBlockchain =
  async (
    fileHash,
    priceInEth
  ) => {

    checkMetaMask();

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const network =
      await provider.getNetwork();

    if (network.chainId !== 31337n) {

      throw new Error(
        "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
      );
    }

    const signer =
      await provider.getSigner();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

    let workHash =
      fileHash;

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    const price =
      ethers.parseEther(
        priceInEth.toString()
      );

    const transaction =
      await contract.buyWork(
        workHash,
        {
          value: price,
        }
      );

    console.log(
      "Purchase transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    return {

      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,

    };
  };

// ============================================================
// CANCEL LISTING
// ============================================================

export const cancelListingOnBlockchain =
  async (
    fileHash
  ) => {

    checkMetaMask();

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const network =
      await provider.getNetwork();

    if (network.chainId !== 31337n) {

      throw new Error(
        "Please switch MetaMask to the Hardhat Local network (Chain ID 31337)."
      );
    }

    const signer =
      await provider.getSigner();

    const contract =
      new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

    let workHash =
      fileHash;

    if (
      typeof workHash === "string" &&
      !workHash.startsWith("0x")
    ) {

      workHash =
        `0x${workHash}`;
    }

    if (
      !ethers.isHexString(
        workHash,
        32
      )
    ) {

      throw new Error(
        "Invalid file hash. Expected a 32-byte SHA-256 hash."
      );
    }

    const transaction =
      await contract.cancelListing(
        workHash
      );

    console.log(
      "Cancel listing transaction:",
      transaction.hash
    );

    const receipt =
      await transaction.wait();

    return {

      transactionHash:
        transaction.hash,

      blockNumber:
        receipt.blockNumber,

    };
  };