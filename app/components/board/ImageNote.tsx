// src/components/ImageNote.tsx
import React, { useState, useEffect, useRef } from "react";
import type { Point, PanOffset, ContainerRect, ItemType, ImageItemData, PenToolType } from "./constants";

interface DragStartInfo {
  screenX: number;
  screenY: number;
  itemStartX: number;
  itemStartY: number;
}

interface ImageResizeStartInfo {
  screenX: number;
  screenY: number;
  initialWidth: number;
  initialHeight: number;
  aspectRatio: number;
}

interface ImageNoteProps {
  image: ImageItemData;
  onUpdate: (updatedImage: ImageItemData, isTemporary?: boolean) => void;
  onSelectItem: (type: ItemType, id: number) => void;
  panOffset: PanOffset;
  zoomLevel: number;
  currentPenType: PenToolType | "";
  isPinchZooming: boolean;
}

const worldToCanvasLocal = (worldX: number, worldY: number, panOffset: PanOffset, zoomLevel: number): Point => {
  return {
    x: (worldX - panOffset.x) * zoomLevel,
    y: (worldY - panOffset.y) * zoomLevel,
  };
};

const ImageNote: React.FC<ImageNoteProps> = ({ image, onUpdate, onSelectItem, panOffset, zoomLevel, currentPenType, isPinchZooming }) => {
  const imageRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<DragStartInfo>({ screenX: 0, screenY: 0, itemStartX: 0, itemStartY: 0 });
  const [showBorder, setShowBorder] = useState(false);
  const [size, setSize] = useState({ width: image.width, height: image.height });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<ImageResizeStartInfo | null>(null);

  useEffect(() => {
    setSize({ width: image.width, height: image.height });
  }, [image.width, image.height]);

  useEffect(() => {
    setShowBorder(image.isSelected && currentPenType === "");
  }, [image.isSelected, currentPenType]);

  useEffect(() => {
    if (!image.isSelected && isResizing) {
      setIsResizing(false);
    }
  }, [image.isSelected, isResizing]);

  useEffect(() => {
    if (isPinchZooming) {
      if (isDragging) setIsDragging(false);
      if (isResizing) setIsResizing(false);
    }
  }, [isPinchZooming, isDragging, isResizing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinchZooming || currentPenType !== "") return;
    if (!image.isSelected) {
      onSelectItem("image", image.id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPinchZooming || currentPenType !== "" || isResizing || (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle-img"))) {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ screenX: e.clientX, screenY: e.clientY, itemStartX: image.x, itemStartY: image.y });
    if (!image.isSelected) {
      onSelectItem("image", image.id);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isPinchZooming || currentPenType !== "" || isResizing || (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle-img"))) {
      return;
    }
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ screenX: touch.clientX, screenY: touch.clientY, itemStartX: image.x, itemStartY: image.y });
    if (!image.isSelected) {
      onSelectItem("image", image.id);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (isPinchZooming || currentPenType !== "") return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      screenX: e.clientX,
      screenY: e.clientY,
      initialWidth: size.width,
      initialHeight: size.height,
      aspectRatio: size.width / size.height || 1,
    });
  };

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    if (isPinchZooming || currentPenType !== "") return;
    e.stopPropagation();
    e.preventDefault();
    const touch = e.touches[0];
    setIsResizing(true);
    setResizeStart({
      screenX: touch.clientX,
      screenY: touch.clientY,
      initialWidth: size.width,
      initialHeight: size.height,
      aspectRatio: size.width / size.height || 1,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeStart) {
        const worldDx = (e.clientX - resizeStart.screenX) / zoomLevel;

        let newWidth = resizeStart.initialWidth + worldDx;
        newWidth = Math.max(50 / zoomLevel, newWidth);
        const newHeight = resizeStart.aspectRatio ? newWidth / resizeStart.aspectRatio : resizeStart.initialHeight;

        setSize({ width: newWidth, height: newHeight });
        onUpdate({ ...image, width: newWidth, height: newHeight }, true);
      } else if (isDragging) {
        const worldDxDrag = (e.clientX - dragStart.screenX) / zoomLevel;
        const worldDyDrag = (e.clientY - dragStart.screenY) / zoomLevel;
        onUpdate({ ...image, x: dragStart.itemStartX + worldDxDrag, y: dragStart.itemStartY + worldDyDrag }, true);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (isResizing && resizeStart) {
        if (e.cancelable) e.preventDefault();
        const worldDx = (touch.clientX - resizeStart.screenX) / zoomLevel;
        let newWidth = resizeStart.initialWidth + worldDx;
        newWidth = Math.max(50 / zoomLevel, newWidth);
        const newHeight = resizeStart.aspectRatio ? newWidth / resizeStart.aspectRatio : resizeStart.initialHeight;
        setSize({ width: newWidth, height: newHeight });
        onUpdate({ ...image, width: newWidth, height: newHeight }, true);
      } else if (isDragging) {
        if (e.cancelable) e.preventDefault();
        const worldDxDrag = (touch.clientX - dragStart.screenX) / zoomLevel;
        const worldDyDrag = (touch.clientY - dragStart.screenY) / zoomLevel;
        onUpdate({ ...image, x: dragStart.itemStartX + worldDxDrag, y: dragStart.itemStartY + worldDyDrag }, true);
      }
    };

    const handleMouseUpOrTouchEnd = () => {
      if (isResizing) {
        setIsResizing(false);
        setResizeStart(null);
        onUpdate({ ...image, width: size.width, height: size.height }, false);
      }
      if (isDragging) {
        setIsDragging(false);
        onUpdate({ ...image }, false);
      }
    };

    if (isDragging || isResizing) {
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
  }, [isDragging, isResizing, dragStart, resizeStart, size, image, onUpdate, zoomLevel]);

  const screenPos = worldToCanvasLocal(image.x, image.y, panOffset, zoomLevel);
  const cursorStyle = currentPenType !== "" ? "auto" : isResizing ? "nwse-resize" : isDragging ? "grabbing" : "grab";

  return (
    <div
      ref={imageRef}
      id={`image-${image.id}`}
      className={`absolute group
                  ${showBorder ? "ring-1 ring-blue-500" : "ring-1 ring-transparent hover:ring-gray-400"}
                  ${isDragging ? "shadow-2xl" : ""}`}
      style={{
        transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
        transformOrigin: "top left",
        width: `${size.width * zoomLevel}px`,
        height: `${size.height * zoomLevel}px`,
        zIndex: image.zIndex,
        cursor: cursorStyle,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <img src={image.src} alt={`Image item ${image.id}`} className="w-full h-full object-contain select-none pointer-events-none" draggable="false" />
      {showBorder && (
        <div
          className="resize-handle-img w-3 h-3 absolute rounded-full bg-blue-500 border border-white"
          style={{
            bottom: "-6px",
            right: "-6px",
            cursor: "nwse-resize",
            zIndex: (image.zIndex || 0) + 1,
          }}
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleResizeTouchStart}
        />
      )}
    </div>
  );
};

export default ImageNote;
