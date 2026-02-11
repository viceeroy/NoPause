// Web Audio API wrapper for real-time speech analysis
// Architecture: Delta-time accumulation — every millisecond is classified.
// Guarantee: speakingTime + silenceTime = totalSessionTime (always)
//
// ┌──────────────────────────────────────────────────────────┐
// │  Adaptive detection disabled for V1 simplicity.         │
// │  Architecture preserved for future activation.          │
// │  See: detectionProfile.js (reserved for V2 adaptive)    │
// └──────────────────────────────────────────────────────────┘

// ── V1 Fixed Constants ──
const SPEECH_THRESHOLD = 0.01;
const SPEECH_OFF_MULTIPLIER = 0.7;
const HESITATION_MIN_DURATION = 1800;   // ms
const MICRO_PAUSE_IGNORE = 300;         // ms
const SMOOTHING_WINDOW = 10;
const CALIBRATION_DURATION = 1500;      // ms

export class AudioAnalyzer {
  constructor(options = {}) {
    // Fixed thresholds — no profile, no adaptive, no mode switching
    this.speechOnThreshold = SPEECH_THRESHOLD;
    this.speechOffThreshold = SPEECH_THRESHOLD * SPEECH_OFF_MULTIPLIER;
    this.hesitationMinDuration = HESITATION_MIN_DURATION;
    this.microPauseFilter = MICRO_PAUSE_IGNORE;

    // Audio nodes
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.dataArray = null;
    this.isRunning = false;
    this.onData = options.onData || null;
    this.onHesitation = options.onHesitation || null;
    this.onCalibrated = options.onCalibrated || null;
    this.animationFrame = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recognition = null;
    this.transcript = '';

    // Delta-time state
    this.sessionStartTime = null;
    this.lastFrameTime = null;
    this.totalSpeakingTime = 0;   // ms
    this.totalSilenceTime = 0;    // ms

    // Hesitation tracking
    this.hesitationSilenceTime = 0;
    this.hesitationCount = 0;
    this.currentSilenceStart = null;
    this.isSpeaking = false;
    this.hasSpokeAtLeastOnce = false;
    this.hesitationTimings = [];
    this.currentFlowStreakStart = null;
    this.longestFlowStreak = 0;
    this.frameCount = 0;
    this.noiseFloor = 0;

    // Volume smoothing
    this.volumeSamples = [];

    // Throttle: ~30fps
    this.lastAnalyzeTime = 0;
    this.analyzeInterval = 33;

    // Calibration
    this.calibrationSamples = [];
    this.isCalibrating = true;
    this.calibrationStartTime = null;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
      this.isRunning = true;

      const now = Date.now();
      this.sessionStartTime = now;
      this.lastFrameTime = now;
      this.calibrationStartTime = now;

      // Reset accumulators
      this.totalSpeakingTime = 0;
      this.totalSilenceTime = 0;
      this.hesitationSilenceTime = 0;
      this.hesitationCount = 0;
      this.currentSilenceStart = null;
      this.isSpeaking = false;
      this.hasSpokeAtLeastOnce = false;
      this.hesitationTimings = [];
      this.currentFlowStreakStart = null;
      this.longestFlowStreak = 0;
      this.frameCount = 0;
      this.noiseFloor = 0;
      this.volumeSamples = [];
      this.audioChunks = [];
      this.transcript = '';
      this.calibrationSamples = [];
      this.isCalibrating = true;

      // MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(100);

      // SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              this.transcript += event.results[i][0].transcript + ' ';
            }
          }
        };

        this.recognition.onerror = () => { };
        this.recognition.onend = () => {
          if (this.isRunning && this.recognition) {
            try { this.recognition.start(); } catch (e) { }
          }
        };

        try { this.recognition.start(); } catch (e) { }
      }

      this._analyze();
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      return false;
    }
  }

  _analyze() {
    if (!this.isRunning) return;

    const now = Date.now();

    // Throttle to ~30fps
    if (now - this.lastAnalyzeTime < this.analyzeInterval) {
      this.animationFrame = requestAnimationFrame(() => this._analyze());
      return;
    }
    this.lastAnalyzeTime = now;
    this.frameCount++;

    // Delta time
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // RMS volume
    this.analyser.getFloatTimeDomainData(this.dataArray);
    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sumSquares += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // Smoothing
    this.volumeSamples.push(rms);
    if (this.volumeSamples.length > SMOOTHING_WINDOW) {
      this.volumeSamples = this.volumeSamples.slice(-SMOOTHING_WINDOW);
    }
    const smoothedRms = this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length;

    // Calibration: record noise floor (informational only — does NOT change thresholds)
    if (this.isCalibrating) {
      this.calibrationSamples.push(rms);
      if (now - this.calibrationStartTime >= CALIBRATION_DURATION) {
        this.isCalibrating = false;
        const avgNoise = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
        this.noiseFloor = avgNoise;
        // Thresholds stay fixed — calibration is for analytics/diagnostics only
        if (this.onCalibrated) {
          this.onCalibrated(avgNoise, this.speechOnThreshold);
        }
      }
    }

    // Hysteresis classification (fixed thresholds)
    const wasSpeaking = this.isSpeaking;
    let isSpeaking;
    if (wasSpeaking) {
      isSpeaking = smoothedRms > this.speechOffThreshold;
    } else {
      isSpeaking = smoothedRms > this.speechOnThreshold;
    }
    this.isSpeaking = isSpeaking;

    // Delta-time accumulation
    if (isSpeaking) {
      this.totalSpeakingTime += delta;
      this.hasSpokeAtLeastOnce = true;
      if (!wasSpeaking) {
        this.currentFlowStreakStart = now;
      }
    } else {
      this.totalSilenceTime += delta;
      if (wasSpeaking && this.currentFlowStreakStart) {
        const streak = now - this.currentFlowStreakStart;
        if (streak > this.longestFlowStreak) {
          this.longestFlowStreak = streak;
        }
        this.currentFlowStreakStart = null;
      }
    }

    // Hesitation tracking (with micro-pause filter)
    if (!this.isCalibrating && this.hasSpokeAtLeastOnce) {
      if (!isSpeaking) {
        if (wasSpeaking) {
          this.currentSilenceStart = now;
        }
      } else {
        if (!wasSpeaking && this.currentSilenceStart) {
          const silenceDuration = now - this.currentSilenceStart;
          if (silenceDuration >= this.microPauseFilter && silenceDuration >= this.hesitationMinDuration) {
            this.hesitationSilenceTime += silenceDuration;
            this.hesitationCount++;
            this.hesitationTimings.push({
              startOffset: this.currentSilenceStart - this.sessionStartTime,
              duration: silenceDuration,
            });
            if (this.onHesitation) {
              this.onHesitation(silenceDuration, this.hesitationCount);
            }
          }
          this.currentSilenceStart = null;
        }
      }
    }

    // Visualization data
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    const speechFrequencies = freqData.slice(0, 12);
    const speechEnergy = speechFrequencies.reduce((a, b) => a + b, 0) / speechFrequencies.length;

    let currentSilenceDuration = 0;
    if (!isSpeaking && this.currentSilenceStart) {
      currentSilenceDuration = now - this.currentSilenceStart;
    }

    if (this.onData) {
      this.onData({
        rms,
        smoothedRms,
        isSilent: !isSpeaking,
        isActuallySpeaking: isSpeaking,
        currentSilenceDuration,
        totalSilenceTime: Math.round(this.totalSilenceTime / 1000),
        totalSpeakingTime: Math.round(this.totalSpeakingTime / 1000),
        hesitationCount: this.hesitationCount,
        waveformData: Array.from(this.dataArray.slice(0, 256)),
        frequencyData: Array.from(freqData.slice(0, 64)),
        volume: smoothedRms,
        speechEnergy,
        isCalibrating: this.isCalibrating,
      });
    }

    this.animationFrame = requestAnimationFrame(() => this._analyze());
  }

  async stop() {
    this.isRunning = false;

    // Final delta
    const now = Date.now();
    if (this.lastFrameTime) {
      const finalDelta = now - this.lastFrameTime;
      if (this.isSpeaking) {
        this.totalSpeakingTime += finalDelta;
        if (this.currentFlowStreakStart) {
          const streak = now - this.currentFlowStreakStart;
          if (streak > this.longestFlowStreak) this.longestFlowStreak = streak;
        }
      } else {
        this.totalSilenceTime += finalDelta;
      }
    }

    // Trailing silence: do NOT count as hesitation

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // No adaptive learning — reserved for V2
    // updateProfileFromSession() is NOT called

    // Stop SpeechRecognition
    let finalTranscript = this.transcript;
    if (this.recognition) {
      this.recognition.onend = null;
      await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(), 1000);

        this.recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              this.transcript += event.results[i][0].transcript + ' ';
            }
          }
          finalTranscript = this.transcript;
        };

        this.recognition.onend = () => {
          clearTimeout(timeout);
          resolve();
        };

        try {
          this.recognition.stop();
        } catch (e) {
          clearTimeout(timeout);
          resolve();
        }
      });
      finalTranscript = this.transcript;
    }

    // Stop MediaRecorder
    const audioBlob = await new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          resolve(blob);
        };
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });

    // Cleanup hardware
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    const totalTime = this.sessionStartTime ? now - this.sessionStartTime : 0;
    const avgVolume = this.volumeSamples.length > 0
      ? this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length
      : 0;

    return {
      totalSpeakingTime: Math.round(this.totalSpeakingTime / 1000),
      totalSilenceTime: Math.round(this.totalSilenceTime / 1000),
      hesitationSilenceTime: Math.round(this.hesitationSilenceTime),
      hesitationCount: this.hesitationCount,
      hesitationTimings: this.hesitationTimings,
      longestFlowStreak: this.longestFlowStreak,
      frameCount: this.frameCount,
      noiseFloor: this.noiseFloor,
      totalTime,
      avgVolume: Math.round(avgVolume * 1000) / 1000,
      audioBlob,
      transcript: finalTranscript.trim() || "No speech detected. Please ensure your microphone is working and you are speaking into it."
    };
  }

  static calculateFlowScore(hesitationSilenceTimeMs, hesitationCount) {
    const silenceSeconds = hesitationSilenceTimeMs / 1000;
    const score = 100 - (hesitationCount * 5) - (silenceSeconds * 10);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  static getScoreLabel(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Great';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Keep Practicing';
  }

  static getScoreColor(score) {
    if (score >= 90) return '#5A7D7C';
    if (score >= 75) return '#6a9997';
    if (score >= 60) return '#D97C5F';
    if (score >= 40) return '#c4613e';
    return '#a24c30';
  }
}
