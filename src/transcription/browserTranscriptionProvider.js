import { TranscriptionProvider } from '@/transcription/transcriptionProvider';

export class BrowserTranscriptionProvider extends TranscriptionProvider {
  constructor(callbacks = {}, options = {}) {
    super(callbacks);
    this.callbacks = callbacks;
    this.options = options;
    this.recognition = null;
    this.active = false;
    this.startTimeMs = null;
  }

  _log(event, data = {}) {
    if (this.callbacks.onLog) this.callbacks.onLog(event, { provider: 'browser', ...data });
  }

  _emitError(code, message, recoverable = true) {
    if (this.callbacks.onError) {
      this.callbacks.onError({ code, message, recoverable });
    }
  }

  async start({ language = 'en-US' } = {}) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this._emitError('speech-recognition-unsupported', 'SpeechRecognition is not available', false);
      return false;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        this.active = true;
        this.startTimeMs = Date.now();
        this._log('onstart');
        if (this.callbacks.onStart) this.callbacks.onStart();
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          const isFinal = !!result.isFinal;
          const elapsedMs = this.startTimeMs ? Date.now() - this.startTimeMs : null;

          if (this.callbacks.onSegment) {
            this.callbacks.onSegment({
              id: `browser-${i}-${Date.now()}-${isFinal ? 'f' : 'p'}`,
              text,
              startMs: elapsedMs == null ? null : Math.max(0, elapsedMs - 1200),
              endMs: elapsedMs,
              isFinal,
              source: 'browser',
            });
          }
        }
      };

      recognition.onerror = (event) => {
        const code = event?.error || 'unknown-browser-stt-error';
        const recoverable = !['not-allowed', 'service-not-allowed'].includes(code);
        this._log('onerror', { code, recoverable });
        this._emitError(code, `Browser STT error: ${code}`, recoverable);
      };

      recognition.onend = () => {
        this.active = false;
        this._log('onend');
        if (this.callbacks.onEnd) this.callbacks.onEnd();
      };

      this.recognition = recognition;
      recognition.start();
      this._log('start_called');
      return true;
    } catch (error) {
      this._emitError(error?.name || 'browser-start-failed', error?.message || 'Failed to start browser STT', true);
      return false;
    }
  }

  async stop() {
    if (!this.recognition) return;
    const recognition = this.recognition;
    this.recognition = null;
    this.active = false;

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    try {
      recognition.stop();
    } catch (error) {
      this._log('stop_failed', { error: String(error) });
    }
  }

  isActive() {
    return this.active;
  }
}

