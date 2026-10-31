const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const sharp = require("sharp");
const Work = require("../models/Work");

const AI_BASE_URL = process.env.TRUEAUTHOR_AI_URL || "http://127.0.0.1:8000";
const AI_CACHE_DIR = path.join(__dirname, "..", "uploads", "ai_video_embeddings");
const AI_VIDEO_THRESHOLD = Number(process.env.AI_VIDEO_SIMILARITY_THRESHOLD || 88);
const IMAGE_THRESHOLD = Number(process.env.TRUEAUTHOR_IMAGE_SIMILARITY_THRESHOLD || 82);
const AUDIO_THRESHOLD = Number(process.env.TRUEAUTHOR_AUDIO_SIMILARITY_THRESHOLD || 88);
const TEXT_AI_THRESHOLD = Number(process.env.TRUEAUTHOR_TEXT_AI_SIMILARITY_THRESHOLD || 85);
const AI_TIMEOUT_MS = Number(process.env.AI_VIDEO_TIMEOUT_MS || 180000);

const getAbsoluteFilePath = (filePath) => {
  if (!filePath) return null;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(__dirname, "..", filePath);
};

const ensureDirectory = (directory) => {
  fs.mkdirSync(directory, { recursive: true });
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const getFileCacheKey = (filePath) => {
  const stat = fs.statSync(filePath);
  return sha256(`${path.resolve(filePath)}|${stat.size}|${stat.mtimeMs}`);
};

async function getAIHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${AI_BASE_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI health endpoint returned ${response.status}`);
    const data = await response.json();
    if (data.status !== "ready") throw new Error("Local AI service is not ready");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAIEmbeddings(videoPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_BASE_URL}/analyze-video-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.resolve(videoPath) }),
      signal: controller.signal,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`AI service returned invalid JSON: ${text.slice(0, 300)}`);
    }

    if (!response.ok) {
      throw new Error(data.detail || `AI service returned ${response.status}`);
    }
    if (!Array.isArray(data.frames) || data.frames.length === 0) {
      throw new Error("AI service returned no video frame embeddings");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAIImageEmbedding(imagePath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_BASE_URL}/analyze-image-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.resolve(imagePath) }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `AI image service returned ${response.status}`);
    if (!Array.isArray(data.embedding) || !data.embedding.length) {
      throw new Error("AI service returned no image embedding");
    }
    return data.embedding;
  } finally {
    clearTimeout(timeout);
  }
}


async function requestAITextEmbedding(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_BASE_URL}/analyze-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || `AI text service returned ${response.status}`);
    }

    const embedding = data.embedding || data.embeddings;
    if (!Array.isArray(embedding) || !embedding.length) {
      throw new Error("AI service returned no document embedding");
    }
    return embedding;
  } finally {
    clearTimeout(timeout);
  }
}



async function requestAIAudioEmbeddings(audioPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_BASE_URL}/analyze-audio-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.resolve(audioPath) }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `AI audio service returned ${response.status}`);
    }
    if (!Array.isArray(data.segments) || data.segments.length === 0) {
      throw new Error("AI service returned no audio segment embeddings");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAIImageComparison(pathA, pathB) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_BASE_URL}/compare-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path_a: path.resolve(pathA),
        path_b: path.resolve(pathB),
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `AI image comparison returned ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
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
      const cached = JSON.parse(await fs.promises.readFile(cachePath, "utf8"));
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

function compareEmbeddingSequences(current, existing) {
  const a = current.frames || [];
  const b = existing.frames || [];
  if (a.length < 3 || b.length < 3) {
    return {
      score: 0, visualScore: 0, orderedScore: 0,
      matchedFrames: 0, comparedFrames: a.length, coverage: 0,
    };
  }

  const matrix = a.map((frame) =>
    b.map((candidate) => cosineSimilarity(frame.embedding, candidate.embedding))
  );

  // Require high frame-level similarity. OpenCLIP alone is semantic, so a frame
  // that merely depicts the same subject must not count as a copy match.
  const FRAME_MATCH_THRESHOLD = 0.90;
  const matchedIndices = [];
  let lastIndex = -1;
  let orderedSimilaritySum = 0;

  for (let i = 0; i < matrix.length; i++) {
    let bestScore = -1;
    let bestIndex = -1;
    for (let j = lastIndex + 1; j < b.length; j++) {
      if (matrix[i][j] > bestScore) {
        bestScore = matrix[i][j];
        bestIndex = j;
      }
    }
    if (bestIndex >= 0 && bestScore >= FRAME_MATCH_THRESHOLD) {
      matchedIndices.push({ currentIndex: i, existingIndex: bestIndex, score: bestScore });
      lastIndex = bestIndex;
      orderedSimilaritySum += bestScore;
    }
  }

  const comparedFrames = a.length;
  const matchedFrames = matchedIndices.length;
  const coverage = matchedFrames / comparedFrames;
  const orderedScore = matchedFrames
    ? (orderedSimilaritySum / comparedFrames) * 100
    : 0;

  // Only count high-similarity frame matches that preserve order. This is more
  // conservative than averaging each frame's best match anywhere in the video.
  const score = Math.min(100, coverage * (matchedFrames
    ? (orderedSimilaritySum / matchedFrames) * 100
    : 0));

  return {
    score: Number(score.toFixed(2)),
    visualScore: Number((matchedFrames
      ? (orderedSimilaritySum / matchedFrames) * 100
      : 0).toFixed(2)),
    orderedScore: Number(orderedScore.toFixed(2)),
    matchedFrames,
    comparedFrames,
    coverage: Number((coverage * 100).toFixed(2)),
  };
}

// ============================================================
// IMAGE - perceptual hash + structural similarity + OpenCLIP
// ============================================================

const generatePerceptualHash = async (filePath) => {
  const size = 32;
  const pixels = await sharp(filePath)
    .rotate()
    .resize(size, size, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const coefficients = [];
  // 8x8 low-frequency DCT. Exclude DC when calculating the median.
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum += pixels[x * size + y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }
      coefficients.push(sum);
    }
  }
  const medianValues = coefficients.slice(1).sort((a, b) => a - b);
  const median = medianValues[Math.floor(medianValues.length / 2)];
  return coefficients.slice(1).map((value) => value >= median ? "1" : "0").join("");
};

const calculateHashSimilarity = (hash1, hash2) => {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
  let differentBits = 0;
  for (let i = 0; i < hash1.length; i++) if (hash1[i] !== hash2[i]) differentBits++;
  return Number((100 - (differentBits / hash1.length) * 100).toFixed(2));
};

const getGrayImage = async (filePath, size = 128) => sharp(filePath)
  .rotate().resize(size, size, { fit: "fill" }).greyscale().raw().toBuffer();

const calculateStructuralSimilarity = async (file1, file2) => {
  const [a, b] = await Promise.all([getGrayImage(file1), getGrayImage(file2)]);
  if (a.length !== b.length || !a.length) return 0;
  let meanA = 0, meanB = 0;
  for (let i = 0; i < a.length; i++) { meanA += a[i]; meanB += b[i]; }
  meanA /= a.length; meanB /= b.length;
  let varianceA = 0, varianceB = 0, covariance = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    varianceA += da * da; varianceB += db * db; covariance += da * db;
  }
  varianceA /= a.length; varianceB /= b.length; covariance /= a.length;
  const c1 = (0.01 * 255) ** 2, c2 = (0.03 * 255) ** 2;
  const ssim = ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
    ((meanA ** 2 + meanB ** 2 + c1) * (varianceA + varianceB + c2));
  return Number((Math.max(-1, Math.min(1, ssim)) * 100).toFixed(2));
};

