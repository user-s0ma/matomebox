// src/components/board/DynamicGradientBorder.tsx
import React, { useRef, useEffect } from "react";

const DynamicGradientBorder: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // カスタマイズ可能な設定
  const blurRadius = 30;
  const baseThickness = 10; // 標準の枠の太さ
  const amplitude = 5; // 波の振幅
  const waveCount = 2; // 波の横幅（周回あたりの波数）
  const colorSpeed = 30; // 色移動速度 (hue/frame)
  const waveSpeed = 0.6; // 波動速度 (rad/s)

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stops = [
      [155, 64, 255], // 紫
      [255, 128, 191], // ピンク
      [64, 128, 255], // 水色
      [255, 128, 128], // ピンク
      [255, 0, 128], // 赤
      [255, 128, 0], // オレンジ
      [255, 128, 255], // ピンク
      [64, 128, 255], // 水色
    ];

    let width: number, height: number;
    let animationFrameId: number;
    let start: number | null = null;

    const resize = () => {
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      if (parentRect) {
        width = canvas.width = parentRect.width + blurRadius * 2;
        height = canvas.height = parentRect.height + blurRadius * 2;
      } else {
        width = canvas.width = window.innerWidth + blurRadius * 2;
        height = canvas.height = window.innerHeight + blurRadius * 2;
      }
    };

    const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

    const getColorAt = (t: number) => {
      const n = stops.length;
      const scaled = t * n;
      const idx = Math.floor(scaled) % n;
      const next = (idx + 1) % n;
      const f = scaled - Math.floor(scaled);
      const [r1, g1, b1] = stops[idx];
      const [r2, g2, b2] = stops[next];
      return `rgb(${lerp(r1, r2, f) | 0},${lerp(g1, g2, f) | 0},${lerp(b1, b2, f) | 0})`;
    };

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      const colorPhase = elapsed * colorSpeed;
      const thicknessPhase = elapsed * Math.PI * waveSpeed;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.lineCap = "round";

      const segments = 240;
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      const actualWidth = parentRect ? parentRect.width : window.innerWidth;
      const actualHeight = parentRect ? parentRect.height : window.innerHeight;

      for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const angle = t * Math.PI * 2;
        const wave = Math.sin(waveCount * angle + thicknessPhase) * amplitude;
        const thickness = baseThickness + wave;
        ctx.lineWidth = thickness;
        const ct = (t + colorPhase / 360) % 1;
        ctx.strokeStyle = getColorAt(ct);

        const u1 = t;
        const u2 = ((i + 1) % segments) / segments;

        function computePoint(u_param: number) {
          const u = u_param < 1 ? u_param : 0;
          let x, y;

          if (u < 0.25) {
            x = actualWidth * (u / 0.25);
            y = 0;
          } else if (u < 0.5) {
            x = actualWidth;
            y = actualHeight * ((u - 0.25) / 0.25);
          } else if (u < 0.75) {
            x = actualWidth * (1 - (u - 0.5) / 0.25);
            y = actualHeight;
          } else {
            x = 0;
            y = actualHeight * (1 - (u - 0.75) / 0.25);
          }

          return { x: x + blurRadius, y: y + blurRadius };
        }

        const p1 = computePoint(u1);
        const p2 = computePoint(u2);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    resize();
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: `-${blurRadius}px`,
        left: `-${blurRadius}px`,
        width: `calc(100% + ${blurRadius * 2}px)`,
        height: `calc(100% + ${blurRadius * 2}px)`,
        filter: "blur(5px)",
        pointerEvents: "none",
      }}
    />
  );
};

export default DynamicGradientBorder;
