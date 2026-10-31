
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const Work = require("../models/Work");

const AI_URL = (process.env.TRUEAUTHOR_AI_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const SIMILARITY_THRESHOLD = Number(process.env.TRUEAUTHOR_SIMILARITY_THRESHOLD || 30);
const IMAGE_HASH_THRESHOLD = Number(process.env.TRUEAUTHOR_IMAGE_HASH_THRESHOLD || 90);

const getAbsoluteFilePath = (filePath) => {
  if (!filePath) return null;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(__dirname, "..", filePath);
};

const getAiEmbedding = async (endpoint, filePath) => {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required for fetch().");
  }

  const response = await fetch(`${AI_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path.resolve(filePath) }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `AI service ${endpoint} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.embedding) && !Array.isArray(data.embeddings)) {
    throw new Error(`AI service ${endpoint} returned no embedding.`);
  }

  return data;
};

const getTextEmbedding = async (text) => {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required for fetch().");
  }

  const response = await fetch(`${AI_URL}/analyze-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`AI service /analyze-text returned HTTP ${response.status}.`);
  }

  const data = await response.json();

  if (!Array.isArray(data.embedding)) {
    throw new Error("AI service /analyze-text returned no embedding.");
  }

  return data.embedding;
};

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;

  return Math.max(-1, Math.min(1, dot / Math.sqrt(normA * normB)));
};

// ============================================================
// IMAGE - PERCEPTUAL HASH
// ============================================================

const generatePerceptualHash = async (filePath) => {
  const size = 32;

  const imageBuffer = await sharp(filePath)
    .resize(size, size, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  const dctValues = [];

  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum +=
            imageBuffer[x * size + y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }

      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;

      dctValues.push(0.25 * cu * cv * sum);
    }
  }

  const values = dctValues.slice(1).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];

  return dctValues.map((value) => (value > median ? "1" : "0")).join("");
};

const calculateHashSimilarity = (hash1, hash2) => {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;

  let differentBits = 0;

  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differentBits++;
  }

  return Number(((1 - differentBits / hash1.length) * 100).toFixed(2));
};

const getExistingWorks = async (regex) => {
  return Work.find({ fileType: { $regex: regex } });
};

// ============================================================
// IMAGE - AI + PERCEPTUAL HASH SIMILARITY
// ============================================================

const calculateImageSimilarity = async (filePath, currentHash) => {
  const exactMatch = await Work.findOne({ fileHash: currentHash });

  if (exactMatch) {
    return { similarityScore: 100, isSimilar: true, existingWork: exactMatch };
  }

  const existingWorks = await getExistingWorks(/^image\//i);

  if (!existingWorks.length) {
    return { similarityScore: 0, isSimilar: false, existingWork: null };
  }

  let currentPerceptualHash = null;
  let currentEmbedding = null;

  try {
    currentPerceptualHash = await generatePerceptualHash(filePath);
  } catch (error) {
    console.warn("Could not generate image perceptual hash:", error.message);
  }

  try {
    currentEmbedding = (
      await getAiEmbedding("/analyze-image-path", filePath)
    ).embedding;
  } catch (error) {
    console.warn("Image AI unavailable; using perceptual hash:", error.message);
  }

  let highestSimilarity = 0;
  let mostSimilarWork = null;

  for (const work of existingWorks) {
    const existingFilePath = getAbsoluteFilePath(work.filePath);

    if (!existingFilePath || !fs.existsSync(existingFilePath)) continue;

    let hashScore = 0;
    let aiScore = null;

    try {
      if (currentPerceptualHash) {
        const existingHash = await generatePerceptualHash(existingFilePath);
        hashScore = calculateHashSimilarity(currentPerceptualHash, existingHash);
      }
    } catch (error) {
      console.warn(`Image hash comparison failed for "${work.title}":`, error.message);
    }

    if (currentEmbedding) {
      try {
        const existingEmbedding = (
          await getAiEmbedding("/analyze-image-path", existingFilePath)
        ).embedding;

        aiScore =
          Math.max(0, cosineSimilarity(currentEmbedding, existingEmbedding)) * 100;
      } catch (error) {
        console.warn(`Image AI comparison failed for "${work.title}":`, error.message);
      }
    }

    // CLIP similarity is diagnostic only here. Similar subject matter alone
    // is not sufficient evidence that an image was copied.
    console.log(
      `IMAGE "${work.title}": hash=${hashScore.toFixed(2)}%, ` +
      `AI-cosine=${aiScore === null ? "unavailable" : aiScore.toFixed(2) + "%"}`
    );

    if (hashScore > highestSimilarity) {
      highestSimilarity = hashScore;
      mostSimilarWork = work;
    }
  }

  return {
    similarityScore: Number(highestSimilarity.toFixed(2)),
    isSimilar: highestSimilarity >= IMAGE_HASH_THRESHOLD,
    existingWork: mostSimilarWork,
  };
};

// ============================================================
// VIDEO - DURATION AND FRAME EXTRACTION
// ============================================================

const getVideoDuration = (filePath) =>
  new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ["-i", filePath],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stderr || ""}\n${stdout || ""}`;
        const match = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);

        if (!match) {
          return reject(new Error("Could not determine media duration."));
        }

        resolve(
          Number(match[1]) * 3600 +
          Number(match[2]) * 60 +
          Number(match[3])
        );
      }
    );
  });

