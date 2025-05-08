// src/components/DrawLine.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Point, PanOffset, ContainerRect, PenToolType, ItemType, DrawLineData } from "./constants";
import { HIGHLIGHTER_THICKNESS } from "./constants";

interface LineDragStartInfo {
  screenX: number;
  screenY: number;
  pointsStart: Point[];
}

interface DrawLineProps {
  line: DrawLineData;
  isSelected: boolean;
  onSelect: (type: ItemType, id: number) => void;
  onUpdate: (updatedLine: DrawLineData, isTemporary?: boolean) => void;
  panOffset: PanOffset;
  zoomLevel: number;
  currentPenType: PenToolType | "";
  onItemEraserClick: (itemType: ItemType, itemId: number) => void;
  containerRect: ContainerRect | null;
  isPinchZooming: boolean;
}

interface BoundingBox {
  svgTransformX: number;
  svgTransformY: number;
  width: number;
  height: number;
}

const screenToWorld = (screenX: number, screenY: number, panOffset: PanOffset, zoomLevel: number, containerRect: ContainerRect | null): Point => {
  if (!containerRect) return { x: 0, y: 0 };
  return {
    x: (screenX - containerRect.left) / zoomLevel + panOffset.x,
    y: (screenY - containerRect.top) / zoomLevel + panOffset.y,
  };
};

const worldToCanvasLocal = (worldX: number, worldY: number, panOffset: PanOffset, zoomLevel: number): Point => {
  return {
    x: (worldX - panOffset.x) * zoomLevel,
    y: (worldY - panOffset.y) * zoomLevel,
  };
};

function distanceSq(p1: Point, p2: Point): number {
  return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
}

