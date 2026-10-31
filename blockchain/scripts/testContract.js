import { JsonRpcProvider, Contract } from "ethers";
import { readFileSync } from "fs";

// Connect to local Hardhat blockchain
const provider = new JsonRpcProvider("http://127.0.0.1:8545");

// Contract address from our deployment
const contractAddress =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Read ABI from compiled contract
const artifact = JSON.parse(
  readFileSync(
    "./artifacts/contracts/TrueAuthor.sol/TrueAuthor.json",
    "utf8"
  )
);

// Connect to deployed contract
const contract = new Contract(
  contractAddress,
  artifact.abi,
  provider
);

// Test SHA-256 hash
const workHash =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

// Test IPFS CID
const ipfsCid = "QmTestCID123456789";

// Get a Hardhat account
const accounts = await provider.send("eth_accounts", []);
const signer = await provider.getSigner(accounts[0]);

// Connect contract with signer for transactions
const contractWithSigner = contract.connect(signer);

console.log("=================================");
console.log("Testing TrueAuthor Smart Contract");
console.log("=================================");

console.log("Account:", accounts[0]);

// ==================== REGISTER WORK ====================

console.log("\nRegistering work...");

const tx = await contractWithSigner.registerWork(
  workHash,
  ipfsCid
);

console.log("Transaction Hash:", tx.hash);

await tx.wait();

console.log("✅ Work registered successfully");

// ==================== VERIFY WORK ====================

console.log("\nVerifying work...");

const result = await contract.verifyWork(workHash);

console.log("=================================");
console.log("Verification Result");
console.log("=================================");

console.log("Exists:", result[0]);
console.log("IPFS CID:", result[1]);
console.log("Owner:", result[2]);
console.log("Timestamp:", result[3].toString());

console.log("=================================");