const extractVideoFrame = (videoPath, timestamp, outputPath) =>
  new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        "-ss", String(timestamp),
        "-i", videoPath,
        "-frames:v", "1",
        "-vf", "scale=320:320",
        "-y", outputPath,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
      (error) => {
        if (error) return reject(error);
        resolve(outputPath);
      }
    );
  });

const generateVideoFrames = async (videoPath) => {
  const duration = await getVideoDuration(videoPath);
  if (!duration || duration <= 0) return [];

  const frameDirectory = path.join(__dirname, "..", "uploads", "video_frames");
  fs.mkdirSync(frameDirectory, { recursive: true });

  const frames = [];
  const frameCount = 10;

  for (let i = 0; i < frameCount; i++) {
    const timestamp = duration * ((i + 1) / (frameCount + 1));
    const framePath = path.join(
      frameDirectory,
      `frame_${Date.now()}_${Math.random().toString(36).slice(2)}_${i}.jpg`
    );

    try {
      await extractVideoFrame(videoPath, timestamp, framePath);
      if (fs.existsSync(framePath)) frames.push(framePath);
    } catch (error) {
      console.warn(`Could not extract video frame ${i}:`, error.message);
    }
  }

  return frames;
};

const getNormalizedFrame = async (framePath, flipMode = null) => {
  let image = sharp(framePath).resize(64, 64, { fit: "fill" }).grayscale();

  if (flipMode === "horizontal") image = image.flop();
  if (flipMode === "vertical") image = image.flip();

  return image.raw().toBuffer();
};

const calculatePixelSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;

  let totalDifference = 0;

  for (let i = 0; i < a.length; i++) {
    totalDifference += Math.abs(a[i] - b[i]);
  }

  return Math.max(
    0,
    Math.min(100, (1 - totalDifference / (255 * a.length)) * 100)
  );
};

const calculateCorrelationSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;

  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;

  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i] - meanA;
    const y = b[i] - meanB;

    numerator += x * y;
    denominatorA += x * x;
    denominatorB += y * y;
  }

  if (!denominatorA || !denominatorB) return 0;

  const correlation = numerator / Math.sqrt(denominatorA * denominatorB);

  return Math.max(0, Math.min(100, ((correlation + 1) / 2) * 100));
};

const compareFrames = async (currentFrame, existingFrame) => {
  const currentBuffer = await getNormalizedFrame(currentFrame);

  const candidates = [
    await getNormalizedFrame(existingFrame),
    await getNormalizedFrame(existingFrame, "horizontal"),
    await getNormalizedFrame(existingFrame, "vertical"),
  ];

  let bestScore = 0;

  for (const existingBuffer of candidates) {
    const pixelScore = calculatePixelSimilarity(currentBuffer, existingBuffer);
    const correlationScore = calculateCorrelationSimilarity(currentBuffer, existingBuffer);
    const score = pixelScore * 0.6 + correlationScore * 0.4;

    if (score > bestScore) bestScore = score;
  }

  return bestScore;
};

