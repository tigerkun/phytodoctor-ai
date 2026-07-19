import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload size for images
app.use(express.json({ limit: '10mb' }));

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

app.post("/api/identify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Extract base64 data
    const base64Data = image.split(",")[1] || image;

    const prompt = "Identify this plant, assess its health, detect any diseases or pests, and provide a detailed clinical diagnostic report. Include a severity score from 1-5, a differential diagnosis with top alternatives, and a clear treatment timeline.";
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: "image/jpeg"
              }
            }
          ]
        }
      ],
      config: {
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
              description: "Specific primary diagnosis if issues are found."
            },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "confidence", "description"],
                properties: {
                  name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER, description: "Percentage (0-100)" },
                  description: { type: Type.STRING }
                }
              }
            },
            treatmentTimeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["day", "action", "expectedOutcome"],
                properties: {
                  day: { type: Type.STRING, description: "e.g. Day 1, Week 2, etc." },
                  action: { type: Type.STRING },
                  expectedOutcome: { type: Type.STRING }
                }
              }
            },
            treatmentInstructions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Step-by-step instructions for recovery."
            },
            watering: { type: Type.STRING },
            light: { type: Type.STRING },
            soil: { type: Type.STRING },
            temperature: { type: Type.STRING },
            careTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            vulnerabilityNotes: {
              type: Type.STRING,
              description: "Notes on why this specific plant was vulnerable (e.g. soil pH, humidity)."
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || "Failed to identify plant" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages are required" });
    }

    const systemPrompt = "You are PhytoDoctor AI's Senior Botanist and Master Gardener. Your goal is to provide expert, scientific, yet accessible advice on all things gardening. You specialize in indoor and outdoor plant care, organic pest control, soil science, and garden design. Be helpful, concise, and professional.";
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: 'user',
          parts: [{ text: `CONTEXT: ${systemPrompt}` }]
        },
        ...messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      ]
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message || "Failed to get response" });
  }
});

app.post("/api/guardian/predict", async (req, res) => {
  try {
    const { species, checkins, sensorData, weather } = req.body;

    const prompt = `Based on the following data for a ${species}, predict potential health stressors in the next 14 days. 
    Check-in history: ${JSON.stringify(checkins)}
    Sensor trajectory: ${JSON.stringify(sensorData)}
    Local weather forecast: ${JSON.stringify(weather)}
    
    Return a structured JSON report with a risk score (0-100), primary stressor, confidence, and a brief evidence-based reasoning.
    Address specific biological vulnerabilities of this species.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    const result = JSON.parse(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("Prediction Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate prediction" });
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
