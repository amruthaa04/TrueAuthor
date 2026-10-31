const {
  registerWorkOnBlockchain,
  verifyWorkOnBlockchain,
} = require("./services/blockchainService");

const test = async () => {
  try {
    console.log("=================================");
    console.log("Testing Backend Blockchain Service");
    console.log("=================================");

    const workHash =
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const ipfsCid = "QmBackendTestCID123";

    // Register work
    console.log("\nRegistering work...");

    const registration =
      await registerWorkOnBlockchain(
        workHash,
        ipfsCid
      );

    console.log(
      "Transaction Hash:",
      registration.transactionHash
    );

    console.log(
      "Block Number:",
      registration.blockNumber
    );

    console.log(
      "Owner:",
      registration.owner
    );

    // Verify work
    console.log("\nVerifying work...");

    const verification =
      await verifyWorkOnBlockchain(workHash);

    console.log("=================================");
    console.log("Verification Result");
    console.log("=================================");

    console.log(
      "Exists:",
      verification.exists
    );

    console.log(
      "IPFS CID:",
      verification.ipfsCid
    );

    console.log(
      "Owner:",
      verification.owner
    );

    console.log(
      "Timestamp:",
      verification.timestamp
    );

    console.log("=================================");

  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.message
    );
  }
};

test();