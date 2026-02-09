# No Pause

**Offline-first speaking practice tool for mastering verbal continuity and eliminating hesitations.**

No Pause is a high-performance web application designed for speakers, language learners, and presenters who want to build a "flow" state in their speech. Unlike traditional language apps, No Pause focuses exclusively on the rhythm and continuity of your delivery, providing real-time technical analysis without ever sending your audio to the cloud.

---

## 🚀 Product Overview

In high-stakes communication, pauses and hesitations (filler words, trailing off, "uhm/ah") are the primary barriers to perceived confidence. No Pause provides a rigorous training environment to:

-   **Eliminate Silence:** Real-time monitoring of speech gaps.
-   **Measure Continuity:** Using our proprietary **Flow Score** metric.
-   **Protect Privacy:** 100% on-device processing. No accounts, no uploads, no latency.

---

## ✨ Core Features

-   **🎙️ Multi-Mode Practice:**
    -   **Free Speaking:** Unlimited timeframe for natural flow development.
    -   **Lemon Technique:** High-pressure 1-minute sessions triggered by random word prompts.
    -   **Topic Speaking:** 2-minute critical thinking challenges across various categories.
-   **📊 Real-Time Voice Analysis:** Integrated hesitation detection that flags silences longer than 500ms.
-   **📈 Flow Score Analytics:** Instant calculation of your speaking-to-silence ratio.
-   **📅 Stats & History:** Local persistence of session performance, streaks, and progress trends.
-   **⚡ Offline-First:** Works anywhere, anytime. Completely serverless architecture.

---

## 📈 Flow Score Explained

The **Flow Score** is a technical percentage (0–100%) that measures your speech density. 

-   **Speaking Time vs. Silence:** The core ratio is calculated based on active voice periods against the total session duration.
-   **Hesitation Penalties:** Each detected hesitation (silence > 500ms) applies a minor penalty to the overall score.
-   **Continuity over Grammar:** The score is intentionally agnostic to grammar, pronunciation, or vocabulary, focusing purely on your ability to maintain a steady verbal stream.

---

## 🛠 Tech Stack

-   **Frontend:** React 19 + Tailwind CSS
-   **Audio Engine:** Web Audio API (Native browser processing)
-   **Capture:** MediaRecorder API
-   **Persistence:** localStorage (Browser-based storage)
-   **Data Vis:** Recharts (Performance trends)
-   **Icons:** Lucide Icons

---

## 📁 App Structure

```text
src/
├── components/   # UI components and layout wrappers
├── pages/        # Dashboard, Practice modes, and Stats
├── lib/
│   ├── audioAnalyzer.js  # Core Web Audio logic and scoring
│   ├── storage.js       # localStorage management
│   └── prompts.js       # Practice topics and word banks
└── App.js        # Routing and global state
```

---

## 🚀 Getting Started

1.  **Clone and Install:**
    ```bash
    npm install
    ```
2.  **Start Dev Server:**
    ```bash
    npm start
    ```
3.  **Build for Production:**
    ```bash
    npm run build
    ```

---

## 🔒 Privacy & Security

No Pause is built on a "Zero-Trust" audio architecture.
-   **No Backend:** There is no server API to intercept data.
-   **No Uploads:** Your voice is processed in-memory and never saved to a server.
-   **Local Storage:** Your practice history belongs solely to your browser's local storage.

---

## 🗺️ Roadmap

-   [ ] **AI Evaluation:** Localized LLM integration for content feedback.
-   [ ] **Pronunciation Scoring:** Extended frequency analysis for phoneme clarity.
-   [ ] **Conversation Mode:** Interactive scenarios for dialogue flow practice.

---

## 📄 License & Contribution

Open source under the MIT License. We welcome contributions that improve the UI or the technical accuracy of the audio analyzer while maintaining our strict offline-first principles.
