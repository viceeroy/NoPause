import { useRef, useEffect } from 'react';

export const AudioVisualizer = ({ waveformData, isRecording, isSilent, volume }) => {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    ctx.clearRect(0, 0, w, h);

    if (!isRecording || !waveformData || waveformData.length === 0) {
      // Draw idle state - gentle sine wave
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(90, 125, 124, 0.2)';
      ctx.lineWidth = 2;
      const now = Date.now() / 1000;
      for (let i = 0; i < w; i++) {
        const x = i;
        const y = h / 2 + Math.sin((i / w) * Math.PI * 4 + now * 2) * 8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    // Draw waveform bars
    const barCount = 48;
    const barWidth = (w / barCount) * 0.6;
    const gap = (w / barCount) * 0.4;
    const step = Math.floor(waveformData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * step;
      const value = Math.abs(waveformData[dataIndex] || 0);
      const barHeight = Math.max(3, value * h * 3);

      const x = i * (barWidth + gap) + gap / 2;
      const y = (h - barHeight) / 2;

      // Color based on state
      const alpha = 0.4 + value * 3;
      if (isSilent) {
        ctx.fillStyle = `rgba(217, 124, 95, ${Math.min(alpha, 0.6)})`;
      } else {
        ctx.fillStyle = `rgba(90, 125, 124, ${Math.min(alpha, 0.9)})`;
      }

      // Draw rounded bar
      const radius = barWidth / 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight - radius);
      ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - radius, y + barHeight);
      ctx.lineTo(x + radius, y + barHeight);
      ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      // Smooth rounded bars
      ctx.beginPath();
      ctx.moveTo(x + barWidth / 2, y);
      ctx.lineTo(x + barWidth / 2, y + barHeight);
      ctx.lineTo(x + barWidth / 2, y + barHeight);
      ctx.lineTo(x + barWidth / 2, y);
      ctx.closePath();
      ctx.fill();
    }
  }, [waveformData, isRecording, isSilent, volume]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="audio-visualizer"
      className="w-full waveform-canvas"
      style={{ height: '120px' }}
    />
  );
};
