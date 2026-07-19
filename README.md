<div align="center">

# 🌿 PhytoDoctor AI

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js->=18-brightgreen?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://typescriptlang.org)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google)](https://ai.google.dev)
[![Status](https://img.shields.io/badge/Status-Production--Ready-success)](https://github.com/YOUR_USERNAME/phytodoctor-ai)

**A high-fidelity, AI-powered plant health platform.** PhytoDoctor AI uses deterministic visual drift detection, a hardened seed economy, and an offline-first architecture to predict plant stress before it becomes visible to the human eye.

[Live Demo](https://your-live-url.com) · [Report Bug](https://github.com/YOUR_USERNAME/phytodoctor-ai/issues) · [Request Feature](https://github.com/YOUR_USERNAME/phytodoctor-ai/issues)

</div>

---

## ✨ Features

- 🔬 **AI Plant Identification** — Upload a photo and get a full clinical diagnostic report powered by Google Gemini.
- 📈 **Visual Drift Lab** — Deterministic HSV histogram analysis detects stress before it's visible.
- 🤖 **Guardian AI** — Predictive 14-day health forecasting using sensor data, check-in history, and weather.
- 💬 **Botanist Chat** — On-demand expert advice from a Senior Botanist AI persona.
- 🌱 **Offline-First** — All data (including high-res photos) is persisted in IndexedDB via Dexie.js.
- 🏆 **Hardened Seed Economy** — Anti-exploit gamification with permanent species-discovery registry and daily XP caps.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Node.js, Express 4 |
| Database | IndexedDB (Dexie.js) — Offline-first |
| AI / LLM | Google Gemini (`@google/genai`) |
| Build Tool | Vite 6, esbuild |
| Deployment | Docker, Node.js PaaS (Render / Cloud Run) |

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) `>= 18.0.0`
- [npm](https://www.npmjs.com/) `>= 9`
- A [Google AI Studio](https://aistudio.google.com/) API key

---

## 🚀 Local Development

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/phytodoctor-ai.git
cd phytodoctor-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in your values (see [Environment Variables](#-environment-variables) below).

### 4. Start the dev server
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key from [AI Studio](https://aistudio.google.com/). |
| `APP_URL` | ✅ Yes | The base URL of your app (e.g., `http://localhost:3000` for dev). |
| `PORT` | Optional | Server port. Defaults to `3000`. Set automatically by most PaaS providers. |
| `NODE_ENV` | Optional | Set to `production` for prod builds. |

---

## 🏭 Production Build

```bash
# Build the Vite frontend + esbuild backend
npm run build

# Start the production server
npm start
```

---

## 🐳 Docker Deployment

```bash
# Build the image
docker build -t phytodoctor-ai .

# Run the container (inject your env vars)
docker run -p 3000:3000 \
  -e GEMINI_API_KEY="your_key_here" \
  -e APP_URL="https://your-domain.com" \
  -e NODE_ENV="production" \
  phytodoctor-ai
```

### Deploy to Render / Railway / Google Cloud Run

1. Connect your GitHub repository to the platform.
2. Set the build command to `npm run build`.
3. Set the start command to `npm start`.
4. Add `GEMINI_API_KEY` and `APP_URL` as environment variables in the platform's dashboard.

---

## 📂 Project Structure

```
phytodoctor-ai/
├── src/
│   ├── components/      # Reusable React components
│   ├── pages/           # Page-level components (Home, Chat, Profile, etc.)
│   ├── services/        # Business logic, DB, and AI service wrappers
│   └── main.tsx         # React entry point
├── public/              # Static assets
├── server.ts            # Express API server (Gemini proxy)
├── vite.config.ts       # Vite configuration
├── Dockerfile           # Docker multi-stage build
└── .env.example         # Environment variable template
```

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.
