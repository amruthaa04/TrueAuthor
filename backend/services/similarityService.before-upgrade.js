
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const sharp = require("sharp");
const Work = require("../models/Work");

const AI_BASE_URL = (
  process.env.TRUEAUTHOR_AI_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const AI_CACHE_DIR = path.join(
  __dirname, "..", "uploads", "ai_video_embeddings"
);

const AI_VIDEO_THRESHOLD = Number(
  process.env.AI_VIDEO_SIMILARITY_THRESHOLD || 30
);

const AI_TIMEOUT_MS = Number(
  process.env.AI_VIDEO_TIMEOUT_MS || 180000
);

const SIMILARITY_THRESHOLD = Number(
  process.env.TRUEAUTHOR_SIMILARITY_THRESHOLD || 30
);

// A perceptual-hash match is more useful for detecting copied images
// than raw CLIP cosine similarity, which can match different images
// depicting similar subjects.
const IMAGE_HASH_THRESHOLD = Number(
  process.env.TRUEAUTHOR_IMAGE_HASH_THRESHOLD || 90
);

const getAbsoluteFilePath = (filePath) => {
  if (!filePath) return null;
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(__dirname, "..", filePath);
};

const ensureDirectory = (directory) => {
  fs.mkdirSync(directory, { recursive: true });
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const getFileCacheKey = (filePath) => {
  const stat = fs.statSync(filePath);
  return sha256(
    `${path.resolve(filePath)}|${stat.size}|${stat.mtimeMs}`
  );
};

async function requestAI(endpoint, payload, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AI_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `AI endpoint ${endpoint} returned invalid JSON: ${text.slice(0, 200)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.detail || `AI endpoint ${endpoint} returned HTTP ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAIHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${AI_BASE_URL}/health`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI health endpoint returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "ready") {
      throw new Error("Local AI service is not ready");
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// The Python service currently returns `embeddings` for videos.
// This helper also accepts `frames` for compatibility with older versions.
async function requestAIEmbeddings(videoPath) {
  const data = await requestAI("/analyze-video-path", {
    path: path.resolve(videoPath),
  });

  let frames = [];

  if (Array.isArray(data.frames)) {
    frames = data.frames.map((frame) =>
      Array.isArray(frame)
        ? { embedding: frame }
        : frame
    );
  } else if (Array.isArray(data.embeddings)) {
    frames = data.embeddings.map((embedding) => ({
      embedding: Array.isArray(embedding)
        ? embedding
        : embedding.embedding,
    }));
  }

  frames = frames.filter(
    (frame) =>
      frame &&
      Array.isArray(frame.embedding) &&
      frame.embedding.length > 0
  );

  if (!frames.length) {
    throw new Error("AI service returned no video frame embeddings");
  }

  return {
    model: data.model || "ViT-B-32",
    frames,
    totalFrames: data.frame_count || data.totalFrames || frames.length,
  };
}

async function getVideoEmbeddings(videoPath) {
  const absolutePath = getAbsoluteFilePath(videoPath);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new Error(`Video file not found: ${videoPath || "(empty path)"}`);
  }

  ensureDirectory(AI_CACHE_DIR);

  const key = getFileCacheKey(absolutePath);
  const cachePath = path.join(AI_CACHE_DIR, `${key}.json`);

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(
        await fs.promises.readFile(cachePath, "utf8")
      );

      if (
        cached &&
        cached.cacheKey === key &&
        Array.isArray(cached.frames) &&
        cached.frames.length > 0
      ) {
        return cached;
      }
    } catch (error) {
      console.warn("Ignoring invalid AI embedding cache:", error.message);
    }
  }

  const analyzed = await requestAIEmbeddings(absolutePath);

  const cached = {
    cacheKey: key,
    sourcePath: absolutePath,
    analyzedAt: new Date().toISOString(),
    model: analyzed.model,
    totalFrames: analyzed.totalFrames,
    frames: analyzed.frames,
  };

  const tempPath = `${cachePath}.${process.pid}.tmp`;

  await fs.promises.writeFile(tempPath, JSON.stringify(cached), "utf8");
  await fs.promises.rename(tempPath, cachePath);

  return cached;
}

async function getImageEmbedding(imagePath) {
  const data = await requestAI("/analyze-image-path", {
    path: path.resolve(imagePath),
  });

  if (!Array.isArray(data.embedding) || !data.embedding.length) {
    throw new Error("AI service returned no image embedding");
  }

  return data.embedding;
}

async function getTextEmbedding(text) {
  const data = await requestAI(
    "/analyze-text",
    { text },
    AI_TIMEOUT_MS
  );

  if (!Array.isArray(data.embedding) || !data.embedding.length) {
    throw new Error("AI service returned no text embedding");
  }

  return data.embedding;
}

const cosineSimilarity = (a, b) => {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    !a.length
  ) {
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

const embeddingScore = (a, b) =>
  Math.max(0, Math.min(100, cosineSimilarity(a, b) * 100));

function compareEmbeddingSequences(current, existing) {
  const a = Array.isArray(current?.frames) ? current.frames : [];
  const b = Array.isArray(existing?.frames) ? existing.frames : [];

  if (!a.length || !b.length) {
    return {
      score: 0,
      visualScore: 0,
      orderedScore: 0,
      coverageScore: 0,
      matchedFrames: 0,
      comparedFrames: a.length,
      existingFrames: b.length,
      frameScores: [],
    };
  }

  const n = a.length;
  const m = b.length;

  const matrix = a.map((frame) =>
    b.map((other) =>
      embeddingScore(frame.embedding, other.embedding)
    )
  );

  const bestFrameScores = matrix.map((row) => Math.max(...row));
  const visualScore =
    bestFrameScores.reduce((sum, score) => sum + score, 0) / n;

  const MIN_FRAME_MATCH = 70;
  const dp = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );
  const directions = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill("")
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = dp[i - 1][j];
      let direction = "up";

      if (dp[i][j - 1] > best) {
        best = dp[i][j - 1];
        direction = "left";
      }

      const frameScore = matrix[i - 1][j - 1];

      if (frameScore >= MIN_FRAME_MATCH) {
        const matchScore =
          dp[i - 1][j - 1] + (frameScore - MIN_FRAME_MATCH);

        if (matchScore > best) {
          best = matchScore;
          direction = "diagonal";
        }
      }

      dp[i][j] = best;
      directions[i][j] = direction;
    }
  }

  const alignedScores = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    const direction = directions[i][j];

    if (direction === "diagonal") {
      alignedScores.push(matrix[i - 1][j - 1]);
      i--;
      j--;
    } else if (direction === "up") {
      i--;
    } else {
      j--;
    }
  }

  const matchedFrames = alignedScores.length;
  const coverage = Math.min(matchedFrames / n, matchedFrames / m);
  const orderedScore = matchedFrames
    ? alignedScores.reduce((sum, score) => sum + score, 0) /
      matchedFrames
    : 0;

  const coverageScore = coverage * 100;
  const score = visualScore * 0.25 + orderedScore * coverage * 0.75;

  return {
    score: Number(Math.max(0, Math.min(100, score)).toFixed(2)),
    visualScore: Number(visualScore.toFixed(2)),
    orderedScore: Number(orderedScore.toFixed(2)),
    coverageScore: Number(coverageScore.toFixed(2)),
    matchedFrames,
    comparedFrames: n,
    existingFrames: m,
    frameScores: bestFrameScores.map((value) =>
      Number(value.toFixed(2))
    ),
  };
}

const calculateVideoSimilarity = async (
  currentVideoPath,
  existingVideoPath
) => {
  const current = await getVideoEmbeddings(currentVideoPath);
  const existing = await getVideoEmbeddings(existingVideoPath);
  const result = compareEmbeddingSequences(current, existing);

  console.log(
    `AI VIDEO similarity: ${result.score}% ` +
    `(visual ${result.visualScore}%, ordered ${result.orderedScore}%, ` +
    `coverage ${result.coverageScore}%, ` +
    `${result.matchedFrames}/${result.comparedFrames} aligned frames)`
  );

  return result.score;
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

  const sorted = dctValues.slice(1).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return dctValues.map((value) => (value > median ? "1" : "0")).join("");
};

const calculateHashSimilarity = (hash1, hash2) => {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;

  let differentBits = 0;

  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differentBits++;
  }

  return Number(
    (100 - (differentBits / hash1.length) * 100).toFixed(2)
  );
};

const calculateImageSimilarity = async (filePath, currentHash) => {
  const exactMatch = await Work.findOne({ fileHash: currentHash });

  if (exactMatch) {
    return {
      similarityScore: 100,
      isSimilar: true,
      existingWork: exactMatch,
    };
  }

  const existingWorks = await Work.find({
    fileType: { $regex: /^image\//i },
  });

  let currentHashValue = null;
  let currentEmbedding = null;

  try {
    currentHashValue = await generatePerceptualHash(filePath);
  } catch (error) {
    console.warn("Image perceptual hash failed:", error.message);
  }

  try {
    currentEmbedding = await getImageEmbedding(filePath);
  } catch (error) {
    console.warn("Image AI embedding unavailable:", error.message);
  }

  let highestSimilarity = 0;
  let mostSimilarWork = null;

  for (const work of existingWorks) {
    const existingPath = getAbsoluteFilePath(work.filePath);

    if (!existingPath || !fs.existsSync(existingPath)) continue;

    let hashScore = 0;
    let aiScore = null;

    try {
      if (currentHashValue) {
        const existingHash = await generatePerceptualHash(existingPath);
        hashScore = calculateHashSimilarity(currentHashValue, existingHash);
      }
    } catch (error) {
      console.warn(`Image hash comparison failed for "${work.title}":`, error.message);
    }

    try {
      if (currentEmbedding) {
        const existingEmbedding = await getImageEmbedding(existingPath);
        aiScore = embeddingScore(currentEmbedding, existingEmbedding);
      }
    } catch (error) {
      console.warn(`Image AI comparison failed for "${work.title}":`, error.message);
    }

    console.log(
      `IMAGE "${work.title}": perceptual=${hashScore}%, ` +
      `AI cosine=${aiScore === null ? "unavailable" : `${aiScore.toFixed(2)}% (diagnostic)`}`
    );

    // Perceptual hash determines blocking. CLIP is logged for calibration
    // because semantic similarity alone can match different images.
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
// AUDIO - SIGNAL FEATURES
// ============================================================

const getMediaDuration = (filePath) =>
  new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ["-i", filePath],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = stderr || stdout || "";
        const match = output.match(
          /Duration:\s*(\d+):(\d+):([\d.]+)/
        );

        if (!match) {
          return reject(
            new Error("Could not determine media duration")
          );
        }

        resolve(
          Number(match[1]) * 3600 +
          Number(match[2]) * 60 +
          Number(match[3])
        );
      }
    );
  });

const extractAudioSegment = (
  audioPath,
  timestamp,
  duration = 8
) =>
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
        if ((!stdout || !stdout.length) && error) {
          return reject(error);
        }

        if (!stdout || !stdout.length) {
          return reject(new Error("No audio data extracted"));
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
  const samplesPerFeature = Math.max(
    1,
    Math.floor(sampleCount / featureCount)
  );

  for (let feature = 0; feature < featureCount; feature++) {
    const start = feature * samplesPerFeature;
    const end = Math.min(
      sampleCount,
      start + samplesPerFeature
    );

    if (start >= end) {
      rms.push(0);
      zcr.push(0);
      continue;
    }

    let energy = 0;
    let crossings = 0;

    for (let i = start; i < end; i++) {
      const sample = samples[i];
      energy += sample * sample;

      if (
        i > start &&
        (
          (samples[i - 1] < 0 && sample >= 0) ||
          (samples[i - 1] >= 0 && sample < 0)
        )
      ) {
        crossings++;
      }
    }

    rms.push(Math.sqrt(energy / (end - start)));
    zcr.push(crossings / (end - start));
  }

  return { rms, zcr };
};

const calculateArrayCorrelation = (array1, array2) => {
  if (
    !array1 ||
    !array2 ||
    array1.length !== array2.length ||
    !array1.length
  ) {
    return 0;
  }

  const mean1 =
    array1.reduce((a, b) => a + b, 0) / array1.length;
  const mean2 =
    array2.reduce((a, b) => a + b, 0) / array2.length;

  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < array1.length; i++) {
    const a = array1[i] - mean1;
    const b = array2[i] - mean2;

    numerator += a * b;
    denominator1 += a * a;
    denominator2 += b * b;
  }

  if (!denominator1 || !denominator2) return 0;

  return numerator / Math.sqrt(denominator1 * denominator2);
};

const compareAudioSignatures = (one, two) => {
  if (!one || !two) return 0;

  const rms = Math.max(
    0,
    calculateArrayCorrelation(one.rms, two.rms)
  ) * 100;

  const zcr = Math.max(
    0,
    calculateArrayCorrelation(one.zcr, two.zcr)
  ) * 100;

  return Math.max(
    0,
    Math.min(100, rms * 0.75 + zcr * 0.25)
  );
};

const generateAudioSignatures = async (audioPath) => {
  const duration = await getMediaDuration(audioPath);
  if (!duration || duration <= 0) return [];

  const segmentCount = 8;
  const segmentDuration = Math.min(
    8,
    Math.max(2, duration / segmentCount)
  );

  const signatures = [];

  for (let i = 0; i < segmentCount; i++) {
    const timestamp = duration * ((i + 0.5) / segmentCount);

    try {
      const buffer = await extractAudioSegment(
        audioPath,
        timestamp,
        segmentDuration
      );

      const signature = createAudioSignature(buffer);
      if (signature) signatures.push(signature);
    } catch (error) {
      console.warn(
        `Could not analyze audio segment ${i}: ${error.message}`
      );
    }
  }

  return signatures;
};

const calculateAudioSimilarity = async (
  currentAudioPath,
  existingAudioPath
) => {
  try {
    const current = await generateAudioSignatures(currentAudioPath);
    const existing = await generateAudioSignatures(existingAudioPath);

    if (!current.length || !existing.length) return 0;

    // Compare each current segment against every existing segment,
    // allowing for different start times in otherwise similar audio.
    const scores = current.map((signature) => {
      let best = 0;

      for (const candidate of existing) {
        best = Math.max(
          best,
          compareAudioSignatures(signature, candidate)
        );
      }

      return best;
    });

    const result =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    console.log(`FINAL AUDIO SIMILARITY: ${result.toFixed(2)}%`);
    return Number(result.toFixed(2));
  } catch (error) {
    console.error("Audio similarity error:", error);
    return 0;
  }
};

// ============================================================
// TEXT - SHINGLE / JACCARD SIMILARITY
// ============================================================

const readTextFile = async (filePath) =>
  (await fs.promises.readFile(filePath)).toString("utf8");

const normalizeText = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  const one = createTextShingles(text1);
  const two = createTextShingles(text2);

  if (!one.size || !two.size) return 0;

  let intersection = 0;

  for (const item of one) {
    if (two.has(item)) intersection++;
  }

  const union = new Set([...one, ...two]).size;

  return union
    ? Number(((intersection / union) * 100).toFixed(2))
    : 0;
};

const calculateTextSimilarity = async (filePath, currentHash) => {
  const exactMatch = await Work.findOne({ fileHash: currentHash });

  if (exactMatch) {
    return {
      similarityScore: 100,
      isSimilar: true,
      existingWork: exactMatch,
    };
  }

  const currentText = await readTextFile(filePath);

  if (!currentText.trim()) {
    return {
      similarityScore: 0,
      isSimilar: false,
      existingWork: null,
    };
  }

  const existingWorks = await Work.find({
    $or: [
      { fileType: { $regex: /^text\//i } },
      {
        fileName: {
          $regex: /\.(txt|md|csv|json|xml|html|htm)$/i,
        },
      },
      { fileType: "application/json" },
      { fileType: "application/xml" },
    ],
  });

  let currentEmbedding = null;

  // Generate the current document's AI embedding once.
  try {
    currentEmbedding = await getTextEmbedding(currentText);
  } catch (error) {
    console.warn("Text AI embedding unavailable:", error.message);
  }

  let highestSimilarity = 0;
  let mostSimilarWork = null;

  for (const work of existingWorks) {
    const existingPath = getAbsoluteFilePath(work.filePath);

    if (!existingPath || !fs.existsSync(existingPath)) continue;

    try {
      const existingText = await readTextFile(existingPath);
      const lexicalScore = calculateTextSimilarityScore(
        currentText,
        existingText
      );

      let semanticScore = null;

      if (currentEmbedding) {
        try {
          const existingEmbedding = await getTextEmbedding(existingText);
          semanticScore = embeddingScore(
            currentEmbedding,
            existingEmbedding
          );
        } catch (error) {
          console.warn(
            `Text AI comparison failed for "${work.title}":`,
            error.message
          );
        }
      }

      console.log(
        `TEXT "${work.title}": lexical=${lexicalScore}%, ` +
        `AI cosine=${
          semanticScore === null
            ? "unavailable"
            : `${semanticScore.toFixed(2)}% (diagnostic)`
        }`
      );

      // Do not use semantic cosine directly for blocking until calibrated:
      // related but independently written texts can have high semantic scores.
      if (lexicalScore > highestSimilarity) {
        highestSimilarity = lexicalScore;
        mostSimilarWork = work;
      }
    } catch (error) {
      console.warn(
        `Could not compare text "${work.title}": ${error.message}`
      );
    }
  }

  return {
    similarityScore: Number(highestSimilarity.toFixed(2)),
    isSimilar: highestSimilarity >= SIMILARITY_THRESHOLD,
    existingWork: mostSimilarWork,
  };
};

// ============================================================
// MAIN SIMILARITY DISPATCH
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

    return {
      similarityScore: 100,
      isSimilar: true,
      existingWork: exactMatch,
    };
  }

  if (mimeType?.startsWith("image/")) {
    console.log("Using AI-assisted IMAGE similarity detection");
    return calculateImageSimilarity(filePath, fileHash);
  }

  if (mimeType?.startsWith("video/")) {
    console.log("Using OpenCLIP VIDEO similarity detection");

    const existingVideos = await Work.find({
      fileType: { $regex: /^video\//i },
    });

    let highestSimilarity = 0;
    let mostSimilarWork = null;
    let bestDetails = null;
    let successfulComparisons = 0;
    let currentEmbeddings = null;

    const comparableVideos = existingVideos.filter((work) => {
      const existingPath = getAbsoluteFilePath(work.filePath);
      return existingPath && fs.existsSync(existingPath);
    });

    for (const work of comparableVideos) {
      const existingPath = getAbsoluteFilePath(work.filePath);

      try {
        if (!currentEmbeddings) {
          currentEmbeddings = await getVideoEmbeddings(filePath);
        }

        const existingEmbeddings = await getVideoEmbeddings(existingPath);
        const details = compareEmbeddingSequences(
          currentEmbeddings,
          existingEmbeddings
        );

        successfulComparisons++;

        console.log(
          `AI VIDEO similarity with "${work.title}": ${details.score}% ` +
          `(visual ${details.visualScore}%, ordered ${details.orderedScore}%, ` +
          `coverage ${details.coverageScore}%)`
        );

        if (details.score > highestSimilarity) {
          highestSimilarity = details.score;
          mostSimilarWork = work;
          bestDetails = details;
        }
      } catch (error) {
        console.error(
          `AI video comparison failed for "${work.title}":`,
          error.message
        );
      }
    }

    // If there are existing comparable videos but every AI comparison failed,
    // fail closed rather than silently allowing a potentially duplicate upload.
    if (comparableVideos.length > 0 && successfulComparisons === 0) {
      throw new Error(
        `AI video comparison failed. Check the AI service at ${AI_BASE_URL}.`
      );
    }

    return {
      similarityScore: highestSimilarity,
      isSimilar: highestSimilarity >= AI_VIDEO_THRESHOLD,
      existingWork: mostSimilarWork,
      ...(bestDetails
        ? {
            similarityDetails: {
              model: "OpenCLIP ViT-B-32",
              threshold: AI_VIDEO_THRESHOLD,
              visualScore: bestDetails.visualScore,
              orderedScore: bestDetails.orderedScore,
              coverageScore: bestDetails.coverageScore,
              matchedFrames: bestDetails.matchedFrames,
              comparedFrames: bestDetails.comparedFrames,
            },
          }
        : {}),
    };
  }

  if (mimeType?.startsWith("audio/")) {
    console.log("Using AUDIO similarity detection");

    const existingAudios = await Work.find({
      fileType: { $regex: /^audio\//i },
    });

    let highestSimilarity = 0;
    let mostSimilarWork = null;

    for (const work of existingAudios) {
      const existingPath = getAbsoluteFilePath(work.filePath);

      if (!existingPath || !fs.existsSync(existingPath)) continue;

      const score = await calculateAudioSimilarity(filePath, existingPath);

      console.log(`AUDIO similarity with "${work.title}": ${score}%`);

      if (score > highestSimilarity) {
        highestSimilarity = score;
        mostSimilarWork = work;
      }
    }

    return {
      similarityScore: highestSimilarity,
      isSimilar: highestSimilarity >= SIMILARITY_THRESHOLD,
      existingWork: mostSimilarWork,
    };
  }

  const isTextFile =
    mimeType &&
    (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml"
    );

  if (
    isTextFile ||
    /\.(txt|md|csv|json|xml|html|htm)$/i.test(filePath)
  ) {
    console.log("Using AI-assisted TEXT similarity detection");
    return calculateTextSimilarity(filePath, fileHash);
  }

  return {
    similarityScore: 0,
    isSimilar: false,
    existingWork: null,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  calculateImageSimilarity,
  calculateVideoSimilarity,
  calculateAudioSimilarity,
  calculateTextSimilarity,
  calculateSimilarity,
  getAIHealth,
};
