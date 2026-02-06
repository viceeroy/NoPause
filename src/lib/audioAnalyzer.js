// Web Audio API wrapper for real-time speech analysis

export class AudioAnalyzer {
  constructor(options = {}) {
    this.silenceThreshold = options.silenceThreshold || 0.015;
    this.hesitationMinDuration = options.hesitationMinDuration || 400; // ms
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.dataArray = null;
    this.isRunning = false;
    this.onData = options.onData || null;
    this.animationFrame = null;

    // Tracking state
    this.silenceStart = null;
    this.totalSilenceTime = 0;
    this.hesitationCount = 0;
    this.volumeSamples = [];
    this.isSilent = false;
    this.sessionStartTime = null;
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

    // Get frequency data for visualization
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    this.volumeSamples.push(rms);

    const now = Date.now();
    const wasSilent = this.isSilent;
    this.isSilent = rms < this.silenceThreshold;

    if (this.isSilent) {
      if (!wasSilent) {
        // Silence just started
        this.silenceStart = now;
      }
    } else {
      if (wasSilent && this.silenceStart) {
        // Silence just ended
        const silenceDuration = now - this.silenceStart;
        if (silenceDuration >= this.hesitationMinDuration) {
          this.totalSilenceTime += silenceDuration;
          this.hesitationCount++;
        }
        this.silenceStart = null;
      }
    }

    // Calculate current silence duration
    let currentSilenceDuration = 0;
    if (this.isSilent && this.silenceStart) {
      currentSilenceDuration = now - this.silenceStart;
    }

    if (this.onData) {
      this.onData({
        rms,
        isSilent: this.isSilent,
        currentSilenceDuration,
        totalSilenceTime: this.totalSilenceTime,
        hesitationCount: this.hesitationCount,
        waveformData: Array.from(this.dataArray.slice(0, 128)),
        frequencyData: Array.from(freqData.slice(0, 64)),
        volume: Math.min(rms * 10, 1),
      });
    }

    this.animationFrame = requestAnimationFrame(() => this._analyze());
  }

  stop() {
    this.isRunning = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Account for any ongoing silence
    if (this.isSilent && this.silenceStart) {
      const silenceDuration = Date.now() - this.silenceStart;
      if (silenceDuration >= this.hesitationMinDuration) {
        this.totalSilenceTime += silenceDuration;
        this.hesitationCount++;
      }
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
      hesitationCount: this.hesitationCount,
      avgVolume: Math.round(avgVolume * 1000) / 1000,
      totalTime,
    };
  }

  static calculateHesitationScore(silenceTimeMs, totalTimeMs) {
    if (totalTimeMs <= 0) return 100;
    const silenceRatio = silenceTimeMs / totalTimeMs;
    // Score: 100 = perfect (no silence), 0 = all silence
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
