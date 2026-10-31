# Beside

**Disabled patients are talked over, rushed, and dismissed. Beside makes sure they are heard.**

People who are nonverbal, autistic, deaf or hard of hearing, or who have speech or cognitive disabilities often leave appointments without having been asked, understood, or accommodated. Doctors speak to the companion instead of the patient, use jargon, move too fast, and miss pain that doesn’t look like “typical” pain. Up to 1 in 4 U.S. adults has a disability (CDC).

Beside is a communication companion for the exam room. The patient’s phone gives them a voice. The clinician’s tablet nudges them to communicate better, in real time.

**Open the app.** A 25-second intro plays (skip any time), then press **Watch a 75-second visit**. Sam, a fictional autistic, nonverbal patient, goes through an urgent care visit, and every feature plays out on the real patient and clinician screens. No key, no microphone, no setup.

## Features

| | Feature | What it does |
|---|---|---|
| 1 | **Sample visit** | A narrated, scripted appointment on the real app screens, organized as 10 numbered steps. Play, pause, restart, 1–2× speed, jump to any step, and switch Sam’s language. |
| 2 | **“This is me” card** | The patient’s own words: how they communicate, what overwhelms them, how pain shows up, what they need. It lands on the clinician’s tablet when the visit starts. |
| 3 | **Live captions** | Everything said in the room appears in large Atkinson Hyperlegible text on the patient’s phone, word by word, and is announced once to screen readers. |
| 4 | **Jargon decoder** | Medical terms are highlighted and swapped for plain words, with the original term kept small (“gently press on your belly · *palpate your abdomen*”). There are over 100 offline terms, plus AI for anything else. |
| 5 | **Reply prediction + voice** | Three likely answers after every question, as big buttons. One tap speaks it aloud (speech synthesis) and shows it on the tablet. There’s also a 15-phrase AAC board and type-to-speak. |
| 6 | **Talk-to-me nudge** | When the clinician addresses the companion instead of the patient, the tablet shows “Please speak directly to Sam.” While the patient is choosing a reply, it shows “Sam is answering… silence is okay.” |
| 7 | **Pain translator** | A body map plus quality, severity, and duration become a clinical-style summary (“sharp pain, right lower quadrant (RLQ), 7/10, 3 days, aggravated by movement”), spoken aloud in plain words. |
| 8 | **Say it simpler + understanding meter** | One tap rewrites the last sentence in plain words, right away. Two taps tell the clinician to slow down and rephrase. |
| 9 | **Recap + accountability** | The patient gets a plain-language summary and next steps, read aloud and saved to their visit history. The clinician gets a communication summary (direct-address %, terms decoded, accommodations provided) with coaching. |
| 10 | **Live visits** | A real visit across two devices: the patient shares a 4-digit code and the clinician joins from any device. Captions come from the microphone (the browser’s recognizer, or Groq Whisper in browsers without one) or typing. AI refines everything when a key is set. |
| 11 | **Video visits** | Peer-to-peer, encrypted video calls between patient and clinician, with live captions running throughout. The patient’s tapped replies are spoken on the clinician’s device, so the doctor hears them clearly. |
| 12 | **15 languages** | The patient app, captions, replies, and recap appear in the patient’s language, while the clinician stays in English. Right-to-left layouts are supported for Arabic and Persian. |
| 13 | **Decode tool** | Paste discharge papers or any medical text, and get it back in plain words in your language, read aloud. |
| 14 | **30-second tour** | An optional, step-by-step walkthrough on the home page: two screens, the card, the visit code, talking, coaching, and the recap. |

## Accessibility of the app itself

- WCAG 2.2 AA: axe-core reports **0 violations** on every screen, in dark, light, and high-contrast themes.
- Full keyboard support: skip links, roving-focus tabs and segmented controls, keyboard-operable body map, native `<dialog>` with focus trapping, and focus moved to the page heading on navigation.
- Screen readers: captions are announced once, in plain words, with the medical term in brackets. Live regions cover nudges, narration, and pain reports.
- Display: matte-black dark theme, light theme, and high contrast. Four text sizes. Reduced motion follows the OS setting and can be toggled.
- Touch targets are 44–64px. Containers resize with their layout, so screens work in device frames and at any size.

## Architecture

```
          Patient phone (/patient)                     Clinician tablet (/clinician)
   captions · replies · board · pain · card      card · nudges · checklist · transcript
                    │  ▲                                        │  ▲
          actions.js │  │ state                       actions.js │  │ state
                    ▼  │                                        ▼  │
              ┌─────────────────┐  events + video by   ┌─────────────────┐
              │ visit engine    │◄─── visit code ─────►│ visit engine    │
              │ (event log →    │  WebRTC (peer to     │ (same reducer)  │
              │  reducer.js)    │  peer) + Broadcast-  │                 │
              └────────┬────────┘  Channel + local log └────────┬────────┘
                       │ instant offline answer                  │
                       ▼ then AI refinement                      ▼
               jargon.js · local replies            POST /api/assist      (Vercel functions)
                                                    POST /api/transcribe
                                                     ├─ Groq (GROQ_API_KEY): gpt-oss-120b, Whisper
                                                     ├─ Hugging Face (HF_TOKEN)
                                                     └─ Claude (ANTHROPIC_API_KEY)
```

