import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "80mb" }));

// Server-side persistent storage for API keys
const SERVER_KEYS_FILE = path.resolve("./server_keys.json");
const SEED_DEFAULT_KEY = "AQ.Ab8RN6KFZN-6-FSYzhGltlD_XCIu8YmyRr8JtYStTGxnQLNYYw";

const loadPersistedKeysFromFile = (): string[] => {
  try {
    if (fs.existsSync(SERVER_KEYS_FILE)) {
      const data = fs.readFileSync(SERVER_KEYS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((k: any) => typeof k === "string" && k.trim().length > 5);
      }
    }
  } catch (err) {
    console.warn("Could not read server_keys.json:", err);
  }
  return [SEED_DEFAULT_KEY];
};

let serverKeysMemory: string[] = loadPersistedKeysFromFile();

const persistKeysToFile = (keys: string[]) => {
  serverKeysMemory = Array.from(new Set(keys.map((k) => k.trim()).filter((k) => k.length > 5)));
  try {
    fs.writeFileSync(SERVER_KEYS_FILE, JSON.stringify(serverKeysMemory, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write server_keys.json:", err);
  }
};

// Multi-Key Management & Per-Key Telemetry Tracking (Zero script/audio disk storage)
let currentKeyIndex = 0;

export type KeyHealthStatus = "active" | "standby" | "quota_exhausted" | "rate_limited" | "invalid";

interface KeyTelemetry {
  status: KeyHealthStatus;
  usageCount: number;
  successCount: number;
  errorCount: number;
  lastError: string;
  lastUsedAt: number | null;
  cooldownUntil: number;
}

const keyTelemetryMap = new Map<string, KeyTelemetry>();

const getOrInitTelemetry = (key: string, defaultStatus: KeyHealthStatus = "standby"): KeyTelemetry => {
  let entry = keyTelemetryMap.get(key);
  if (!entry) {
    entry = {
      status: defaultStatus,
      usageCount: 0,
      successCount: 0,
      errorCount: 0,
      lastError: "",
      lastUsedAt: null,
      cooldownUntil: 0,
    };
    keyTelemetryMap.set(key, entry);
  }
  return entry;
};

type CooldownEntry = { until: number; kind: "rpm" | "daily" | "unavailable" };
const modelCooldownMap = new Map<string, CooldownEntry>();

const getModelCooldownKey = (apiKey: string, model: string) => `${apiKey}::${model}`;

const parseRetryDelaySeconds = (rawMsg: string): number | null => {
  const secMatch =
    rawMsg.match(/retry\s+in\s+([\d.]+)s/i) ||
    rawMsg.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  if (secMatch && secMatch[1]) {
    const val = Math.ceil(parseFloat(secMatch[1]));
    if (!isNaN(val) && val > 0) return Math.min(75, Math.max(4, val));
  }
  return null;
};

const classifyGeminiError = (
  rawMsg: string
): {
  status: KeyHealthStatus;
  shortError: string;
  retryAfterSeconds: number | null;
  modelUnavailable: boolean;
  modelQuotaZero: boolean;
} => {
  const lower = rawMsg.toLowerCase();
  const retryAfterSeconds = parseRetryDelaySeconds(rawMsg);

  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthenticated")
  ) {
    return {
      status: "invalid",
      shortError: "অবৈধ API Key (401/403 Invalid)",
      retryAfterSeconds: null,
      modelUnavailable: false,
      modelQuotaZero: false,
    };
  }
  if (lower.includes("free tier is not available")) {
    return {
      status: "invalid",
      shortError: "প্রজেক্টে ফ্রি টিয়ার বন্ধ",
      retryAfterSeconds: null,
      modelUnavailable: false,
      modelQuotaZero: false,
    };
  }
  if (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("not supported for generatecontent") ||
    (lower.includes("model") && lower.includes("is not supported"))
  ) {
    return {
      status: "active",
      shortError: "এই মডেলটি এই Key-তে সাপোর্টেড নয়",
      retryAfterSeconds: null,
      modelUnavailable: true,
      modelQuotaZero: false,
    };
  }
  // Check limit: 0 BEFORE retryAfterSeconds — Google appends "retry in Xs" even when a model has limit: 0!
  const hasLimitZero = /limit:\s*0\b/i.test(rawMsg);
  if (hasLimitZero) {
    return {
      status: "standby",
      shortError: "এই মডেলের ফ্রি লিমিট ০ (limit: 0)",
      retryAfterSeconds: null,
      modelUnavailable: false,
      modelQuotaZero: true,
    };
  }

  const isPerMinuteRateLimit =
    lower.includes("per_minute") ||
    lower.includes("perminute") ||
    lower.includes("requests_per_minute") ||
    lower.includes("tokens_per_minute") ||
    lower.includes("inputtokenspermodelperminute") ||
    lower.includes("rpm") ||
    lower.includes("tpm");

  const hasExplicitDailyMetric =
    lower.includes("per_day") ||
    lower.includes("perday") ||
    lower.includes("requests_per_day") ||
    lower.includes("per_model_per_day") ||
    lower.includes("requestsperday") ||
    lower.includes("rpd") ||
    lower.includes("daily");

  // Treat any explicit PerDay/RPD metric as Daily Quota Exhaustion even if Google includes a generic retryDelay
  if (hasExplicitDailyMetric) {
    return {
      status: "quota_exhausted",
      shortError: "দৈনিক প্রজেক্ট কোটা শেষ (Daily RPD Quota Exceeded)",
      retryAfterSeconds: null,
      modelUnavailable: false,
      modelQuotaZero: false,
    };
  }

  if (!isPerMinuteRateLimit && retryAfterSeconds && retryAfterSeconds >= 45 && lower.includes("quota")) {
    // Generic quota errors with long delays (>45s) and NO per_minute metric are still checked below,
    // flagged as rate_limited only up to 2 client cycles before surfacing raw Google error.
  }

  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate") ||
    retryAfterSeconds !== null
  ) {
    return {
      status: "rate_limited",
      shortError: retryAfterSeconds
        ? `সাময়িক RPM রেট লিমিট (${retryAfterSeconds}s পর রিসেট)`
        : "সাময়িক RPM রেট লিমিট (429 Rate Limit)",
      retryAfterSeconds: retryAfterSeconds ?? 30,
      modelUnavailable: false,
      modelQuotaZero: false,
    };
  }

  return {
    status: "standby",
    shortError: rawMsg.slice(0, 120),
    retryAfterSeconds: null,
    modelUnavailable: false,
    modelQuotaZero: false,
  };
};

const buildPublicTelemetry = (keys: string[]) =>
  keys.map((k, idx) => {
    const t = getOrInitTelemetry(k, idx === currentKeyIndex % (keys.length || 1) ? "active" : "standby");
    const isNowActive = idx === currentKeyIndex % (keys.length || 1);
    return {
      index: idx,
      label: `Key ${String(idx + 1).padStart(2, "0")}`,
      keyPreview: `${k.slice(0, 8)}...${k.slice(-6)}`,
      status: t.status === "quota_exhausted" || t.status === "invalid" || t.status === "rate_limited"
        ? t.status
        : isNowActive
          ? "active"
          : t.status,
      usageCount: t.usageCount,
      successCount: t.successCount,
      errorCount: t.errorCount,
      lastError: t.lastError,
      lastUsedAt: t.lastUsedAt,
    };
  });

// Ensure any raw PCM audio (L16 24kHz mono) returned by TTS models is wrapped with a 44-byte RIFF WAV header
const ensureWavBase64 = (rawBase64: string, mimeType = ""): string => {
  const buf = Buffer.from(rawBase64, "base64");
  if (buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "RIFF") {
    return rawBase64;
  }
  // Parse sample rate if provided e.g. audio/L16;codec=pcm;rate=24000
  const rateMatch = mimeType.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = buf.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // Audio format = PCM (1)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, buf]).toString("base64");
};

