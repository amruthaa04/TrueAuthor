const fs = require("fs");
const { PinataSDK } = require("pinata");

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
});

// Upload a file to IPFS through Pinata
const uploadToIPFS = async (filePath, fileName) => {
  try {
    if (!process.env.PINATA_JWT) {
      throw new Error("PINATA_JWT is not configured");
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);

    const file = new File(
      [fileBuffer],
      fileName,
      {
        type: "application/octet-stream",
      }
    );

    const upload = await pinata.upload.public.file(file);

    console.log("✅ File uploaded to IPFS");
    console.log("CID:", upload.cid);

    return upload.cid;
  } catch (error) {
    console.error("❌ IPFS upload error:", error);
    throw error;
  }
};

module.exports = {
  uploadToIPFS,
};