- **Event-sourced visit engine** (`src/core/visit.js`). A visit is an append-only event log. The phone, the tablet, the sample visit, the home-page hero, and the saved recap all reduce the same log with the same reducer, so they can never disagree. Events whose type starts with `ui/` stay on the device.
- **Live sync** (`src/core/sync.js`). The patient’s phone hosts the visit; clinicians connect to it over a WebRTC data channel (PeerJS signaling), so the conversation travels peer to peer, encrypted. Tabs in the same browser also share a `BroadcastChannel`. Every device persists the log locally and merges by event ID: late joiners request a snapshot, reloads resume, and duplicates are harmless. Presence pings drive the “Connected” indicator.
- **Video calls** (`src/core/call.js`). The same peer connection carries audio and video. Either side can call; the other side is asked first. Captions start automatically on the clinician’s device, and the patient’s replies are spoken there, so they are never heard twice.
- **Captions everywhere** (`src/core/speech.js`, `api/transcribe.js`). The browser’s speech recognizer when it has one; otherwise a voice-activity detector records each phrase and Groq Whisper transcribes it, with Whisper’s known silence hallucinations filtered out.
- **Offline-first AI** (`src/core/actions.js`, `src/core/ai.js`). Every action answers instantly with the built-in decoder and heuristics, then upgrades when AI responds: speaker and addressee detection, extra jargon, three replies in English and the patient’s language, a plain-language translation, simplifications, and recaps. If AI is missing, slow, or wrong, the visit carries on.
- **Server** (`api/assist.js`). Keys stay on the server. Each task has a strict schema (zod). Groq and Hugging Face use JSON mode with validation and one retry; Claude uses native structured outputs. A different model can be set per task. Addressee detection combines the model with rules for unambiguous wording (“So Mom, …”, “Sam, …”).
- **Languages** (`src/core/i18n.js`). The interface is written in English. Picking another language translates the whole interface in one batched AI call, cached on the device. Captions and replies are translated per line.
- **Privacy.** No accounts and no analytics. Cards, visits, and settings live in the patient’s `localStorage`. All sample people are fictional.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Everything works without a key.

### Turn on AI

```bash
cp .env.example .env
```

Then set **one** of these:

- `GROQ_API_KEY` (recommended): fastest, and also powers Whisper captions. Default model `openai/gpt-oss-120b`; override with `GROQ_MODEL` or per task (`GROQ_MODEL_TURN`, …).
- `HF_TOKEN`: a Hugging Face token with Inference Providers access (`HF_MODEL`, default `meta-llama/Llama-3.3-70B-Instruct`).
- `ANTHROPIC_API_KEY`: uses Claude (`claude-opus-5-5`, low effort for speed).

Restart `npm run dev`. The settings sheet shows which provider and model are connected.

### Try a live visit on one computer

1. Open `/patient`, choose **Explore with a sample profile** (or build your own card), then **Start a visit**.
2. On another device, open `/clinician` and enter the code. Or click **Open the clinician screen here** to use a second tab.
3. Type or speak as the clinician. Tap replies on the patient side. Start a **video call** from either screen. End the visit from either screen.

Camera and microphone need HTTPS on real devices, so use the deployed URL for phone-to-laptop video.

### Calls across different networks

Two devices on the same Wi-Fi connect directly. Devices on different networks (a phone on mobile data and a laptop on home Wi-Fi, or most office and school networks) need a TURN relay. Add a free Cloudflare TURN key:

1. In the Cloudflare dashboard, open **Realtime → TURN Server → Create**.
2. Add `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_KEY_API_TOKEN` to your environment (Vercel: Settings → Environment Variables), then redeploy.

`/api/ice` then hands each browser short-lived relay credentials. Any other TURN provider works through `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`. If two devices can't reach each other, both screens say so instead of failing silently.

### Share a temporary public link

Serve the production build (with the AI routes, gzipped) and tunnel it over SSH. Nothing to install, and the link is HTTPS, so camera and microphone work on phones:

```bash
npm run serve
```

```bash
ssh -R 80:localhost:4173 nokey@localhost.run
```

The tunnel prints a `https://….lhr.life` address. It lasts while both commands run, and changes each time.

## Deploy to Vercel

```bash
npx vercel
```

Vercel detects Vite and the `api/` function. `vercel.json` rewrites app routes to `index.html`. Add `GROQ_API_KEY` (or `HF_TOKEN` / `ANTHROPIC_API_KEY`) under Project Settings → Environment Variables. Without a key, the deployed app runs fully in sample and offline mode.

## Project layout

```
api/assist.js                  AI tasks: turn, simplify, translate, strings, recap (Groq, Hugging Face, or Claude)
api/transcribe.js              Whisper speech to text on Groq
api/ice.js                     STUN/TURN servers for video and live sync
src/app/                       App shell, router
src/core/visit.js              Event types, reducer, selectors, metrics, coaching
src/core/sync.js               Live sync by visit code (WebRTC data channel + BroadcastChannel + local log)
src/core/call.js               Peer-to-peer video calls
src/core/actions.js            High-level actions with voice + AI side effects
src/core/ai.js                 API client, status, offline fallbacks
src/core/jargon.js             100+ term plain-language dictionary and decoder
src/core/i18n.js               15 languages, AI-translated interface
src/core/sampleVisit.js        Sam’s scripted visit
src/core/catalog.js            Card prompts, accommodations, phrase board, pain options
src/patient/                   Patient app: onboarding, home, visit, pain map, recap, decode
src/clinician/                 Clinician app: join by code, live dashboard, summary
src/theater/                   Sample visit player with device frames
src/landing/                   Four-act intro and home page
src/ui/                        Design system: tokens, components, captions, settings
public/                        PWA manifest, icon, offline service worker
```

Beside is a hackathon prototype, not a medical device.