function distancePointToSegment(p: Point, s1: Point, s2: Point): number {
  const l2 = distanceSq(s1, s2);
  if (l2 === 0) return Math.sqrt(distanceSq(p, s1));

  let t = ((p.x - s1.x) * (s2.x - s1.x) + (p.y - s1.y) * (s2.y - s1.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  const closestPoint: Point = {
    x: s1.x + t * (s2.x - s1.x),
    y: s1.y + t * (s2.y - s1.y),
  };

  return Math.sqrt(distanceSq(p, closestPoint));
}

const DrawLine: React.FC<DrawLineProps> = ({
  line,
  isSelected,
  onSelect,
  onUpdate,
  panOffset,
  zoomLevel,
  currentPenType,
  onItemEraserClick,
  containerRect,
  isPinchZooming,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<LineDragStartInfo>({ screenX: 0, screenY: 0, pointsStart: [] });

  useEffect(() => {
    if (isPinchZooming && isDragging) {
      setIsDragging(false);
    }
  }, [isPinchZooming, isDragging]);

  const getBoundingBoxForSVGTransform = useCallback(
    (currentPointsInWorld: Point[]): BoundingBox => {
      if (!currentPointsInWorld || currentPointsInWorld.length === 0) return { svgTransformX: 0, svgTransformY: 0, width: 0, height: 0 };
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      currentPointsInWorld.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });

      const basePadding = line.penType === "highlighter" ? HIGHLIGHTER_THICKNESS / 2 : line.width || 2;
      const paddingWorld = basePadding + 15;

      const worldBoundingBoxX = minX - paddingWorld;
      const worldBoundingBoxY = minY - paddingWorld;
      const worldBoundingBoxWidth = maxX - minX + paddingWorld * 2;
      const worldBoundingBoxHeight = maxY - minY + paddingWorld * 2;

      const screenPos = worldToCanvasLocal(worldBoundingBoxX, worldBoundingBoxY, panOffset, zoomLevel);

      return {
        svgTransformX: screenPos.x,
        svgTransformY: screenPos.y,
        width: worldBoundingBoxWidth * zoomLevel,
        height: worldBoundingBoxHeight * zoomLevel,
      };
    },
    [line.width, line.penType, panOffset.x, panOffset.y, zoomLevel]
  );

  const [boundingBox, setBoundingBox] = useState<BoundingBox>(getBoundingBoxForSVGTransform(line.points));

  useEffect(() => {
    setBoundingBox(getBoundingBoxForSVGTransform(line.points));
  }, [line.points, line.width, line.penType, panOffset, zoomLevel, getBoundingBoxForSVGTransform]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinchZooming || currentPenType !== "") return;
    if (!line.isSelected) {
      onSelect("line", line.id);
    }
  };

  const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => {
    if (isPinchZooming) return;

    e.stopPropagation();
    if (currentPenType === "eraser" && containerRect) {
      const worldClick = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);
      for (let i = 0; i < line.points.length - 1; i++) {
        const p1 = line.points[i];
        const p2 = line.points[i + 1];
        const dist = distancePointToSegment(worldClick, p1, p2);
        const lineThicknessWorld = line.penType === "highlighter" ? HIGHLIGHTER_THICKNESS : line.width || 2;
        const eraserToleranceWorld = 5;

        if (dist < lineThicknessWorld / 2 + eraserToleranceWorld) {
          onItemEraserClick("line", line.id);
          return;
        }
      }
      return;
    }
    setIsDragging(true);
    setDragStart({ screenX: clientX, screenY: clientY, pointsStart: line.points.map((p) => ({ ...p })) });
    if (!line.isSelected) {
      onSelect("line", line.id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => handleInteractionStart(e, e.clientX, e.clientY);
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleInteractionStart(e, touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const worldDx = (e.clientX - dragStart.screenX) / zoomLevel;
      const worldDy = (e.clientY - dragStart.screenY) / zoomLevel;
      const newPoints = dragStart.pointsStart.map((p) => ({ x: p.x + worldDx, y: p.y + worldDy }));
      onUpdate({ ...line, points: newPoints }, true);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const worldDx = (touch.clientX - dragStart.screenX) / zoomLevel;
      const worldDy = (touch.clientY - dragStart.screenY) / zoomLevel;
      const newPoints = dragStart.pointsStart.map((p) => ({ x: p.x + worldDx, y: p.y + worldDy }));
      onUpdate({ ...line, points: newPoints }, true);
    };
    const handleMouseUpOrTouchEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      onUpdate({ ...line, points: line.points }, false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUpOrTouchEnd);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleMouseUpOrTouchEnd);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUpOrTouchEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleMouseUpOrTouchEnd);
    };
  }, [isDragging, dragStart, line, onUpdate, zoomLevel]);

  const getPathDataForSVG = () => {
    if (!line.points || line.points.length < 2) return "";
    const firstP = worldToCanvasLocal(line.points[0].x, line.points[0].y, panOffset, zoomLevel);
    let d = `M ${(firstP.x - boundingBox.svgTransformX) / zoomLevel} ${(firstP.y - boundingBox.svgTransformY) / zoomLevel}`;
    for (let i = 1; i < line.points.length; i++) {
      const p = worldToCanvasLocal(line.points[i].x, line.points[i].y, panOffset, zoomLevel);
      d += ` L ${(p.x - boundingBox.svgTransformX) / zoomLevel} ${(p.y - boundingBox.svgTransformY) / zoomLevel}`;
    }
    return d;
  };

  if (!line.points || line.points.length < 2) return null;

  const strokeOpacity = line.penType === "highlighter" ? 0.4 : 1;
  const effectiveStrokeWidth = line.penType === "highlighter" ? HIGHLIGHTER_THICKNESS : line.width || 2;
  const strokeLineCap = line.penType === "highlighter" ? "butt" : "round";

  return (
    <svg
      ref={svgRef}
      id={`line-${line.id}`}
      className="absolute"
      style={{
        transform: `translate(${boundingBox.svgTransformX}px, ${boundingBox.svgTransformY}px) scale(${zoomLevel})`,
        transformOrigin: "top left",
        width: `${Math.max(1, boundingBox.width / zoomLevel)}px`,
        height: `${Math.max(1, boundingBox.height / zoomLevel)}px`,
        zIndex: line.zIndex,
        overflow: "visible",
        pointerEvents: "none",
      }}
      onClick={handleClick}
    >
      <path
        d={getPathDataForSVG()}
        stroke="transparent"
        strokeWidth={effectiveStrokeWidth + 20 / zoomLevel}
        fill="none"
        strokeLinecap={strokeLineCap as "butt" | "round" | "square" | undefined}
        strokeLinejoin="round"
        style={{
          pointerEvents: "stroke",
          cursor: currentPenType === "eraser" ? "alias" : isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />
      <path
        d={getPathDataForSVG()}
        stroke={line.color || "#FFCC00"}
        strokeWidth={effectiveStrokeWidth}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap={strokeLineCap as "butt" | "round" | "square" | undefined}
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      />
      {isSelected && currentPenType !== "eraser" && (
        <path
          d={getPathDataForSVG()}
          stroke="rgba(0, 122, 255, 0.5)"
          strokeWidth={effectiveStrokeWidth + 10 / zoomLevel}
          fill="none"
          strokeLinecap={strokeLineCap as "butt" | "round" | "square" | undefined}
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
};

export default DrawLine;
