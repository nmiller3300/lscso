"use client";

import { useEffect, useRef } from "react";

export function PortalCinematicBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const glints = Array.from({ length: 34 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.55 + Math.random() * 1.35,
      phase: Math.random() * Math.PI * 2,
      speed: 0.18 + Math.random() * 0.32,
      edgeBias: index % 2 === 0 ? -1 : 1,
    }));

    const grainCanvas = document.createElement("canvas");
    grainCanvas.width = 128;
    grainCanvas.height = 128;
    const grainContext = grainCanvas.getContext("2d");
    let grainPattern: CanvasPattern | null = null;

    if (grainContext) {
      const grain = grainContext.createImageData(128, 128);
      for (let i = 0; i < grain.data.length; i += 4) {
        const value = 115 + Math.floor(Math.random() * 95);
        grain.data[i] = value;
        grain.data[i + 1] = value;
        grain.data[i + 2] = value;
        grain.data[i + 3] = 18 + Math.floor(Math.random() * 18);
      }
      grainContext.putImageData(grain, 0, 0);
      grainPattern = context.createPattern(grainCanvas, "repeat");
    }

    let width = 0;
    let height = 0;
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawGlow = (
      x: number,
      y: number,
      radius: number,
      color: [number, number, number],
      alpha: number,
    ) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.38})`);
      gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    };

    const drawRibbon = (
      baseY: number,
      amplitude: number,
      lineWidth: number,
      color: [number, number, number],
      alpha: number,
      phase: number,
      time: number,
    ) => {
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
      gradient.addColorStop(0.2, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.72})`);
      gradient.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
      gradient.addColorStop(0.8, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.7})`);
      gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);

      context.beginPath();
      for (let x = -80; x <= width + 80; x += 30) {
        const y =
          height * baseY +
          Math.sin(x * 0.0045 + time * 0.00022 + phase) * height * amplitude +
          Math.cos(x * 0.0018 - time * 0.00012 + phase * 1.7) * height * amplitude * 0.35 +
          pointer.y * 12;
        if (x === -80) context.moveTo(x, y);
        else context.lineTo(x, y);
      }

      context.strokeStyle = gradient;
      context.lineWidth = lineWidth;
      context.lineCap = "round";
      context.shadowBlur = 52;
      context.shadowColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.72})`;
      context.stroke();
      context.shadowBlur = 0;
    };

    const draw = (time: number) => {
      if (!width || !height) resize();

      pointer.x += (pointer.targetX - pointer.x) * 0.035;
      pointer.y += (pointer.targetY - pointer.y) * 0.035;

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "screen";

      drawGlow(width * (0.14 + pointer.x * 0.012), height * (0.28 + pointer.y * 0.012), Math.max(width, height) * 0.34, [194, 157, 72], 0.105);
      drawGlow(width * (0.86 + pointer.x * 0.014), height * (0.72 + pointer.y * 0.014), Math.max(width, height) * 0.31, [72, 105, 142], 0.095);
      drawGlow(width * 0.7, height * 0.12, Math.max(width, height) * 0.2, [132, 119, 78], 0.055);

      drawRibbon(0.21, 0.055, 66, [206, 177, 94], 0.055, 0.6, time);
      drawRibbon(0.78, 0.048, 54, [77, 113, 151], 0.045, 2.4, time);
      drawRibbon(0.55, 0.028, 24, [173, 145, 77], 0.03, 4.2, time);

      context.restore();

      for (const glint of glints) {
        const pulse = 0.35 + Math.sin(time * 0.001 * glint.speed + glint.phase) * 0.25;
        const edgeShift = glint.edgeBias * width * 0.08;
        const x = glint.x * width + edgeShift + pointer.x * 8;
        const y = glint.y * height + pointer.y * 6;
        context.fillStyle = `rgba(230, 216, 169, ${Math.max(0.05, pulse) * 0.26})`;
        context.beginPath();
        context.arc(x, y, glint.size, 0, Math.PI * 2);
        context.fill();
      }

      if (grainPattern) {
        context.save();
        context.globalAlpha = 0.045;
        context.fillStyle = grainPattern;
        context.translate((time * 0.003) % 128, (time * 0.002) % 128);
        context.fillRect(-128, -128, width + 256, height + 256);
        context.restore();
      }

      if (!reducedMotion.matches) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointer.targetY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    };

    const handleMotionChange = () => {
      window.cancelAnimationFrame(animationFrame);
      draw(performance.now());
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    reducedMotion.addEventListener("change", handleMotionChange);

    draw(performance.now());

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      reducedMotion.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div className="portal-cinematic-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="portal-cinematic-backdrop__canvas" />
      <div className="portal-cinematic-backdrop__crest portal-cinematic-backdrop__crest--left" />
      <div className="portal-cinematic-backdrop__crest portal-cinematic-backdrop__crest--right" />
      <div className="portal-cinematic-backdrop__sheen" />
    </div>
  );
}
