const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ============================================================
// BLOCKCHAIN CONFIGURATION
// ============================================================

const RPC_URL = "http://127.0.0.1:8545";

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Mandatory platform fee = 5%
const PLATFORM_FEE_BPS = 500;

// Creator/collaborator pool = 95%
const CREATOR_POOL_BPS = 9500;

// ============================================================
// PROVIDER
// ============================================================

const provider =
  new ethers.JsonRpcProvider(RPC_URL);

// ============================================================
// CONTRACT ABI
// ============================================================

const artifactPath = path.join(
  __dirname,
  "../../blockchain/artifacts/contracts/TrueAuthor.sol/TrueAuthor.json"
);

const artifact = JSON.parse(
  fs.readFileSync(
    artifactPath,
    "utf8"
  )
);

console.log(
  "TrueAuthor Contract Address:",
  CONTRACT_ADDRESS
);

// ============================================================
// CHECK BLOCKCHAIN CONNECTION
// ============================================================

provider
  .getCode(CONTRACT_ADDRESS)
  .then((code) => {

    console.log(
      "Code at address:",
      code === "0x"
        ? "NOTHING DEPLOYED"
        : "contract found"
    );

  })
  .catch((err) => {

    console.log(
      "Cannot reach blockchain node:",
      err.message
    );

  });

// ============================================================
// CONTRACT INSTANCE
// ============================================================

const contract =
  new ethers.Contract(
    CONTRACT_ADDRESS,
    artifact.abi,
    provider
  );

// ============================================================
// GET BLOCKCHAIN SIGNER
// ============================================================

const getSigner = async () => {

  const accounts =
    await provider.send(
      "eth_accounts",
      []
    );

  if (
    !accounts ||
    accounts.length === 0
  ) {

    throw new Error(
      "No blockchain account available"
    );
  }

  return {

    signer:
      await provider.getSigner(
        accounts[0]
      ),

    account:
      accounts[0],
  };
};

// ============================================================
// REGISTER WORK
// ============================================================