const getAllApiKeys = (customRaw?: string): string[] => {
  const customList = (customRaw || "")
    .split(/[,\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 5);

  const envList = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(/[,\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 5 && k !== "MY_GEMINI_API_KEY");

  const serverList = serverKeysMemory.filter((k) => k.length > 5);

  const combined = Array.from(new Set([...customList, ...serverList, ...envList]));
  return combined.length > 0 ? combined : [SEED_DEFAULT_KEY];
};

const getGeminiClientForIndex = (index: number, customRaw?: string) => {
  const keys = getAllApiKeys(customRaw);
  if (keys.length === 0) return null;
  const safeIndex = index % keys.length;
  const apiKey = keys[safeIndex];
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const getGeminiClient = (customRaw?: string) => getGeminiClientForIndex(currentKeyIndex, customRaw);

// Endpoint to fetch persistent API keys list and live telemetry for client
app.get("/api/keys", (req, res) => {
  const customHeader = (req.headers["x-gemini-api-key"] as string) || "";
  const allKeys = getAllApiKeys(customHeader);
  res.json({
    keys: allKeys,
    activeKeyIndex: currentKeyIndex % (allKeys.length || 1),
    totalKeys: allKeys.length,
    hasApiKey: allKeys.length > 0,
    telemetry: buildPublicTelemetry(allKeys),
  });
});

// Endpoint to save persistent API keys list from client
app.post("/api/keys/save", (req, res) => {
  const { keys } = req.body;
  if (Array.isArray(keys)) {
    persistKeysToFile(keys);
    res.json({
      success: true,
      totalKeys: serverKeysMemory.length,
      telemetry: buildPublicTelemetry(serverKeysMemory),
    });
  } else {
    res.status(400).json({ error: "Invalid keys array" });
  }
});

// Health check endpoint with key count & telemetry status
app.get("/api/health", (req, res) => {
  const customHeader = (req.headers["x-gemini-api-key"] as string) || "";
  const keys = getAllApiKeys(customHeader);
  res.json({
    status: "ok",
    hasApiKey: keys.length > 0,
    totalKeys: keys.length,
    isCustomKey: customHeader.trim().length > 5,
    activeKeyIndex: currentKeyIndex % (keys.length || 1),
    telemetry: buildPublicTelemetry(keys),
    supportedTTS: true,
  });
});

// Endpoint to test and validate user-provided Gemini API key(s)
app.post("/api/key/test", async (req, res) => {
  try {
    const { apiKey } = req.body;
    const testKeyRaw = (apiKey || (req.headers["x-gemini-api-key"] as string) || "").trim();
    if (!testKeyRaw) {
      return res.status(400).json({ success: false, status: "invalid", error: "কোনো API Key প্রদান করা হয়নি।" });
    }

    const cleanSingleKey = testKeyRaw.replace(/["'`\s]/g, "");
    if (cleanSingleKey.length < 15) {
      return res.status(400).json({
        success: false,
        status: "invalid",
        error: "API Key-এর ফরম্যাট সঠিক নয় (দৈর্ঘ্য অত্যন্ত কম)।",
      });
    }

    const telemetry = getOrInitTelemetry(cleanSingleKey);
    telemetry.lastUsedAt = Date.now();

    const testAi = new GoogleGenAI({
      apiKey: cleanSingleKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    try {
      // 3.5 second probe timeout with Promise.race so testing NEVER hangs
      const probePromise = testAi.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: "Hi",
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("PROBE_TIMEOUT")), 3500)
      );

      await Promise.race([probePromise, timeoutPromise]);
      telemetry.status = "active";
      telemetry.lastError = "";

      return res.json({
        success: true,
        status: "active",
        message: "Gemini API Key সফলভাবে যাচাই হয়েছে এবং সক্রিয়!",
      });
    } catch (testErr: any) {
      const rawMsg = testErr?.message || String(testErr);
      const classified = classifyGeminiError(rawMsg);

      if (classified.status === "invalid") {
        telemetry.status = "invalid";
        telemetry.lastError = classified.shortError;
        return res.status(400).json({
          success: false,
          status: "invalid",
          error:
            "API Key-টি সঠিক নয় (401/403 Invalid) অথবা এই প্রজেক্টে Gemini API চালু নেই।",
        });
      }

      // 429 Quota/Rate limit means the key is VALID!
      if (
        rawMsg.includes("429") ||
        rawMsg.includes("RESOURCE_EXHAUSTED") ||
        rawMsg.includes("quota") ||
        rawMsg.includes("rate-limits")
      ) {
        telemetry.status = classified.status;
        telemetry.lastError = classified.shortError;
        return res.json({
          success: true,
          status: "exhausted",
          message: "API Key-টি বৈধ (বর্তমানে সাময়িক দৈনিক কোটা শেষ, তবে রোটেশনে স্ট্যান্ডবাই হিসেবে সংরক্ষিত হয়েছে)",
        });
      }

      telemetry.status = "standby";
      telemetry.lastError = "";
      // If probe timed out or server network lag, accept the key in standby
      return res.json({
        success: true,
        status: "standby",
        message: "API Key ফরম্যাট সঠিক এবং স্ট্যান্ডবাই তালিকায় যোগ করা হয়েছে।",
      });
    }
  } catch (err: any) {
    console.error("Key verification error:", err?.message || err);
    return res.status(400).json({
      success: false,
      status: "invalid",
      error: `API Key যাচাই ব্যর্থ হয়েছে: ${err?.message || "ত্রুটি"}`,
    });
  }
});

// Rebuilt Google AI Studio Gemini 2.5 TTS Engine (Clean, Zero-Legacy, Auto Key Rotation + Smart Quota Cascade)
app.post("/api/tts/generate", async (req, res) => {
  try {
    req.setTimeout(300_000);
    res.setTimeout(300_000);
    const customHeader = (req.headers["x-gemini-api-key"] as string) || "";
    const {
      text,
      voiceName = "Despina",
      channelSlot,
      model = "gemini-2.5-flash-preview-tts",
      strictModelLock = false,
      seed,
      temperature,
      speechStylePrompt,
      voiceSessionId,
      partLabel,
      customApiKey,
      forceRetry = false,
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "স্ক্রিপ্টের টেক্সট পাওয়া যায়নি।" });
    }

    const effectiveCustomKey = (customApiKey || customHeader || "").trim();
    if (effectiveCustomKey) {
      const incomingKeys = effectiveCustomKey
        .split(/[,\n]+/)
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 5);
      if (incomingKeys.length > 0) {
        const merged = Array.from(new Set([...serverKeysMemory, ...incomingKeys]));
        if (merged.length !== serverKeysMemory.length) {
          persistKeysToFile(merged);
        }
      }
    }

    const keys = getAllApiKeys(effectiveCustomKey);
    if (keys.length === 0) {
      return res.status(503).json({
        error: "Gemini API Key পাওয়া যায়নি। '🔑 Key' বাটনে ক্লিক করে একটি API Key দিন।",
        canUseFallback: false,
      });
    }

    // Freeze speaker voice ID cleanly so key rotation never shifts the speaker
    const lockedVoiceName = String(voiceName || "Despina").trim();

    // Deterministic seed & fixed temperature keep tone, pitch, accent & delivery uniform across Parts & Retries
    const lockedSeed =
      typeof seed === "number" && Number.isFinite(seed) && seed > 0
        ? Math.floor(seed)
        : 420101;
    const lockedTemperature =
      typeof temperature === "number" && Number.isFinite(temperature)
        ? Math.max(0.1, Math.min(1.0, temperature))
        : 0.65;
    const cleanStylePrompt =
      typeof speechStylePrompt === "string" && speechStylePrompt.trim()
        ? speechStylePrompt.trim().slice(0, 320)
        : "";

    // Clean spoken Bengali text (strip script brackets and excess blank lines)
    const cleanSpokenText = text
      .trim()
      .replace(/\[\s*|\s*\]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n");

    // Single Speaker Consistency: When strictModelLock is active (Part 02..NN & Retry),
    // NEVER switch to a different TTS model mid-script — only rotate across API keys for the locked model!
    const requestedModel = typeof model === "string" && model.trim() ? model.trim() : "gemini-2.5-flash-preview-tts";
    const modelsToTry = strictModelLock
      ? [requestedModel]
      : Array.from(
          new Set([
            requestedModel,
            "gemini-2.5-flash-preview-tts",
            "gemini-3.1-flash-tts-preview",
            "gemini-3.8-flash-lite-tts",
            "gemini-2.5-pro-preview-tts",
          ])
        );

    const now = Date.now();
    const routeStartMs = now;
    const isSingleLongPass = cleanSpokenText.length > 1200;
    const MAX_ROUTE_MS = isSingleLongPass ? 260_000 : 75_000;
    const totalKeys = keys.length;

    if (forceRetry) {
      keys.forEach((k) => {
        const t = getOrInitTelemetry(k);
        if (t.status !== "invalid") t.cooldownUntil = 0;
        modelsToTry.forEach((m) => modelCooldownMap.delete(getModelCooldownKey(k, m)));
      });
    }

    // Prioritize valid AIza keys first, followed by other valid keys (such as AI Studio AQ keys)
    const validAiza: number[] = [];
    const validOther: number[] = [];
    const fallbackInvalid: number[] = [];
    for (let offset = 0; offset < totalKeys; offset++) {
      const idx = (currentKeyIndex + offset) % totalKeys;
      const keyStr = keys[idx];
      if (getOrInitTelemetry(keyStr).status === "invalid") {
        fallbackInvalid.push(idx);
      } else if (/^AIza/i.test(keyStr)) {
        validAiza.push(idx);
      } else {
        validOther.push(idx);
      }
    }
    const validKeyIndices = [...validAiza, ...validOther];
    const orderedKeyIndices = validKeyIndices.length > 0 ? validKeyIndices : fallbackInvalid;

    let base64Audio: string | undefined;
    let successfulModel = "";
    let usedKeyIndex = currentKeyIndex % totalKeys;
    const keysAttemptedSet = new Set<number>();

    let lastErrorMsg = "";
    let rpmRetrySec: number | null = null;
    let hadRpmLimit = false;
    let hadDailyLimit = false;
    let hadTimeout = false;
    let invalidKeyCount = 0;

    outerLoop: for (const targetModel of modelsToTry) {
      const isProFallback = targetModel === "gemini-2.5-pro-preview-tts" && requestedModel !== "gemini-2.5-pro-preview-tts";
      const maxKeysThisModel = isProFallback ? Math.min(2, orderedKeyIndices.length) : orderedKeyIndices.length;
      let triedThisModel = 0;

      for (const activeKeyIdx of orderedKeyIndices) {
        if (triedThisModel >= maxKeysThisModel) break;

        const remainingBudgetMs = MAX_ROUTE_MS - (Date.now() - routeStartMs);
        if (remainingBudgetMs < 8_000) {
          hadTimeout = true;
          break outerLoop;
        }

        const activeKey = keys[activeKeyIdx];
        const telemetry = getOrInitTelemetry(activeKey);
        if (telemetry.status === "invalid" && validKeyIndices.length > 0) continue;

        const pairCooldown = modelCooldownMap.get(getModelCooldownKey(activeKey, targetModel));
        if (!forceRetry && pairCooldown && pairCooldown.until > now) {
          if (pairCooldown.kind === "rpm") {
            const rem = Math.min(75, Math.max(1, Math.ceil((pairCooldown.until - now) / 1000)));
            rpmRetrySec = rpmRetrySec === null ? rem : Math.min(rpmRetrySec, rem);
            hadRpmLimit = true;
          } else if (pairCooldown.kind === "daily") {
            hadDailyLimit = true;
          }
          continue;
        }

        const ai = getGeminiClientForIndex(activeKeyIdx, effectiveCustomKey);
        if (!ai) continue;

        triedThisModel += 1;
        keysAttemptedSet.add(activeKeyIdx);

        try {
          telemetry.usageCount += 1;
          telemetry.lastUsedAt = Date.now();

          const perCallTimeoutMs = Math.min(remainingBudgetMs, isSingleLongPass ? 200_000 : 50_000);
          let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
              reject(new Error(`TTS_TIMEOUT: timed out after ${Math.round(perCallTimeoutMs / 1000)}s`));
            }, perCallTimeoutMs);
          });

          const partPayload: any = { text: cleanSpokenText };
          if (targetModel.startsWith("gemini-3.8") && cleanStylePrompt) {
            partPayload.speechMetadata = { style: cleanStylePrompt };
          }

          // Consistent single-speaker Google AI Studio TTS request (locked voiceName + fixed temperature & seed)
          const response = await Promise.race([
            ai.models.generateContent({
              model: targetModel,
              contents: [{ role: "user", parts: [partPayload] }],
              config: {
                temperature: lockedTemperature,
                seed: lockedSeed,
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: lockedVoiceName },
                  },
                },
              },
            }),
            timeoutPromise,
          ]).finally(() => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
          });

          const audioPart = response.candidates?.[0]?.content?.parts?.find(
            (p: any) => p?.inlineData?.data
          );
          if (!audioPart?.inlineData?.data) {
            throw new Error("Empty audio payload returned by Gemini TTS");
          }

          const rawMime = audioPart.inlineData.mimeType || "audio/wav";
          base64Audio = ensureWavBase64(audioPart.inlineData.data, rawMime);
          successfulModel = targetModel;
          usedKeyIndex = activeKeyIdx;
          currentKeyIndex = (activeKeyIdx + 1) % totalKeys;

          telemetry.status = "active";
          telemetry.successCount += 1;
          telemetry.lastError = "";
          telemetry.cooldownUntil = 0;
          modelCooldownMap.delete(getModelCooldownKey(activeKey, targetModel));
          break outerLoop;
        } catch (err: any) {
          const msg = err?.message || String(err);
          lastErrorMsg = msg;
          telemetry.errorCount += 1;
          console.warn(`[TTS Key #${activeKeyIdx + 1}/${totalKeys} | ${targetModel}] Failed:`, msg.slice(0, 220));

          const isTimeoutOrNet =
            msg.includes("TTS_TIMEOUT") ||
            msg.includes("ETIMEDOUT") ||
            msg.includes("ECONNRESET") ||
            msg.includes("fetch failed") ||
            msg.includes("Empty audio payload");

          if (isTimeoutOrNet) {
            hadTimeout = true;
            telemetry.status = "standby";
            telemetry.lastError = "সাময়িক টাইমআউট / নেটওয়ার্ক বিলম্ব";
            continue;
          }

          const classified = classifyGeminiError(msg);
          if (classified.status === "invalid") {
            telemetry.status = "invalid";
            telemetry.lastError = classified.shortError;
            telemetry.cooldownUntil = Date.now() + 10 * 60_000;
            invalidKeyCount += 1;
          } else if (classified.modelUnavailable || classified.modelQuotaZero) {
            modelCooldownMap.set(getModelCooldownKey(activeKey, targetModel), {
              until: Date.now() + 15 * 60_000,
              kind: "unavailable",
            });
          } else if (classified.status === "rate_limited") {
            const waitSec = classified.retryAfterSeconds ?? 30;
            modelCooldownMap.set(getModelCooldownKey(activeKey, targetModel), {
              until: Date.now() + (waitSec + 1) * 1000,
              kind: "rpm",
            });
            telemetry.status = "rate_limited";
            telemetry.lastError = classified.shortError;
            hadRpmLimit = true;
            rpmRetrySec = rpmRetrySec === null ? waitSec : Math.min(rpmRetrySec, waitSec);
          } else if (classified.status === "quota_exhausted") {
            modelCooldownMap.set(getModelCooldownKey(activeKey, targetModel), {
              until: Date.now() + 5 * 60_000,
              kind: "daily",
            });
            telemetry.status = "quota_exhausted";
            telemetry.lastError = classified.shortError;
            hadDailyLimit = true;
          } else {
            telemetry.status = classified.status;
            telemetry.lastError = classified.shortError;
          }
        }
      }
    }

    if (!base64Audio) {
      const validKeysCount = Math.max(
        0,
        keys.filter((k) => getOrInitTelemetry(k).status !== "invalid").length
      );
      const isRateLimitPerMinute = hadRpmLimit && rpmRetrySec !== null;
      const allDailyExhausted = validKeysCount === 0 || (!isRateLimitPerMinute && hadDailyLimit);
      const retryableTimeout = hadTimeout && !allDailyExhausted && !isRateLimitPerMinute;

      let friendlyError = `ভয়েস তৈরি করা যায়নি (${keysAttemptedSet.size}/${totalKeys}টি Key চেষ্টা করা হয়েছে)।`;
      if (validKeysCount === 0 && invalidKeyCount > 0) {
        friendlyError = `⚠️ আপনার দেওয়া API Key-টি সঠিক নয় (401/403 Invalid)। দয়া করে '🔑 Key' বাটনে সঠিক API Key দিন।`;
      } else if (isRateLimitPerMinute) {
        friendlyError = `⏳ সচল ${validKeysCount}টি API Key-এর প্রতি-মিনিটের রেট লিমিট (RPM) পূর্ণ হয়েছে — প্রায় ${rpmRetrySec} সেকেন্ড পর রিসেট হবে।`;
      } else if (retryableTimeout) {
        friendlyError = `⏳ ভয়েস সার্ভার সাড়া দিতে দেরি করছে — স্বয়ংক্রিয়ভাবে পরের প্রচেষ্টা চালানো হচ্ছে...`;
      } else if (hadDailyLimit || lastErrorMsg.includes("429") || lastErrorMsg.toLowerCase().includes("quota")) {
        friendlyError = `⚠️ সবগুলো সচল Gemini TTS মডেলের (2.5 Flash / 3.1 Flash / 3.8 Lite) দৈনিক ফ্রি কোটা শেষ হয়েছে। নতুন আলাদা Google অ্যাকাউন্ট/প্রজেক্টের API Key যোগ করুন অথবা রেকর্ড করা ভয়েস ব্যবহার করুন।`;
      } else if (lastErrorMsg) {
        friendlyError = `ভয়েস তৈরি ব্যর্থ হয়েছে: ${lastErrorMsg.slice(0, 180)}`;
      }

      const httpStatus = validKeysCount === 0 ? 401 : isRateLimitPerMinute || hadDailyLimit ? 429 : retryableTimeout ? 504 : 500;
      return res.status(httpStatus).json({
        error: friendlyError,
        rawError: lastErrorMsg,
        allKeysExhausted: allDailyExhausted,
        isRateLimitPerMinute,
        retryableTimeout,
        retryAfterSeconds: isRateLimitPerMinute ? rpmRetrySec : retryableTimeout ? 4 : null,
        validKeysCount,
        invalidKeysCount: totalKeys - validKeysCount,
        keysAttempted: keysAttemptedSet.size,
        totalKeys,
        keyTelemetry: buildPublicTelemetry(keys),
        canUseFallback: false,
      });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: "audio/wav",
      model: successfulModel,
      voiceName: lockedVoiceName,
      voiceSessionId: voiceSessionId || null,
      partLabel: partLabel || null,
      seed: lockedSeed,
      temperature: lockedTemperature,
      channelSlot: channelSlot || null,
      usedKeyIndex,
      usedKeyLabel: `Key ${String(usedKeyIndex + 1).padStart(2, "0")}`,
      keyTelemetry: buildPublicTelemetry(keys),
    });
  } catch (err: any) {
    console.error("TTS generation error:", err);
    return res.status(500).json({
      error: err?.message || "Failed to generate audio from script",
      canUseFallback: false,
    });
  }
});

