import { TranscriptionProvider } from '@/transcription/transcriptionProvider';

const DEFAULT_ENDPOINT = '/api/transcription/chunk';
const DEFAULT_TIMESLICE_MS = 4000;
const DEFAULT_MAX_UPLOAD_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return '';
}

export class ServerTranscriptionProvider extends TranscriptionProvider {
  constructor(callbacks = {}, options = {}) {
    super(callbacks);
    this.callbacks = callbacks;
    this.options = options;
    this.endpoint = options.endpoint || DEFAULT_ENDPOINT;
    this.providerHint = options.providerHint || 'auto';
    this.chunkTimesliceMs = options.chunkTimesliceMs || DEFAULT_TIMESLICE_MS;
    this.maxUploadRetries = options.maxUploadRetries || DEFAULT_MAX_UPLOAD_RETRIES;
    this.fetchImpl = options.fetchImpl || fetch;
    this.audioConstraints = options.audioConstraints || {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    this.stream = null;
    this.mediaRecorder = null;
    this.active = false;
    this.uploading = false;
    this.queue = [];
    this.sequence = 0;
    this.startedAtMs = null;
    this.lastChunkEndMs = 0;
  }

  _log(event, data = {}) {
    if (this.callbacks.onLog) this.callbacks.onLog(event, { provider: 'server', ...data });
  }

  _emitError(code, message, recoverable = true) {
    if (this.callbacks.onError) {
      this.callbacks.onError({ code, message, recoverable });
    }
  }

  _normalizeSegments(payload) {
    const segments = Array.isArray(payload?.segments) ? payload.segments : [];
    return segments.map((seg, index) => ({
      id: seg.id || `server-${this.sequence}-${index}`,
      text: seg.text || '',
      startMs: Number.isFinite(seg.start_ms) ? seg.start_ms : null,
      endMs: Number.isFinite(seg.end_ms) ? seg.end_ms : null,
      isFinal: seg.is_final !== false,
      source: 'server',
    }));
  }

  async _uploadChunk(item) {
    const formData = new FormData();
    formData.append('audio', item.blob, `chunk-${item.sequence}.webm`);
    formData.append('sequence', String(item.sequence));
    formData.append('start_ms', String(item.startMs));
    formData.append('end_ms', String(item.endMs));
    formData.append('provider_hint', this.providerHint);
    formData.append('session_id', item.sessionId);
    formData.append('language', item.language || 'en-US');

    for (let attempt = 0; attempt <= this.maxUploadRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          body: formData,
          headers: {
            'x-transcription-provider': this.providerHint,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const normalized = this._normalizeSegments(data);
        normalized.forEach((segment) => {
          if (this.callbacks.onSegment) this.callbacks.onSegment(segment);
        });
        this._log('chunk_uploaded', {
          sequence: item.sequence,
          attempts: attempt + 1,
          segments: normalized.length,
        });
        return true;
      } catch (error) {
        const isLast = attempt === this.maxUploadRetries;
        this._log('chunk_upload_failed', {
          sequence: item.sequence,
          attempt: attempt + 1,
          isLast,
          error: String(error),
        });
        if (isLast) {
          this._emitError('server-upload-failed', `Failed uploading audio chunk ${item.sequence}`, true);
          return false;
        }
        await sleep((attempt + 1) * 400);
      }
    }

    return false;
  }

  async _drainQueue() {
    if (this.uploading) return;
    this.uploading = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      await this._uploadChunk(item);
    }

    this.uploading = false;
  }

  async start({ stream = null, language = 'en-US', sessionId = `session-${Date.now()}` } = {}) {
    if (typeof MediaRecorder === 'undefined') {
      this._emitError('media-recorder-unavailable', 'MediaRecorder is unavailable for server fallback', false);
      return false;
    }

    try {
      this.stream = stream || await navigator.mediaDevices.getUserMedia({ audio: this.audioConstraints });
      const mimeType = pickMimeType();
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);

      this.active = true;
      this.sequence = 0;
      this.queue = [];
      this.startedAtMs = Date.now();
      this.lastChunkEndMs = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        const nowElapsed = Date.now() - this.startedAtMs;
        const chunk = {
          blob: event.data,
          sequence: this.sequence++,
          startMs: this.lastChunkEndMs,
          endMs: nowElapsed,
          sessionId,
          language,
        };
        this.lastChunkEndMs = nowElapsed;
        this.queue.push(chunk);
        this._drainQueue();
      };

      this.mediaRecorder.onerror = (event) => {
        this._emitError('media-recorder-error', event?.error?.message || 'MediaRecorder error', true);
      };

      this.mediaRecorder.onstop = () => {
        this.active = false;
        if (this.callbacks.onEnd) this.callbacks.onEnd();
      };

      this.mediaRecorder.start(this.chunkTimesliceMs);
      this._log('fallback_started', { mimeType: this.mediaRecorder.mimeType, timeslice: this.chunkTimesliceMs });
      if (this.callbacks.onStart) this.callbacks.onStart();
      return true;
    } catch (error) {
      this._emitError(error?.name || 'server-fallback-start-failed', error?.message || 'Failed to start server fallback', true);
      return false;
    }
  }

  async stop() {
    if (!this.mediaRecorder) {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.active = false;
      return;
    }

    const recorder = this.mediaRecorder;
    this.mediaRecorder = null;

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch (error) {
      this._log('stop_failed', { error: String(error) });
    }

    // Give remaining uploads a chance to finish.
    await this._drainQueue();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.active = false;
  }

  isActive() {
    return this.active;
  }
}