const calculateVideoSimilarity = async (currentVideoPath, existingVideoPath) => {
  let currentFrames = [];
  let existingFrames = [];

  try {
    currentFrames = await generateVideoFrames(currentVideoPath);
    existingFrames = await generateVideoFrames(existingVideoPath);

    if (!currentFrames.length || !existingFrames.length) return 0;

    const frameScores = [];

    for (let i = 0; i < currentFrames.length; i++) {
      let bestScore = 0;

      for (const existingFrame of existingFrames) {
        try {
          const score = await compareFrames(currentFrames[i], existingFrame);
          if (score > bestScore) bestScore = score;
        } catch (error) {
          console.warn("Video frame comparison error:", error.message);
        }
      }

      frameScores.push(bestScore);
      console.log(`VIDEO frame ${i + 1}: ${bestScore.toFixed(2)}%`);
    }

    frameScores.sort((a, b) => b - a);

    const usefulCount = Math.max(1, Math.ceil(frameScores.length * 0.7));
    const usefulScores = frameScores.slice(0, usefulCount);

    const finalSimilarity =
      usefulScores.reduce((sum, score) => sum + score, 0) / usefulScores.length;

    console.log(`VIDEO FINAL SIMILARITY: ${finalSimilarity.toFixed(2)}%`);

    return Number(finalSimilarity.toFixed(2));
  } catch (error) {
    console.error("Video similarity error:", error);
    return 0;
  } finally {
    [...currentFrames, ...existingFrames].forEach((frame) => {
      try {
        if (fs.existsSync(frame)) fs.unlinkSync(frame);
      } catch (_) {}
    });
  }
};

// ============================================================
// AUDIO - SIGNATURE GENERATION AND COMPARISON
// ============================================================

const extractAudioSegment = (audioPath, timestamp, duration = 8) =>
  new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        "-ss", String(timestamp),
        "-i", audioPath,
        "-t", String(duration),
        "-ac", "1",
        "-ar", "8000",
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-",
      ],
      { encoding: null, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        if ((!stdout || !stdout.length) && error) return reject(error);
        if (!stdout || !stdout.length) {
          return reject(new Error("No audio data extracted."));
        }
        resolve(stdout);
      }
    );
  });

const createAudioSignature = (buffer) => {
  const sampleCount = Math.floor(buffer.length / 2);
  if (sampleCount < 100) return null;

  const samples = new Float32Array(sampleCount);
  let totalEnergy = 0;

  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buffer.readInt16LE(i * 2) / 32768;
    totalEnergy += Math.abs(samples[i]);
  }

  if (totalEnergy / sampleCount < 0.002) return null;

  const featureCount = 128;
  const rms = [];
  const zcr = [];
  const samplesPerFeature = Math.max(1, Math.floor(sampleCount / featureCount));

  for (let feature = 0; feature < featureCount; feature++) {
    const start = feature * samplesPerFeature;
    const end = Math.min(sampleCount, start + samplesPerFeature);

    if (start >= end) {
      rms.push(0);
      zcr.push(0);
      continue;
    }

    let energy = 0;
    let zeroCrossings = 0;

    for (let i = start; i < end; i++) {
      const sample = samples[i];
      energy += sample * sample;

      if (
        i > start &&
        ((samples[i - 1] < 0 && sample >= 0) ||
          (samples[i - 1] >= 0 && sample < 0))
      ) {
        zeroCrossings++;
      }
    }

    const count = end - start;
    rms.push(Math.sqrt(energy / count));
    zcr.push(zeroCrossings / count);
  }

  return { rms, zcr };
};

const calculateArrayCorrelation = (a, b) => {
  if (!a || !b || a.length !== b.length || !a.length) return 0;

  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;

  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i] - meanA;
    const y = b[i] - meanB;

    numerator += x * y;
    denominatorA += x * x;
    denominatorB += y * y;
  }

  if (!denominatorA || !denominatorB) return 0;

  return numerator / Math.sqrt(denominatorA * denominatorB);
};

const compareAudioSignatures = (a, b) => {
  if (!a || !b) return 0;

  const rmsSimilarity = Math.max(0, calculateArrayCorrelation(a.rms, b.rms)) * 100;
  const zcrSimilarity = Math.max(0, calculateArrayCorrelation(a.zcr, b.zcr)) * 100;

  return Math.max(0, Math.min(100, rmsSimilarity * 0.75 + zcrSimilarity * 0.25));
};

