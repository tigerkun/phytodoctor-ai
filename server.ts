import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Behind Render's proxy: derive req.ip from the trusted proxy chain so a
// client cannot spoof X-Forwarded-For to rotate rate-limit identities.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Security headers ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Styles keep 'unsafe-inline' for the UI's runtime CSS-in-JS; scripts stay
    // locked to 'self' (SW registration lives in the bundled main.tsx).
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self'; " +
      "connect-src 'self' https:; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  next();
});

// ── Per-IP rate limiter ────────────────────────────────────────────────────
// Two tiers: general API traffic and the expensive Gemini AI endpoints.
// Counters are keyed on req.ip (proxy-aware). In-memory only — swap in
// express-rate-limit + Redis when running multiple instances.
const RATE_WINDOW_MS = 60_000;
const GENERAL_RATE_LIMIT = 60;
const AI_RATE_LIMIT = 15;
const rateCounts = new Map<string, { count: number; resetAt: number }>();

function makeLimiter(limit: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Rightmost X-Forwarded-For entry: the trusted proxy (Render) appends the
    // real client address after any client-supplied entries, so the last value
    // is the only one an attacker cannot spoof. Falls back to req.ip /
    // socket address for direct (non-proxied) connections.
    const xff = req.headers['x-forwarded-for'];
    const entries = typeof xff === 'string' ? xff.split(',').map(s => s.trim()).filter(Boolean) : [];
    const ip = (entries.length > 0 ? entries[entries.length - 1] : (req.ip || req.socket.remoteAddress || 'unknown'));
    const now = Date.now();
    const entry = rateCounts.get(ip);
    if (!entry || now > entry.resetAt) {
      rateCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    } else {
      entry.count++;
      if (entry.count > limit) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
      }
    }
    next();
  };
}

const generalLimiter = makeLimiter(GENERAL_RATE_LIMIT);
const aiLimiter = makeLimiter(AI_RATE_LIMIT);

app.use('/api', generalLimiter);

// Periodically evict stale limiter entries so the Map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateCounts) {
    if (now > entry.resetAt) rateCounts.delete(ip);
  }
}, 5 * 60_000).unref();

// ── Shared helpers ─────────────────────────────────────────────────────────
// Client-facing errors must never echo internal error messages.
function fail(res: express.Response, code: number, msg: string) {
  return res.status(code).json({ error: msg });
}
const AI_GENERIC_ERROR = 'The AI service is temporarily unavailable. Please try again in a moment.';

// Binomial-safe species names: letters, numbers, spaces, hyphens, apostrophes,
// periods and parentheses only. Blocks prompt-injection payloads masquerading
// as species names.
const SPECIES_RE = /^[\p{L}\p{N}'’\-.() ]{2,80}$/u;
function isValidSpecies(name: unknown): name is string {
  return typeof name === 'string' && SPECIES_RE.test(name.trim());
}
function strLimit(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

// ── Optional Supabase API gate ─────────────────────────────────────────────
// When SUPABASE_URL + SUPABASE_ANON_KEY are set on the server, every /api
// request must carry a valid Supabase access token (Bearer). Without them
// (local dev / pre-Supabase deploys) the endpoints stay open but rate-limited.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabaseAuthClient: any = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  import('@supabase/supabase-js').then(({ createClient }) => {
    supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('API auth gate enabled: /api/* requires a Supabase session token.');
  }).catch((err) => console.error('Supabase gate init failed:', err?.message));
}

function apiGate(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!supabaseAuthClient) return next(); // gate not active (no env or still loading)
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return fail(res, 401, 'Sign in to use the AI features.');
  supabaseAuthClient.auth.getUser(token)
    .then(({ data, error }: any) => {
      if (error || !data?.user) return fail(res, 401, 'Your session has expired. Please sign in again.');
      next();
    })
    .catch(() => fail(res, 401, 'Your session has expired. Please sign in again.'));
}

// Health check for Render
app.get('/healthz', (_req, res) => res.sendStatus(200));


// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function generateWithRetry(params: any, retries = 1) {
  const envModel = process.env.GEMINI_MODEL;
  const models = envModel 
    ? [envModel, "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.0-flash", "gemini-1.5-flash"]
    : ["gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.0-flash", "gemini-1.5-flash"];
  
  for (const modelName of models) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await ai.models.generateContent({
          ...params,
          model: modelName,
        });
      } catch (err: any) {
        const isFatal = err?.status === 400 || err?.status === 401 || err?.status === 403;
        if (isFatal) throw err; // Don't delay on authentication or bad request errors

        const isNotFoundOrQuota = err?.status === 429 || err?.status === 404 || err?.message?.includes("not found") || err?.message?.includes("quota");
        if (isNotFoundOrQuota && modelName !== models[models.length - 1]) {
          console.warn(`Model ${modelName} unavailable (${err?.status || 'error'}), falling back to next model...`);
          break;
        }

        if (i === retries && modelName === models[models.length - 1]) throw err;
        console.warn(`Gemini API (${modelName}) attempt ${i + 1} failed, retrying...`, err?.message || err);
        await new Promise(r => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw new Error("Gemini API generateContent failed across all models");
}

app.post("/api/identify", express.json({ limit: '11mb' }), aiLimiter, apiGate, async (req, res) => {
  try {
    const { image, location } = req.body;
    if (!image || typeof image !== 'string') {
      return fail(res, 400, "No image provided");
    }

    // Extract base64 data and mimeType — strict allowlist, no silent fallback
    const mimeMatch = image.match(/^data:(image\/(jpeg|png|webp|gif|bmp|tiff|avif));base64,/);
    if (!mimeMatch) {
      return fail(res, 400, 'Invalid image format. Supported: JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF.');
    }
    const mimeType = mimeMatch[1];
    const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '').trim();
    // ~8M base64 chars ≈ 6 MB of image data. The parser above already caps at
    // 11MB; this tighter bound keeps Gemini calls cheap.
    if (base64Data.length < 100 || base64Data.length > 8_000_000) {
      return fail(res, 413, 'Image is too large. Please upload an image under 6 MB.');
    }

    // Build location + weather context block for the prompt
    let locationBlock = "";
    if (location && typeof location === 'object') {
      const parts: string[] = [];
      const city = strLimit(location.city, 120);
      if (city) parts.push(`City/Region: ${city}`);
      const lat = Number(location.latitude);
      const lon = Number(location.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        parts.push(`Coordinates: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
      }
      if (location.weather && typeof location.weather === 'object') {
        const w = location.weather;
        const temp = Number(w.temp), hum = Number(w.humidity), wind = Number(w.windSpeed);
        const cond = strLimit(w.condition, 60);
        parts.push(`Current Weather: ${Number.isFinite(temp) ? temp : '?'}°C, ${Number.isFinite(hum) ? hum : '?'}% humidity, ${cond ?? 'unknown'}${Number.isFinite(wind) ? `, wind ${wind} km/h` : ""}`);
      }
      if (parts.length > 0) {
        locationBlock = `\n\nUSER LOCATION CONTEXT (use this to personalise ALL advice):\n${parts.join("\n")}\nTailor watering frequency, pest risk, seasonal care, climate compatibility, and all recommendations to this exact region and current weather conditions.`;
      }
    }

    const prompt = `You are PhytoDoctor AI, the world's most advanced botanical diagnostician. Perform an exhaustive, clinically precise analysis of the plant in this image.

REQUIRED — be specific and detailed in every field:
1. Identify the exact species (common name, full scientific name with authority if known).
2. Visually assess ALL visible symptoms: leaf colour, texture, lesions, spots, wilting, edge burn, yellowing pattern, stem condition, soil surface if visible, pest evidence.
3. Assign a health status (Healthy / Stressed / Diseased / Infested) and severity 1-5.
4. Write a thorough diagnosis paragraph — name the exact pathology or deficiency if detectable, not generic phrases.
5. List 3-4 differential diagnoses with realistic confidence percentages.
6. Provide a day-by-day treatment timeline (at least 4 milestones).
7. Write detailed step-by-step treatment instructions (minimum 5 steps, each actionable).
8. Give precise care parameters: watering schedule, light requirements, soil type, temperature range.
9. List 4+ specific care tips tailored to the detected condition.
10. Explain vulnerability notes — WHY this specific specimen shows these symptoms.${locationBlock}

LOCATION-AWARE FIELDS (required if location provided):
- locationAdvice: Specific advice for growing this plant in the user's exact city/region — native range, climate match, whether it's suited to grow outdoors there, seasonal adjustments.
- seasonalCare: What specific care adjustments are needed right now given the current season and weather in that region.
- localPestRisks: Which pests and diseases are most prevalent in that geographic region/climate zone that this plant owner should watch for.
- climateCompatibility: Rate and explain how well this species' native climate matches the user's current location climate.`;

    const response = await generateWithRetry({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: "You are PhytoDoctor AI's Chief Botanical Pathologist and Regional Horticulture Specialist. You perform precise, evidence-based visual diagnoses. You always consider the user's local climate, geography, and current weather when giving care advice. Never give generic advice — always be specific to the plant specimen, its visible condition, and the user's location. Return complete, structured JSON according to the schema.",
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["commonName", "scientificName", "healthStatus", "severity", "diagnosis", "differentialDiagnosis", "treatmentTimeline", "treatmentInstructions", "watering", "light", "soil", "temperature", "careTips", "vulnerabilityNotes"],
          properties: {
            commonName: { type: Type.STRING },
            scientificName: { type: Type.STRING },
            healthStatus: {
              type: Type.STRING,
              description: "Overall health rating: Healthy, Stressed, Diseased, or Infested"
            },
            severity: {
              type: Type.NUMBER,
              description: "Severity score from 1 (minor) to 5 (critical/terminal)."
            },
            diagnosis: {
              type: Type.STRING,
              description: "Detailed primary diagnosis including visible symptoms observed, root cause, and pathology name if applicable."
            },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "confidence", "description"],
                properties: {
                  name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER, description: "Percentage (0-100)" },
                  description: { type: Type.STRING, description: "Why this differential is considered and how to rule it in/out" }
                }
              }
            },
            treatmentTimeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["day", "action", "expectedOutcome"],
                properties: {
                  day: { type: Type.STRING, description: "e.g. Day 1, Day 3-5, Week 2, etc." },
                  action: { type: Type.STRING },
                  expectedOutcome: { type: Type.STRING }
                }
              }
            },
            treatmentInstructions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific, numbered step-by-step treatment instructions. Minimum 5 steps."
            },
            watering: { type: Type.STRING, description: "Precise watering frequency and method for this specimen's condition" },
            light: { type: Type.STRING, description: "Specific light requirements: hours, intensity, direction" },
            soil: { type: Type.STRING, description: "Recommended soil mix, drainage requirements, pH range" },
            temperature: { type: Type.STRING, description: "Ideal temperature range, frost tolerance, and heat limits" },
            careTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "At least 4 actionable, specific care tips for this specimen and condition"
            },
            vulnerabilityNotes: {
              type: Type.STRING,
              description: "Detailed explanation of why this specific plant is showing these symptoms — root cause analysis."
            },
            locationAdvice: {
              type: Type.STRING,
              description: "Specific advice for cultivating this plant in the user's city/region — climate match, outdoor viability, local adjustments."
            },
            seasonalCare: {
              type: Type.STRING,
              description: "Current seasonal care adjustments based on the user's location and weather right now."
            },
            localPestRisks: {
              type: Type.STRING,
              description: "Pests and diseases most common in the user's geographic region that threaten this species."
            },
            climateCompatibility: {
              type: Type.STRING,
              description: "How well this species' native climate matches the user's local climate, with rating and explanation."
            }
          }
        }
      }
    });

    const rawText = response.text || "";
    const cleanedText = rawText.replace(/```json|```/gi, "").trim();
    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch (parseErr: any) {
      console.error("JSON parse error (response may have been truncated):", parseErr.message, "\nRaw snippet:", cleanedText.slice(0, 200));
      throw new Error("AI response was malformed. Please try again.");
    }
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Error:", error?.response?.status || error?.status || '', error?.message || error);
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/sandbox", express.json({ limit: '64kb' }), aiLimiter, apiGate, async (req, res) => {
  try {
    const { mode, species, environment } = req.body;
    if (!isValidSpecies(species)) {
      return fail(res, 400, "Please enter a valid plant species name (2–80 characters, letters and basic punctuation).");
    }

    if (mode === "profile") {
      const response = await generateWithRetry({
        contents: [{
          role: "user",
          parts: [{ text: `Create a horticultural dossier for the plant species "${species.trim()}". If the name is ambiguous, pick the most commonly cultivated interpretation. Be specific and evidence-based. If the requested name is not a real, existing plant species (fictional, invented, misspelled beyond recognition, or non-botanical), set isRealSpecies to false and fill the remaining fields with your best-effort interpretation marked as such.` }]
        }],
        config: {
          systemInstruction: "You are PhytoDoctor AI's horticultural physiologist. Return only JSON matching the schema. Ideal ranges must be realistic for that species. Never invent a plant that does not exist — flag fictional or non-botanical names via isRealSpecies=false.",
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["isRealSpecies", "commonName", "scientificName", "overview", "origin", "hardinessZones", "idealTempMin", "idealTempMax", "idealHumidityMin", "idealHumidityMax", "light", "soil", "soilPh", "watering", "photoperiodHours", "nativeClimate", "pests"],
            properties: {
              isRealSpecies: { type: Type.BOOLEAN, description: "True only if this is a real, existing plant species. False for fictional, invented, or non-botanical names." },
              commonName: { type: Type.STRING },
              scientificName: { type: Type.STRING },
              overview: { type: Type.STRING },
              origin: { type: Type.STRING },
              hardinessZones: { type: Type.STRING },
              idealTempMin: { type: Type.NUMBER },
              idealTempMax: { type: Type.NUMBER },
              idealHumidityMin: { type: Type.NUMBER },
              idealHumidityMax: { type: Type.NUMBER },
              light: { type: Type.STRING },
              soil: { type: Type.STRING },
              soilPh: { type: Type.STRING },
              watering: { type: Type.STRING },
              photoperiodHours: { type: Type.NUMBER },
              nativeClimate: { type: Type.STRING },
              pests: { type: Type.STRING }
            }
          }
        }
      });
      const raw = (response.text || "").replace(/```json|```/gi, "").trim();
      const result = JSON.parse(raw);
      if (result.isRealSpecies === false) {
        return fail(res, 422, `"${species.trim()}" does not appear to be a real plant species. Please check the spelling or try a known species (e.g. Monstera deliciosa).`);
      }
      delete result.isRealSpecies;
      return res.json(result);
    }

    if (mode === "assess") {
      if (!environment || typeof environment !== 'object') return fail(res, 400, "Environment is required");
      if (JSON.stringify(environment).length > 8000) return fail(res, 400, "Environment payload is too large.");
      const response = await generateWithRetry({
        contents: [{
          role: "user",
          parts: [{ text: `Assess whether "${species.trim()}" can survive and thrive in this placement.

SITE:
${JSON.stringify(environment, null, 2)}

Score climate, water, light, soil, pest pressure, and seasonal timing independently (0-100). Survival chance is the overall likelihood the plant lives 12 months in these conditions with reasonable amateur care. Give concrete tips and ranked risks.` }]
        }],
        config: {
          systemInstruction: "You are PhytoDoctor AI running a clinical placement simulation. Be honest: hostile climates should score low. Return only JSON.",
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["survivalChance", "verdict", "climateScore", "waterScore", "lightScore", "soilScore", "pestScore", "seasonalScore", "summary", "tips", "risks", "protocol"],
            properties: {
              survivalChance: { type: Type.NUMBER },
              verdict: { type: Type.STRING },
              climateScore: { type: Type.NUMBER },
              waterScore: { type: Type.NUMBER },
              lightScore: { type: Type.NUMBER },
              soilScore: { type: Type.NUMBER },
              pestScore: { type: Type.NUMBER, description: "Higher is safer (lower pest pressure for this species)" },
              seasonalScore: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              protocol: { type: Type.STRING }
            }
          }
        }
      });
      const raw = (response.text || "").replace(/```json|```/gi, "").trim();
      return res.json(JSON.parse(raw));
    }

    return fail(res, 400, "mode must be profile or assess");
  } catch (error: any) {
    console.error("Sandbox Error:", error?.response?.status || error?.status || '', error?.message || error);
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/chat", express.json({ limit: '64kb' }), aiLimiter, apiGate, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return fail(res, 400, "Messages are required");
    }
    if (messages.length > 40) {
      return fail(res, 400, "Conversation is too long. Please start a new chat.");
    }
    for (const m of messages) {
      if (!m || typeof m.content !== 'string' || m.content.trim().length === 0 || m.content.length > 4000) {
        return fail(res, 400, "Invalid message content.");
      }
    }

    const systemPrompt = `You are PhytoDoctor AI's Chief Master Botanist and world-renowned Plant Pathologist.

CORE BOTANICAL PERSONA:
You possess encyclopedic, evidence-based mastery over botany, plant physiology, horticulture, soil microbiology, organic pest management, and phytopathology. Your tone is warm, authoritative, deeply knowledgeable, and reassuring.

CRITICAL GUARDRAILS:
- You ONLY answer questions related to plants, gardening, botany, indoor flora, agriculture, soil chemistry, pests, plant diseases, fertilizers, and horticulture.
- If a user asks about any non-plant or non-botanical topics (such as general knowledge, coding, politics, math, entertainment, sports, non-botanical personal advice), POLITELY and FIRMLY deflect back to botany:
  "I am exclusively dedicated to botanical sciences and plant care. Let's redirect our focus to your flora—what plant species or gardening questions can I help you with today?"

RESPONSE FORMAT & PACING (SHORT STANZAS):
- Deliver your guidance in prompt, concise, structured short stanzas (short paragraphs of 2-3 sentences each).
- Use clear bullet points and bold key parameters (e.g., **Lighting**, **Watering Schedule**, **Treatment**).
- Avoid long rambling essays; keep it crisp, insightful, and immediately actionable so the user can easily digest and apply the advice.`;

    let formattedContents = messages
      .filter(m => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-20) // cap: keep only last 20 messages to prevent cost abuse
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

    // Gemini multi-turn conversation requires the first turn to be from 'user'
    while (formattedContents.length > 0 && formattedContents[0].role === 'model') {
      formattedContents.shift();
    }

    if (formattedContents.length === 0) {
      return fail(res, 400, "At least one user message is required");
    }

    const response = await generateWithRetry({
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error("Chat Error:", error?.response?.status || error?.status || '', error?.message || error);
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/guardian/predict", express.json({ limit: '64kb' }), aiLimiter, apiGate, async (req, res) => {
  try {
    const { species, checkins, sensorData, weather } = req.body;
    if (!isValidSpecies(species)) {
      return fail(res, 400, "Please provide a valid plant species name.");
    }
    if (JSON.stringify({ checkins, sensorData, weather }).length > 20_000) {
      return fail(res, 400, "Check-in history payload is too large.");
    }

    const prompt = `Based on the following data for a ${species}, predict potential health stressors in the next 14 days. 
    Check-in history: ${JSON.stringify(checkins)}
    Sensor trajectory: ${JSON.stringify(sensorData)}
    Local weather forecast: ${JSON.stringify(weather)}
    
    Return a structured JSON report with a risk score (0-100), primary stressor, confidence, and a brief evidence-based reasoning.
    Address specific biological vulnerabilities of this species.`;

    const response = await generateWithRetry({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["riskScore", "primaryStressor", "confidence", "reasoning", "protocolRecommendation"],
          properties: {
            riskScore: { type: Type.NUMBER },
            primaryStressor: { 
              type: Type.STRING,
              enum: ["Light", "Water", "Humidity", "Temperature", "Nutrition", "Unknown"]
            },
            confidence: { type: Type.NUMBER, description: "0-1" },
            reasoning: { type: Type.STRING },
            protocolRecommendation: { type: Type.STRING }
          }
        }
      }
    });

    const rawText = response.text || "";
    const cleanedText = rawText.replace(/```json|```/gi, "").trim();
    const result = JSON.parse(cleanedText);
    res.json(result);
  } catch (error: any) {
    console.error("Prediction Error:", error?.response?.status || error?.status || '', error?.message || error);
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
