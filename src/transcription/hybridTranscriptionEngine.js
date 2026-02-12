import { BrowserTranscriptionProvider } from '@/transcription/browserTranscriptionProvider';
import { ServerTranscriptionProvider } from '@/transcription/serverTranscriptionProvider';
import { createTranscriptAccumulator } from '@/transcription/transcriptAccumulator';

const DEFAULT_UNSUPPORTED_BROWSERS = ['Samsung Internet', 'Firefox'];

export function createHybridTranscriptionEngine(config = {}) {
  const {
    runtimeInfo,
    log,
    onTranscriptChange,
    onStateChange,
    onError,
    language = 'en-US',
    maxBrowserErrors = 3,
    maxBrowserRestarts = 4,
    browserRestartDelayMs = 700,
    unsupportedBrowsers = DEFAULT_UNSUPPORTED_BROWSERS,
    server = {},
  } = config;

  const accumulator = createTranscriptAccumulator();
  let providerType = 'idle';
  let provider = null;
  let browserErrorCount = 0;
  let browserRestartCount = 0;
  let browserRestartTimer = null;
  let stoppedManually = false;

  const emitState = () => {
    if (!onStateChange) return;
    onStateChange({
      providerType,
      browserErrorCount,
      browserRestartCount,
    });
  };

  const emitTranscript = () => {
    if (!onTranscriptChange) return;
    onTranscriptChange({
      text: accumulator.getDisplayText(),
      finalText: accumulator.getFinalText(),
      partialText: accumulator.getPartialText(),
      segments: accumulator.getSegments(),
      providerType,
    });
  };

  const addSegment = (segment) => {
    if (accumulator.addSegment(segment)) {
      emitTranscript();
    }
  };

  const clearBrowserRestartTimer = () => {
    if (browserRestartTimer) {
      clearTimeout(browserRestartTimer);
      browserRestartTimer = null;
    }
  };

  const closeProvider = async () => {
    clearBrowserRestartTimer();
    if (!provider) return;
    await provider.stop();
    provider = null;
    providerType = 'idle';
    emitState();
  };

  const createCallbacks = () => ({
    onLog: (event, data = {}) => {
      if (log) log(event, data);
    },
    onStart: () => {
      if (providerType === 'browser') {
        browserErrorCount = 0;
      }
      emitState();
    },
    onSegment: addSegment,
    onError: async (error) => {
      if (log) log('provider_error', { providerType, ...error });
      if (onError) onError(error);

      if (providerType !== 'browser') return;

      const code = error?.code || 'unknown';
      const browserPermissionDenied = code === 'not-allowed' || code === 'service-not-allowed';
      if (browserPermissionDenied) {
        await switchToServer('browser_permission_denied');
        return;
      }

      browserErrorCount += 1;
      emitState();
      if (browserErrorCount >= maxBrowserErrors) {
        await switchToServer('browser_errors_exceeded');
      }
    },
    onEnd: () => {
      if (providerType !== 'browser' || stoppedManually) return;
      if (browserRestartCount >= maxBrowserRestarts) {
        switchToServer('browser_restarts_exceeded');
        return;
      }
      browserRestartCount += 1;
      emitState();
      clearBrowserRestartTimer();
      browserRestartTimer = setTimeout(() => {
        if (!stoppedManually && providerType === 'browser') {
          provider.start({ language });
        }
      }, browserRestartDelayMs);
    },
  });

  const shouldUseBrowserFirst = () => {
    if (!runtimeInfo?.hasSpeechRecognition) return false;
    if (!runtimeInfo?.isSecure) return false;
    const browserName = runtimeInfo?.browser?.name || 'Unknown';
    if (unsupportedBrowsers.includes(browserName)) return false;
    return true;
  };

  const startBrowser = async () => {
    providerType = 'browser';
    provider = new BrowserTranscriptionProvider(createCallbacks());
    emitState();
    return provider.start({ language });
  };

  const startServer = async ({ stream = null, sessionId = null } = {}) => {
    providerType = 'server';
    provider = new ServerTranscriptionProvider(createCallbacks(), server);
    emitState();
    return provider.start({ stream, language, sessionId: sessionId || `session-${Date.now()}` });
  };

  async function switchToServer(reason, { stream = null, sessionId = null } = {}) {
    if (providerType === 'server') return true;
    if (log) log('fallback_switch', { reason });
    await closeProvider();
    return startServer({ stream, sessionId });
  }

  async function start(options = {}) {
    const { preferBrowser = true, allowServerFallback = true, stream = null, sessionId = null } = options;
    stoppedManually = false;

    if (preferBrowser && shouldUseBrowserFirst()) {
      const browserStarted = await startBrowser();
      if (browserStarted) return true;
      await closeProvider();
      if (!allowServerFallback) return false;
      return startServer({ stream, sessionId });
    }

    if (!allowServerFallback) return false;
    return startServer({ stream, sessionId });
  }

  async function stop() {
    stoppedManually = true;
    await closeProvider();
  }

  function resetTranscript() {
    accumulator.reset();
    browserErrorCount = 0;
    browserRestartCount = 0;
    emitTranscript();
    emitState();
  }

  function getSnapshot() {
    return {
      providerType,
      transcript: accumulator.getDisplayText(),
      finalTranscript: accumulator.getFinalText(),
      segments: accumulator.getSegments(),
      browserErrorCount,
      browserRestartCount,
    };
  }

  return {
    start,
    stop,
    switchToServer,
    resetTranscript,
    getSnapshot,
    isActive: () => provider?.isActive?.() || false,
  };
}

