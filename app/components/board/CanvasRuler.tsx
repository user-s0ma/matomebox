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

interface RulerDragStartInfo {
  type: "p1" | "p2" | "body";
  initialMouseX: number;
  initialMouseY: number;
  initialP1: Point;
  initialP2: Point;
  handleDragOffset?: Point;
}

const CanvasRuler = React.forwardRef<SVGSVGElement, CanvasRulerProps>(({ zoomLevel, rulerConfig, setRulerConfig, containerRect }, ref) => {
  if (!rulerConfig.active || !containerRect) return null;

  const [draggingHandle, setDraggingHandle] = useState<"p1" | "p2" | "body" | null>(null);
  const [dragStartInfo, setDragStartInfo] = useState<RulerDragStartInfo | null>(null);

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
    if (!containerRect || draggingHandle) return;

    setRulerConfig((prevConfig) => {
      let { p1, p2 } = prevConfig;
      const rulerLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      if (rulerLength === 0) return prevConfig;
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

      const isP1OnScreen = p1.x >= containerRect.left && p1.x <= containerRect.right && p1.y >= containerRect.top && p1.y <= containerRect.bottom;
      const isP2OnScreen = p2.x >= containerRect.left && p2.x <= containerRect.right && p2.y >= containerRect.top && p2.y <= containerRect.bottom;

      if (!isP1OnScreen && !isP2OnScreen && !needsAdjustment) {
        const targetMidX = containerRect.left + containerRect.width / 2;
        const targetMidY = containerRect.top + containerRect.height / 2;
        dx = targetMidX - midX;
        dy = targetMidY - midY;
        needsAdjustment = true;
      }

      if (needsAdjustment) {
        const newP1Base = { x: p1.x + dx, y: p1.y + dy };
        const newP2Base = { x: p2.x + dx, y: p2.y + dy };

        const clampedP1 = clampPointToScreen(newP1Base, 5);
        const finalP2FromClampedP1 = {
          x: clampedP1.x + rulerLength * Math.cos(angle),
          y: clampedP1.y + rulerLength * Math.sin(angle),
        };

        const clampedP2 = clampPointToScreen(newP2Base, 5);
        const finalP1FromClampedP2 = {
          x: clampedP2.x - rulerLength * Math.cos(angle),
          y: clampedP2.y - rulerLength * Math.sin(angle),
        };

        const p2ViaP1MidX = (clampedP1.x + finalP2FromClampedP1.x) / 2;
        const p2ViaP1MidY = (clampedP1.y + finalP2FromClampedP1.y) / 2;
        const isP2ViaP1Valid =
          p2ViaP1MidX >= containerRect.left && p2ViaP1MidX <= containerRect.right && p2ViaP1MidY >= containerRect.top && p2ViaP1MidY <= containerRect.bottom;

        const p1ViaP2MidX = (finalP1FromClampedP2.x + clampedP2.x) / 2;
        const p1ViaP2MidY = (finalP1FromClampedP2.y + clampedP2.y) / 2;
        const isP1ViaP2Valid =
          p1ViaP2MidX >= containerRect.left && p1ViaP2MidX <= containerRect.right && p1ViaP2MidY >= containerRect.top && p1ViaP2MidY <= containerRect.bottom;

        if (isP2ViaP1Valid) {
          return { ...prevConfig, p1: clampedP1, p2: finalP2FromClampedP1 };
        } else if (isP1ViaP2Valid) {
          return { ...prevConfig, p1: finalP1FromClampedP2, p2: clampedP2 };
        } else {
          return { ...prevConfig, p1: clampedP1, p2: finalP2FromClampedP1 };
        }
      }
      return prevConfig;
    });
  }, [containerRect, setRulerConfig, clampPointToScreen, draggingHandle]);

  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, handleName: "p1" | "p2" | "body", clientX: number, clientY: number) => {
    e.stopPropagation();
    setDraggingHandle(handleName);

    const currentP1 = rulerConfig.p1;
    const currentP2 = rulerConfig.p2;

    if (handleName === "body") {
      setDragStartInfo({
        type: "body",
        initialMouseX: clientX,
        initialMouseY: clientY,
        initialP1: currentP1,
        initialP2: currentP2,
      });
    } else if (handleName === "p1") {
      setDragStartInfo({
        type: "p1",
        initialMouseX: clientX,
        initialMouseY: clientY,
        initialP1: currentP1,
        initialP2: currentP2,
        handleDragOffset: { x: clientX - currentP1.x, y: clientY - currentP1.y },
      });
    } else if (handleName === "p2") {
      setDragStartInfo({
        type: "p2",
        initialMouseX: clientX,
        initialMouseY: clientY,
        initialP1: currentP1,
        initialP2: currentP2,
        handleDragOffset: { x: clientX - currentP2.x, y: clientY - currentP2.y },
      });
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
      if (!draggingHandle || !dragStartInfo) return;

      const mouseScreenX = clientX;
      const mouseScreenY = clientY;

      if (dragStartInfo.type === "body") {
        const mouseDeltaX = mouseScreenX - dragStartInfo.initialMouseX;
        const mouseDeltaY = mouseScreenY - dragStartInfo.initialMouseY;
        const newP1 = {
          x: dragStartInfo.initialP1.x + mouseDeltaX,
          y: dragStartInfo.initialP1.y + mouseDeltaY,
        };
        const newP2 = {
          x: dragStartInfo.initialP2.x + mouseDeltaX,
          y: dragStartInfo.initialP2.y + mouseDeltaY,
        };
        setRulerConfig((prev) => ({ ...prev, p1: newP1, p2: newP2 }));
      } else if (dragStartInfo.type === "p1" && dragStartInfo.handleDragOffset) {
        const newP1X = mouseScreenX - dragStartInfo.handleDragOffset.x;
        const newP1Y = mouseScreenY - dragStartInfo.handleDragOffset.y;
        setRulerConfig((prev) => ({ ...prev, p1: { x: newP1X, y: newP1Y } }));
      } else if (dragStartInfo.type === "p2" && dragStartInfo.handleDragOffset) {
        const newP2X = mouseScreenX - dragStartInfo.handleDragOffset.x;
        const newP2Y = mouseScreenY - dragStartInfo.handleDragOffset.y;
        setRulerConfig((prev) => ({ ...prev, p2: { x: newP2X, y: newP2Y } }));
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
      setDragStartInfo(null);
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
  }, [draggingHandle, dragStartInfo, setRulerConfig]);

  useEffect(() => {
    if (!draggingHandle && rulerConfig.active && containerRect) {
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
  }, [draggingHandle, rulerConfig.active, containerRect, adjustRulerToBeOnScreen, rulerConfig.p1, rulerConfig.p2]);

  const p1Screen = rulerConfig.p1;
  const p2Screen = rulerConfig.p2;

  const dxScreen = p2Screen.x - p1Screen.x;
  const dyScreen = p2Screen.y - p1Screen.y;
  const angleRad = Math.atan2(dyScreen, dxScreen);
  const angleDeg = angleRad * (180 / Math.PI);

  const rulerVisualThickness = RULER_THICKNESS_SCREEN;

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
    if (tickIntervalWorld === 1 * E10) tickIntervalWorld = 2 * E10;
    else if (tickIntervalWorld === 2 * E10) tickIntervalWorld = 2.5 * E10;
    else if (tickIntervalWorld === 2.5 * E10) tickIntervalWorld = 5 * E10;
    else if (tickIntervalWorld === 5 * E10) tickIntervalWorld = 10 * E10;
    currentTickScreenSpacing = tickIntervalWorld * zoomLevel;
  }

  if (tickIntervalWorld <= 0 || currentTickScreenSpacing <= 0.1 || isNaN(currentTickScreenSpacing)) {
    tickIntervalWorld = 10 / zoomLevel;
    currentTickScreenSpacing = 10;
  }

  const cos_a = Math.cos(angleRad);
  const sin_a = Math.sin(angleRad);

  const svgScreenCorners = [
    { x: 0, y: 0 },
    { x: containerRect.width, y: 0 },
    { x: containerRect.width, y: containerRect.height },
    { x: 0, y: containerRect.height },
  ];

  const svgP1X = p1Screen.x - containerRect.left;
  const svgP1Y = p1Screen.y - containerRect.top;

  const localXCoords = svgScreenCorners.map((corner) => {
    const dSvgX = corner.x - svgP1X;
    const dSvgY = corner.y - svgP1Y;
    return dSvgX * cos_a + dSvgY * sin_a;
  });

  const minVisibleLocalX = Math.min(...localXCoords);
  const maxVisibleLocalX = Math.max(...localXCoords);

  const tickMargin = 2;
  const startTickIndex = Math.floor(minVisibleLocalX / currentTickScreenSpacing) - tickMargin;
  const endTickIndex = Math.ceil(maxVisibleLocalX / currentTickScreenSpacing) + tickMargin;

  const rulerBodyX = startTickIndex * currentTickScreenSpacing - currentTickScreenSpacing / 2;
  const rulerBodyWidth = (endTickIndex - startTickIndex + 1) * currentTickScreenSpacing;

  const targetScreenMajorTickSpacing = Math.max(50, 3 * currentTickScreenSpacing);
  let numMinorTicksPerMajor = Math.round(targetScreenMajorTickSpacing / currentTickScreenSpacing);
  if (numMinorTicksPerMajor <= 0) numMinorTicksPerMajor = 1;
  if (numMinorTicksPerMajor === 3) numMinorTicksPerMajor = currentTickScreenSpacing * 4 < targetScreenMajorTickSpacing * 1.2 ? 4 : 5;
  else if (numMinorTicksPerMajor > 5 && numMinorTicksPerMajor < 8) numMinorTicksPerMajor = 5;
  else if (numMinorTicksPerMajor >= 8 && numMinorTicksPerMajor < 12) numMinorTicksPerMajor = 10;

  let tickLabelPrecision = 0;
  if (tickIntervalWorld < 0.001) tickLabelPrecision = 4;
  else if (tickIntervalWorld < 0.01) tickLabelPrecision = 3;
  else if (tickIntervalWorld < 0.1) tickLabelPrecision = 2;
  else if (tickIntervalWorld < 1) tickLabelPrecision = 1;

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

  const ticks = [];
  if (currentTickScreenSpacing > 0.1 && endTickIndex >= startTickIndex) {
    for (let i = startTickIndex; i <= endTickIndex; i++) {
      const posLocalX = i * currentTickScreenSpacing; // Position on the ruler's local X-axis
      const isMajorTick = numMinorTicksPerMajor > 0 ? i % numMinorTicksPerMajor === 0 : true;
      const tickLengthRatio = isMajorTick ? majorTickLengthRatio : minorTickLengthRatio;
      const tickActualLength = rulerVisualThickness * tickLengthRatio;

      ticks.push(
        <g key={`tick-group-${i}`}>
          <line
            x1={posLocalX}
            y1="0"
            x2={posLocalX}
            y2={tickActualLength}
            stroke={tickStrokeColor}
            strokeWidth={isMajorTick ? majorTickStrokeWidth : minorTickStrokeWidth}
          />
          {isMajorTick && (
            <text
              x={posLocalX + 3}
              y={tickActualLength + 3}
              fill={labelFillColor}
              fontSize={`${fixedFontSize}px`}
              textAnchor="start"
              dominantBaseline="hanging"
            >
              {(i * tickIntervalWorld).toFixed(tickLabelPrecision)}
            </text>
          )}
        </g>
      );
    }
  }

  return (
    <svg ref={ref} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 10000, userSelect: "none" }}>
      <g transform={`translate(${svgP1X}, ${svgP1Y}) rotate(${angleDeg})`}>
        <rect
          x={rulerBodyX}
          y="0"
          width={rulerBodyWidth}
          height={rulerVisualThickness}
          fill={rulerBodyFillColor}
          stroke={rulerBodyStrokeColor}
          strokeWidth={bodyStrokeWidth}
          className="cursor-move"
          pointerEvents="auto"
          onMouseDown={(e) => handleMouseDown(e, "body")}
          onTouchStart={(e) => handleTouchStart(e, "body")}
        />
        {ticks}
      </g>
      <circle
        cx={svgP1X}
        cy={svgP1Y}
        r="6"
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
        r="6"
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