const calculateImageSimilarity = async (filePath, currentHash) => {
  const exactMatch = await Work.findOne({ fileHash: currentHash });
  if (exactMatch) return { similarityScore: 100, isSimilar: true, existingWork: exactMatch };

  const existingWorks = await Work.find({ fileType: { $regex: /^image\//i } });
  const currentPHash = await generatePerceptualHash(filePath);
  let currentEmbedding = null;

  try {
    currentEmbedding = await requestAIImageEmbedding(filePath);
  } catch (error) {
    console.warn(`OpenCLIP image embedding unavailable: ${error.message}`);
  }

  let highestScore = 0;
  let mostSimilarWork = null;
  let bestDetails = null;
  let strongestCopy = null;

  for (const work of existingWorks) {
    const existingPath = getAbsoluteFilePath(work.filePath);
    if (!existingPath || !fs.existsSync(existingPath)) continue;

    try {
      const existingPHash = await generatePerceptualHash(existingPath);
      const pHashScore = calculateHashSimilarity(currentPHash, existingPHash);
      const structuralScore = await calculateStructuralSimilarity(filePath, existingPath);

      let clipScore = 0;
      if (currentEmbedding) {
        try {
          const existingEmbedding = await requestAIImageEmbedding(existingPath);
          clipScore = Math.max(0, cosineSimilarity(currentEmbedding, existingEmbedding)) * 100;
        } catch (error) {
          console.warn(`OpenCLIP image compare failed for "${work.title}": ${error.message}`);
        }
      }

      let featureResult = {
        featureScore: 0,
        goodMatches: 0,
        inlierMatches: 0,
        inlierRatio: 0,
        verifiedCopy: false,
      };

      try {
        featureResult = await requestAIImageComparison(filePath, existingPath);
      } catch (error) {
        // Keep legacy signals available if the AI service has not yet been updated.
        console.warn(`Geometric image verification unavailable for "${work.title}": ${error.message}`);
      }

      // OpenCLIP is context only, never proof of copying. Structural similarity
      // is also not enough on its own because unrelated images can share layouts.
      const score = Number((
        pHashScore * 0.35 +
        Math.max(0, structuralScore) * 0.25 +
        Math.max(0, featureResult.featureScore || 0) * 0.35 +
        clipScore * 0.05
      ).toFixed(2));

      const verifiedCopy =
        featureResult.verifiedCopy === true &&
        Number(featureResult.inlierMatches || 0) >= 15 &&
        Number(featureResult.inlierRatio || 0) >= 0.45;

      // A high pHash can independently catch near-identical images; transformed
      // copies need geometric feature matches. Semantic similarity cannot trigger.
      const nearExactCopy = pHashScore >= 94 && structuralScore >= 82;
      const transformedCopy = verifiedCopy && score >= IMAGE_THRESHOLD;

      const details = {
        pHashScore,
        structuralScore,
        clipScore,
        featureScore: Number(featureResult.featureScore || 0),
        goodMatches: Number(featureResult.goodMatches || 0),
        inlierMatches: Number(featureResult.inlierMatches || 0),
        inlierRatio: Number(featureResult.inlierRatio || 0),
        verifiedCopy: verifiedCopy || nearExactCopy,
      };

      console.log(
        `IMAGE similarity with "${work.title}": ${score}% ` +
        `(pHash ${pHashScore}%, structure ${structuralScore}%, ` +
        `features ${details.inlierMatches} inliers, OpenCLIP ${clipScore}%, ` +
        `verified ${details.verifiedCopy})`
      );

      if (score > highestScore) {
        highestScore = score;
        mostSimilarWork = work;
        bestDetails = details;
      }

      if ((nearExactCopy || transformedCopy) &&
          (!strongestCopy || score > strongestCopy.score)) {
        strongestCopy = { score: Math.max(score, nearExactCopy ? 94 : score), work, details };
      }
    } catch (error) {
      console.warn(`Could not compare image "${work.title}": ${error.message}`);
    }
  }

  const selected = strongestCopy;
  if (selected) {
    highestScore = selected.score;
    mostSimilarWork = selected.work;
    bestDetails = selected.details;
  }

  return {
    similarityScore: Number(highestScore.toFixed(2)),
    isSimilar: Boolean(selected),
    existingWork: mostSimilarWork,
    ...(bestDetails ? {
      similarityDetails: {
        method: "pHash+structure+ORB-geometric-verification+OpenCLIP-context",
        threshold: IMAGE_THRESHOLD,
        ...bestDetails,
      },
    } : {}),
  };
};

// ============================================================
// VIDEO - LOCAL OPENCLIP AI SIMILARITY
// ============================================================

const calculateVideoSimilarity = async (currentVideoPath, existingVideoPath) => {
  const current = await getVideoEmbeddings(currentVideoPath);
  const existing = await getVideoEmbeddings(existingVideoPath);
  const result = compareEmbeddingSequences(current, existing);

  console.log(
    `AI VIDEO similarity: ${result.score}% ` +
    `(visual ${result.visualScore}%, ordered ${result.orderedScore}%, ` +
    `${result.matchedFrames}/${result.comparedFrames} ordered frame matches)`
  );
  return result.score;
};

// ============================================================
// AUDIO - spectral fingerprints (more robust than RMS/ZCR alone)
// ============================================================

const getMediaDuration = (filePath) => new Promise((resolve, reject) => {
  execFile(ffmpegPath, ["-i", filePath, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }, (error, _stdout, stderr) => {
    const match = (stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return error ? reject(error) : resolve(0);
    resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
  });
});

const extractAudioPcm = (audioPath) => new Promise((resolve, reject) => {
  execFile(ffmpegPath, ["-i", audioPath, "-vn", "-ac", "1", "-ar", "11025", "-f", "s16le", "-acodec", "pcm_s16le", "-"],
    { encoding: null, maxBuffer: 256 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!stdout || !stdout.length) return reject(error || new Error(stderr || "No decoded audio"));
      resolve(stdout);
    });
});

// Radix-2 FFT, used to build normalized log-frequency spectral fingerprints.
const fftReal = (input) => {
  const n = input.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = input[i];
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len, wlenR = Math.cos(angle), wlenI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const uR = re[i + j], uI = im[i + j];
        const vR = re[i + j + len / 2] * wr - im[i + j + len / 2] * wi;
        const vI = re[i + j + len / 2] * wi + im[i + j + len / 2] * wr;
        re[i + j] = uR + vR; im[i + j] = uI + vI;
        re[i + j + len / 2] = uR - vR; im[i + j + len / 2] = uI - vI;
        const nextWr = wr * wlenR - wi * wlenI; wi = wr * wlenI + wi * wlenR; wr = nextWr;
      }
    }
  }
  return { re, im };
};