const registerWorkOnBlockchain =
  async (
    workHash,
    ipfsCid
  ) => {

    try {

      const {
        signer,
        account,
      } = await getSigner();

      const contractWithSigner =
        contract.connect(
          signer
        );

      console.log(
        "Registering work on blockchain..."
      );

      const transaction =
        await contractWithSigner.registerWork(
          workHash,
          ipfsCid
        );

      console.log(
        "Blockchain transaction:",
        transaction.hash
      );

      const receipt =
        await transaction.wait();

      console.log(
        "✅ Blockchain registration confirmed"
      );

      return {

        transactionHash:
          transaction.hash,

        blockNumber:
          receipt.blockNumber,

        owner:
          account,

      };

    } catch (error) {

      console.error(
        "❌ Blockchain registration error:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// VERIFY WORK
// ============================================================

const verifyWorkOnBlockchain =
  async (
    workHash
  ) => {

    try {

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

    } catch (error) {

      console.error(
        "❌ Blockchain verification error:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// GET WORK CREATOR
// ============================================================

const getWorkCreatorOnBlockchain =
  async (
    workHash
  ) => {

    try {

      const creator =
        await contract.getWorkCreator(
          workHash
        );

      return creator;

    } catch (error) {

      console.error(
        "❌ Error getting work creator:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// LIST WORK FOR LICENSE
// ============================================================
//
// royaltyAccounts:
// [
//   ownerWallet,
//   collaboratorWallet1,
//   collaboratorWallet2
// ]
//
// royaltyShares:
// [
//   7000,
//   2000,
//   500
// ]
//
// Total MUST equal 9500 = 95%
//
// The remaining 500 = 5% platform fee.
//

const listWorkForLicense =
  async (
    workHash,
    price,
    duration,
    royaltyAccounts,
    royaltyShares
  ) => {

    try {

      const {
        signer,
        account,
      } = await getSigner();

      // ========================================================
      // VALIDATE ROYALTY DATA
      // ========================================================

      if (
        !Array.isArray(
          royaltyAccounts
        ) ||
        !Array.isArray(
          royaltyShares
        )
      ) {

        throw new Error(
          "Royalty accounts and royalty shares must be arrays."
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
        royaltyShares.length
      ) {

        throw new Error(
          "Royalty accounts and royalty shares must have the same length."
        );
      }

      // ========================================================
      // CONVERT SHARES TO BIGINT
      // ========================================================

      const normalizedShares =
        royaltyShares.map(
          (share) =>
            BigInt(
              String(share)
            )
        );

      // ========================================================
      // CHECK TOTAL
      // ========================================================

      const totalShares =
        normalizedShares.reduce(
          (
            total,
            share
          ) =>
            total + share,
          0n
        );

      if (
        totalShares !==
        BigInt(CREATOR_POOL_BPS)
      ) {

        throw new Error(
          "Royalty shares must total exactly 95% (9500 basis points)."
        );
      }

      // ========================================================
      // CHECK ACCOUNTS
      // ========================================================

      const normalizedAccounts =
        royaltyAccounts.map(
          (address) => {

            if (
              !ethers.isAddress(
                address
              )
            ) {

              throw new Error(
                `Invalid royalty wallet address: ${address}`
              );
            }

            return ethers.getAddress(
              address
            );
          }
        );

      // ========================================================
      // PREVENT DUPLICATE WALLETS
      // ========================================================

      const uniqueAccounts =
        new Set(
          normalizedAccounts.map(
            (address) =>
              address.toLowerCase()
          )
        );

      if (
        uniqueAccounts.size !==
        normalizedAccounts.length
      ) {

        throw new Error(
          "Duplicate royalty wallet addresses are not allowed."
        );
      }

      // ========================================================
      // CONVERT PRICE
      // ========================================================

      const normalizedPrice =
        BigInt(
          String(price)
        );

      if (
        normalizedPrice <= 0n
      ) {

        throw new Error(
          "Price must be greater than zero."
        );
      }

      // ========================================================
      // CONVERT DURATION
      // ========================================================

      const normalizedDuration =
        BigInt(
          String(duration)
        );

      if (
        normalizedDuration <= 0n
      ) {

        throw new Error(
          "License duration must be greater than zero."
        );
      }

      // ========================================================
      // LOG DISTRIBUTION
      // ========================================================

      console.log(
        "=========================================="
      );

      console.log(
        "Creating license offer..."
      );

      console.log(
        "Seller:",
        account
      );

      console.log(
        "Price:",
        normalizedPrice.toString()
      );

      console.log(
        "Duration:",
        normalizedDuration.toString()
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
        "Royalty recipients:"
      );

      normalizedAccounts.forEach(
        (
          address,
          index
        ) => {

          console.log(
            `  ${address} -> ${normalizedShares[index].toString()} BPS`
          );

        }
      );

      console.log(
        "=========================================="
      );

      // ========================================================
      // CONNECT SIGNER
      // ========================================================

      const contractWithSigner =
        contract.connect(
          signer
        );

      // ========================================================
      // CREATE LICENSE OFFER
      // ========================================================

      const transaction =
        await contractWithSigner.listWork(
          workHash,
          normalizedPrice,
          normalizedDuration,
          normalizedAccounts,
          normalizedShares
        );

      console.log(
        "License listing transaction:",
        transaction.hash
      );

      const receipt =
        await transaction.wait();

      console.log(
        "✅ License offer created"
      );

      // ========================================================
      // RETURN RESULT
      // ========================================================

      return {

        transactionHash:
          transaction.hash,

        blockNumber:
          receipt.blockNumber,

        seller:
          account,

        price:
          normalizedPrice.toString(),

        duration:
          normalizedDuration.toString(),

        platformFeeBps:
          PLATFORM_FEE_BPS.toString(),

        platformFeePercent:
          "5",

        creatorPoolBps:
          CREATOR_POOL_BPS.toString(),

        creatorPoolPercent:
          "95",

        royaltyAccounts:
          normalizedAccounts,

        royaltyShares:
          normalizedShares.map(
            (share) =>
              share.toString()
          ),

      };

    } catch (error) {

      console.error(
        "❌ License listing error:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// CANCEL LICENSE OFFER
// ============================================================

const cancelLicenseOffer =
  async (
    workHash
  ) => {

    try {

      const {
        signer,
      } = await getSigner();

      const contractWithSigner =
        contract.connect(
          signer
        );

      console.log(
        "Cancelling license offer..."
      );

      const transaction =
        await contractWithSigner.cancelLicense(
          workHash
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

    } catch (error) {

      console.error(
        "❌ License cancellation error:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// GET LICENSE OFFER
// ============================================================

const getLicenseOffer =
  async (
    workHash
  ) => {

    try {

      const result =
        await contract.getLicenseOffer(
          workHash
        );

      return {

        seller:
          result[0],

        price:
          result[1].toString(),

        duration:
          result[2].toString(),

        // New contract always has a 95%
        // creator royalty pool.
        creatorPoolBps:
          result[3].toString(),

        creatorPoolPercent:
          "95",

        active:
          result[4],

        platformFeeBps:
          PLATFORM_FEE_BPS.toString(),

        platformFeePercent:
          "5",

      };

    } catch (error) {

      console.error(
        "❌ Error getting license offer:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// GET ROYALTY SHARES
// ============================================================

const getRoyaltyShares =
  async (
    workHash
  ) => {

    try {

      const result =
        await contract.getRoyaltyShares(
          workHash
        );

      const accounts =
        result[0];

      const shares =
        result[1];

      return {

        accounts,

        shares:
          shares.map(
            (share) =>
              share.toString()
          ),

        totalBps:
          shares
            .reduce(
              (
                total,
                share
              ) =>
                total +
                BigInt(
                  share.toString()
                ),
              0n
            )
            .toString(),

        creatorPoolBps:
          CREATOR_POOL_BPS.toString(),

        platformFeeBps:
          PLATFORM_FEE_BPS.toString(),

      };

    } catch (error) {

      console.error(
        "❌ Error getting royalty shares:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// CHECK VALID LICENSE
// ============================================================

const hasValidLicense =
  async (
    workHash,
    userAddress
  ) => {

    try {

      const result =
        await contract.hasValidLicense(
          workHash,
          userAddress
        );

      return result;

    } catch (error) {

      console.error(
        "❌ License verification error:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// GET LICENSE DETAILS
// ============================================================

const getLicense =
  async (
    workHash,
    userAddress
  ) => {

    try {

      const result =
        await contract.getLicense(
          workHash,
          userAddress
        );

      return {

        licensee:
          result[0],

        licensor:
          result[1],

        pricePaid:
          result[2].toString(),

        startTime:
          result[3].toString(),

        expiryTime:
          result[4].toString(),

        exists:
          result[5],

        active:
          result[6],

      };

    } catch (error) {

      console.error(
        "❌ Error getting license:",
        error.message
      );

      throw error;
    }
  };

// ============================================================
// GET CONTRACT
// ============================================================

const getContract =
  () => {

    return contract;

  };

// ============================================================
// EXPORT
// ============================================================

module.exports = {

  // Work registration
  registerWorkOnBlockchain,
  verifyWorkOnBlockchain,

  // Work information
  getWorkCreatorOnBlockchain,

  // Licensing
  listWorkForLicense,
  cancelLicenseOffer,
  getLicenseOffer,
  getRoyaltyShares,

  // License verification
  hasValidLicense,
  getLicense,

  // Contract
  getContract,

  // Configuration
  CONTRACT_ADDRESS,
  PLATFORM_FEE_BPS,
  CREATOR_POOL_BPS,

};