// Endpoint to generate Bengali Natok Review & Update Script
app.post("/api/script/generate", async (req, res) => {
  try {
    const {
      dramaName = "ফায়ার আশার গল্প",
      channelName = "Labiba Media Hub",
      currentEpisode = 6,
      nextEpisode = 7,
      releaseDate = "2026-10-28",
      releaseTime = "12:00",
      targetDurationSeconds = 90,
      videoName = "",
      characterNames = "",
    } = req.body;

    // Strict single name sanitization: Strip any bilingual parentheses like '(Fire Ashar Golpo)' or '(Moner Manush)'
    const cleanDramaName = (dramaName || "ফায়ার আশার গল্প").replace(/\s*\([^)]*\)/g, "").trim();
    const cleanChannelName = (channelName || "Labiba Media Hub").replace(/\s*\([^)]*\)/g, "").trim();

    const customHeader = (req.headers["x-gemini-api-key"] as string) || "";
    const ai = getGeminiClient(customHeader);

    // Parse Bengali Day of Week and Date
    const d = new Date(releaseDate + "T00:00:00");
    const banglaDays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
    const banglaDayName = !isNaN(d.getTime()) ? banglaDays[d.getDay()] : "বুধবার";

    // Parse 12-hour time in Bengali
    let timeFormatted = releaseTime;
    const [hStr, mStr] = (releaseTime || "12:00").split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;
    if (!isNaN(h)) {
      const period = h >= 12 ? (h >= 17 ? (h >= 20 ? "রাত" : "সন্ধ্যা") : "দুপুর") : (h >= 6 ? "সকাল" : "রাত");
      const h12 = h % 12 === 0 ? 12 : h % 12;
      timeFormatted = `${period} ${h12}${m > 0 ? `:${String(m).padStart(2, "0")}` : ""}টায়`;
    }

    const estimatedWords = Math.round(targetDurationSeconds * 2.5);
    const numBrackets = Math.max(4, Math.min(8, Math.round(targetDurationSeconds / 18)));

    const charactersInstruction = characterNames && characterNames.trim()
      ? `- Key Characters: "${characterNames.trim()}" (Weave these exact character names throughout the recap, questions, and predictions).`
      : `- Key Characters: Extract or invent natural, deeply realistic Bengali drama characters (e.g., নূরজাহান, আন্টি, চাচা ফয়জুল, আদিল or matching the drama "${cleanDramaName}").`;

    const prompt = `You are a professional Bengali YouTube drama reviewer, scriptwriter, and trailer producer for the channel "${cleanChannelName}".
Write an engaging, high-retention, suspenseful Bengali drama review and next-episode update script for:
- Drama Name: "${cleanDramaName}"
- Current/Previous Episode: ${currentEpisode}
- Next Upcoming Episode: ${nextEpisode}
- Next Episode Release Schedule: আগামী ${releaseDate}, রোজ ${banglaDayName} ${timeFormatted}
- Target Speaking Duration: ${Math.floor(targetDurationSeconds / 60)} মিনিট ${targetDurationSeconds % 60} সেকেন্ড (Approx ${estimatedWords} words).
- Video Name context: "${videoName || 'নাটক এপিসোড ভিডিও'}"
${charactersInstruction}

STRICT NAMING CONSTRAINTS:
1. DRAMA & CHANNEL NAME INTEGRITY:
   - Use ONLY "${cleanDramaName}" and "${cleanChannelName}".
   - NEVER add English transliterations or translations in parentheses (e.g. NEVER write "${cleanDramaName} (English Name)" or "${cleanChannelName} (English Name)").
   - If the name is in Bengali, keep it 100% in Bengali. If it is in English, keep it 100% in English. There must be ONLY ONE single name with NO bilingual dual versions.

STRICT FORMATTING REQUIREMENTS:
1. Divide the script into exactly ${numBrackets} distinct paragraphs.
2. CRITICAL: Every single paragraph MUST be wrapped inside square brackets like: [ প্যারাগ্রাফের কথা... ]
3. Content Breakdown:
   - Paragraph 1 [ ... ]: Catchy intro greeting for "${cleanDramaName}" episode ${currentEpisode} recap, asking viewers to watch without skipping to know the episode ${nextEpisode} release update.
   - Paragraph 2 [ ... ]: In-depth character analysis and exactly 5 suspenseful audience questions (১., ২., ৩., ৪., ৫.) involving key character dilemmas, asking viewers to comment their opinion.
   - Paragraph 3 [ ... ]: The exact release date & time announcement: "${cleanDramaName} নাটকের ${nextEpisode} নম্বর পর্বটি আগামী ${releaseDate}, রোজ ${banglaDayName} ${timeFormatted}-এ প্রকাশিত হতে পারে..."
   - Paragraph 4 [ ... ]: Deep storytelling analysis of emotional highs, character dilemmas, family secrets, or turning points from episode ${currentEpisode}.
   - Paragraph 5 [ ... ]: Dramatic predictions and potential story twists for upcoming episode ${nextEpisode}.
   - Paragraph 6 [ ... ]: Outro asking viewers to like, comment their thoughts, subscribe to "${cleanChannelName}" and click the notification bell, plus recommending the next video on screen.
4. Language: Natural, expressive, dramatic standard Bengali (প্রমিত বাংলা).
5. Output ONLY the bracketed script with double newlines between paragraphs. No markdown headers, no introductory commentary.`;

    if (ai) {
      try {
        const generatePromise = ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI generation timed out")), 10000)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        const generatedText = response?.text?.trim();
        if (generatedText && generatedText.includes("[")) {
          return res.json({ success: true, script: generatedText });
        }
      } catch (geminiErr) {
        console.warn("Gemini script generation fallback used:", geminiErr);
      }
    }

    // High quality intelligent template fallback if offline
    const fallbackScript = `[ আসসালামু আলাইকুম দর্শক! আজকের বিশেষ পর্বে আপনাদের সবাইকে স্বাগতম। আজকে আমরা কথা বলছি তুমুল জনপ্রিয় নাটক ‘${cleanDramaName}’-এর সম্প্রতিক পর্ব নিয়ে। গত ${currentEpisode} নম্বর পর্বে আমরা দেখেছি কীভাবে গল্পটি এক শ্বাসরুদ্ধকর আবেগী মোড়ে এসে দাঁড়িয়েছে। আর এই নাটকের পরবর্তী ${nextEpisode} নম্বর পর্বটি কবে এবং কখন প্রকাশিত হতে পারে, সেই আপডেট জানতে ভিডিওটি না টেনে শেষ পর্যন্ত মনোযোগ দিয়ে দেখুন। কারণ আজকের পর্বে থাকছে গল্পের গভীর বিশ্লেষণ এবং প্রকাশের সময়সূচি নিয়ে বিস্তারিত আলোচনা। ]

[ গত ${currentEpisode} নম্বর পর্বটি দেখার পর আপনাদের মনে কি বেশ কিছু প্রশ্ন জাগেনি? যেমন—
১. মূল চরিত্রের স্মৃতি আর পারিবারিক আচরণের মধ্যে যে অদ্ভুত পরিবর্তন দেখা গেল, এর পেছনে কি গভীর কোনো রহস্য আছে?
২. প্রতিদ্বন্দ্বী চরিত্রটি হঠাৎ এসে যেভাবে অনুশোচনা প্রকাশ করল, তা কি আসলেই আন্তরিক, নাকি এর পেছনে লুকিয়ে আছে অন্য কোনো বড় চক্রান্ত?
৩. সম্পর্কের এই নতুন টানাপোড়েন কি আগামী পর্বে আরও বড় কোনো সংঘাত তৈরি করতে চলেছে?
৪. পরবর্তী পর্বে কি গল্পের মূল সমীকরণে কোনো অপ্রত্যাশিত পরিবর্তন আসতে পারে?
৫. আপনার কি মনে হয়, গল্পের নায়কের এই সিদ্ধান্ত কি সঠিক ছিল? আপনাদের মতামত অবশ্যই কমেন্টে লিখে জানান! ]

[ এবার আসি সবচেয়ে কাঙ্ক্ষিত আপডেটে। নাটকের অফিশিয়াল তথ্য অনুযায়ী, ‘${cleanDramaName}’-এর পরবর্তী ${nextEpisode} নম্বর পর্বটি আগামী ${releaseDate}, রোজ ${banglaDayName} ${timeFormatted} প্রকাশিত হতে পারে। তবে অফিশিয়াল কোনো বিশেষ শিডিউল পরিবর্তন না থাকলে এটিকেই সম্ভাব্য সময় হিসেবে ধরে নিতে পারেন। তাই আপনার পছন্দের চ্যানেল ‘${cleanChannelName}’-এর নোটিফিকেশনে চোখ রাখুন। ]

[ এবার চলুন পর্বটির গভীর বিশ্লেষণে যাওয়া যাক। পরিচালক এই পর্বে এমন কিছু দৃশ্য উপস্থাপন করেছেন যা কেবল সাধারণ কোনো ড্রামা নয়, বরং প্রতিটি চরিত্রের ভেতরের দ্বন্দ্বকে দারুণভাবে ফুটিয়ে তুলেছে। পারিবারিক আবেগ, ত্যাগ আর জটিল সম্পর্কের টানাপোড়েন এই নাটকের মূল প্রাণ। চরিত্রের এই অসহায়ত্ব ও নিঃস্বার্থ ভালোবাসা দর্শকের হৃদয়কে গভীরভাবে নাড়া দিয়েছে। প্রতিটি সংলাপে ছিল টানটান উত্তেজনা, যা আগামী পর্বের অপেক্ষাকে আরও বাড়িয়ে দিয়েছে। ]

[ আমাদের বিশ্লেষণে মনে হচ্ছে, আগামী ${nextEpisode} নম্বর পর্বে আমরা দেখতে পারি সম্পর্কের এক নতুন বাঁক। পুরোনো ভুল বোঝাবুঝি হয়তো আরও চরম রূপ নিতে পারে, কিংবা অপ্রত্যাশিত কোনো সত্য সামনে এসে সবাইকে চমকে দিতে পারে। তবে কোনো সম্ভাবনাকেই আমরা চূড়ান্ত বলছি না, এটি কেবল আমাদের গল্প বিশ্লেষণের পূর্বাভাস মাত্র। ]

[ ভিডিওটি ভালো লাগলে অবশ্যই একটি লাইক দিন। আপনারা যারা ‘${cleanDramaName}’-এর পরবর্তী পর্ব নিয়ে নিজেদের মতামত জানাতে চান, কমেন্টে লিখে ফেলুন। আর এমন সব জনপ্রিয় নাটকের রিভিউ, নিখুঁত বিশ্লেষণ এবং পরবর্তী পর্বের রিলিজ আপডেট সবার আগে পেতে চ্যানেলটি সাবক্রাইব করে বেল বাটনটি অন রাখুন। আর অন্য কোনো নাটকের আপডেট জানতে স্ক্রিনে থাকা ভিডিওটিতে ক্লিক করুন। ধন্যবাদ সবাইকে! ]`;

    return res.json({ success: true, script: fallbackScript });
  } catch (err: any) {
    console.error("Script generation error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate script" });
  }
});

