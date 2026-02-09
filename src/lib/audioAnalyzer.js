// Web Audio API wrapper for real-time speech analysis

export class AudioAnalyzer {
  constructor(options = {}) {
    this.silenceThreshold = options.silenceThreshold || 0.01; // Lowered for better sensitivity
    this.hesitationMinDuration = options.hesitationMinDuration || 500; // Increased to avoid false positives
    this.speechThreshold = options.speechThreshold || 0.015; // Separate threshold for speech detection
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.dataArray = null;
    this.isRunning = false;
    this.onData = options.onData || null;
    this.animationFrame = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recognition = null;
    this.transcript = '';

    // Enhanced tracking state
    this.silenceStart = null;
    this.totalSilenceTime = 0;
    this.hesitationCount = 0;
    this.volumeSamples = [];
    this.isSilent = false;
    this.sessionStartTime = null;
    this.speakingStartTime = null; // Track actual speaking periods
    this.totalSpeakingTime = 0; // Track actual speaking time separately
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
      this.analyser.smoothingTimeConstant = 0.8;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this.dataArray = new Float32Array(this.analyser.fftSize);
      this.isRunning = true;
      this.sessionStartTime = Date.now();
      this.silenceStart = null;
      this.totalSilenceTime = 0;
      this.hesitationCount = 0;
      this.volumeSamples = [];
      this.isSilent = false;
      this.audioChunks = [];
      this.transcript = '';

      // Initialize MediaRecorder for audio recording
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start();

      // Initialize SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              this.transcript += event.results[i][0].transcript + ' ';
            } else {
              currentTranscript += event.results[i][0].transcript;
            }
          }

          if (this.onData) {
            this.onData({
              interimTranscript: currentTranscript,
              finalTranscript: this.transcript,
            });
          }
        };

        this.recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };

        this.recognition.start();
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

    this.analyser.getFloatTimeDomainData(this.dataArray);

    // Calculate RMS (Root Mean Square) for volume level
    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sumSquares += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // Enhanced volume smoothing with adaptive window
    this.volumeSamples.push(rms);
    const smoothingWindow = Math.min(30, this.volumeSamples.length); // Larger window for stability
    if (this.volumeSamples.length > smoothingWindow) {
      this.volumeSamples = this.volumeSamples.slice(-smoothingWindow);
    }
    const smoothedRms = this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length;

    // Multi-level detection for accuracy
    const isAboveSilenceThreshold = smoothedRms > this.silenceThreshold;
    const isAboveSpeechThreshold = smoothedRms > this.speechThreshold;
    const isActuallySpeaking = isAboveSpeechThreshold; // Use speech threshold for speaking detection
    const wasSilent = this.isSilent;
    const wasSpeaking = this.isActuallySpeaking || false;

    // Update speaking state
    this.isSilent = !isAboveSilenceThreshold;
    this.isActuallySpeaking = isActuallySpeaking;

    const now = Date.now();

    // Track speaking time accurately
    if (isActuallySpeaking) {
      if (!wasSpeaking) {
        // Just started speaking
        this.speakingStartTime = now;
      }
      // Currently speaking - add to total speaking time
      if (this.speakingStartTime) {
        this.totalSpeakingTime += now - this.speakingStartTime;
        this.speakingStartTime = now; // Reset for next measurement
      }
    } else {
      if (wasSpeaking && this.speakingStartTime) {
        // Just stopped speaking
        this.totalSpeakingTime += now - this.speakingStartTime;
        this.speakingStartTime = null;
      }
    }

    // Enhanced silence detection for hesitations
    if (this.isSilent) {
      if (!wasSilent) {
        // Silence just started
        this.silenceStart = now;
      }
    } else {
      if (wasSilent && this.silenceStart) {
        // Silence just ended
        const silenceDuration = now - this.silenceStart;
        // Only count as hesitation if it was speech before silence
        if (silenceDuration >= this.hesitationMinDuration && wasSpeaking) {
          this.totalSilenceTime += silenceDuration;
          this.hesitationCount++;
        }
        this.silenceStart = null;
      }
    }

    // Get frequency data for visualization
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    // Enhanced frequency analysis for better speech detection
    const speechFrequencies = freqData.slice(0, 12); // Wider speech range
    const speechEnergy = speechFrequencies.reduce((a, b) => a + b, 0) / speechFrequencies.length;
    const hasSpeechEnergy = speechEnergy > 25; // Threshold for speech frequencies

    // Calculate current silence duration
    let currentSilenceDuration = 0;
    if (this.isSilent && this.silenceStart) {
      currentSilenceDuration = now - this.silenceStart;
    }

    if (this.onData) {
      this.onData({
        rms,
        smoothedRms,
        isSilent: this.isSilent,
        isActuallySpeaking: this.isActuallySpeaking,
        currentSilenceDuration,
        totalSilenceTime: this.totalSilenceTime,
        totalSpeakingTime: Math.floor(this.totalSpeakingTime / 1000), // Convert to seconds
        hesitationCount: this.hesitationCount,
        waveformData: Array.from(this.dataArray.slice(0, 256)),
        frequencyData: Array.from(freqData.slice(0, 64)),
        volume: smoothedRms,
        speechEnergy,
        isAboveSpeechThreshold,
        isAboveSilenceThreshold
      });
    }

    this.animationFrame = requestAnimationFrame(() => this._analyze());
  }

  async stop() {
    this.isRunning = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Stop SpeechRecognition and wait for final results
    let finalTranscript = this.transcript;
    if (this.recognition) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.recognition.onend = null;
          this.recognition.onresult = null;
          resolve();
        }, 1000); // 1 second timeout for final processing

        this.recognition.onend = () => {
          clearTimeout(timeout);
          resolve();
        };

        const originalOnResult = this.recognition.onresult;
        this.recognition.onresult = (event) => {
          if (originalOnResult) originalOnResult(event);
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript = this.transcript;
            }
          }
        };

        this.recognition.stop();
      });
    }

    // Stop MediaRecorder and get audio blob
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

    // Account for any ongoing silence or speaking at the end
    const now = Date.now();
    if (this.isSilent && this.silenceStart) {
      const silenceDuration = now - this.silenceStart;
      if (silenceDuration >= this.hesitationMinDuration) {
        this.totalSilenceTime += silenceDuration;
        this.hesitationCount++;
      }
    } else if (this.isActuallySpeaking && this.speakingStartTime) {
      this.totalSpeakingTime += now - this.speakingStartTime;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    const totalTime = this.sessionStartTime ? Date.now() - this.sessionStartTime : 0;
    const avgVolume = this.volumeSamples.length > 0
      ? this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length
      : 0;

    return {
      totalSilenceTime: this.totalSilenceTime,
      totalSpeakingTime: Math.round(this.totalSpeakingTime / 1000), // convert to seconds
      hesitationCount: this.hesitationCount,
      avgVolume: Math.round(avgVolume * 1000) / 1000,
      totalTime,
      audioBlob,
      transcript: finalTranscript.trim() || "No speech detected. Please ensure your microphone is working and you are speaking into it."
    };
  }

  static calculateHesitationScore(silenceTimeMs, totalTimeMs) {
    if (totalTimeMs <= 0) return 100;
    const silenceRatio = silenceTimeMs / totalTimeMs;
    const score = Math.max(0, Math.min(100, Math.round((1 - silenceRatio) * 100)));
    return score;
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
