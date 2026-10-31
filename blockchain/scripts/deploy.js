import { network } from "hardhat";

async function main() {
  // ============================================================
  // CONNECT TO HARDHAT NETWORK
  // ============================================================

  const { ethers } = await network.connect();

  // ============================================================
  // GET DEPLOYER
  // ============================================================

  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying from:",
    deployer.address
  );

  // ============================================================
  // PLATFORM WALLET
  // ============================================================

  const platformWallet =
    deployer.address;

  console.log(
    "Platform wallet:",
    platformWallet
  );

  // ============================================================
  // GET CONTRACT
  // ============================================================

  const TrueAuthor =
    await ethers.getContractFactory(
      "TrueAuthor"
    );

  console.log(
    "Deploying TrueAuthor contract..."
  );

  // ============================================================
  // DEPLOY CONTRACT
  // ============================================================

  const trueAuthor =
    await TrueAuthor.deploy(
      platformWallet
    );

  // ============================================================
  // WAIT FOR DEPLOYMENT
  // ============================================================

  await trueAuthor.waitForDeployment();

  const contractAddress =
    await trueAuthor.getAddress();

  // ============================================================
  // SUCCESS
  // ============================================================

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "TRUEAUTHOR DEPLOYMENT SUCCESSFUL"
  );
  console.log(
    "========================================"
  );

  console.log(
    "Contract address:",
    contractAddress
  );

  console.log(
    "Platform wallet:",
    platformWallet
  );

  console.log(
    "Network: localhost"
  );

  console.log(
    "========================================"
  );

  // ============================================================
  // CHECK ABI
  // ============================================================

  const artifact =
    await ethers.artifacts.readArtifact(
      "TrueAuthor"
    );

  const hasVerifyWork =
    artifact.abi.some(
      (item) =>
        item.type === "function" &&
        item.name === "verifyWork"
    );

  console.log(
    "ABI has verifyWork:",
    hasVerifyWork
  );

  // ============================================================
  // VERIFY PLATFORM WALLET
  // ============================================================

  const storedPlatformWallet =
    await trueAuthor.platformWallet();

  console.log(
    "Stored platform wallet:",
    storedPlatformWallet
  );

  if (
    storedPlatformWallet.toLowerCase() !==
    platformWallet.toLowerCase()
  ) {
    throw new Error(
      "Platform wallet verification failed."
    );
  }

  console.log(
    "✅ Platform wallet verified successfully."
  );
}

// ============================================================
// RUN
// ============================================================

main().catch((error) => {
  console.error(
    "An unexpected error occurred:"
  );

  console.error(error);

  process.exitCode = 1;
});