const generateAudioFingerprints = async (audioPath) => {
  const pcm = await extractAudioPcm(audioPath);
  const sampleCount = Math.floor(pcm.length / 2), windowSize = 4096, hop = 2048, bandCount = 32;
  if (sampleCount < windowSize) return [];
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  const fingerprints = [];
  for (let start = 0; start + windowSize <= sampleCount; start += hop) {
    const frame = new Float64Array(windowSize);
    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      const sample = samples[start + i]; energy += sample * sample;
      frame[i] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (windowSize - 1)));
    }
    if (energy / windowSize < 1e-7) continue;
    const { re, im } = fftReal(frame);
    const bands = new Float64Array(bandCount);
    // Log-ish bands; broad bands are more tolerant of codec and pitch imperfections.
    for (let k = 2; k < windowSize / 2; k++) {
      const band = Math.min(bandCount - 1, Math.floor(Math.log(k / 2) / Math.log((windowSize / 4) / 2) * bandCount));
      bands[band] += Math.log1p(Math.hypot(re[k], im[k]));
    }
    let mean = 0;
    for (const value of bands) mean += value;
    mean /= bandCount;
    let norm = 0;
    for (let i = 0; i < bandCount; i++) { bands[i] -= mean; norm += bands[i] * bands[i]; }
    norm = Math.sqrt(norm) || 1;
    fingerprints.push(Array.from(bands, (value) => value / norm));
  }
  return fingerprints;
};