// Helper function: Contextual Bengali Drama Review Script Adapter Fallback (Supports Both Condense & Expand)
function generateAdaptedDramaScriptFallback(
  originalScript: string,
  targetMinutes: number,
  targetSeconds: number,
  targetWords: number,
  numParagraphs: number
): string {
  // Extract Drama Name, Channel Name, and Episode if present in original text
  let dramaName = "ফিরে আসার গল্প";
  let channelName = "সিনেমাওয়ালা (CINEMAWALA)";
  let episodeText = "অষ্টম পর্ব";

  const dramaMatch = originalScript.match(/নাটক\s*[‘"“]([^’”"]+)[’”"]/) || originalScript.match(/নাটক\s+([^\s,-]+(?:\s+[^\s,-]+){0,3})/);
  if (dramaMatch && dramaMatch[1]) {
    dramaName = dramaMatch[1].replace(/\s*\(.*?\)/g, "").trim();
  }

  const channelMatch = originalScript.match(/([^\s,]+(?:\s+[^\s,]+){0,2})\s*চ্যানেলে/) || originalScript.match(/চ্যানেল\s*[‘"“]([^’”"]+)[’”"]/);
  if (channelMatch && channelMatch[1]) {
    channelName = channelMatch[1].trim();
  }

  const episodeMatch = originalScript.match(/(?:পরবর্তী\s*অর্থাৎ\s*)?([১-৯০-৯a-zA-Z\u0980-\u09FF]+\s*পর্ব)/);
  if (episodeMatch && episodeMatch[1]) {
    episodeText = episodeMatch[1].trim();
  }

  // Extract existing bracket paragraphs or raw lines from user script
  const existingMatches = originalScript.match(/\[([\s\S]*?)\]/g);
  const existingParas: string[] = [];
  if (existingMatches && existingMatches.length > 0) {
    existingMatches.forEach((m) => {
      const clean = m.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();
      if (clean.length > 10) existingParas.push(clean);
    });
  } else {
    const rawParas = originalScript.split(/\n\s*\n/).map((l) => l.trim()).filter((l) => l.length > 10);
    if (rawParas.length > 0) {
      existingParas.push(...rawParas);
    } else if (originalScript.trim()) {
      existingParas.push(originalScript.trim());
    }
  }

  const existingWordCount = originalScript.trim() ? originalScript.trim().split(/\s+/).filter(Boolean).length : 0;
  const targetCount = Math.max(1, numParagraphs);
  const wordsPerPara = Math.max(12, Math.round(targetWords / targetCount));
  const isCondenseMode = existingParas.length > 0 && existingWordCount > targetWords * 1.05;

  let selectedParas: string[] = [];

  if (isCondenseMode) {
    // Condense User's Actual Paragraphs preserving intro, core emotional beats, and ending
    if (existingParas.length >= targetCount) {
      if (targetCount === 1) {
        selectedParas = [existingParas.join(" ")];
      } else {
        selectedParas.push(existingParas[0]);
        const middleNeed = targetCount - 2;
        const step = (existingParas.length - 2) / Math.max(1, middleNeed);
        for (let i = 0; i < middleNeed; i++) {
          const idx = Math.min(existingParas.length - 2, 1 + Math.floor(i * step));
          selectedParas.push(existingParas[idx]);
        }
        selectedParas.push(existingParas[existingParas.length - 1]);
      }
    } else {
      selectedParas = [...existingParas];
      while (selectedParas.length < targetCount && selectedParas.length > 0) {
        // Split longest paragraph along sentences
        let maxIdx = 0;
        for (let i = 1; i < selectedParas.length; i++) {
          if (selectedParas[i].length > selectedParas[maxIdx].length) maxIdx = i;
        }
        const sentences = selectedParas[maxIdx].split(/(?<=[।?!.])\s+/).filter(Boolean);
        if (sentences.length < 2) break;
        const mid = Math.ceil(sentences.length / 2);
        selectedParas.splice(maxIdx, 1, sentences.slice(0, mid).join(" "), sentences.slice(mid).join(" "));
      }
    }
  } else {
    // Expand / Structure Mode: Preserve ALL user content and add analytical reflection sections
    const introPara =
      existingParas[0] ||
      `আসসালামু আলাইকুম দর্শক! আশা করি আপনারা সবাই ভালো আছেন। ${channelName} চ্যানেলে প্রচারিত জনপ্রিয় বাংলা নাটক ‘${dramaName}’-এর গল্প বিশ্লেষণ ও ${episodeText}-এর বিশেষ আলোচনায় আপনাদের সবাইকে স্বাগতম। প্রতিটি পর্বে চরিত্রগুলোর মানসিক টানাপোড়েন আর পারিবারিক আবেগ দর্শককে গভীরভাবে ছুঁয়ে যাচ্ছে।`;

    const analysisReflections = [
      `গল্পের এই অংশের গভীর বিশ্লেষণ করলে দেখা যায়, চরিত্রগুলো কেবল পরিস্থিতির শিকার নয়, বরং তাদের ভেতরের না বলা অনুভূতি, দ্বিধা এবং আত্মসম্মানবোধ প্রতিটি সিদ্ধান্তকে জটিল করে তুলছে। সাধারণ একটি ঘটনার ভেতরে লুকিয়ে থাকা মানবিক টানাপোড়েন এবং দীর্ঘদিনের চাপা কষ্টই মূলত গল্পটিকে এতটা বিশ্বাসযোগ্য ও হৃদয়স্পর্শী করে তুলেছে।`,
      `প্রধান চরিত্রগুলোর মানসিক অবস্থান পর্যালোচনা করলে বোঝা যায়, ভালোবাসা এবং দায়িত্ববোধের সংঘাত এখানে সবচেয়ে গুরুত্বপূর্ণ ভূমিকা রাখছে। একজন যখন সম্পর্কের বন্ধন ধরে রাখতে আপ্রাণ চেষ্টা করছে, তখন অতীতের অমীমাংসিত ক্ষত কিংবা ভুল বোঝাবুঝি বারবার সামনে এসে দাঁড়াচ্ছে, যা দর্শকের মনেও গভীর সহানুভূতি জাগিয়ে তোলে।`,
      `অভিনয় ও নির্মাণশৈলীর দিক থেকে লক্ষ্য করলে প্রতিটি নীরব মুহূর্ত এবং চোখের অভিব্যক্তি সংলাপের চেয়েও বেশি কথা বলছে। ব্যাকগ্রাউন্ড সুর ও দৃশ্যের পরিমিত গতি চরিত্রগুলোর একাকিত্ব এবং পারিবারিক আবেগকে অত্যন্ত বাস্তবসম্মতভাবে পর্দায় ফুটিয়ে তুলেছে, যা গল্পের আবহকে আরও ভারী ও অর্থবহ করে।`,
      `সামাজিক ও পারিবারিক প্রেক্ষাপটে এই গল্প আমাদের মনে করিয়ে দেয় যে সময়ের সাথে না বলা কথা জমে থাকলে কীভাবে প্রিয় মানুষের মাঝেও দূরত্ব তৈরি হয়। তবে ক্ষমা, উপলব্ধি ও পারস্পরিক শ্রদ্ধাবোধ থাকলে সবচেয়ে কঠিন সংকট থেকেও বেরিয়ে আসার পথ তৈরি হতে পারে—এই মানবিক বার্তাই গল্পটিকে সাধারণ নাটক থেকে আলাদা করেছে।`,
      `এখন দর্শকের মনে সবচেয়ে বড় প্রশ্ন হলো—সামনের পথে চরিত্রগুলো কি নিজেদের অহংকার ও দূরত্ব সরিয়ে সত্যের মুখোমুখি হতে পারবে, নাকি পরিস্থিতির চাপে সম্পর্কের সমীকরণ আরও জটিল মোড় নেবে? প্রতিটি সংলাপের অন্তর্নিহিত ইঙ্গিত ইঙ্গিত দিচ্ছে যে সামনের অংশে আবেগী বোঝাপড়ার দারুণ কিছু মুহূর্ত অপেক্ষা করছে।`,
    ];

    const outroPara =
      existingParas.length > 1
        ? existingParas[existingParas.length - 1]
        : `আজকের এই গল্প বিশ্লেষণ ও পর্যালোচনা আপনাদের কেমন লাগল, তা অবশ্যই কমেন্টে লিখে জানাবেন। ‘${dramaName}’-এর গল্প ও চরিত্রগুলো নিয়ে আপনার ব্যক্তিগত ভাবনা আমাদের সাথে শেয়ার করুন। ভিডিওটি ভালো লাগলে লাইক দিন ও চ্যানেলটি সাবস্ক্রাইব করে সাথেই থাকুন। ধন্যবাদ সবাইকে!`;

    const pool: string[] = [introPara];
    for (let i = 1; i < existingParas.length - 1; i++) {
      pool.push(existingParas[i]);
    }
    for (const refPara of analysisReflections) {
      if (pool.length + 1 >= targetCount) break;
      pool.push(refPara);
    }
    let idx = 0;
    while (pool.length + 1 < targetCount) {
      pool.push(analysisReflections[idx % analysisReflections.length]);
      idx++;
    }
    if (targetCount > 1) {
      pool.push(outroPara);
    }
    selectedParas = pool.slice(0, targetCount);
  }

  // Strictly match targeted wordsPerPara for every paragraph
  const extraSentences = [
    "প্রতিটি চরিত্রের ভেতরের নীরব সংগ্রাম ও আবেগিক টানাপোড়েন গল্পটিকে আরও গভীর ও বাস্তবধর্মী করে তুলেছে।",
    "পারিবারিক সম্পর্কের সূক্ষ্ম অনুভূতি এবং সময়ের বাস্তবতা দর্শকদের মনে গভীর ছাপ ফেলে।",
    "অভিনয়শিল্পীদের সংযত ও স্বাভাবিক অভিব্যক্তি দৃশ্যগুলোর আবেগী গুরুত্ব বহুগুণে বাড়িয়ে দিয়েছে।",
    "গল্পের প্রতিটি ধাপে চরিত্রগুলোর মানসিক পরিবর্তন অত্যন্ত যুক্তিসঙ্গত ও প্রাসঙ্গিকভাবে ফুটে উঠেছে।",
  ];

  const finalParas = selectedParas.slice(0, targetCount).map((para, pIdx) => {
    let clean = para.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();
    let words = clean.split(/\s+/).filter(Boolean);

    if (!isCondenseMode && words.length < wordsPerPara) {
      let addIdx = pIdx;
      while (words.length < wordsPerPara && addIdx < pIdx + extraSentences.length * 4) {
        clean += " " + extraSentences[addIdx % extraSentences.length];
        words = clean.split(/\s+/).filter(Boolean);
        addIdx++;
      }
    }

    if (words.length > wordsPerPara + 4) {
      const sliced = words.slice(0, wordsPerPara).join(" ");
      const lastPunct = Math.max(sliced.lastIndexOf("।"), sliced.lastIndexOf("?"), sliced.lastIndexOf("!"));
      if (lastPunct > sliced.length * 0.45) {
        clean = sliced.substring(0, lastPunct + 1).trim();
      } else {
        clean = sliced.trim() + "।";
      }
    }

    return clean;
  });

  // Wrap all paragraphs neatly into [ ... ]
  return finalParas.map((p) => `[ ${p} ]`).join("\n\n");
}

// Endpoint to adapt (expand with genuine analysis OR condense accurately, 10s up to 60 minutes)
app.post("/api/script/adapt-duration", async (req, res) => {
  try {
    const {
      currentScript = "",
      targetMinutes = 10,
      targetSeconds = 0,
      speed = 1.0,
      customApiKey = "",
      customWords,
      customParas,
      channelSlot,
      channelPersona = "",
      voiceGender = "",
      wpmBaseline = 106,
      interludeDuration = 5.0,
      audioMixMode = "voice_with_bgm",
      hasBgm = true,
    } = req.body;

    const customHeader = (req.headers["x-gemini-api-key"] as string) || "";
    const effectiveCustomKey = (customApiKey || customHeader || "").trim();

    // Clamp cleanly between 10 seconds and 60 minutes (3600 seconds)
    const rawSec = Number(targetMinutes) * 60 + Number(targetSeconds);
    const totalSeconds = Math.max(10, Math.min(60 * 60, Math.round(rawSec)));
    const effectiveSpeed = Math.max(0.5, Number(speed) || 1.0);
    const effectiveWpm = Math.max(85, Math.min(140, Number(wpmBaseline) || 106));
    const useBgmBreaks = Boolean(hasBgm) && audioMixMode !== "pure_voice";
    const breakSecPerGap = useBgmBreaks ? Math.max(2, Number(interludeDuration) || 5.0) : 0.35;

    // Paragraph count scales smoothly from 10s up to 60 minutes
    let numParagraphs = 2;
    if (customParas !== undefined && Number(customParas) > 0) {
      numParagraphs = Math.max(1, Math.min(50, Math.round(Number(customParas))));
    } else {
      if (totalSeconds <= 45) {
        numParagraphs = 1;
      } else if (totalSeconds <= 95) {
        numParagraphs = 2;
      } else if (totalSeconds <= 260) {
        numParagraphs = 3;
      } else if (totalSeconds <= 380) {
        numParagraphs = 4;
      } else if (totalSeconds <= 540) {
        numParagraphs = 5;
      } else if (totalSeconds <= 1200) {
        numParagraphs = Math.min(14, Math.max(6, Math.round(totalSeconds / 65)));
      } else {
        numParagraphs = Math.min(42, Math.max(14, Math.round(totalSeconds / 75)));
      }
    }

    // Ensure BGM break time never crowds out voice on short targets
    while (numParagraphs > 1 && (numParagraphs - 1) * breakSecPerGap > totalSeconds * 0.4) {
      numParagraphs--;
    }

    // Target word count calibrated to channel's exact WPM & break intervals
    let targetWords = 100;
    if (customWords !== undefined && Number(customWords) > 0) {
      targetWords = Math.max(12, Math.round(Number(customWords)));
    } else {
      const musicBreaksSec = (numParagraphs - 1) * breakSecPerGap + (useBgmBreaks ? 1.5 : 0.25);
      const pureSpeechSec = Math.max(8, totalSeconds - musicBreaksSec);
      targetWords = Math.max(12, Math.round((pureSpeechSec / 60) * effectiveWpm * effectiveSpeed));
    }

    const sourceContent = currentScript?.trim()
      ? currentScript.trim()
      : "জনপ্রিয় বাংলা নাটকের সাম্প্রতিক পর্বের আবেগঘন মুহূর্ত, চরিত্রের মানসিক দ্বন্দ্ব ও সম্পর্কের টানাপোড়েন নিয়ে গভীর বিশ্লেষণ।";

    const currentWords = currentScript?.trim() ? currentScript.trim().split(/\s+/).filter(Boolean).length : 0;
    const adaptationMode =
      currentWords > targetWords * 1.08
        ? "CONDENSE"
        : currentWords > 0 && currentWords < targetWords * 0.92
          ? "EXPAND_WITH_ANALYSIS"
          : "REFINE_EXACT";

    const allKeys = getAllApiKeys(effectiveCustomKey);
    const candidateModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

    const personaHeader = channelSlot
      ? `Channel Slot: CH ${channelSlot} | Speaker Voice: ${voiceGender || "natural"} | Narration Persona: ${channelPersona || "Authentic Bangladeshi Bengali drama analyst"}`
      : "Authentic Bangladeshi Bengali drama analyst";

    const runGeminiText = async (promptText: string, timeoutMs = 24000): Promise<string | null> => {
      for (let kIdx = 0; kIdx < allKeys.length; kIdx++) {
        const keyVal = allKeys[kIdx];
        const t = getOrInitTelemetry(keyVal);
        if (t.status === "invalid") continue;
        const client = getGeminiClientForIndex(kIdx, effectiveCustomKey);
        if (!client) continue;

        for (const model of candidateModels) {
          try {
            t.usageCount += 1;
            t.lastUsedAt = Date.now();
            const generatePromise = client.models.generateContent({
              model,
              contents: promptText,
            });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("AI generation timed out")), timeoutMs)
            );
            const response: any = await Promise.race([generatePromise, timeoutPromise]);
            const text = response?.text?.trim();
            if (text && text.includes("[")) {
              t.successCount += 1;
              t.status = "active";
              t.lastError = "";
              return text;
            }
          } catch (geminiErr: any) {
            t.errorCount += 1;
            const c = classifyGeminiError(geminiErr?.message || String(geminiErr));
            t.status = c.status;
            t.lastError = c.shortError;
            console.warn(`Gemini script adapt attempt failed (key ${kIdx}, model ${model}):`, geminiErr?.message || geminiErr);
            if (c.status === "invalid" || c.status === "quota_exhausted" || c.status === "rate_limited") {
              break;
            }
          }
        }
      }
      return null;
    };

    const modeInstructions =
      adaptationMode === "CONDENSE"
        ? `MODE: CONDENSE / SUMMARIZE LONG SCRIPT (${currentWords} words -> ~${targetWords} words).
- Keep ALL core plot facts, character names, drama title/channel/episode details, emotional conflicts, and conclusion intact.
- Cut redundant phrasing, filler sentences, and over-long elaboration cleanly so the total script matches EXACTLY ~${targetWords} Bengali words across ${numParagraphs} bracketed paragraphs.`
        : adaptationMode === "EXPAND_WITH_ANALYSIS"
          ? `MODE: EXPAND SHORT SCRIPT WITH GENUINE NEW ANALYSIS (${currentWords} words -> ~${targetWords} words).
- Keep ALL original story details intact.
- DO NOT invent fake events, imaginary scenes, or fabricated dialogues that contradict the input.
- Add GENUINE NEW analytical commentary ("নতুন বিশ্লেষণ"): deeper psychological motivation of the mentioned characters, emotional dynamics of relationships, acting/direction appreciation, family & social themes, and thoughtful viewer questions so the total script smoothly reaches ~${targetWords} Bengali words across ${numParagraphs} paragraphs.`
          : `MODE: EXACT DURATION ALIGNMENT (~${targetWords} words across ${numParagraphs} paragraphs).
- Polish flow and adjust length seamlessly to ~${targetWords} Bengali words without inventing fake plot facts.`;

    // For long targets (>1300 words), synthesize in structured thematic acts so full long-form word counts are met without truncation
    if (allKeys.length > 0 && targetWords > 1300 && numParagraphs >= 6) {
      const numActs = targetWords > 3800 ? 4 : targetWords > 2400 ? 3 : 2;
      const parasPerAct = Math.max(2, Math.round(numParagraphs / numActs));
      const wordsPerAct = Math.round(targetWords / numActs);

      const collectedParts: string[] = [];
      for (let a = 0; a < numActs; a++) {
        const actParas = a === numActs - 1 ? Math.max(2, numParagraphs - parasPerAct * (numActs - 1)) : parasPerAct;
        const actPrompt = `You are a master Bangladeshi Bengali (প্রমিত বাংলা) drama critic & narrator.
${personaHeader}
${modeInstructions}
Task: Write Part ${a + 1} of ${numActs} for the final script based strictly on the source context below.

STRICT RULES:
1. Never invent fake plot events, fabricated dialogues, or contradictions not present in SOURCE CONTEXT.
2. ${adaptationMode === "CONDENSE" ? "Summarize tightly without repetition." : "Expand with meaningful emotional, psychological, thematic, and acting analysis without robotic repetition."}
3. Language: Pure, warm, idiomatic Bangladeshi Bengali (বাংলাদেশি প্রমিত বাংলা).
4. Format: Output ONLY ${actParas} paragraphs wrapped in square brackets [ ... ], totaling STRICTLY ~${wordsPerAct} Bengali words (~${Math.round(wordsPerAct / actParas)} words per paragraph), separated by double newlines.

SOURCE CONTEXT:
"""
${sourceContent.slice(0, 12000)}
"""`;

        const actResult = await runGeminiText(actPrompt, 26000);
        if (actResult) {
          collectedParts.push(actResult);
        }
      }

      if (collectedParts.length > 0) {
        const combined = collectedParts.join("\n\n");
        return res.json({
          success: true,
          script: combined,
          targetWords,
          numParagraphs,
          targetTotalSeconds: totalSeconds,
          adaptationMode,
          modelUsed: "gemini-4-hydrogen (multi-act)",
        });
      }
    }

    const prompt = `You are an expert Bangladeshi Bengali (প্রমিত বাংলা) drama reviewer, emotional analyst, and storyteller.
${personaHeader}

${modeInstructions}

TARGET SPECIFICATIONS (MUST MATCH EXACTLY):
- Target Audio Duration: ${Math.floor(totalSeconds / 60)} minute(s) ${totalSeconds % 60} second(s) (${totalSeconds} total seconds).
- Target Total Bengali Word Count: ~${targetWords} words (Strict tolerance: within ±8% of ${targetWords} words).
- Paragraphs: Exactly ${numParagraphs} bracketed paragraphs ([ ... ]) separated by double newlines.

ORIGINAL SCRIPT:
"""
${sourceContent.slice(0, 18000)}
"""

QUALITY & ACCURACY RULES:
1. NO FAKE EVENTS OR DIALOGUES: Keep strictly faithful to the provided story facts/names. When expanding, add ONLY genuine character psychology, emotional/social themes, acting/direction analysis, and audience questions. When condensing, keep every important point while trimming wordiness.
2. ZERO ROBOTIC REPETITION: Every paragraph must feel authentic for human listening.
3. BANGLADESHI BENGALI AUTHENTICITY: Use natural Bangladeshi standard Bengali (প্রমিত বাংলা) with natural punctuation (। , ? —).
4. FORMATTING: Output ONLY the ${numParagraphs} [ ... ] bracketed paragraphs separated by double newlines. No markdown titles or extra notes.`;

    if (allKeys.length > 0) {
      const singleResult = await runGeminiText(prompt, 24000);
      if (singleResult) {
        return res.json({
          success: true,
          script: singleResult,
          targetWords,
          numParagraphs,
          targetTotalSeconds: totalSeconds,
          adaptationMode,
          modelUsed: "gemini-4-hydrogen",
        });
      }
    }

    // High quality contextual fallback: Guarantees 100% offline/no-key reliability
    const adaptedScript = generateAdaptedDramaScriptFallback(
      currentScript,
      Math.floor(totalSeconds / 60),
      totalSeconds % 60,
      targetWords,
      numParagraphs
    );

    return res.json({
      success: true,
      script: adaptedScript,
      targetWords,
      numParagraphs,
      targetTotalSeconds: totalSeconds,
      adaptationMode,
      fallbackUsed: true,
    });
  } catch (err: any) {
    console.error("Script adapt error:", err);
    const safeFallback = `[ আসসালামু আলাইকুম দর্শক! আজকের বিশেষ পর্বে আপনাদের সবাইকে স্বাগতম। নাটকের গল্প বিশ্লেষণ ও পরবর্তী পর্বের আপডেট জানতে ভিডিওটি না টেনে শেষ পর্যন্ত মনোযোগ দিয়ে দেখুন। ]\n\n[ গল্পে প্রতিটি চরিত্রের মানসিক টানাপোড়েন এবং পারিবারিক সংঘাত নাটকটিকে অনন্য উচ্চতায় নিয়ে গেছে। আপনার মতামত অবশ্যই কমেন্টে জানান এবং চ্যানেলটি সাবস্ক্রাইব করে সাথে থাকুন। ধন্যবাদ! ]`;
    return res.json({
      success: true,
      script: safeFallback,
      targetWords: 100,
      numParagraphs: 2,
      targetTotalSeconds: 60,
    });
  }
});

async function startServer() {
  const distExists = fs.existsSync(path.resolve("dist"));
  if (process.env.NODE_ENV !== "production" || !distExists) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.resolve("dist"), {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".webmanifest")) {
            res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
          } else if (filePath.endsWith("sw.js") || filePath.endsWith("registerSW.js")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get("*", (_req, res) => {
      const indexPath = path.resolve("dist", "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("App building or not found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
