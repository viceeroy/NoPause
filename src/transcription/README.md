# Hybrid Transcription Architecture

`useMobileSpeechRecognition` now uses a provider engine:

- `BrowserTranscriptionProvider`
  - Uses Web Speech API.
  - First choice on secure, supported browsers.
  - Emits partial/final segments.

- `ServerTranscriptionProvider`
  - Uses `MediaRecorder` chunks and uploads to `/api/transcription/chunk`.
  - Activated only on fallback conditions.
  - Provider-agnostic (`whisper` / `gemini` / `deepgram` via server routing).

- `hybridTranscriptionEngine`
  - Starts browser provider when possible.
  - Auto-switches to server provider when browser STT is unavailable or unreliable.
  - Handles restart threshold, error threshold, and permission-denied browser STT.

- `transcriptAccumulator`
  - Merges partial + final transcript output.
  - Deduplicates repeated final segments.
  - Preserves per-segment timestamps for analytics.
