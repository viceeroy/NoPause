import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, Square, Play, ChevronLeft, AlertTriangle } from 'lucide-react';
import { AudioAnalyzer } from '@/lib/audioAnalyzer';
import { AudioVisualizer } from '@/components/ui/AudioVisualizer';
import { storage } from '@/lib/storage';
import { TIMER_PRESETS, SPEAKING_PROMPTS } from '@/lib/prompts';
import { cn } from '@/lib/utils';

const generateId = () => {
  return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

export default function Practice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promptId = searchParams.get('prompt');
  const prompt = promptId ? SPEAKING_PROMPTS.find(p => p.id === promptId) : null;

  const [state, setState] = useState('setup'); // setup | countdown | recording | done
  const [selectedTimer, setSelectedTimer] = useState(storage.getPreferences().defaultTimer || 60);
  const [customTimer, setCustomTimer] = useState('');
  const [timeLeft, setTimeLeft] = useState(selectedTimer);
  const [countdown, setCountdown] = useState(3);

  // Audio state
  const [audioData, setAudioData] = useState(null);
  const [micPermission, setMicPermission] = useState('unknown'); // unknown | granted | denied

  const analyzerRef = useRef(null);
  const timerRef = useRef(null);
  const sessionDataRef = useRef(null);

  // Check mic permission
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then(result => {
        setMicPermission(result.state);
      }).catch(() => {});
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleStart = useCallback(async () => {
    setState('countdown');
    setTimeLeft(selectedTimer);

    // Countdown 3, 2, 1
    let count = 3;
    setCountdown(count);
    const countdownInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        startRecording();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [selectedTimer]);

  const startRecording = async () => {
    const analyzer = new AudioAnalyzer({
      silenceThreshold: storage.getPreferences().silenceThreshold || 0.015,
      hesitationMinDuration: storage.getPreferences().hesitationMinDuration || 400,
      onData: (data) => setAudioData(data),
    });

    const success = await analyzer.start();
    if (!success) {
      setMicPermission('denied');
      setState('setup');
      return;
    }

    setMicPermission('granted');
    analyzerRef.current = analyzer;
    setState('recording');

    // Start countdown timer
    let remaining = selectedTimer;
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        stopRecording();
      }
    }, 1000);
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (analyzerRef.current) {
      const result = analyzerRef.current.stop();
      const duration = selectedTimer - timeLeft;
      const actualDuration = Math.max(duration, 1);
      const silenceTimeSec = result.totalSilenceTime / 1000;
      const speakingTimeSec = Math.max(0, actualDuration - silenceTimeSec);
      const hesitationScore = AudioAnalyzer.calculateHesitationScore(
        result.totalSilenceTime,
        actualDuration * 1000
      );

      const session = {
        id: generateId(),
        duration: actualDuration,
        silence_time: Math.round(silenceTimeSec * 10) / 10,
        speaking_time: Math.round(speakingTimeSec * 10) / 10,
        hesitation_count: result.hesitationCount,
        hesitation_score: hesitationScore,
        prompt: prompt ? prompt.text : null,
        avg_volume: result.avgVolume,
        timer_setting: selectedTimer,
        created_at: new Date().toISOString(),
      };

      // ✅ OFFLINE ONLY - Save to localStorage (NO backend sync!)
      storage.saveSession(session);
      sessionDataRef.current = session;

      analyzerRef.current = null;
      setState('done');
    }
  }, [selectedTimer, timeLeft, prompt]);

  // Stop on timeLeft reaching 0
  useEffect(() => {
    if (state === 'recording' && timeLeft <= 0) {
      stopRecording();
    }
  }, [timeLeft, state, stopRecording]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = state === 'recording'
    ? ((selectedTimer - timeLeft) / selectedTimer) * 100
    : 0;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (analyzerRef.current) analyzerRef.current.stop();
    };
  }, []);

  // ---- COUNTDOWN STATE ----
  if (state === 'countdown') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-9xl font-serif font-bold text-sage-500 mb-4 animate-pulse">
            {countdown}
          </div>
          <p className="text-lg text-muted-foreground font-sans">Get ready to speak...</p>
        </div>
      </div>
    );
  }

  // ---- DONE STATE ----
  if (state === 'done' && sessionDataRef.current) {
    const s = sessionDataRef.current;
    const scoreLabel = AudioAnalyzer.getScoreLabel(s.hesitation_score);
    const scoreColor = AudioAnalyzer.getScoreColor(s.hesitation_score);

    return (
      <div data-testid="session-results" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-12 max-w-3xl mx-auto">
        <div className="animate-float-up">
          <p className="text-sm font-sans font-semibold text-sage-500 tracking-wide uppercase mb-2">Session Complete</p>
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-8">{scoreLabel}</h1>

          {/* Score Circle */}
          <div className="flex justify-center mb-10">
            <div className="relative w-44 h-44">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#E8E6DF" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke={scoreColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${s.hesitation_score * 2.83} 283`}
                  className="animate-progress"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-serif font-medium" style={{ color: scoreColor }}>{s.hesitation_score}</span>
                <span className="text-xs text-muted-foreground font-sans">Fluency Score</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-center">
              <p className="text-sm text-muted-foreground font-sans mb-1">Speaking Time</p>
              <p className="text-3xl font-serif font-medium text-sage-600">{s.speaking_time}s</p>
            </div>
            <div className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-center">
              <p className="text-sm text-muted-foreground font-sans mb-1">Silence Time</p>
              <p className="text-3xl font-serif font-medium text-terracotta-400">{s.silence_time}s</p>
            </div>
            <div className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-center">
              <p className="text-sm text-muted-foreground font-sans mb-1">Hesitations</p>
              <p className="text-3xl font-serif font-medium text-foreground">{s.hesitation_count}</p>
            </div>
            <div className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-center">
              <p className="text-sm text-muted-foreground font-sans mb-1">Duration</p>
              <p className="text-3xl font-serif font-medium text-foreground">{formatTime(s.duration)}</p>
            </div>
          </div>

          {/* Prompt */}
          {s.prompt && (
            <div className="mb-8 p-5 rounded-2xl bg-sand-100 border border-sand-300/50">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wide mb-2">Topic</p>
              <p className="text-sm text-foreground font-sans">{s.prompt}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              data-testid="practice-again-btn"
              onClick={() => {
                sessionDataRef.current = null;
                setState('setup');
              }}
              className="flex-1 py-4 rounded-full bg-sage-500 text-white font-sans font-semibold text-base btn-press hover:bg-sage-600" style={{ transition: 'background-color 0.2s ease' }}
            >
              Practice Again
            </button>
            <button
              data-testid="view-history-btn"
              onClick={() => navigate('/history')}
              className="flex-1 py-4 rounded-full bg-sand-200 text-foreground font-sans font-semibold text-base btn-press hover:bg-sand-300" style={{ transition: 'background-color 0.2s ease' }}
            >
              View History
            </button>
          </div>

          <button
            data-testid="back-to-home-btn"
            onClick={() => navigate('/')}
            className="w-full mt-3 py-3 text-muted-foreground font-sans text-sm hover:text-foreground btn-press" style={{ transition: 'color 0.2s ease' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---- RECORDING STATE ----
  if (state === 'recording') {
    return (
      <div data-testid="recording-screen" className="min-h-screen flex flex-col px-6 md:px-12 pt-8 pb-28 max-w-3xl mx-auto">
        {/* Back button */}
        <button
          data-testid="stop-and-back-btn"
          onClick={stopRecording}
          className="flex items-center gap-1 text-muted-foreground font-sans text-sm mb-8 hover:text-foreground w-fit btn-press" style={{ transition: 'color 0.2s ease' }}
        >
          <Square size={14} />
          Stop & Finish
        </button>

        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Timer */}
          <div className="relative w-48 h-48 mb-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E8E6DF" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={audioData?.isSilent ? '#D97C5F' : '#5A7D7C'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset={283 - (progressPercent / 100) * 283}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-serif font-medium text-foreground">{formatTime(timeLeft)}</span>
              <span className="text-xs text-muted-foreground font-sans mt-1">remaining</span>
            </div>
          </div>

          {/* Silence Indicator */}
          {audioData?.isSilent && audioData.currentSilenceDuration > 300 && (
            <div data-testid="silence-indicator" className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-terracotta-50 border border-terracotta-200 animate-silence-flash">
              <AlertTriangle size={14} className="text-terracotta-400" />
              <span className="text-sm font-sans text-terracotta-500 font-medium">Silence detected</span>
            </div>
          )}

          {/* Waveform */}
          <div className="w-full max-w-md mb-8">
            <AudioVisualizer
              waveformData={audioData?.waveformData}
              isRecording={true}
              isSilent={audioData?.isSilent || false}
              volume={audioData?.volume || 0}
            />
          </div>

          {/* Live Stats */}
          <div className="flex gap-8 text-center">
            <div>
              <p data-testid="live-hesitations" className="text-2xl font-serif font-medium text-foreground">{audioData?.hesitationCount || 0}</p>
              <p className="text-xs text-muted-foreground font-sans">Hesitations</p>
            </div>
            <div>
              <p data-testid="live-silence" className="text-2xl font-serif font-medium text-foreground">{((audioData?.totalSilenceTime || 0) / 1000).toFixed(1)}s</p>
              <p className="text-xs text-muted-foreground font-sans">Silence</p>
            </div>
          </div>

          {/* Prompt */}
          {prompt && (
            <div className="mt-8 px-6 py-4 rounded-2xl bg-sand-100 border border-sand-300/50 max-w-md">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wide mb-1">Topic</p>
              <p className="text-sm text-foreground font-sans">{prompt.text}</p>
            </div>
          )}
        </div>

        {/* Stop Button */}
        <div className="flex justify-center mt-8">
          <button
            data-testid="stop-recording-btn"
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-terracotta-400 text-white flex items-center justify-center btn-press hover:bg-terracotta-500 shadow-lg" style={{ transition: 'background-color 0.2s ease' }}
          >
            <Square size={24} fill="white" />
          </button>
        </div>
      </div>
    );
  }

  // ---- SETUP STATE ----
  return (
    <div data-testid="practice-setup" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-3xl mx-auto">
      <button
        data-testid="back-to-home"
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-muted-foreground font-sans text-sm mb-8 hover:text-foreground btn-press" style={{ transition: 'color 0.2s ease' }}
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-3">New Session</h1>
      <p className="text-base text-muted-foreground font-sans mb-10">Choose your timer and start speaking.</p>

      {/* Mic Permission Warning */}
      {micPermission === 'denied' && (
        <div data-testid="mic-denied-warning" className="mb-6 p-4 rounded-2xl bg-terracotta-50 border border-terracotta-200 flex items-center gap-3">
          <MicOff size={20} className="text-terracotta-400" />
          <div>
            <p className="text-sm font-sans font-semibold text-terracotta-500">Microphone access denied</p>
            <p className="text-xs text-muted-foreground font-sans">Please allow microphone access in your browser settings.</p>
          </div>
        </div>
      )}

      {/* Timer Selection */}
      <div className="mb-8">
        <p className="text-sm font-sans font-semibold text-muted-foreground tracking-wide uppercase mb-3">Timer</p>
        <div className="flex flex-wrap gap-3">
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.value}
              data-testid={`timer-${preset.value}`}
              onClick={() => { setSelectedTimer(preset.value); setCustomTimer(''); }}
              className={cn(
                'px-6 py-3 rounded-full font-sans font-semibold text-sm btn-press',
                'transition-colors duration-200',
                selectedTimer === preset.value && !customTimer
                  ? 'bg-sage-500 text-white'
                  : 'bg-sand-200 text-foreground hover:bg-sand-300'
              )}
            >
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <input
              data-testid="custom-timer-input"
              type="number"
              placeholder="Custom (sec)"
              value={customTimer}
              onChange={(e) => {
                const val = e.target.value;
                setCustomTimer(val);
                if (val && parseInt(val) > 0) {
                  setSelectedTimer(parseInt(val));
                }
              }}
              className="w-36 px-4 py-3 rounded-full bg-sand-100 border border-sand-300 text-sm font-sans text-foreground focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500" style={{ transition: 'border-color 0.2s ease' }}
              min="5"
              max="600"
            />
          </div>
        </div>
      </div>

      {/* Selected Prompt */}
      {prompt && (
        <div className="mb-8 p-5 rounded-2xl bg-sand-100 border border-sand-300/50">
          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wide mb-2">Selected Prompt</p>
          <p className="text-base text-foreground font-sans">{prompt.text}</p>
          <button
            data-testid="change-prompt-btn"
            onClick={() => navigate('/prompts')}
            className="mt-3 text-sm text-sage-500 font-sans font-semibold hover:underline"
          >
            Change prompt
          </button>
        </div>
      )}

      {/* Start Button */}
      <button
        data-testid="start-session-btn"
        onClick={handleStart}
        disabled={micPermission === 'denied'}
        className={cn(
          'w-full py-5 rounded-full font-sans font-bold text-lg btn-press',
          'transition-colors duration-200',
          micPermission === 'denied'
            ? 'bg-sand-300 text-muted-foreground cursor-not-allowed'
            : 'bg-sage-500 text-white hover:bg-sage-600'
        )}
      >
        <span className="flex items-center justify-center gap-3">
          <Play size={20} fill="currentColor" />
          Start Speaking
        </span>
      </button>

      {!prompt && (
        <button
          data-testid="browse-prompts-link"
          onClick={() => navigate('/prompts')}
          className="w-full mt-4 py-4 rounded-full bg-sand-200 text-foreground font-sans font-semibold text-base btn-press hover:bg-sand-300" style={{ transition: 'background-color 0.2s ease' }}
        >
          Or pick a speaking prompt first
        </button>
      )}
    </div>
  );
}