const compareAudioFrame = (a, b) => {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
};

const compareAudioEmbeddingSegments = (currentData, existingData) => {
  const current = currentData?.segments || [];
  const existing = existingData?.segments || [];
  if (!current.length || !existing.length) {
    return { score: 0, matchedSegments: 0, comparedSegments: current.length, coverage: 0 };
  }

  let lastExistingIndex = -1;
  let similarityTotal = 0;
  let matchedSegments = 0;

  for (const segment of current) {
    let bestScore = -1;
    let bestIndex = -1;
    for (let j = lastExistingIndex + 1; j < existing.length; j++) {
      const score = cosineSimilarity(segment.embedding, existing[j].embedding);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = j;
      }
    }
    if (bestIndex >= 0 && bestScore >= 0.88) {
      matchedSegments++;
      similarityTotal += bestScore;
      lastExistingIndex = bestIndex;
    }
  }

  const coverage = matchedSegments / current.length;
  const meanMatched = matchedSegments ? similarityTotal / matchedSegments : 0;
  return {
    score: Number((coverage * meanMatched * 100).toFixed(2)),
    matchedSegments,
    comparedSegments: current.length,
    coverage: Number((coverage * 100).toFixed(2)),
  };
};

const calculateAudioSimilarity = async (currentAudioPath, existingAudioPath) => {
  try {
    const [current, existing] = await Promise.all([
      generateAudioFingerprints(currentAudioPath),
      generateAudioFingerprints(existingAudioPath),
    ]);
    if (current.length < 5 || existing.length < 5) return 0;

    // Search a range of temporal offsets, but compare frames in sequence rather
    // than allowing every current frame to match any unrelated frame anywhere.
    const minLength = Math.min(current.length, existing.length);
    const maxOffset = Math.min(existing.length - 1, Math.max(0, Math.floor(current.length * 0.35)));
    let bestScore = 0;

    for (let offset = -Math.min(current.length - 1, Math.floor(existing.length * 0.35));
         offset <= maxOffset; offset++) {
      const aligned = [];
      for (let i = 0; i < current.length; i++) {
        const j = i + offset;
        if (j >= 0 && j < existing.length) {
          aligned.push(compareAudioFrame(current[i], existing[j]));
        }
      }

      if (aligned.length < Math.max(5, Math.floor(minLength * 0.35))) continue;

      const strongThreshold = 0.94;
      const strongRatio = aligned.filter((value) => value >= strongThreshold).length / aligned.length;
      const mean = aligned.reduce((sum, value) => sum + value, 0) / aligned.length;

      // A match requires both a high average and many consecutive aligned frames.
      // The coverage penalty makes short coincidental passages score lower.
      let longestStrongRun = 0;
      let currentRun = 0;
      for (const value of aligned) {
        if (value >= strongThreshold) {
          currentRun++;
          longestStrongRun = Math.max(longestStrongRun, currentRun);
        } else {
          currentRun = 0;
        }
      }
      const runRatio = longestStrongRun / aligned.length;
      const coverageRatio = aligned.length / Math.max(current.length, existing.length);
      const score = 100 * (
        0.45 * mean +
        0.40 * strongRatio +
        0.15 * runRatio
      ) * Math.sqrt(coverageRatio);

      bestScore = Math.max(bestScore, score);
    }

    return Number(Math.max(0, Math.min(100, bestScore)).toFixed(2));
  } catch (error) {
    console.error("Audio fingerprint error:", error.message);
    return 0;
  }
};

