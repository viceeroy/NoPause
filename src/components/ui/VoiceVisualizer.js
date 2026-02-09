import { useRef, useEffect } from 'react';

export const VoiceVisualizer = ({ volume, isSilent, isRecording }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const ripplesRef = useRef([]);

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

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      if (!isRecording) {
        // Idle state - gentle pulse
        const centerX = w / 2;
        const centerY = h / 2;
        const pulseRadius = 20 + Math.sin(Date.now() / 1000) * 5;

        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(90, 125, 124, 0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(90, 125, 124, 0.2)';
        ctx.fill();
        return;
      }

      // Voice-reactive visualization
      const centerX = w / 2;
      const centerY = h / 2;
      const normalizedVolume = Math.min(1, Math.max(0, volume * 10));

      if (!isSilent && normalizedVolume > 0.1) {
        // Create ripples when speaking
        if (Math.random() < 0.1) {
          ripplesRef.current.push({
            x: centerX + (Math.random() - 0.5) * 100,
            y: centerY + (Math.random() - 0.5) * 100,
            radius: 5,
            opacity: 0.6,
            speed: 1 + Math.random() * 2
          });
        }

        // Keep only recent ripples
        ripplesRef.current = ripplesRef.current.filter(r => r.opacity > 0.01);
      }

      // Update and draw ripples
      ripplesRef.current = ripplesRef.current.map(ripple => ({
        ...ripple,
        radius: ripple.radius + ripple.speed,
        opacity: ripple.opacity - 0.01
      }));

      ripplesRef.current.forEach(ripple => {
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(90, 125, 124, ${ripple.opacity})`;
        ctx.fill();
      });

      // Central voice orb that responds to volume
      const orbRadius = 15 + normalizedVolume * 40;
      const orbGlow = normalizedVolume * 30;

      // Ensure finite values for gradient and dimensions
      const safeCenterX = isFinite(centerX) ? centerX : w / 2;
      const safeCenterY = isFinite(centerY) ? centerY : h / 2;
      const safeOrbRadius = isFinite(orbRadius) ? Math.max(1, Math.min(100, orbRadius)) : 15;
      const safeOrbGlow = isFinite(orbGlow) ? Math.max(0, Math.min(50, orbGlow)) : 0;
      const gradientRadius = Math.max(0.1, safeOrbRadius + safeOrbGlow);

      // Outer glow
      try {
        const gradient = ctx.createRadialGradient(
          safeCenterX, safeCenterY, 0,
          safeCenterX, safeCenterY, gradientRadius
        );
        gradient.addColorStop(0, `rgba(90, 125, 124, ${0.3 + normalizedVolume * 0.4})`);
        gradient.addColorStop(0.5, `rgba(90, 125, 124, ${0.2 + normalizedVolume * 0.3})`);
        gradient.addColorStop(1, 'rgba(90, 125, 124, 0)');

        ctx.beginPath();
        ctx.arc(safeCenterX, safeCenterY, gradientRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } catch (e) {
        console.warn("Gradient creation failed:", e);
      }

      // Inner orb
      ctx.beginPath();
      ctx.arc(centerX, centerY, safeOrbRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(90, 125, 124, ${0.6 + normalizedVolume * 0.4})`;
      ctx.fill();

      // Sound waves emanating from center
      if (!isSilent) {
        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
          const waveRadius = safeOrbRadius + 20 + (i * 15) + (Date.now() / 50) % 20;
          const waveOpacity = Math.max(0, 0.3 - (i * 0.1) - normalizedVolume * 0.2);

          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(90, 125, 124, ${waveOpacity})`;
          ctx.lineWidth = 2 - (i * 0.5);
          ctx.stroke();
        }
      }

      // Frequency bars around the orb
      if (!isSilent) {
        const barCount = 12;
        const barHeight = normalizedVolume * 30;

        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2;
          const barX = centerX + Math.cos(angle) * (safeOrbRadius + 10);
          const barY = centerY + Math.sin(angle) * (safeOrbRadius + 10);
          const barEndX = centerX + Math.cos(angle) * (safeOrbRadius + 10 + barHeight);
          const barEndY = centerY + Math.sin(angle) * (safeOrbRadius + 10 + barHeight);

          ctx.beginPath();
          ctx.moveTo(barX, barY);
          ctx.lineTo(barEndX, barEndY);
          ctx.strokeStyle = `rgba(90, 125, 124, ${0.4 + normalizedVolume * 0.6})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Bar endpoints
          ctx.beginPath();
          ctx.arc(barEndX, barEndY, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(90, 125, 124, ${0.6 + normalizedVolume * 0.4})`;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [volume, isSilent, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