const generateAudioSignatures = async (audioPath) => {
  const duration = await getVideoDuration(audioPath);
  if (!duration || duration <= 0) return [];

  const segmentCount = 8;
  const segmentDuration = Math.min(8, Math.max(2, duration / segmentCount));
  const signatures = [];

  for (let i = 0; i < segmentCount; i++) {
    const timestamp = duration * ((i + 0.5) / segmentCount);

    try {
      const buffer = await extractAudioSegment(audioPath, timestamp, segmentDuration);
      const signature = createAudioSignature(buffer);
      if (signature) signatures.push(signature);
    } catch (error) {
      console.warn(`Could not analyze audio segment ${i}:`, error.message);
    }
  }

  return signatures;
};

const calculateAudioSimilarity = async (currentAudioPath, existingAudioPath) => {
  try {
    const currentSignatures = await generateAudioSignatures(currentAudioPath);
    const existingSignatures = await generateAudioSignatures(existingAudioPath);

    if (!currentSignatures.length || !existingSignatures.length) return 0;

    const scores = [];
    const count = Math.min(currentSignatures.length, existingSignatures.length);

    for (let i = 0; i < count; i++) {
      scores.push(
        compareAudioSignatures(currentSignatures[i], existingSignatures[i])
      );
    }

    const finalSimilarity = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    console.log(`FINAL AUDIO SIMILARITY: ${finalSimilarity.toFixed(2)}%`);

    return Number(finalSimilarity.toFixed(2));
  } catch (error) {
    console.error("Audio similarity error:", error);
    return 0;
  }
};

// ============================================================
// TEXT - AI EMBEDDINGS + LEXICAL SIMILARITY
// ============================================================

const readTextFile = async (filePath) => {
  return fs.promises.readFile(filePath, "utf8");
};

const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const createTextShingles = (text, size = 5) => {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const shingles = new Set();

  if (!words.length) return shingles;

  if (words.length < size) {
    shingles.add(words.join(" "));
    return shingles;
  }

  for (let i = 0; i <= words.length - size; i++) {
    shingles.add(words.slice(i, i + size).join(" "));
  }

  return shingles;
};

const calculateTextSimilarityScore = (text1, text2) => {
  const shingles1 = createTextShingles(text1);
  const shingles2 = createTextShingles(text2);

  if (!shingles1.size || !shingles2.size) return 0;

  let intersection = 0;

  for (const item of shingles1) {
    if (shingles2.has(item)) intersection++;
  }

  const union = new Set([...shingles1, ...shingles2]).size;

  if (!union) return 0;

  return Number(((intersection / union) * 100).toFixed(2));
};

