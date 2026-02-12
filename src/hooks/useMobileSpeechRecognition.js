import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createHybridTranscriptionEngine } from '@/transcription/hybridTranscriptionEngine';

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function detectBrowser(ua) {
  const lower = ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(lower);
  const isAndroid = /android/.test(lower);

  if (/samsungbrowser/.test(lower)) return { name: 'Samsung Internet', isIOS, isAndroid };
  if (/crios/.test(lower)) return { name: 'Chrome iOS', isIOS: true, isAndroid: false };
  if (/chrome/.test(lower) && !/edg|opr|opera/.test(lower)) return { name: 'Chrome', isIOS, isAndroid };
  if (/safari/.test(lower) && !/chrome|crios|android/.test(lower)) return { name: 'Safari', isIOS, isAndroid };
  if (/firefox|fxios/.test(lower)) return { name: 'Firefox', isIOS, isAndroid };

  return { name: 'Unknown', isIOS, isAndroid };
}

function buildRuntimeInfo() {
  const ua = navigator.userAgent || '';
  const browser = detectBrowser(ua);
  const isMobile = MOBILE_UA_REGEX.test(ua);
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost';

  return {
    ua,
    browser,
    isMobile,
    isSecure,
    hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    hasPermissionsApi: !!(navigator.permissions && navigator.permissions.query),
    hasSpeechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}

export function useMobileSpeechRecognition(options = {}) {
  const {
    lang = 'en-US',
    debug = true,
    maxBrowserErrors = 3,
    maxAutoRestarts = 4,
    restartDelayMs = 700,
    serverEndpoint = '/api/transcription/chunk',
    providerHint = 'auto',
    unsupportedBrowsers = ['Samsung Internet', 'Firefox'],
  } = options;

  const [permissionState, setPermissionState] = useState('prompt');
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [segments, setSegments] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [providerType, setProviderType] = useState('idle');
  const [runtimeInfo] = useState(() => buildRuntimeInfo());

  const engineRef = useRef(null);

  const log = useCallback((event, extra = {}) => {
    if (!debug) return;
    console.info('[NoPauseSpeech]', {
      ts: new Date().toISOString(),
      event,
      providerType,
      permissionState,
      browser: runtimeInfo.browser.name,
      isMobile: runtimeInfo.isMobile,
      isSecure: runtimeInfo.isSecure,
      ...extra,
    });
  }, [debug, providerType, permissionState, runtimeInfo]);

  const syncPermissionState = useCallback(async () => {
    if (!runtimeInfo.hasPermissionsApi) {
      return permissionState;
    }

    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      setPermissionState(result.state);
      log('permission_sync', { permission: result.state });
      return result.state;
    } catch (error) {
      log('permission_sync_failed', { error: String(error) });
      return permissionState;
    }
  }, [runtimeInfo.hasPermissionsApi, permissionState, log]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (!runtimeInfo.hasMediaDevices) {
      setPermissionState('denied');
      setErrorCode('media-devices-unavailable');
      setErrorMessage('This browser does not provide microphone access APIs.');
      log('permission_request_unsupported_media_devices');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      setErrorCode(null);
      setErrorMessage(null);
      log('permission_granted_via_getusermedia');
      return true;
    } catch (error) {
      const code = error?.name || 'permission-error';
      const denied = code === 'NotAllowedError' || code === 'PermissionDeniedError';
      setPermissionState(denied ? 'denied' : 'prompt');
      setErrorCode(code);
      setErrorMessage('Microphone permission is required for transcription.');
      log('permission_request_failed', { code, message: error?.message });
      return false;
    }
  }, [runtimeInfo.hasMediaDevices, log]);

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;

    engineRef.current = createHybridTranscriptionEngine({
      runtimeInfo,
      language: lang,
      maxBrowserErrors,
      maxBrowserRestarts: maxAutoRestarts,
      browserRestartDelayMs: restartDelayMs,
      unsupportedBrowsers,
      server: {
        endpoint: serverEndpoint,
        providerHint,
      },
      log: (event, data) => log(event, data),
      onTranscriptChange: (data) => {
        setTranscript(data.text || '');
        setFinalTranscript(data.finalText || '');
        setSegments(data.segments || []);
      },
      onStateChange: (data) => {
        setProviderType(data.providerType || 'idle');
        setIsListening(data.providerType === 'browser' || data.providerType === 'server');
      },
      onError: (error) => {
        const code = error?.code || 'unknown-transcription-error';
        setErrorCode(code);
        setErrorMessage(error?.message || `Transcription error: ${code}`);
      },
    });

    return engineRef.current;
  }, [
    runtimeInfo,
    lang,
    maxBrowserErrors,
    maxAutoRestarts,
    restartDelayMs,
    unsupportedBrowsers,
    serverEndpoint,
    providerHint,
    log,
  ]);

  const stopListening = useCallback(async () => {
    const engine = ensureEngine();
    await engine.stop();
    setIsListening(false);
    setProviderType('idle');
    log('speech_stopped');
  }, [ensureEngine, log]);

  const startListening = useCallback(async (startOptions = {}) => {
    const { stream = null, sessionId = null, allowServerFallback = true, preferBrowser = true } = startOptions;

    if (!runtimeInfo.isSecure) {
      setErrorCode('insecure-context');
      setErrorMessage('Microphone and transcription require HTTPS (or localhost).');
      log('start_blocked_insecure_context');
      return false;
    }

    if (permissionState !== 'granted') {
      const granted = await requestMicrophoneAccess();
      if (!granted) {
        log('start_blocked_permission_not_granted');
        return false;
      }
    }

    const engine = ensureEngine();
    const started = await engine.start({
      stream,
      sessionId,
      allowServerFallback,
      preferBrowser,
    });

    if (!started) {
      setErrorCode('transcription-start-failed');
      setErrorMessage('Failed to start transcription on this device.');
      setIsListening(false);
      return false;
    }

    setIsListening(true);
    setErrorCode(null);
    setErrorMessage(null);
    log('speech_started', { allowServerFallback, preferBrowser });
    return true;
  }, [runtimeInfo.isSecure, permissionState, requestMicrophoneAccess, ensureEngine, log]);

  const resetTranscript = useCallback(() => {
    const engine = ensureEngine();
    engine.resetTranscript();
    setTranscript('');
    setFinalTranscript('');
    setSegments([]);
  }, [ensureEngine]);

  useEffect(() => {
    syncPermissionState();
  }, [syncPermissionState]);

  useEffect(() => () => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
  }, []);

  const isSupported = useMemo(
    () => runtimeInfo.isSecure && (runtimeInfo.hasSpeechRecognition || runtimeInfo.hasMediaDevices),
    [runtimeInfo]
  );

  return {
    isSupported,
    runtimeInfo,
    permissionState,
    transcript,
    finalTranscript,
    transcriptSegments: segments,
    providerType,
    isListening,
    errorCode,
    errorMessage,
    requestMicrophoneAccess,
    syncPermissionState,
    startListening,
    stopListening,
    resetTranscript,
    log,
  };
}
