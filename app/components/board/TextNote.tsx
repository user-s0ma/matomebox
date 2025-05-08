// src/components/TextNote.tsx
import React, { useState, useEffect, useRef } from "react";
import type { Point, PanOffset, ContainerRect, ItemType, PenToolType, TextNoteData } from "./constants";

// --- Types for TextNote ---
interface DragStartInfo {
  screenX: number;
  screenY: number;
  itemStartX: number;
  itemStartY: number;
}

interface TextResizeStartInfo {
  screenX: number;
  initialWidth: number;
  itemInitialX: number;
}

interface TextNoteProps {
  text: TextNoteData;
  onUpdate: (updatedText: TextNoteData, isTemporary?: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelectItem: (type: ItemType, id: number) => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  panOffset: PanOffset;
  zoomLevel: number;
  currentPenType: PenToolType | "";
  onItemEraserClick: (itemType: ItemType, itemId: number) => void;
  containerRect: ContainerRect | null;
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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const isPointInRect = (point: Point, rect: Rect): boolean => {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
};

const TextNote: React.FC<TextNoteProps> = ({
  text,
  onUpdate,
  onSelectItem,
  isEditing,
  onEdit,
  onSave,
  panOffset,
  zoomLevel,
  currentPenType,
  onItemEraserClick,
  containerRect,
}) => {
  const [content, setContent] = useState(text.content);
  const textRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<DragStartInfo>({ screenX: 0, screenY: 0, itemStartX: 0, itemStartY: 0 });
  const [showBorder, setShowBorder] = useState(false);
  const [size, setSize] = useState({ width: text.width || 250, height: text.height || "auto" });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<TextResizeStartInfo>({ screenX: 0, initialWidth: 0, itemInitialX: 0 });

  useEffect(() => {
    if (isEditing) {
      setContent(text.content);
    }
  }, [isEditing, text.content]);

  useEffect(() => {
    setSize({ width: text.width || 250, height: text.height || "auto" });
  }, [text.width, text.height]);

  useEffect(() => {
    setShowBorder(text.isSelected && !isEditing && currentPenType !== "eraser" && currentPenType === "");
  }, [text.isSelected, isEditing, currentPenType]);

  useEffect(() => {
    if ((!text.isSelected || isEditing) && isResizing) {
      setIsResizing(false);
    }
  }, [text.isSelected, isEditing, isResizing]);

  const handleContentChange = (newContent: string) => setContent(newContent);
  const handleTextareaBlur = () => {
    onUpdate({ ...text, content });
    if (onSave) onSave();
  };
  const handleEditLocal = () => {
    if (onEdit) onEdit();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (currentPenType !== "" || isEditing) {
      return;
    }
    onSelectItem("text", text.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentPenType !== "" || isEditing || isResizing || (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle"))) {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ screenX: e.clientX, screenY: e.clientY, itemStartX: text.x, itemStartY: text.y });
    if (!text.isSelected) {
      onSelectItem("text", text.id);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (currentPenType !== "" || isEditing || isResizing || (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle"))) {
      return;
    }
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ screenX: touch.clientX, screenY: touch.clientY, itemStartX: text.x, itemStartY: text.y });
    if (!text.isSelected) {
      onSelectItem("text", text.id);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handleType: string) => {
    if (currentPenType !== "" || isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handleType);
    setResizeStart({ screenX: e.clientX, initialWidth: size.width, itemInitialX: text.x });
  };
  const handleResizeTouchStart = (e: React.TouchEvent, handleType: string) => {
    if (currentPenType !== "" || isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    const touch = e.touches[0];
    setIsResizing(true);
    setResizeHandle(handleType);
    setResizeStart({ screenX: touch.clientX, initialWidth: size.width, itemInitialX: text.x });
  };

  const handleDoubleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (currentPenType !== "" || isEditing) return;
    e.stopPropagation();
    handleEditLocal();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeHandle === "right") {
        const worldDx = (e.clientX - resizeStart.screenX) / zoomLevel;
        const newWidth = Math.max(50 / zoomLevel, resizeStart.initialWidth + worldDx);
        setSize((s) => ({ ...s, width: newWidth }));
        onUpdate({ ...text, width: newWidth }, true);
      } else if (isDragging) {
        const worldDxDrag = (e.clientX - dragStart.screenX) / zoomLevel;
        const worldDyDrag = (e.clientY - dragStart.screenY) / zoomLevel;
        onUpdate({ ...text, x: dragStart.itemStartX + worldDxDrag, y: dragStart.itemStartY + worldDyDrag }, true);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (isResizing && resizeHandle === "right") {
        if (e.cancelable) e.preventDefault();
        const worldDx = (touch.clientX - resizeStart.screenX) / zoomLevel;
        const newWidth = Math.max(50 / zoomLevel, resizeStart.initialWidth + worldDx);
        setSize((s) => ({ ...s, width: newWidth }));
        onUpdate({ ...text, width: newWidth }, true);
      } else if (isDragging) {
        if (e.cancelable) e.preventDefault();
        const worldDxDrag = (touch.clientX - dragStart.screenX) / zoomLevel;
        const worldDyDrag = (touch.clientY - dragStart.screenY) / zoomLevel;
        onUpdate({ ...text, x: dragStart.itemStartX + worldDxDrag, y: dragStart.itemStartY + worldDyDrag }, true);
      }
    };
    const handleMouseUpOrTouchEnd = () => {
      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        onUpdate({ ...text, width: size.width }, false);
      } else if (isDragging) {
        setIsDragging(false);
        onUpdate({ ...text }, false);
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
  }, [isDragging, isResizing, dragStart, resizeStart, size.width, text, onUpdate, resizeHandle, zoomLevel, panOffset.x, panOffset.y]);

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchRef = useRef(0);

  const handleTouchTap = (e: React.TouchEvent) => {
    e.stopPropagation();

    if (currentPenType !== "" || isEditing) {
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (text.isSelected && lastTouchRef.current && now - lastTouchRef.current < DOUBLE_TAP_DELAY) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      handleDoubleClick(e);
      lastTouchRef.current = 0;
    } else {
      lastTouchRef.current = now;
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      touchTimerRef.current = setTimeout(() => {
        if (!isEditing && currentPenType === "") {
          onSelectItem("text", text.id);
        }
        touchTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  const screenPos = worldToCanvasLocal(text.x, text.y, panOffset, zoomLevel);
  const currentHeightStyle = isEditing || size.height === "auto" ? "auto" : `${size.height * zoomLevel}px`;
  const minHeightStyle = isEditing
    ? "30px"
    : size.height === "auto"
      ? "auto"
      : `${(typeof size.height === "number" ? size.height : 30 / zoomLevel) * zoomLevel}px`;

  const cursorStyle = currentPenType !== "" ? "auto" : isDragging ? "grabbing" : isEditing ? "text" : "grab";

  return (
    <div
      ref={textRef}
      id={`text-${text.id}`}
      className={`absolute p-1 group 
                  ${showBorder ? "ring-1 ring-blue-500" : "ring-1 ring-transparent hover:ring-gray-600"} 
                  ${isDragging ? "shadow-lg" : ""}`}
      style={{
        transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
        transformOrigin: "top left",
        width: `${size.width * zoomLevel}px`,
        minHeight: minHeightStyle,
        height: currentHeightStyle,
        zIndex: text.zIndex,
        cursor: cursorStyle,
        fontSize: `calc(${text.fontSize} * ${zoomLevel})`,
        lineHeight: `calc(1.2 * ${zoomLevel})`,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchTap}
    >
      {isEditing ? (
        <textarea
          className="w-full h-full p-1 resize-none bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-500"
          value={content}
          onChange={(e) => {
            handleContentChange(e.target.value);
            const target = e.target;
            target.style.height = "inherit";
            target.style.height = `${target.scrollHeight}px`;
          }}
          onBlur={handleTextareaBlur}
          autoFocus
          style={{
            textAlign: text.textAlign,
            color: text.color,
            fontSize: text.fontSize,
            lineHeight: 1.2,
          }}
          onFocus={(e) => {
            const target = e.target;
            target.style.height = "inherit";
            target.style.height = `${target.scrollHeight}px`;
          }}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          placeholder="テキストを入力..."
        />
      ) : (
        <p
          className="whitespace-pre-wrap break-words p-1 w-full select-none"
          style={{
            textAlign: text.textAlign,
            color: text.color,
          }}
        >
          {text.content || "ダブルタップして編集"}
        </p>
      )}
      {showBorder && (
        <div
          className="resize-handle absolute w-3 h-3 rounded-full bg-blue-500 border-1 border-white shadow-md right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
          style={{ zIndex: (text.zIndex || 0) + 1 }}
          onMouseDown={(e) => handleResizeMouseDown(e, "right")}
          onTouchStart={(e) => handleResizeTouchStart(e, "right")}
        />
      )}
    </div>
  );
};

export default TextNote;