const calculateTextSimilarity = async (filePath, currentHash) => {
  const exactMatch = await Work.findOne({ fileHash: currentHash });

  if (exactMatch) {
    return { similarityScore: 100, isSimilar: true, existingWork: exactMatch };
  }

  const currentText = await readTextFile(filePath);

  if (!currentText.trim()) {
    return { similarityScore: 0, isSimilar: false, existingWork: null };
  }

  const existingWorks = await Work.find({
    $or: [
      { fileType: { $regex: /^text\//i } },
      { fileName: { $regex: /\.(txt|md|csv|json|xml|html|htm)$/i } },
    ],
  });

  let highestSimilarity = 0;
  let mostSimilarWork = null;

  for (const work of existingWorks) {
    const existingFilePath = getAbsoluteFilePath(work.filePath);

    if (!existingFilePath || !fs.existsSync(existingFilePath)) continue;

    try {
      const existingText = await readTextFile(existingFilePath);
      const lexicalScore = calculateTextSimilarityScore(currentText, existingText);

      let semanticScore = null;

      try {
        const [currentEmbedding, existingEmbedding] = await Promise.all([
          getTextEmbedding(currentText),
          getAiEmbedding("/analyze-text-path", existingFilePath).then(
            (result) => result.embedding
          ),
        ]);

        semanticScore =
          Math.max(0, cosineSimilarity(currentEmbedding, existingEmbedding)) * 100;
      } catch (error) {
        console.warn("Text AI comparison failed:", error.message);
      }

      // Semantic score is logged for calibration; lexical overlap remains the
      // blocking score to avoid treating same-topic writing as copied text.
      const score = lexicalScore;

      console.log(
        `TEXT "${work.title}": lexical=${lexicalScore.toFixed(2)}%, ` +
        `AI-cosine=${semanticScore === null ? "unavailable" : semanticScore.toFixed(2) + "% (diagnostic only)"}`
      );

      if (score > highestSimilarity) {
        highestSimilarity = score;
        mostSimilarWork = work;
      }
    } catch (error) {
      console.warn(`Could not compare text "${work.title}":`, error.message);
    }
  }

  return {
    similarityScore: Number(highestSimilarity.toFixed(2)),
    isSimilar: highestSimilarity >= SIMILARITY_THRESHOLD,
    existingWork: mostSimilarWork,
  };
};

// ============================================================
// MAIN SIMILARITY FUNCTION
// ============================================================

const calculateSimilarity = async (filePath, fileHash, mimeType) => {
  console.log("\n======================================");
  console.log("TRUEAUTHOR SIMILARITY CHECK");
  console.log("File:", path.basename(filePath));
  console.log("MIME TYPE:", mimeType);
  console.log("======================================");

  const exactMatch = await Work.findOne({ fileHash });

  if (exactMatch) {
    console.log("EXACT FILE MATCH FOUND");
    return { similarityScore: 100, isSimilar: true, existingWork: exactMatch };
  }

  if (mimeType && mimeType.startsWith("image/")) {
    console.log("Using IMAGE similarity detection");
    return calculateImageSimilarity(filePath, fileHash);
  }

  if (mimeType && mimeType.startsWith("video/")) {
    console.log("Using VIDEO similarity detection");

    const existingVideos = await getExistingWorks(/^video\//i);

    if (!existingVideos.length) {
      return { similarityScore: 0, isSimilar: false, existingWork: null };
    }

    let highestSimilarity = 0;
    let mostSimilarWork = null;

    for (const work of existingVideos) {
      const existingFilePath = getAbsoluteFilePath(work.filePath);

      if (!existingFilePath || !fs.existsSync(existingFilePath)) continue;

      try {
        const similarity = await calculateVideoSimilarity(filePath, existingFilePath);

        console.log(`VIDEO similarity with "${work.title}": ${similarity}%`);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          mostSimilarWork = work;
        }
      } catch (error) {
        console.warn(`Could not compare video "${work.title}":`, error.message);
      }
    }

    return {
      similarityScore: Number(highestSimilarity.toFixed(2)),
      isSimilar: highestSimilarity >= SIMILARITY_THRESHOLD,
      existingWork: mostSimilarWork,
    };
  }

  if (mimeType && mimeType.startsWith("audio/")) {
    console.log("Using AUDIO similarity detection");

    const existingAudios = await getExistingWorks(/^audio\//i);

    if (!existingAudios.length) {
      return { similarityScore: 0, isSimilar: false, existingWork: null };
    }

    let highestSimilarity = 0;
    let mostSimilarWork = null;

    for (const work of existingAudios) {
      const existingFilePath = getAbsoluteFilePath(work.filePath);

      if (!existingFilePath || !fs.existsSync(existingFilePath)) continue;

      try {
        const similarity = await calculateAudioSimilarity(filePath, existingFilePath);

        console.log(`AUDIO similarity with "${work.title}": ${similarity}%`);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          mostSimilarWork = work;
        }
      } catch (error) {
        console.warn(`Could not compare audio "${work.title}":`, error.message);
      }
    }

    return {
      similarityScore: Number(highestSimilarity.toFixed(2)),
      isSimilar: highestSimilarity >= SIMILARITY_THRESHOLD,
      existingWork: mostSimilarWork,
    };
  }

  const isTextFile =
    mimeType &&
    (mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml");

  if (isTextFile) {
    console.log("Using TEXT similarity detection");
    return calculateTextSimilarity(filePath, fileHash);
  }

  console.log("No similarity algorithm available for:", mimeType);

  return { similarityScore: 0, isSimilar: false, existingWork: null };
};

// ============================================================
// EXPORTS - KEEP COMPATIBLE WITH THE BACKEND
// ============================================================

module.exports = {
  calculateImageSimilarity,
  calculateVideoSimilarity,
  calculateAudioSimilarity,
  calculateTextSimilarity,
  calculateSimilarity,
};
