# AUDIT_CLAIMS_VERIFIED

35 untriaged — moved to post-merge backlog, NOT cleared

## Previously verified
- BUG-01 (streak multiplier) ✅
- BUG-03 (Pro price inversion) ✅
- SEC-03 (rate limiter maps) ✅
- SEC-09 (Dockerfile NODE_ENV) ✅
- SEC-01 ❌ superseded

## 12 claims to verify by reading code
- **BUG-06**: `BotanicalLab.tsx` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "await GameService.addSeeds(15, 'bonus', 'Updated plant photo check-in'); ... const cloudUrl = await StorageService.uploadPlantPhoto(file, userId);". Notes: Seeds are added before the photo is uploaded, allowing repeated retries on network failure to grant infinite seeds.
- **BUG-07**: `geminiService.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: EXPECTED-FALSE. Evidence: The code does not use response.text() in the catch block of response.json(). Notes: Calibrator claim.
- **BUG-09**: `Assistant.tsx` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "plantId: plantSlug || 'botanical-consultation', userId: 'local-gardener'". Notes: The assistant writes notes using the slug and a hardcoded user id instead of the real plantId and userId.
- **BUG-10**: `CheckInFlow.tsx` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "photoBlob: null,". Notes: `CheckInFlow.tsx` writes `photoBlob: null` which prevents the perfect check-in bonus since `updateCardFromCheckIn` checks for `checkIn.photoBlob`.
- **SEC-02**: `server.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "app.post('/api/identify', express.json({ limit: '11mb' })". Notes: Missing robust prompt injection validation before sending to Gemini, directly interpolating JSON.
- **SEC-04**: `server.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "const ip = (entries.length > 0 ? entries[entries.length - 1] : (req.ip || req.socket.remoteAddress || 'unknown'));". Notes: The rate limiter trusts the rightmost X-Forwarded-For which can be spoofed if proxy chain is unverified.
- **SEC-05**: `server.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: EXPECTED-FALSE. Evidence: There is no missing centralized 4-argument Express error middleware leaking stack traces in HTML. Notes: Calibrator claim.
- **SEC-06**: `server.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "connect-src 'self' https:;". Notes: Wildcard CSP allows data exfiltration.
- **SEC-10**: `gameService.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "fetch('/api/economy/seed-sync', ...". Notes: The client lacks a transactionId outbox queue and blindly fires-and-forgets.
- **SEC-11**: `server.ts` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "const ready = process.env.NODE_ENV !== 'production' ? true : configured.supabase && Boolean(supabaseAuthClient && supabaseAdmin);". Notes: Failing to init Supabase admin blocks `/healthz` from returning 200 ok.
- **R2-08**: `package.json` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: `"framer-motion": "^10.16.4"` and `"motion": "^11.11.13"`. Notes: Dual motion packages installed.
- **R4-02**: `Clinic.tsx` @ `b7b3057982a7950d8e22c7cb52b731f86c46189d`. Verdict: CONFIRMED. Evidence: "text-muted", "gold" etc against warm cream backgrounds fail WCAG contrast. Notes: Checked colors and tokens.
