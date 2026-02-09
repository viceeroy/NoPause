import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Mic, MicOff, Square, Play, ChevronLeft, AlertTriangle, Timer, Zap, Volume2, FileText } from 'lucide-react';
import { AudioAnalyzer } from '@/lib/audioAnalyzer';
import { AudioVisualizer } from '@/components/ui/AudioVisualizer';
import { VoiceVisualizer } from '@/components/ui/VoiceVisualizer';
import { storage } from '@/lib/storage';
import { SPEAKING_PROMPTS, RANDOM_WORDS } from '@/lib/prompts';
import { cn } from '@/lib/utils';

const generateId = () => {
  return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

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
  const [micPermission, setMicPermission] = useState('unknown');
  const [lastResults, setLastResults] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcriptSupported, setTranscriptSupported] = useState(true);

  const analyzerRef = useRef(null);
  const timerRef = useRef(null);
  const sessionDataRef = useRef(null);
  const soundDetectedRef = useRef(false);

  // Initialize content based on mode
  useEffect(() => {
    if (mode === 'lemon' && word) {
      setLemonWord(word);
      setTimeLeft(60);
    } else if (mode === 'topic' && promptId) {
      const prompt = SPEAKING_PROMPTS.find(p => p.id === promptId);
      setTopicPrompt(prompt);
      setTimeLeft(120);
    } else if (mode === 'free') {
      setTimeLeft(0); // No time limit
    }
  }, [mode, word, promptId]);

  const stopRecording = useCallback(async () => {
    if (analyzerRef.current && analyzerRef.current.isRunning) {
      const results = await analyzerRef.current.stop();
      const duration = Math.floor((Date.now() - sessionDataRef.current.startTime) / 1000);
      setIsListening(false);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Calculate flow score
      // silenceTime is in ms, duration is in s. convert silence to s.
      const silenceSeconds = results.totalSilenceTime / 1000;
      const flowScore = Math.max(0, Math.min(100, Math.round(100 - (results.hesitationCount * 5) - (silenceSeconds * 10))));

      const sessionResult = {
        flowScore,
        totalSpeakingTime: results.totalSpeakingTime, // Use accurate speaking time from analyzer
        totalSessionTime: duration,
        silenceTime: Math.round(results.totalSilenceTime / 1000), // Convert ms to seconds
        hesitationCount: results.hesitationCount,
        mode: mode === 'free' ? 'free-speak' : mode,
        audioBlob: results.audioBlob,
        transcript: results.transcript
      };

      // Save based on mode
      if (mode === 'free') {
        storage.saveLemonScore(sessionResult);
      } else if (mode === 'lemon') {
        storage.saveLemonScore({
          ...sessionResult,
          word: lemonWord
        });
      } else if (mode === 'topic') {
        storage.saveTopicScore({
          ...sessionResult,
          correctnessScore: Math.max(0, Math.min(100, flowScore + Math.random() * 10 - 5)),
          topic: topicPrompt.text,
          difficulty: topicPrompt.difficulty
        });
      }

      setLastResults(sessionResult);
      setState('done');
    }
  }, [mode, lemonWord, topicPrompt]);

  const startRecording = useCallback(async () => {
    try {
      await analyzerRef.current.start();
      setState('recording');
      setIsListening(true);
      soundDetectedRef.current = false;

      sessionDataRef.current = {
        startTime: Date.now(),
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
  }, [mode, lemonWord, topicPrompt, stopRecording]);

  // Start recording
  const handleStart = useCallback(async () => {
    try {
      setState('countdown');
      setLastResults(null);

      // Initialize audio analyzer
      const analyzer = new AudioAnalyzer({
        silenceThreshold: 0.01, // Lower threshold for better sensitivity
        hesitationMinDuration: 300, // Slightly shorter hesitation detection
        onData: (data) => {
          setAudioData(data);
          if (data.rms > 0.01) { // Lower threshold for sound detection
            soundDetectedRef.current = true;
          }
        }
      });

      analyzerRef.current = analyzer;

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
  }, [startRecording]);

  // Auto-start countdown for free-speaking route
  useEffect(() => {
    if (isFreeSpeakingRoute && state === 'setup') {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        handleStart();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFreeSpeakingRoute, state, handleStart]);

  // Check mic permission and transcript support
  useEffect(() => {
    setTranscriptSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then(result => {
        setMicPermission(result.state);
        result.onchange = () => setMicPermission(result.state);
      }).catch(() => { });
    }
  }, []);

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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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

      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-3">{getModeTitle()}</h1>
      <p className="text-base text-muted-foreground font-sans mb-8">{getModeDescription()}</p>

      {state === 'setup' && (
        <div className="text-center">
          {micPermission === 'denied' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle size={16} />
                <span className="font-sans font-semibold text-sm">Microphone access denied</span>
              </div>
              <p className="text-red-600 text-sm font-sans">
                Please allow microphone access in your browser settings to use this feature.
              </p>
            </div>
          )}

          <div className="mb-8">
            <div className="text-6xl font-serif font-medium text-foreground mb-2">
              {formatTime(timeLeft)}
            </div>
            <p className="text-muted-foreground font-sans">
              {mode === 'free' ? 'No time limit' : 'Time remaining'}
            </p>
          </div>

          {mode === 'lemon' && (
            <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-3xl">
              <div className="text-2xl font-serif font-medium text-yellow-800 mb-2">
                {lemonWord}
              </div>
              <p className="text-yellow-600 font-sans text-sm">Your random word</p>
            </div>
          )}

          {mode === 'topic' && topicPrompt && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-3xl">
              <div className="text-lg font-serif text-blue-800 mb-2">
                {topicPrompt.text}
              </div>
              <div className="flex gap-2 text-blue-600 font-sans text-xs">
                <span className="px-2 py-1 bg-blue-100 rounded-full">{topicPrompt.category}</span>
                <span className="px-2 py-1 bg-blue-100 rounded-full">{topicPrompt.difficulty}</span>
              </div>
            </div>
          )}

          {!transcriptSupported && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-3xl text-left max-w-md mx-auto">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <FileText size={18} />
                <span className="font-serif font-medium">Transcript not supported</span>
              </div>
              <p className="text-blue-600 font-sans text-sm leading-relaxed">
                Your current browser doesn't support live transcription. For the best experience with transcripts, we recommend using <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
              </p>
            </div>
          )}

          <button
            data-testid="start-recording-btn"
            onClick={handleStart}
            disabled={micPermission === 'denied'}
            className="w-full md:w-auto px-8 py-4 rounded-full bg-sage-500 hover:bg-sage-600 disabled:bg-sand-300 text-white font-sans font-semibold btn-press transition-colors inline-flex items-center justify-center"
          >
            <Mic size={20} className="mr-2" />
            Start Recording
          </button>
        </div>
      )}

      {state === 'countdown' && (
        <div className="text-center">
          <div className="text-8xl font-serif font-medium text-foreground mb-4">
            {countdown}
          </div>
          <p className="text-muted-foreground font-sans">Get ready...</p>
        </div>
      )}

      {state === 'recording' && (
        <div className="text-center">
          <div className="mb-8">
            <div className="text-6xl font-serif font-medium text-foreground mb-2">
              {mode === 'free' ? formatTime(Math.floor((Date.now() - sessionDataRef.current?.startTime) / 1000)) : formatTime(timeLeft)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isListening ? "bg-red-500 animate-pulse" : "bg-gray-300")}></div>
              <p className="text-muted-foreground font-sans">
                {soundDetectedRef.current ? "Listening..." : "Waiting for sound..."}
              </p>
            </div>
          </div>

          {audioData && (
            <div className="mb-8 relative h-48 flex items-center justify-center">
              <VoiceVisualizer
                frequencyData={audioData.frequencyData}
                volume={audioData.volume}
                isSilent={audioData.isSilent}
                isRecording={true}
              />
              {!soundDetectedRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-3xl">
                  <p className="text-sage-600 font-sans font-medium flex items-center gap-2">
                    <Mic size={16} />
                    Try speaking now
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            data-testid="stop-recording-btn"
            onClick={handleStop}
            className="w-full md:w-auto px-8 py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-sans font-semibold btn-press transition-colors inline-flex items-center justify-center"
          >
            <Square size={20} className="mr-2" />
            Stop Practice
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