// ============================================================
// TEXT - Sentence Transformers AI + existing Jaccard fallback
// ============================================================

const readTextFile = async (filePath) =>
  (await fs.promises.readFile(filePath)).toString("utf8");

const normalizeText = (text) => text.toLowerCase()
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

const calculateEmbeddingSimilarity = (a, b) => {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    !a.length ||
    a.length !== b.length
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

  const cosine = dot / Math.sqrt(normA * normB);

  // Convert cosine similarity to a percentage-like 0-100 score.
  return Number((Math.max(0, Math.min(1, cosine)) * 100).toFixed(2));
};

const calculateTextSimilarity = async (filePath, currentHash) => {
  const exactMatch = await Work.findOne({ fileHash: currentHash });

  if (exactMatch) {
    return {
      similarityScore: 100,
      isSimilar: true,
      existingWork: exactMatch,
      similarityDetails: { method: "exact-sha256", threshold: 100 },
    };
  }

  const currentText = await readTextFile(filePath);

  if (!currentText.trim()) {
    return {
      similarityScore: 0,
      isSimilar: false,
      existingWork: null,
      similarityDetails: { method: "empty-document" },
    };
  }

  const existingWorks = await Work.find({
    $or: [
      { fileType: { $regex: /^text\//i } },
      { fileName: { $regex: /\.(txt|md|csv|json|xml|html|htm)$/i } },
      { fileType: "application/json" },
    ],
  });

  let currentEmbedding = null;
  let aiAvailable = true;

  try {
    currentEmbedding = await requestAITextEmbedding(currentText);
  } catch (error) {
    aiAvailable = false;
    console.warn(
      `Document AI unavailable; using Jaccard fallback: ${error.message}`
    );
  }

  let highestSimilarity = 0;
  let highestSemanticScore = 0;
  let highestJaccardScore = 0;
  let mostSimilarWork = null;
  let bestDetails = null;
  let successfulAIComparisons = 0;

  for (const work of existingWorks) {
    const existingPath = getAbsoluteFilePath(work.filePath);

    if (!existingPath || !fs.existsSync(existingPath)) continue;

    try {
      const existingText = await readTextFile(existingPath);

      if (!existingText.trim()) continue;

      const jaccardScore = calculateTextSimilarityScore(
        currentText,
        existingText
      );

      let semanticScore = 0;

      if (currentEmbedding) {
        try {
          const existingEmbedding = await requestAITextEmbedding(existingText);
          semanticScore = calculateEmbeddingSimilarity(
            currentEmbedding,
            existingEmbedding
          );
          successfulAIComparisons++;
        } catch (error) {
          console.warn(
            `Document AI comparison failed for "${work.title}": ${error.message}`
          );
        }
      }

      // AI semantic similarity detects related meaning and paraphrasing.
      // Jaccard remains available to detect direct phrase overlap.
      // The weighted score is a screening signal, not proof of infringement.
      const score = currentEmbedding && semanticScore > 0
        ? Number((semanticScore * 0.70 + jaccardScore * 0.30).toFixed(2))
        : jaccardScore;

      console.log(
        `DOCUMENT similarity with "${work.title}": ${score}% ` +
        `(semantic ${semanticScore}%, Jaccard ${jaccardScore}%)`
      );

      if (score > highestSimilarity) {
        highestSimilarity = score;
        highestSemanticScore = semanticScore;
        highestJaccardScore = jaccardScore;
        mostSimilarWork = work;

        bestDetails = {
          method: currentEmbedding
            ? "Sentence-Transformers+Jaccard"
            : "Jaccard-fallback",
          model: currentEmbedding
            ? "sentence-transformers/all-MiniLM-L6-v2"
            : null,
          semanticScore,
          jaccardScore,
          aiAvailable,
          aiComparisonSucceeded: semanticScore > 0,
          aiThreshold: TEXT_AI_THRESHOLD,
          jaccardThreshold: 30,
        };
      }
    } catch (error) {
      console.warn(
        `Could not compare text "${work.title}": ${error.message}`
      );
    }
  }

  // Require a strong semantic score plus at least some lexical overlap
  // to reduce false positives from documents that merely discuss the
  // same broad subject. Direct textual overlap can still trigger the
  // existing Jaccard threshold independently.
  const semanticMatch =
    highestSemanticScore >= TEXT_AI_THRESHOLD &&
    highestJaccardScore >= 5;

  const lexicalMatch = highestJaccardScore >= 30;

  const isSimilar = semanticMatch || lexicalMatch;

  // If the AI endpoint responded for the current document but failed for
  // every existing document, the score is based on Jaccard only.
  if (
    currentEmbedding &&
    existingWorks.length > 0 &&
    successfulAIComparisons === 0
  ) {
    console.warn(
      "No existing document embeddings were compared; Jaccard fallback was used."
    );
  }

  return {
    similarityScore: highestSimilarity,
    isSimilar,
    existingWork: mostSimilarWork,
    ...(bestDetails
      ? {
          similarityDetails: {
            ...bestDetails,
            highestSemanticScore,
            highestJaccardScore,
            decision: semanticMatch
              ? "semantic-and-lexical-match"
              : lexicalMatch
                ? "lexical-match"
                : "below-threshold",
          },
        }
      : {
          similarityDetails: {
            method: "no-comparable-existing-documents",
            aiAvailable,
          },
        }),
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
    return { similarityScore: 100, isSimilar: true, existingWork: exactMatch };
  }

  if (mimeType && mimeType.startsWith("image/")) {
    return calculateImageSimilarity(filePath, fileHash);
  }

  if (mimeType && mimeType.startsWith("video/")) {
    const existingVideos = await Work.find({ fileType: { $regex: /^video\//i } });
    let highestSimilarity = 0;
    let mostSimilarWork = null;
    let bestDetails = null;
    let successfulComparisons = 0;

    for (const work of existingVideos) {
      const existingPath = getAbsoluteFilePath(work.filePath);
      if (!existingPath || !fs.existsSync(existingPath)) continue;
      try {
        const currentEmbeddings = await getVideoEmbeddings(filePath);
        const existingEmbeddings = await getVideoEmbeddings(existingPath);
        const details = compareEmbeddingSequences(currentEmbeddings, existingEmbeddings);
        successfulComparisons++;
        console.log(
          `AI VIDEO similarity with "${work.title}": ${details.score}% ` +
          `(visual ${details.visualScore}%, ordered ${details.orderedScore}%)`
        );
        if (details.score > highestSimilarity) {
          highestSimilarity = details.score;
          mostSimilarWork = work;
          bestDetails = details;
        }
      } catch (error) {
        // Fail closed for this comparison: log it, but don't crash all other checks.
        console.error(`AI video comparison failed for "${work.title}":`, error.message);
      }
    }

    // If the AI service failed for every comparison, surface an error instead of silently
    // reporting 0% and allowing the upload to appear successfully checked.
    if (existingVideos.length > 0 && successfulComparisons === 0) {
      throw new Error(
        `Local AI video similarity could not compare registered videos. ` +
        `Confirm the AI service is running at ${AI_BASE_URL}.`
      );
    }

    return {
      similarityScore: highestSimilarity,
      isSimilar: highestSimilarity >= AI_VIDEO_THRESHOLD && Number(bestDetails?.coverage || 0) >= 55,
      existingWork: mostSimilarWork,
      ...(bestDetails ? {
        similarityDetails: {
          model: "OpenCLIP ViT-B-32",
          threshold: AI_VIDEO_THRESHOLD,
          visualScore: bestDetails.visualScore,
          orderedScore: bestDetails.orderedScore,
          matchedFrames: bestDetails.matchedFrames,
          comparedFrames: bestDetails.comparedFrames,
          coverage: bestDetails.coverage,
        },
      } : {}),
    };
  }

  if (mimeType && mimeType.startsWith("audio/")) {
    const existingAudios = await Work.find({ fileType: { $regex: /^audio\//i } });
    let highestSimilarity = 0;
    let mostSimilarWork = null;
    let bestDetails = null;
    let successfulAIComparisons = 0;

    let currentAI = null;
    try {
      currentAI = await requestAIAudioEmbeddings(filePath);
    } catch (error) {
      console.warn(`CLAP audio analysis unavailable; using spectral fallback: ${error.message}`);
    }

    for (const work of existingAudios) {
      const existingPath = getAbsoluteFilePath(work.filePath);
      if (!existingPath || !fs.existsSync(existingPath)) continue;

      try {
        const spectralScore = await calculateAudioSimilarity(filePath, existingPath);
        let clapScore = 0;
        let clapDetails = { matchedSegments: 0, comparedSegments: 0, coverage: 0 };

        if (currentAI) {
          try {
            const existingAI = await requestAIAudioEmbeddings(existingPath);
            clapDetails = compareAudioEmbeddingSegments(currentAI, existingAI);
            clapScore = clapDetails.score;
            successfulAIComparisons++;
          } catch (error) {
            console.warn(`CLAP comparison failed for "${work.title}": ${error.message}`);
          }
        }

        // CLAP is semantic context, not proof of copied music. Spectral
        // alignment remains the primary evidence for an automatic flag.
        const combinedScore = currentAI
          ? Number((spectralScore * 0.70 + clapScore * 0.30).toFixed(2))
          : spectralScore;

        console.log(
          `AUDIO similarity with "${work.title}": ${combinedScore}% ` +
          `(spectral ${spectralScore}%, CLAP ${clapScore}%)`
        );

        if (combinedScore > highestSimilarity) {
          highestSimilarity = combinedScore;
          mostSimilarWork = work;
          bestDetails = {
            method: currentAI
              ? "CLAP-semantic+aligned-spectral-fingerprint"
              : "aligned-sequential-spectral-fingerprint-fallback",
            model: currentAI ? "laion/clap-htsat-unfused" : null,
            spectralScore,
            clapScore,
            clapMatchedSegments: clapDetails.matchedSegments,
            clapComparedSegments: clapDetails.comparedSegments,
            clapCoverage: clapDetails.coverage,
            threshold: AUDIO_THRESHOLD,
            aiAvailable: Boolean(currentAI),
          };
        }
      } catch (error) {
        console.warn(`Could not compare audio "${work.title}": ${error.message}`);
      }
    }

    if (currentAI && existingAudios.length > 0 && successfulAIComparisons === 0) {
      console.warn("No existing audio CLAP embeddings were compared; spectral fallback was used.");
    }

    const spectralScore = bestDetails?.spectralScore || 0;
    const clapScore = bestDetails?.clapScore || 0;
    const isSimilar =
      spectralScore >= AUDIO_THRESHOLD ||
      (highestSimilarity >= AUDIO_THRESHOLD && spectralScore >= 65 && clapScore >= 88);

    return {
      similarityScore: highestSimilarity,
      isSimilar,
      existingWork: mostSimilarWork,
      similarityDetails: bestDetails || {
        method: currentAI ? "CLAP+spectral-no-comparable-audio" : "spectral-fallback-no-comparable-audio",
        threshold: AUDIO_THRESHOLD,
        aiAvailable: Boolean(currentAI),
      },
    };
  }

  const isTextFile = mimeType &&
    (mimeType.startsWith("text/") || mimeType === "application/json");

  if (isTextFile) return calculateTextSimilarity(filePath, fileHash);

  // Extension fallback for text files whose MIME type is missing or generic.
  if (/\.(txt|md|csv|json|xml|html|htm)$/i.test(filePath)) {
    return calculateTextSimilarity(filePath, fileHash);
  }

  return { similarityScore: 0, isSimilar: false, existingWork: null };
};

module.exports = {
  calculateImageSimilarity,
  calculateVideoSimilarity,
  calculateAudioSimilarity,
  calculateTextSimilarity,
  calculateSimilarity,
  getAIHealth,
};
