# Transcription Server Contract

Endpoint: `POST /api/transcription/chunk`

Purpose:
- Receive audio chunks only when browser STT is unavailable/unreliable.
- Return provider-agnostic transcript segments.

Request:
- `Content-Type`: `multipart/form-data`
- Fields:
  - `audio`: binary chunk (`webm`/`mp4`)
  - `session_id`: string
  - `sequence`: integer chunk order
  - `start_ms`: integer offset from session start
  - `end_ms`: integer offset from session start
  - `language`: string (example: `en-US`)
  - `provider_hint`: string (`auto` | `whisper` | `gemini` | `deepgram`)
- Headers:
  - `x-transcription-provider`: same values as `provider_hint`

Response (`200`):
```json
{
  "session_id": "session-abc",
  "sequence": 12,
  "provider": "whisper",
  "segments": [
    {
      "id": "seg-12-0",
      "text": "I want to improve my speaking flow",
      "start_ms": 45800,
      "end_ms": 48950,
      "is_final": true
    }
  ],
  "latency_ms": 620
}
```

Error response (`>=400`):
```json
{
  "error": {
    "code": "bad_audio_chunk",
    "message": "Could not decode audio payload",
    "retryable": true
  }
}
```

Provider routing (server-side):
- `provider_hint=whisper` -> Whisper adapter
- `provider_hint=gemini` -> Gemini adapter
- `provider_hint=deepgram` -> Deepgram adapter
- `provider_hint=auto` -> server chooses best provider
