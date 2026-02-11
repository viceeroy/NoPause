# No Pause — Architecture

> A speaking-practice app. Offline-first, privacy-safe, no backend.

## Folder Structure

```
src/
├── index.js                  ← App entry point
├── index.css                 ← Global styles & design tokens
│
├── app/                      ← Application shell
│   ├── App.js                ← Routing, providers, global init
│   └── App.css               ← App-level styles
│
├── pages/                    ← Route-level components (one per route)
│   ├── DashboardPage.js      ← Home screen: mode selection, streak, stats
│   ├── PracticePage.js       ← Recording session: setup → countdown → record → results
│   ├── PromptsPage.js        ← Browse & pick speaking prompts
│   └── StatsPage.js          ← Historical stats, charts, session list
│
├── analytics/                ← Three-layer analytics engine
│   ├── index.js              ← Public API — only file imported by UI
│   ├── store.js              ← IndexedDB wrapper (events, metrics, rollups)
│   ├── metricsEngine.js      ← Session metrics computation + daily/weekly rollups
│   ├── insightsEngine.js     ← Behavioral patterns, improvement velocity, insights
│   ├── coachingContext.js     ← LLM coaching context builder
│   └── benchmarkEngine.js    ← Anonymized benchmark system (consent-gated)
│
├── audio/                    ← Speech detection & analysis
│   ├── speechAnalyzer.js     ← V1 fixed-threshold analyzer (Web Audio API)
│   └── detectionProfile.js   ← V2 adaptive detection (reserved, not active)
│
├── storage/                  ← Persistence layer
│   └── localStore.js         ← localStorage wrapper (sessions, preferences)
│
├── data/                     ← Static data / content
│   └── speakingPrompts.js    ← Prompt library, categories, difficulty levels
│
├── ui/                       ← Reusable UI components
│   ├── Navbar.js             ← Bottom navigation bar
│   ├── AudioVisualizer.js    ← Waveform visualization
│   └── VoiceVisualizer.js    ← Frequency-based voice visualization
│
├── hooks/                    ← Shared React hooks
│   └── useToast.js           ← Toast notification hook
│
├── utils/                    ← Pure utilities
│   └── cn.js                 ← Tailwind class merge helper
│
└── design_guidelines.json    ← Design tokens reference
```

## Design Principles

### Dependency Direction (enforced)

```
pages/ → analytics/, audio/, storage/, data/, ui/
         ↓
analytics/index.js → analytics/store.js, analytics/metricsEngine.js, etc.
         ↓
storage/, data/ → (no imports — leaf nodes)
```

**Allowed:**
- Pages import from any domain module
- `analytics/index.js` imports from its internal modules
- UI components import from `utils/`

**NOT allowed:**
- Storage importing UI
- Analytics importing React components
- Audio depending on analytics
- Internal analytics modules importing `analytics/index.js` (circular)

### Single Entry Points

Each domain exposes **one public API**:
- `analytics/index.js` → `import { analytics } from '@/analytics'`
- `audio/speechAnalyzer.js` → `import { AudioAnalyzer } from '@/audio/speechAnalyzer'`
- `storage/localStore.js` → `import { storage } from '@/storage/localStore'`

Internal modules (e.g., `analytics/store.js`) are **not imported directly** by pages.

## Data Flow

### Practice Session Lifecycle

```
1. User starts session
   PracticePage → AudioAnalyzer.start()

2. Real-time analysis (30fps loop)
   AudioAnalyzer._analyze() → onData callback → React state → UI update

3. Hesitation detected
   AudioAnalyzer → onHesitation callback → analytics.hesitationDetected()

4. Session ends
   AudioAnalyzer.stop() → raw results
   ├── storage.saveSession()           ← localStorage (user-facing history)
   └── analytics.processSessionEnd()   ← IndexedDB (structured metrics)

5. App next open
   App.js → analytics.runDailyRollup() ← aggregates sessions into daily/weekly
```

### Analytics Pipeline

```
Layer 1: Events (ephemeral, 7-day retention)
  └── Raw event log: session.initiated, speech.hesitation, nav.page_viewed

Layer 2: Session Metrics + Rollups (90-day retention)
  ├── computeSessionMetrics()  → per-session: flowScore, speakingRatio, WPM, etc.
  ├── computeDailyRollup()     → per-day: avgFlowScore, totalSessions, cleanAvgFlowScore
  └── computeWeeklyRollup()    → per-week: trend direction, consistency score

Layer 3: Intelligence
  ├── insightsEngine.js
  │   ├── computeImprovementVelocity()  → learning speed, plateau detection
  │   ├── computeBehavioralPatterns()   → time-of-day, practice frequency
  │   └── generateInsights()            → actionable text insights
  ├── coachingContext.js
  │   └── buildCoachingContext()        → structured context for LLM coaching
  └── benchmarkEngine.js
      └── computeBenchmarkSnapshot()    → anonymized, consent-gated benchmarks
```

### Audio Pipeline

```
Microphone → MediaStream
  ├── AnalyserNode (FFT)
  │   └── speechAnalyzer._analyze()  ← 30fps classification loop
  │       ├── RMS calculation
  │       ├── Volume smoothing (10-sample window)
  │       ├── Hysteresis classification (on/off thresholds)
  │       ├── Delta-time accumulation (speaking + silence = total)
  │       └── Hesitation tracking (>1800ms with 300ms micro-pause filter)
  │
  ├── MediaRecorder → audio blob (playback)
  └── SpeechRecognition → transcript
```

**V1 thresholds (fixed):**
| Parameter | Value |
|---|---|
| Speech on | 0.01 RMS |
| Speech off | 0.007 RMS (0.01 × 0.7) |
| Hesitation | ≥ 1800ms silence |
| Micro-pause filter | < 300ms ignored |

**V2 adaptive** (reserved in `detectionProfile.js`):
- Per-user threshold learning via EMA
- Mode switching (forgiving / strict)
- Not active in V1

## Where to Change Things

| I want to... | Go to... |
|---|---|
| Add a new page/route | `pages/` + `app/App.js` |
| Add a new analytics metric | `analytics/metricsEngine.js` |
| Change hesitation detection | `audio/speechAnalyzer.js` (constants at top) |
| Add a new insight type | `analytics/insightsEngine.js` |
| Change session storage | `storage/localStore.js` |
| Add speaking prompts | `data/speakingPrompts.js` |
| Add a reusable component | `ui/` |
| Add a shared hook | `hooks/` |
| Enable adaptive detection | `audio/detectionProfile.js` → import in `speechAnalyzer.js` |
| Add coaching features | `analytics/coachingContext.js` |
| Add benchmark features | `analytics/benchmarkEngine.js` |
| Set up cloud sync | `analytics/store.js` → `setSyncAdapter()` |

## Conventions

- **Page files** are named `*Page.js` and default-export a single component
- **Analytics modules** are named by purpose: `metricsEngine`, `insightsEngine`, etc.
- **No circular imports** — analytics/index.js imports internal modules, never the reverse
- **`@/` alias** maps to `src/` (configured in `jsconfig.json`)
- **Analytics never breaks the app** — all analytics calls are try/catch wrapped
