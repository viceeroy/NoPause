import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Mic, MicOff, Square, Play, ChevronLeft, AlertTriangle, Timer, Zap, Volume2, FileText, Sparkles } from 'lucide-react';
import { AudioAnalyzer } from '@/audio/speechAnalyzer';
import { AudioVisualizer } from '@/ui/AudioVisualizer';
import { VoiceVisualizer } from '@/ui/VoiceVisualizer';
import { storage } from '@/storage/localStore';
import { SPEAKING_PROMPTS, RANDOM_WORDS } from '@/data/speakingPrompts';
import { cn } from '@/utils/cn';
import { analytics } from '@/analytics';
import { useMobileSpeechRecognition } from '@/hooks/useMobileSpeechRecognition';


export default function Practice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Check if this is the free-speaking route
  const isFreeSpeakingRoute = location.pathname === '/practice/free-speaking';

  // Get mode and parameters
  const mode = isFreeSpeakingRoute ? 'free' : (searchParams.get('mode') || 'free');
  const word = searchParams.get('word');
  const promptId = searchParams.get('prompt');

  // Content based on mode
  const [lemonWord, setLemonWord] = useState('');
  const [topicPrompt, setTopicPrompt] = useState(null);

  // Recording state
  const [state, setState] = useState('setup'); // setup | countdown | recording | done
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [audioData, setAudioData] = useState(null);
  const [lastResults, setLastResults] = useState(null);
  const [transcriptError, setTranscriptError] = useState(null);

  const analyzerRef = useRef(null);
  const timerRef = useRef(null);
  const sessionDataRef = useRef(null);
  const soundDetectedRef = useRef(false);
  const speech = useMobileSpeechRecognition({ debug: true, maxAutoRestarts: 5, restartDelayMs: 700 });

  // Initialize content based on mode
  useEffect(() => {
    if (mode === 'lemon') {
      const initialWord = word || RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
      setLemonWord(initialWord);
      setTimeLeft(60);
    } else if (mode === 'topic') {
      const initialPrompt = promptId ? SPEAKING_PROMPTS.find(p => p.id === promptId) : SPEAKING_PROMPTS[Math.floor(Math.random() * SPEAKING_PROMPTS.length)];
      setTopicPrompt(initialPrompt);
      setTimeLeft(120);
    } else if (mode === 'free') {
      setTimeLeft(0); // No time limit
    }
  }, [mode, word, promptId]);

  // Track setup view
  useEffect(() => {
    analytics.sessionSetupViewed(mode);
  }, [mode]);

  const stopRecording = useCallback(async () => {
    if (analyzerRef.current && analyzerRef.current.isRunning) {
      speech.stopListening();
      const results = await analyzerRef.current.stop();
      const duration = Math.floor((Date.now() - sessionDataRef.current.startTime) / 1000);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Calculate flow score — uses only hesitation-level silence (not all silence)
      const flowScore = AudioAnalyzer.calculateFlowScore(results.hesitationSilenceTime, results.hesitationCount);

      const sessionResult = {
        flowScore,
        totalSpeakingTime: results.totalSpeakingTime, // seconds (delta-time accumulated)
        totalSessionTime: duration,
        silenceTime: results.totalSilenceTime, // seconds (delta-time accumulated)
        hesitationCount: results.hesitationCount,
        mode: mode === 'free' ? 'free-speak' : mode,
        audioBlob: results.audioBlob,
        transcript: speech.finalTranscript.trim() || speech.transcript.trim() || results.transcript
      };

      // Save based on mode
      if (mode === 'free') {
        storage.saveSession({
          ...sessionResult,
          duration: duration,
          hesitationCount: results.hesitationCount,
          hesitation_count: results.hesitationCount,
          silenceTime: results.totalSilenceTime,
          silence_time: results.totalSilenceTime,
        });
      } else if (mode === 'lemon') {
        storage.saveLemonScore({
          ...sessionResult,
          word: lemonWord,
          hesitation_count: results.hesitationCount,
          silence_time: results.totalSilenceTime,
          duration: duration
        });
      } else if (mode === 'topic') {
        storage.saveTopicScore({
          ...sessionResult,
          topic: topicPrompt.text,
          difficulty: topicPrompt.difficulty,
          hesitation_count: results.hesitationCount,
          silence_time: results.totalSilenceTime,
          duration: duration
        });
      }

      setLastResults(sessionResult);
      setState('done');

      // Process structured session metrics (Layer 2)
      const sessionId = sessionDataRef.current.sessionId;
      analytics.processSessionEnd(results, {
        sessionId,
        mode: mode === 'free' ? 'free-speak' : mode,
      });
      analytics.recordingStopped(mode, sessionId);
      analytics.flowScoreCalculated(flowScore, mode);
    }
  }, [mode, lemonWord, topicPrompt, speech]);

  const startRecording = useCallback(async () => {
    try {
      speech.resetTranscript();
      const started = await analyzerRef.current.start();
      if (!started) {
        setTranscriptError('Microphone failed to start. Check browser mic settings and retry.');
        setState('setup');
        return;
      }

      const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

      if (speech.isSupported && !speech.isListening) {
        const transcriptionStarted = await speech.startListening({
          stream: analyzerRef.current?.stream || null,
          sessionId,
          allowServerFallback: true,
          preferBrowser: true,
        });
        if (!transcriptionStarted) {
          setTranscriptError(speech.errorMessage || 'Speech-to-text failed to start on this device.');
        }
      }

      setState('recording');
      soundDetectedRef.current = false;

      analytics.recordingStarted(mode, sessionId);

      sessionDataRef.current = {
        startTime: Date.now(),
        sessionId,
        mode,
        word: mode === 'lemon' ? lemonWord : null,
        prompt: mode === 'topic' ? topicPrompt : null
      };

      // Start timer if not free mode
      if (mode !== 'free') {
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              stopRecording();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setState('setup');
    }
  }, [mode, lemonWord, topicPrompt, stopRecording, speech]);

  // Start recording process with countdown
  const handleStart = useCallback(async () => {
    try {
      setLastResults(null);
      setTranscriptError(null);
      speech.log('session_start_tapped', {
        userAgent: speech.runtimeInfo.ua,
        browser: speech.runtimeInfo.browser.name,
        mobile: speech.runtimeInfo.isMobile,
        secure: speech.runtimeInfo.isSecure,
      });

      if (!speech.runtimeInfo.isSecure) {
        setTranscriptError('Microphone access requires HTTPS on mobile (or localhost for local development).');
        return;
      }

      if (!speech.runtimeInfo.hasMediaDevices) {
        setTranscriptError('This browser does not expose microphone APIs. Try Chrome or Safari.');
        return;
      }

      await speech.syncPermissionState();
      const granted = await speech.requestMicrophoneAccess();
      if (!granted) {
        if (speech.permissionState === 'denied') analytics.micDenied();
        setTranscriptError(speech.errorMessage || 'Microphone permission is required to start.');
        return;
      }

      // iOS Safari often requires SpeechRecognition.start() from a user gesture.
      if (speech.isSupported) {
        await speech.startListening({
          allowServerFallback: false,
          preferBrowser: true,
        });
      }

      // Initialize audio analyzer (thresholds loaded from adaptive profile)
      const analyzer = new AudioAnalyzer({
        enableTranscription: false,
        onData: (data) => {
          setAudioData(data);
          if (data.rms > 0.01) {
            soundDetectedRef.current = true;
          }
        },
        onHesitation: (duration, count) => {
          const sessionId = sessionDataRef.current?.sessionId;
          const timeSinceStart = sessionDataRef.current?.startTime
            ? Date.now() - sessionDataRef.current.startTime
            : 0;
          analytics.hesitationDetected(duration, count, timeSinceStart, sessionId);
        },
        onCalibrated: (ambientNoise, thresholdSet) => {
          analytics.calibrationCompleted(ambientNoise, thresholdSet);
        },
        onStartError: (error) => {
          setTranscriptError(`Microphone error: ${error?.name || 'unknown'}`);
        },
        onDebugLog: (event, details) => {
          speech.log(`analyzer_${event}`, details);
        },
      });

      analyzerRef.current = analyzer;

      setState('countdown');
      // Countdown
      let count = 3;
      setCountdown(count);

      const countdownInterval = setInterval(() => {
        count--;
        setCountdown(count);

        if (count === 0) {
          clearInterval(countdownInterval);
          startRecording();
        }
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      setState('setup');
    }
  }, [startRecording, speech]);

  const handleRandomPrompt = () => {
    if (mode === 'lemon') {
      setLemonWord(RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)]);
    } else if (mode === 'topic') {
      setTopicPrompt(SPEAKING_PROMPTS[Math.floor(Math.random() * SPEAKING_PROMPTS.length)]);
    }
  };

  const handleStop = () => {
    stopRecording();
  };

  const handleRetry = () => {
    setState('setup');
    setAudioData(null);
    setLastResults(null);
    if (mode === 'lemon') setTimeLeft(60);
    else if (mode === 'topic') setTimeLeft(120);
    else setTimeLeft(0);
  };

  const handleBack = () => {
    if (analyzerRef.current && analyzerRef.current.isRunning) {
      analyzerRef.current.stop();
    }
    speech.stopListening();
    navigate('/');
  };

  const formatTime = (seconds) => {
    if (mode === 'free' && state !== 'recording') return '∞';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'free': return 'Free Speaking';
      case 'lemon': return 'Lemon Technique';
      case 'topic': return 'Topic Score';
      default: return 'Practice';
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'free': return 'Talk about anything, no time limit';
      case 'lemon': return `Speak about "${lemonWord}" for 1 minute`;
      case 'topic': return `Respond to the topic for 2 minutes`;
      default: return 'Speaking practice';
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analyzerRef.current && analyzerRef.current.isRunning) {
        try {
          analyzerRef.current.stop();
        } catch (error) {
          console.error('Error stopping analyzer on cleanup:', error);
        }
      }
      speech.stopListening();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [speech]);

  // ---- RENDER STATES ----

  // ---- SETUP STATE ----
  return (
    <div data-testid="practice-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
      <button
        data-testid="back-to-home"
        onClick={handleBack}
        className="flex items-center gap-1 text-muted-foreground font-sans text-sm mb-8 hover:text-foreground btn-press" style={{ transition: 'color 0.2s ease' }}
      >
        <ChevronLeft size={16} />
        Back
      </button>

      {state !== 'recording' && (
        <>
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-3">{getModeTitle()}</h1>
          <p className="text-base text-muted-foreground font-sans mb-12">{getModeDescription()}</p>
        </>
      )}

      {(state === 'setup' || state === 'countdown') && (
        <div className="text-center py-10">
          {speech.permissionState === 'denied' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">Microphone access denied</span>
              </div>
              <p className="text-red-600 text-sm font-sans">
                Please allow microphone access in your browser settings, then retry.
              </p>
            </div>
          )}

          {!speech.runtimeInfo.isSecure && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">HTTPS required on mobile</span>
              </div>
              <p className="text-red-700 text-sm font-sans">
                Use HTTPS (or localhost while developing) to access the microphone.
              </p>
            </div>
          )}

          {!speech.runtimeInfo.hasSpeechRecognition && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-yellow-700 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">Transcript unavailable</span>
              </div>
              <p className="text-yellow-700 text-sm font-sans">
                Speech-to-text is not supported on this browser. Audio recording and hesitation analysis will still work.
              </p>
            </div>
          )}

          {transcriptError && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-orange-700 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">Transcription warning</span>
              </div>
              <p className="text-orange-700 text-sm font-sans">
                {transcriptError}
              </p>
            </div>
          )}

          <div className={cn("mb-12 transition-all duration-500", state === 'countdown' && "opacity-30 scale-95 blur-[2px]")}>
            {mode === 'lemon' && (
              <div className="mb-8 p-10 bg-yellow-50 border border-yellow-200 rounded-[40px] shadow-sm">
                <p className="text-xs text-yellow-600 uppercase tracking-widest font-bold mb-4">You will speak about:</p>
                <div className="text-5xl md:text-7xl font-serif font-bold text-yellow-900 mb-6">
                  {lemonWord}
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-sans font-bold">
                  <Timer size={16} />
                  60 Seconds Target
                </div>
              </div>
            )}

            {mode === 'topic' && topicPrompt && (
              <div className="mb-8 p-10 bg-blue-50 border border-blue-200 rounded-[40px] shadow-sm">
                <p className="text-xs text-blue-600 uppercase tracking-widest font-bold mb-4">You will speak about:</p>
                <div className="text-2xl md:text-3xl font-serif font-medium text-blue-900 leading-snug mb-6">
                  {topicPrompt.text}
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider">{topicPrompt.category}</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider">{topicPrompt.difficulty}</span>
                  <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                    <Timer size={12} />
                    120s
                  </span>
                </div>
              </div>
            )}

            {mode === 'free' && (
              <div className="mb-8 py-10">
                <div className="w-24 h-24 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mic size={40} className="text-sage-500" />
                </div>
                <p className="text-xl font-serif text-foreground max-w-md mx-auto leading-relaxed">
                  Speak freely without time limits. Focus on continuous speech and minimizing pauses.
                </p>
              </div>
            )}
          </div>

          <div className="relative min-h-[100px] flex items-center justify-center">
            {state === 'setup' ? (
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {(mode === 'lemon' || mode === 'topic') && (
                  <button
                    onClick={handleRandomPrompt}
                    className="w-full md:w-auto px-8 py-4 rounded-full bg-white border border-sand-300 hover:bg-sand-50 text-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Sparkles size={18} className="text-sage-500" />
                    Randomize
                  </button>
                )}

                <button
                  data-testid="start-recording-btn"
                  onClick={handleStart}
                  disabled={speech.permissionState === 'denied' || !speech.runtimeInfo.isSecure}
                  className="w-full md:w-auto px-10 py-4 rounded-full bg-sage-600 hover:bg-sage-700 disabled:bg-sand-300 text-white font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-md shadow-sage-200"
                >
                  <Mic size={20} />
                  Start Speaking
                </button>
              </div>
            ) : (
              <div className="text-9xl font-serif font-bold text-sage-600 animate-in zoom-in duration-300">
                {countdown}
              </div>
            )}
          </div>
        </div>
      )}


      {state === 'recording' && (
        <div className="flex flex-col items-center max-w-2xl mx-auto animate-in fade-in duration-700">
          {/* Active Prompt Card */}
          <div className="w-full mb-10">
            {mode === 'lemon' && (
              <div className="p-10 bg-yellow-50/50 border-2 border-yellow-200 rounded-[40px] shadow-lg shadow-yellow-100/30 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-400 text-yellow-900 rounded-full text-sm font-bold font-sans shadow-sm">
                    <Timer size={16} className="animate-pulse" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <p className="text-[10px] text-yellow-600 uppercase tracking-widest font-black mb-3">Topic focus:</p>
                <div className="text-4xl md:text-5xl font-serif font-bold text-yellow-900">
                  {lemonWord}
                </div>
              </div>
            )}

            {mode === 'topic' && topicPrompt && (
              <div className="p-10 bg-blue-50/50 border-2 border-blue-200 rounded-[40px] shadow-lg shadow-blue-100/30 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-bold font-sans shadow-sm">
                    <Timer size={16} className="animate-pulse" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <p className="text-[10px] text-blue-600 uppercase tracking-widest font-black mb-3">Responding to:</p>
                <div className="text-xl md:text-2xl font-serif font-medium text-blue-900 leading-snug">
                  {topicPrompt.text}
                </div>
              </div>
            )}

            {mode === 'free' && (
              <div className="p-10 bg-sage-50/50 border-2 border-sage-200 rounded-[40px] shadow-lg shadow-sage-100/30 relative overflow-hidden backdrop-blur-sm text-center">
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-sage-600 text-white rounded-full text-sm font-bold font-sans shadow-sm">
                    <Timer size={16} className="animate-pulse" />
                    {formatTime(sessionDataRef.current?.startTime ? Math.floor((Date.now() - sessionDataRef.current.startTime) / 1000) : 0)}
                  </div>
                </div>
                <p className="text-[10px] text-sage-600 uppercase tracking-widest font-black mb-3">Free Speak</p>
                <p className="text-xl font-serif text-sage-900 italic">"Maintain your flow and speak freely..."</p>
              </div>
            )}
          </div>

          {/* Audio Visualization - Focused */}
          <div className="w-full mb-12">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={cn("w-2 h-2 rounded-full", speech.isListening ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-gray-300")}></div>
              <p className="text-[10px] font-black text-muted-foreground font-sans uppercase tracking-[0.2em]">
                {soundDetectedRef.current ? "Analyzing Speech" : "Waiting for sound"}
              </p>
            </div>

            <div className="h-44 flex items-center justify-center bg-white border border-sand-200 rounded-[50px] shadow-inner-lg overflow-hidden">
              {audioData ? (
                <VoiceVisualizer
                  frequencyData={audioData.frequencyData}
                  volume={audioData.volume}
                  isSilent={audioData.isSilent}
                  isRecording={true}
                />
              ) : (
                <Mic size={40} className="text-sand-200 animate-pulse" />
              )}
            </div>
          </div>

          {/* Finish Button - Bottom Anchored Design */}
          <button
            data-testid="stop-recording-btn"
            onClick={handleStop}
            className="w-full md:w-auto px-16 py-5 rounded-full bg-red-500 hover:bg-red-600 text-white font-sans font-black text-lg btn-press shadow-2xl shadow-red-200 flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Square size={20} fill="white" className="rounded-sm" />
            Finish & View Results
          </button>
        </div>
      )}

      {state === 'done' && lastResults && (
        <div className="text-center">
          <div className="mb-12">
            <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap size={32} className="text-sage-600" />
            </div>
            <h2 className="text-3xl font-serif font-medium text-foreground mb-3">Excellent Practice!</h2>
            <p className="text-muted-foreground font-sans">Here's how you did just now</p>
          </div>

          {/* 1. Stats Section */}
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left">Performance Stats</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
              <div className="p-6 bg-white border border-sand-300/50 rounded-3xl shadow-card">
                <p className="text-sm text-muted-foreground font-sans mb-2">Flow Score</p>
                <p className="text-4xl font-serif font-medium text-sage-600">{lastResults.flowScore}%</p>
              </div>
              <div className="p-6 bg-white border border-sand-300/50 rounded-3xl shadow-card">
                <p className="text-sm text-muted-foreground font-sans mb-2">Speaking Time</p>
                <p className="text-4xl font-serif font-medium text-sage-600">{formatDuration(lastResults.totalSpeakingTime)}</p>
              </div>
              <div className="p-6 bg-white border border-sand-300/50 rounded-3xl shadow-card">
                <p className="text-sm text-muted-foreground font-sans mb-2">Silence Time</p>
                <p className="text-4xl font-serif font-medium text-terracotta-500">{formatDuration(lastResults.silenceTime || 0)}</p>
              </div>
              <div className="p-6 bg-white border border-sand-300/50 rounded-3xl shadow-card">
                <p className="text-sm text-muted-foreground font-sans mb-2">Total Session</p>
                <p className="text-4xl font-serif font-medium text-foreground">{formatDuration(lastResults.totalSessionTime)}</p>
              </div>
              <div className="p-6 bg-white border border-sand-300/50 rounded-3xl shadow-card">
                <p className="text-sm text-muted-foreground font-sans mb-2">Hesitations</p>
                <p className="text-4xl font-serif font-medium text-terracotta-500">{lastResults.hesitationCount}</p>
              </div>
            </div>
          </div>

          {/* 2. Voice Recording Section */}
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <Volume2 size={20} className="text-sage-600" />
              Voice Recording
            </h3>
            <div className="p-8 bg-white border border-sand-300/50 rounded-3xl shadow-card">
              {lastResults.audioBlob ? (
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(lastResults.audioBlob)} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="text-center py-8">
                  <Volume2 size={48} className="text-sage-300 mx-auto mb-4" />
                  <p className="text-muted-foreground font-sans">Audio recording will be available here</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Transcript Section */}
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <FileText size={20} className="text-sage-600" />
              Speech Transcript
            </h3>
            <div className="p-8 bg-white border border-sand-300/50 rounded-3xl shadow-card">
              <div className="text-left">
                <p className="text-foreground font-sans leading-relaxed">
                  {lastResults.transcript}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={handleRetry}
              className="px-8 py-4 rounded-full bg-sage-500 hover:bg-sage-600 text-white font-sans font-semibold btn-press transition-colors"
            >
              Practice Again
            </button>
            <button
              onClick={() => navigate('/stats')}
              className="px-8 py-4 rounded-full bg-white border border-sand-300 hover:bg-sand-100 text-foreground font-sans font-semibold btn-press transition-colors"
            >
              View All Stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
