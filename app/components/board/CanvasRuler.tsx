// src/components/CanvasRuler.tsx
import React, { useState, useEffect, useCallback } from "react";
import type { Point, PanOffset, ContainerRect, RulerConfig } from "./constants";
import { RULER_THICKNESS_SCREEN } from "./constants";

interface CanvasRulerProps {
  panOffset: PanOffset;
  zoomLevel: number;
  rulerConfig: RulerConfig;
  setRulerConfig: React.Dispatch<React.SetStateAction<RulerConfig>>;
  containerRect: ContainerRect | null;
}

const CanvasRuler = React.forwardRef<SVGSVGElement, CanvasRulerProps>(({ zoomLevel, rulerConfig, setRulerConfig, containerRect }, ref) => {
  if (!rulerConfig.active || !containerRect) return null;

  const [draggingHandle, setDraggingHandle] = useState<"p1" | "p2" | "body" | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState<Point>({ x: 0, y: 0 });

  const clampPointToScreen = useCallback(
    (point: Point, margin = 20): Point => {
      if (!containerRect) return point;
      return {
        x: Math.max(containerRect.left + margin, Math.min(point.x, containerRect.left + containerRect.width - margin)),
        y: Math.max(containerRect.top + margin, Math.min(point.y, containerRect.top + containerRect.height - margin - RULER_THICKNESS_SCREEN)),
      };
    },
    [containerRect]
  );

  const adjustRulerToBeOnScreen = useCallback(() => {
    if (!containerRect) return;

    setRulerConfig((prevConfig) => {
      let { p1, p2 } = prevConfig;
      const rulerLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const margin = 30;

      let needsAdjustment = false;
      let dx = 0;
      let dy = 0;

      if (midX < containerRect.left + margin) {
        dx = containerRect.left + margin - midX;
        needsAdjustment = true;
      } else if (midX > containerRect.left + containerRect.width - margin) {
        dx = containerRect.left + containerRect.width - margin - midX;
        needsAdjustment = true;
      }

      if (midY < containerRect.top + margin) {
        dy = containerRect.top + margin - midY;
        needsAdjustment = true;
      } else if (midY > containerRect.top + containerRect.height - margin - RULER_THICKNESS_SCREEN) {
        dy = containerRect.top + containerRect.height - margin - RULER_THICKNESS_SCREEN - midY;
        needsAdjustment = true;
      }

      const screenMargin = 10;

      if (
        p1.x < containerRect.left - rulerLength * 0.5 ||
        p1.x > containerRect.left + containerRect.width + rulerLength * 0.5 ||
        p1.y < containerRect.top - rulerLength * 0.5 ||
        p1.y > containerRect.top + containerRect.height + rulerLength * 0.5
      ) {
        if (
          !(
            p2.x < containerRect.left - screenMargin ||
            p2.x > containerRect.left + containerRect.width + screenMargin ||
            p2.y < containerRect.top - screenMargin ||
            p2.y > containerRect.top + containerRect.height + screenMargin
          )
        ) {
          const targetP1X = p2.x - rulerLength * Math.cos(angle);
          const targetP1Y = p2.y - rulerLength * Math.sin(angle);
          dx += targetP1X - p1.x;
          dy += targetP1Y - p1.y;
          needsAdjustment = true;
        }
      }
      if (
        p2.x < containerRect.left - rulerLength * 0.5 ||
        p2.x > containerRect.left + containerRect.width + rulerLength * 0.5 ||
        p2.y < containerRect.top - rulerLength * 0.5 ||
        p2.y > containerRect.top + containerRect.height + rulerLength * 0.5
      ) {
        if (
          !(
            p1.x < containerRect.left - screenMargin ||
            p1.x > containerRect.left + containerRect.width + screenMargin ||
            p1.y < containerRect.top - screenMargin ||
            p1.y > containerRect.top + containerRect.height + screenMargin
          )
        ) {
          const targetP2X = p1.x + rulerLength * Math.cos(angle);
          const targetP2Y = p1.y + rulerLength * Math.sin(angle);
          dx += targetP2X - p2.x;
          dy += targetP2Y - p2.y;
          needsAdjustment = true;
        }
      }

      if (needsAdjustment) {
        const newP1 = { x: p1.x + dx, y: p1.y + dy };
        const newP2 = { x: p2.x + dx, y: p2.y + dy };
        const clampedP1 = clampPointToScreen(newP1, 5);
        const clampedP2 = {
          x: clampedP1.x + rulerLength * Math.cos(angle),
          y: clampedP1.y + rulerLength * Math.sin(angle),
        };
        const clampedP2SecondTry = clampPointToScreen(newP2, 5);
        const clampedP1SecondTry = {
          x: clampedP2SecondTry.x - rulerLength * Math.cos(angle),
          y: clampedP2SecondTry.y - rulerLength * Math.sin(angle),
        };

        const finalMidX = (clampedP1.x + clampedP2.x) / 2;
        const finalMidY = (clampedP1.y + clampedP2.y) / 2;

        if (
          finalMidX >= containerRect.left &&
          finalMidX <= containerRect.left + containerRect.width &&
          finalMidY >= containerRect.top &&
          finalMidY <= containerRect.top + containerRect.height
        ) {
          return { ...prevConfig, p1: clampedP1, p2: clampedP2 };
        } else {
          const finalMidX2 = (clampedP1SecondTry.x + clampedP2SecondTry.x) / 2;
          const finalMidY2 = (clampedP1SecondTry.y + clampedP2SecondTry.y) / 2;
          if (
            finalMidX2 >= containerRect.left &&
            finalMidX2 <= containerRect.left + containerRect.width &&
            finalMidY2 >= containerRect.top &&
            finalMidY2 <= containerRect.top + containerRect.height
          ) {
            return { ...prevConfig, p1: clampedP1SecondTry, p2: clampedP2SecondTry };
          }
        }
      }
      return prevConfig;
    });
  }, [containerRect, setRulerConfig, clampPointToScreen]);

  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, handleName: "p1" | "p2" | "body", clientX: number, clientY: number) => {
    e.stopPropagation();
    setDraggingHandle(handleName);
    if (handleName === "p1") {
      setDragStartOffset({ x: clientX - rulerConfig.p1.x, y: clientY - rulerConfig.p1.y });
    } else if (handleName === "p2") {
      setDragStartOffset({ x: clientX - rulerConfig.p2.x, y: clientY - rulerConfig.p2.y });
    } else if (handleName === "body") {
      setDragStartOffset({ x: clientX - rulerConfig.p1.x, y: clientY - rulerConfig.p1.y });
    }
  };

  const handleMouseDown = (e: React.MouseEvent, handleName: "p1" | "p2" | "body") => {
    handleInteractionStart(e, handleName, e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent, handleName: "p1" | "p2" | "body") => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleInteractionStart(e, handleName, touch.clientX, touch.clientY);
    }
  };

  useEffect(() => {
    const handleGlobalMove = (clientX: number, clientY: number) => {
      if (!draggingHandle) return;

      const mouseScreenX = clientX;
      const mouseScreenY = clientY;

      if (draggingHandle === "p1") {
        setRulerConfig((prev) => ({ ...prev, p1: { x: mouseScreenX - dragStartOffset.x, y: mouseScreenY - dragStartOffset.y } }));
      } else if (draggingHandle === "p2") {
        setRulerConfig((prev) => ({ ...prev, p2: { x: mouseScreenX - dragStartOffset.x, y: mouseScreenY - dragStartOffset.y } }));
      } else if (draggingHandle === "body") {
        const newP1X = mouseScreenX - dragStartOffset.x;
        const newP1Y = mouseScreenY - dragStartOffset.y;
        const dx = newP1X - rulerConfig.p1.x;
        const dy = newP1Y - rulerConfig.p1.y;
        setRulerConfig((prev) => ({
          ...prev,
          p1: { x: newP1X, y: newP1Y },
          p2: { x: prev.p2.x + dx, y: prev.p2.y + dy },
        }));
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => handleGlobalMove(e.clientX, e.clientY);
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        handleGlobalMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalUp = () => {
      setDraggingHandle(null);
      adjustRulerToBeOnScreen(); // Adjust position on drag end
    };

    if (draggingHandle) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalUp);
      document.addEventListener("touchmove", handleGlobalTouchMove, { passive: false });
      document.addEventListener("touchend", handleGlobalUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalUp);
      document.removeEventListener("touchmove", handleGlobalTouchMove);
      document.removeEventListener("touchend", handleGlobalUp);
    };
  }, [draggingHandle, dragStartOffset, setRulerConfig, rulerConfig.p1, rulerConfig.p2, adjustRulerToBeOnScreen]);

  useEffect(() => {
    if (rulerConfig.active && containerRect) {
      const midX = (rulerConfig.p1.x + rulerConfig.p2.x) / 2;
      const midY = (rulerConfig.p1.y + rulerConfig.p2.y) / 2;
      const safetyMargin = 100;
      if (
        midX < containerRect.left - safetyMargin ||
        midX > containerRect.left + containerRect.width + safetyMargin ||
        midY < containerRect.top - safetyMargin ||
        midY > containerRect.top + containerRect.height + safetyMargin
      ) {
        adjustRulerToBeOnScreen();
      }
    }
  }, [rulerConfig.active, containerRect, adjustRulerToBeOnScreen, rulerConfig.p1, rulerConfig.p2]);

  const p1Screen = rulerConfig.p1;
  const p2Screen = rulerConfig.p2;

  const dxScreen = p2Screen.x - p1Screen.x;
  const dyScreen = p2Screen.y - p1Screen.y;
  const lengthScreen = Math.sqrt(dxScreen * dxScreen + dyScreen * dyScreen);
  const angleDeg = Math.atan2(dyScreen, dxScreen) * (180 / Math.PI);

  const rulerVisualThickness = RULER_THICKNESS_SCREEN;

  // --- Tick Calculation Logic ---
  let tickIntervalWorld: number;
  const targetScreenMinorTickSpacing = 15;
  const rawWorldInterval = targetScreenMinorTickSpacing / zoomLevel;

  const E10 = Math.pow(10, Math.floor(Math.log10(rawWorldInterval)));
  if (rawWorldInterval / E10 >= 5) tickIntervalWorld = 5 * E10;
  else if (rawWorldInterval / E10 >= 2.5) tickIntervalWorld = 2.5 * E10;
  else if (rawWorldInterval / E10 >= 2) tickIntervalWorld = 2 * E10;
  else tickIntervalWorld = 1 * E10;

  if (tickIntervalWorld <= 0) tickIntervalWorld = 1;

  let currentTickScreenSpacing = tickIntervalWorld * zoomLevel;
  if (currentTickScreenSpacing < 7 && E10 > 0) {
    if (tickIntervalWorld === 1 * E10) {
      tickIntervalWorld = 2 * E10;
    } else if (tickIntervalWorld === 2 * E10) {
      tickIntervalWorld = 2.5 * E10;
    } else if (tickIntervalWorld === 2.5 * E10) {
      tickIntervalWorld = 5 * E10;
    } else if (tickIntervalWorld === 5 * E10) {
      tickIntervalWorld = 10 * E10;
    }
    currentTickScreenSpacing = tickIntervalWorld * zoomLevel;
  }
  if (tickIntervalWorld <= 0 || currentTickScreenSpacing <= 0) {
    tickIntervalWorld = 10 / zoomLevel;
    currentTickScreenSpacing = 10;
  }

  const numTicks = currentTickScreenSpacing > 1 && lengthScreen > 0 ? Math.floor(lengthScreen / currentTickScreenSpacing) : 0;

  const targetScreenMajorTickSpacing = Math.max(50, 3 * currentTickScreenSpacing);
  let numMinorTicksPerMajor = Math.round(targetScreenMajorTickSpacing / currentTickScreenSpacing);
  if (numMinorTicksPerMajor <= 0) numMinorTicksPerMajor = 1;

  if (numMinorTicksPerMajor === 3) numMinorTicksPerMajor = currentTickScreenSpacing * 4 < targetScreenMajorTickSpacing * 1.2 ? 4 : 5;
  else if (numMinorTicksPerMajor > 5 && numMinorTicksPerMajor < 8) numMinorTicksPerMajor = 5;
  else if (numMinorTicksPerMajor >= 8 && numMinorTicksPerMajor < 12) numMinorTicksPerMajor = 10;

  let tickLabelPrecision = 0;
  if (tickIntervalWorld < 0.01) tickLabelPrecision = 3;
  else if (tickIntervalWorld < 0.1) tickLabelPrecision = 2;
  else if (tickIntervalWorld < 1) tickLabelPrecision = 1;

  // --- Visuals ---
  const rulerBodyFillColor = "rgba(240, 240, 240, 0.4)";
  const rulerBodyStrokeColor = "rgba(180, 180, 180, 0.6)";
  const tickStrokeColor = "rgba(60, 60, 60, 0.4)";
  const labelFillColor = "rgba(60, 60, 60, 0.6)";

  const fixedFontSize = 10;
  const minorTickStrokeWidth = 0.5;
  const majorTickStrokeWidth = 1;
  const bodyStrokeWidth = 1;

  const minorTickLengthRatio = 0.1;
  const majorTickLengthRatio = 0.2;

  return (
    <svg ref={ref} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 10000, userSelect: "none" }}>
      <g transform={`translate(${p1Screen.x - containerRect.left}, ${p1Screen.y - containerRect.top}) rotate(${angleDeg})`}>
        <rect
          x="0"
          y="0"
          width={lengthScreen}
          height={rulerVisualThickness}
          fill={rulerBodyFillColor}
          stroke={rulerBodyStrokeColor}
          strokeWidth={bodyStrokeWidth}
          className="cursor-move"
          pointerEvents="auto"
          onMouseDown={(e) => handleMouseDown(e, "body")}
          onTouchStart={(e) => handleTouchStart(e, "body")}
        />
        {Array.from({ length: numTicks + 1 }).map((_, i) => {
          const posScreenRelative = i * currentTickScreenSpacing;
          if (posScreenRelative > lengthScreen + 0.1 && lengthScreen >= 0) return null;

          const isMajorTick = i % numMinorTicksPerMajor === 0;

          const tickLengthRatio = isMajorTick ? majorTickLengthRatio : minorTickLengthRatio;
          const tickActualLength = rulerVisualThickness * tickLengthRatio;

          return (
            <g key={`tick-group-${i}`}>
              <line
                x1={posScreenRelative}
                y1="0"
                x2={posScreenRelative}
                y2={tickActualLength}
                stroke={tickStrokeColor}
                strokeWidth={isMajorTick ? majorTickStrokeWidth : minorTickStrokeWidth}
              />
              {isMajorTick && (
                <text x={posScreenRelative + 3} y={3} fill={labelFillColor} fontSize={`${fixedFontSize}px`} textAnchor="start" dominantBaseline="hanging">
                  {(i * tickIntervalWorld).toFixed(tickLabelPrecision)}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <circle
        cx={p1Screen.x - containerRect.left}
        cy={p1Screen.y - containerRect.top}
        r={6}
        fill="rgba(0, 122, 255, 0.8)"
        stroke="white"
        strokeWidth="1"
        className="cursor-grab active:cursor-grabbing"
        pointerEvents="all"
        onMouseDown={(e) => handleMouseDown(e, "p1")}
        onTouchStart={(e) => handleTouchStart(e, "p1")}
      />
      <circle
        cx={p2Screen.x - containerRect.left}
        cy={p2Screen.y - containerRect.top}
        r={6}
        fill="rgba(0, 122, 255, 0.8)"
        stroke="white"
        strokeWidth="1"
        className="cursor-grab active:cursor-grabbing"
        pointerEvents="all"
        onMouseDown={(e) => handleMouseDown(e, "p2")}
        onTouchStart={(e) => handleTouchStart(e, "p2")}
      />
    </svg>
  );
});

export default CanvasRuler;
