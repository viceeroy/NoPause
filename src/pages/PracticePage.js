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
  const speech = useMobileSpeechRecognition({
    debug: true,
    maxAutoRestarts: 5,
    restartDelayMs: 700,
    enableServerFallback: false,
  });

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
      const results = await analyzerRef.current.stop();
      const duration = Math.floor((Date.now() - sessionDataRef.current.startTime) / 1000);
      speech.stopListening().catch(() => {});

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
      console.log('Speech init');
      speech.resetTranscript();

      // Avoid concurrent mic capture lock: stop any pre-existing recognizer first.
      if (speech.isListening) {
        await speech.stopListening();
      }

      console.log('Analyzer ref current:', analyzerRef.current);
      if (!analyzerRef.current) {
        console.error('Analyzer not initialized!');
        setTranscriptError('Audio analyzer not initialized. Please try again.');
        setState('setup');
        return;
      }

      const started = await analyzerRef.current.start();
      console.log('Analyzer started:', started);
      if (!started) {
        setTranscriptError('Microphone failed to start. Check browser mic settings and retry.');
        setState('setup');
        return;
      }

      const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

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

      if (speech.isSupported && !speech.isListening) {
        speech.startListening({
          stream: analyzerRef.current?.stream || null,
          sessionId,
          allowServerFallback: false,
          preferBrowser: true,
        }).then((transcriptionStarted) => {
          if (!transcriptionStarted) {
            setTranscriptError(speech.errorMessage || 'Speech-to-text failed to start on this device.');
          }
        });
      }

      // Timer
      const duration = mode === 'lemon' ? 60 : (mode === 'topic' ? 120 : 0);
      setTimeLeft(duration);

      if (duration > 0) {
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              stopRecording();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setTranscriptError('Failed to start recording. Please try again.');
      setState('setup');
    }
  }, [mode, lemonWord, topicPrompt, speech, stopRecording]);

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
      console.log('Mic permission:', speech.permissionState);
      if (!granted) {
        if (speech.permissionState === 'denied') analytics.micDenied();
        setTranscriptError(speech.errorMessage || 'Microphone permission is required to start.');
        return;
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

      console.log('Audio analyzer created:', analyzer);
      analyzerRef.current = analyzer;
      console.log('Analyzer ref set:', analyzerRef.current);

      setState('countdown');
      // Countdown
      let count = 3;
      setCountdown(count);

      const countdownInterval = setInterval(() => {
        count--;
        setCountdown(count);

        if (count === 0) {
          clearInterval(countdownInterval);
          // Call startRecording directly since analyzerRef.current is now set
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
    <div data-testid="practice-page" className="min-h-screen pb-32 px-5 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
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
            <div className="mb-6 p-4 bg-red-950/45 border border-red-500/40 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm text-red-200">Microphone access denied</span>
              </div>
              <p className="text-red-200/90 text-sm font-sans">
                Please allow microphone access in your browser settings, then retry.
              </p>
            </div>
          )}

          {!speech.runtimeInfo.isSecure && (
            <div className="mb-6 p-4 bg-red-950/45 border border-red-500/40 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-red-200 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">HTTPS required on mobile</span>
              </div>
              <p className="text-red-200/90 text-sm font-sans">
                Use HTTPS (or localhost while developing) to access the microphone.
              </p>
            </div>
          )}

          {!speech.runtimeInfo.hasSpeechRecognition && (
            <div className="mb-6 p-4 bg-amber-900/35 border border-amber-500/40 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-amber-200 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">Transcript unavailable</span>
              </div>
              <p className="text-amber-200/90 text-sm font-sans">
                Speech-to-text is not supported on this browser. Audio recording and hesitation analysis will still work.
              </p>
            </div>
          )}

          {transcriptError && (
            <div className="mb-6 p-4 bg-orange-950/40 border border-orange-500/40 rounded-2xl w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-orange-200 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">Transcription warning</span>
              </div>
              <p className="text-orange-200/90 text-sm font-sans">
                {transcriptError}
              </p>
            </div>
          )}

          <div className={cn("mb-12 transition-all duration-500", state === 'countdown' && "opacity-30 scale-95 blur-[2px]")}>
            {mode === 'lemon' && (
              <div className="mb-8 p-10 bg-ember-200/10 border border-ember-500/35 rounded-[40px] shadow-card">
                <p className="text-xs text-ember-600 uppercase tracking-widest font-bold mb-4">You will speak about:</p>
                <div className="text-5xl md:text-7xl font-serif font-bold text-foreground mb-6">
                  {lemonWord}
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-ember-300/25 text-ember-600 rounded-full text-sm font-sans font-bold border border-ember-500/30">
                  <Timer size={16} />
                  60 Seconds Target
                </div>
              </div>
            )}

            {mode === 'topic' && topicPrompt && (
              <div className="mb-8 p-10 bg-cyan-500/10 border border-cyan-400/35 rounded-[40px] shadow-card">
                <p className="text-xs text-cyan-300 uppercase tracking-widest font-bold mb-4">You will speak about:</p>
                <div className="text-2xl md:text-3xl font-serif font-medium text-foreground leading-snug mb-6">
                  {topicPrompt.text}
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-cyan-400/35">{topicPrompt.category}</span>
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-cyan-400/35">{topicPrompt.difficulty}</span>
                  <span className="px-3 py-1 bg-cyan-500 text-slate-950 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                    <Timer size={12} />
                    120s
                  </span>
                </div>
              </div>
            )}

            {mode === 'free' && (
              <div className="mb-8 py-10">
                <div className="w-24 h-24 bg-surface-card border border-border/80 rounded-full flex items-center justify-center mx-auto mb-6 night-glow">
                  <Mic size={40} className="text-primary" />
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
                    className="w-full md:w-auto px-8 py-4 rounded-full bg-surface-card border border-border hover:bg-surface-elevated text-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-card"
                  >
                    <Sparkles size={18} className="text-primary" />
                    Randomize
                  </button>
                )}

                <button
                  data-testid="start-recording-btn"
                  onClick={handleStart}
                  disabled={speech.permissionState === 'denied' || !speech.runtimeInfo.isSecure}
                  className="w-full md:w-auto px-10 py-4 rounded-full bg-primary hover:brightness-110 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-soft night-glow"
                >
                  <Mic size={20} />
                  Start Speaking
                </button>
              </div>
            ) : (
              <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">
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
              <div className="p-10 bg-ember-200/10 border-2 border-ember-500/35 rounded-[40px] shadow-card relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-ember-500 text-slate-950 rounded-full text-sm font-bold font-sans shadow-sm">
                    <Timer size={16} className="animate-pulse" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <p className="text-[10px] text-ember-600 uppercase tracking-widest font-black mb-3">Topic focus:</p>
                <div className="text-4xl md:text-5xl font-serif font-bold text-foreground">
                  {lemonWord}
                </div>
              </div>
            )}

            {mode === 'topic' && topicPrompt && (
              <div className="p-10 bg-cyan-500/10 border-2 border-cyan-400/35 rounded-[40px] shadow-card relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500 text-slate-950 rounded-full text-sm font-bold font-sans shadow-sm">
                    <Timer size={16} className="animate-pulse" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-black mb-3">Responding to:</p>
                <div className="text-xl md:text-2xl font-serif font-medium text-foreground leading-snug">
                  {topicPrompt.text}
                </div>
              </div>
            )}

            {mode === 'free' && (
              <div className="p-10 bg-surface-card border-2 border-border/70 rounded-[40px] shadow-card relative overflow-hidden backdrop-blur-sm text-center">
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-bold font-sans shadow-sm">
                    <Timer size={16} className="animate-pulse" />
                    {formatTime(sessionDataRef.current?.startTime ? Math.floor((Date.now() - sessionDataRef.current.startTime) / 1000) : 0)}
                  </div>
                </div>
                <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-3">Free Speak</p>
                <p className="text-xl font-serif text-foreground italic">"Maintain your flow and speak freely..."</p>
              </div>
            )}
          </div>

          {/* Audio Visualization - Focused */}
          <div className="w-full mb-12">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={cn("w-2.5 h-2.5 rounded-full", speech.isListening ? "bg-primary animate-pulse shadow-[0_0_12px_rgba(230,140,106,0.65)]" : "bg-muted-foreground/40")}></div>
              <p className="text-[10px] font-black text-muted-foreground font-sans uppercase tracking-[0.2em]">
                {soundDetectedRef.current ? "Recording Active - Analyzing Speech" : "Idle - Waiting for sound"}
              </p>
            </div>

            <div className="h-44 flex items-center justify-center bg-surface-card border border-border/80 rounded-[50px] shadow-inner overflow-hidden">
              {audioData ? (
                <VoiceVisualizer
                  frequencyData={audioData.frequencyData}
                  volume={audioData.volume}
                  isSilent={audioData.isSilent}
                  isRecording={true}
                />
              ) : (
                <Mic size={40} className="text-muted-foreground/50 animate-pulse" />
              )}
            </div>
          </div>

          {/* Finish Button - Bottom Anchored Design */}
          <button
            data-testid="stop-recording-btn"
            onClick={handleStop}
            className="w-full md:w-auto px-16 py-5 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black text-lg btn-press shadow-soft night-glow flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Square size={20} fill="white" className="rounded-sm" />
            Finish & View Results
          </button>
        </div>
      )}

      {state === 'done' && lastResults && (
        <div className="text-center">
          <div className="mb-12">
            <div className="w-20 h-20 bg-surface-card border border-border/80 rounded-full flex items-center justify-center mx-auto mb-6 night-glow">
              <Zap size={32} className="text-primary" />
            </div>
            <h2 className="text-3xl font-serif font-medium text-foreground mb-3">Excellent Practice!</h2>
            <p className="text-muted-foreground font-sans">Here's how you did just now</p>
          </div>

          {/* 1. Stats Section */}
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left">Performance Stats</h3>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
              <div className="p-6 night-panel rounded-3xl">
                <p className="text-sm text-muted-foreground font-sans mb-2">Flow Score</p>
                <p className="text-4xl font-serif font-medium text-primary">{lastResults.flowScore}%</p>
              </div>
              <div className="p-6 night-panel rounded-3xl">
                <p className="text-sm text-muted-foreground font-sans mb-2">Speaking Time</p>
                <p className="text-4xl font-serif font-medium text-primary">{formatDuration(lastResults.totalSpeakingTime)}</p>
              </div>
              <div className="p-6 night-panel rounded-3xl">
                <p className="text-sm text-muted-foreground font-sans mb-2">Silence Time</p>
                <p className="text-4xl font-serif font-medium text-ember-600">{formatDuration(lastResults.silenceTime || 0)}</p>
              </div>
              <div className="p-6 night-panel rounded-3xl">
                <p className="text-sm text-muted-foreground font-sans mb-2">Total Session</p>
                <p className="text-4xl font-serif font-medium text-foreground">{formatDuration(lastResults.totalSessionTime)}</p>
              </div>
              <div className="p-6 night-panel rounded-3xl">
                <p className="text-sm text-muted-foreground font-sans mb-2">Hesitations</p>
                <p className="text-4xl font-serif font-medium text-ember-600">{lastResults.hesitationCount}</p>
              </div>
            </div>
          </div>

          {/* 2. Voice Recording Section */}
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <Volume2 size={20} className="text-primary" />
              Voice Recording
            </h3>
            <div className="p-8 night-panel rounded-3xl">
              {lastResults.audioBlob ? (
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(lastResults.audioBlob)} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="text-center py-8">
                  <Volume2 size={48} className="text-muted-foreground/60 mx-auto mb-4" />
                  <p className="text-muted-foreground font-sans">Audio recording will be available here</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Transcript Section */}
          <div className="mb-16">
            <h3 className="text-xl font-serif font-medium text-foreground mb-6 text-left flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Speech Transcript
            </h3>
            <div className="p-8 night-panel rounded-3xl">
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
              className="px-8 py-4 rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-semibold btn-press transition-colors night-glow"
            >
              Practice Again
            </button>
            <button
              onClick={() => navigate('/stats')}
              className="px-8 py-4 rounded-full bg-surface-card border border-border hover:bg-surface-elevated text-foreground font-sans font-semibold btn-press transition-colors"
            >
              View All Stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
