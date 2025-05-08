// src/components/StickyNote.tsx
import React, { useState, useEffect, useRef } from "react";
import type { Point, PanOffset, ContainerRect, StickyNoteData, ItemType, PenToolType } from "./constants";

interface DragStartInfo {
  screenX: number;
  screenY: number;
  itemStartX: number;
  itemStartY: number;
}

interface ResizeStartInfo {
  screenX: number;
  screenY: number;
  itemInitialX: number;
  itemInitialY: number;
  initialWidth: number;
  initialHeight: number;
}

interface StickyNoteProps {
  note: StickyNoteData;
  onUpdate: (updatedNote: StickyNoteData, isTemporary?: boolean) => void;
  onSelectItem: (type: ItemType, id: number) => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  panOffset: PanOffset;
  zoomLevel: number;
  currentPenType: PenToolType | "";
  isPinchZooming: boolean;
}

const getBrightness = (hexColor: string): number => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const worldToCanvasLocal = (worldX: number, worldY: number, panOffset: PanOffset, zoomLevel: number): Point => {
  return {
    x: (worldX - panOffset.x) * zoomLevel,
    y: (worldY - panOffset.y) * zoomLevel,
  };
};

const StickyNote: React.FC<StickyNoteProps> = ({
  note,
  onUpdate,
  onSelectItem,
  isEditing,
  onEdit,
  onSave,
  panOffset,
  zoomLevel,
  currentPenType,
  isPinchZooming,
}) => {
  const [content, setContent] = useState(note.content);
  const noteRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<DragStartInfo>({ screenX: 0, screenY: 0, itemStartX: 0, itemStartY: 0 });
  const [showResizeHandles, setShowResizeHandles] = useState(false);
  const [size, setSize] = useState({ width: note.width || 200, height: note.height || 200 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<ResizeStartInfo>({
    screenX: 0,
    screenY: 0,
    itemInitialX: 0,
    itemInitialY: 0,
    initialWidth: 0,
    initialHeight: 0,
  });
  const dynamicTextColor = getBrightness(note.color) > 128 ? "#000000" : "#FFFFFF";

  useEffect(() => {
    if (isEditing) {
      setContent(note.content);
    }
  }, [isEditing, note.content]);

  useEffect(() => {
    setSize({ width: note.width || 200, height: note.height || 200 });
  }, [note.width, note.height]);

  useEffect(() => {
    setShowResizeHandles(note.isSelected && !isEditing && currentPenType !== "eraser" && currentPenType === "");
  }, [note.isSelected, isEditing, currentPenType]);

  useEffect(() => {
    if ((!note.isSelected || isEditing) && isResizing) {
      setIsResizing(false);
    }
  }, [note.isSelected, isEditing, isResizing]);

  useEffect(() => {
    if (isPinchZooming) {
      if (isDragging) setIsDragging(false);
      if (isResizing) setIsResizing(false);
    }
  }, [isPinchZooming, isDragging, isResizing]);

  const handleContentChange = (newContent: string) => setContent(newContent);
  const handleTextareaBlur = () => {
    onUpdate({ ...note, content });
    if (onSave) onSave();
  };
  const handleEditLocal = () => {
    if (isPinchZooming) return;
    if (onEdit) onEdit();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (note.isSelected) {
      e.stopPropagation();
    }
    e.stopPropagation();
    if (isPinchZooming || currentPenType !== "" || isEditing) return;
    onSelectItem("note", note.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      !note.isSelected ||
      isPinchZooming ||
      currentPenType !== "" ||
      isEditing ||
      isResizing ||
      (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle"))
    ) {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ screenX: e.clientX, screenY: e.clientY, itemStartX: note.x, itemStartY: note.y });
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    if (
      !note.isSelected ||
      isPinchZooming ||
      currentPenType !== "" ||
      isEditing ||
      isResizing ||
      (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle"))
    ) {
      return;
    }
    if (e.target instanceof Element && e.target.closest && e.target.closest(".resize-handle")) {
    } else {
      e.stopPropagation();
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ screenX: touch.clientX, screenY: touch.clientY, itemStartX: note.x, itemStartY: note.y });
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    if (isPinchZooming || currentPenType !== "" || isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      screenX: e.clientX,
      screenY: e.clientY,
      itemInitialX: note.x,
      itemInitialY: note.y,
      initialWidth: size.width,
      initialHeight: size.height,
    });
  };
  const handleResizeTouchStart = (e: React.TouchEvent, handle: string) => {
    if (isPinchZooming || currentPenType !== "" || isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    const touch = e.touches[0];
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      screenX: touch.clientX,
      screenY: touch.clientY,
      itemInitialX: note.x,
      itemInitialY: note.y,
      initialWidth: size.width,
      initialHeight: size.height,
    });
  };

  const handleDoubleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPinchZooming || currentPenType !== "" || isEditing) return;
    e.stopPropagation();
    handleEditLocal();
  };

  useEffect(() => {
    const handleGlobalMove = (clientX: number, clientY: number) => {
      const screenDx = clientX - resizeStart.screenX;
      const screenDy = clientY - resizeStart.screenY;
      const worldDx = screenDx / zoomLevel;
      const worldDy = screenDy / zoomLevel;

      if (isResizing && resizeHandle) {
        let newX = resizeStart.itemInitialX;
        let newY = resizeStart.itemInitialY;
        let newWidth = resizeStart.initialWidth;
        let newHeight = resizeStart.initialHeight;
        const minDim = 50 / zoomLevel;

        switch (resizeHandle) {
          case "topLeft":
            newWidth = Math.max(minDim, resizeStart.initialWidth - worldDx);
            newHeight = Math.max(minDim, resizeStart.initialHeight - worldDy);
            newX = resizeStart.itemInitialX + (resizeStart.initialWidth - newWidth);
            newY = resizeStart.itemInitialY + (resizeStart.initialHeight - newHeight);
            break;
          case "topRight":
            newWidth = Math.max(minDim, resizeStart.initialWidth + worldDx);
            newHeight = Math.max(minDim, resizeStart.initialHeight - worldDy);
            newY = resizeStart.itemInitialY + (resizeStart.initialHeight - newHeight);
            break;
          case "bottomLeft":
            newWidth = Math.max(minDim, resizeStart.initialWidth - worldDx);
            newHeight = Math.max(minDim, resizeStart.initialHeight + worldDy);
            newX = resizeStart.itemInitialX + (resizeStart.initialWidth - newWidth);
            break;
          case "bottomRight":
            newWidth = Math.max(minDim, resizeStart.initialWidth + worldDx);
            newHeight = Math.max(minDim, resizeStart.initialHeight + worldDy);
            break;
          case "top":
            newHeight = Math.max(minDim, resizeStart.initialHeight - worldDy);
            newY = resizeStart.itemInitialY + (resizeStart.initialHeight - newHeight);
            break;
          case "right":
            newWidth = Math.max(minDim, resizeStart.initialWidth + worldDx);
            break;
          case "bottom":
            newHeight = Math.max(minDim, resizeStart.initialHeight + worldDy);
            break;
          case "left":
            newWidth = Math.max(minDim, resizeStart.initialWidth - worldDx);
            newX = resizeStart.itemInitialX + (resizeStart.initialWidth - newWidth);
            break;
        }

        setSize({ width: newWidth, height: newHeight });
        onUpdate({ ...note, x: newX, y: newY, width: newWidth, height: newHeight }, true);
      } else if (isDragging) {
        const worldDxDrag = (clientX - dragStart.screenX) / zoomLevel;
        const worldDyDrag = (clientY - dragStart.screenY) / zoomLevel;
        onUpdate({ ...note, x: dragStart.itemStartX + worldDxDrag, y: dragStart.itemStartY + worldDyDrag }, true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleGlobalMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        if (isResizing || isDragging) {
          if (e.cancelable) e.preventDefault();
        }
        handleGlobalMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleMouseUpOrTouchEnd = () => {
      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        onUpdate({ ...note, x: note.x, y: note.y, width: size.width, height: size.height }, false);
      } else if (isDragging) {
        setIsDragging(false);
        onUpdate({ ...note }, false);
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
  }, [isDragging, isResizing, dragStart, resizeStart, size, note, onUpdate, resizeHandle, zoomLevel]);

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchRef = useRef(0);

  const handleTouchTap = (e: React.TouchEvent) => {
    if (isDragging || isResizing || isPinchZooming) {
      return;
    }
    e.stopPropagation();

    if (currentPenType !== "" || isEditing) {
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (note.isSelected && lastTouchRef.current && now - lastTouchRef.current < DOUBLE_TAP_DELAY) {
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
        touchTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  const resizeHandlesDef = [
    { name: "topLeft", cursor: "nwse-resize", classes: "top-0 left-0 -translate-x-1/2 -translate-y-1/2" },
    { name: "topRight", cursor: "nesw-resize", classes: "top-0 right-0 translate-x-1/2 -translate-y-1/2" },
    { name: "bottomLeft", cursor: "nesw-resize", classes: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2" },
    { name: "bottomRight", cursor: "nwse-resize", classes: "bottom-0 right-0 translate-x-1/2 translate-y-1/2" },
    { name: "top", cursor: "ns-resize", classes: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
    { name: "right", cursor: "ew-resize", classes: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2" },
    { name: "bottom", cursor: "ns-resize", classes: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" },
    { name: "left", cursor: "ew-resize", classes: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" },
  ];

  const screenPos = worldToCanvasLocal(note.x, note.y, panOffset, zoomLevel);
  const cursorStyle = currentPenType !== "" ? "auto" : isDragging ? "grabbing" : isEditing ? "default" : "grab";

  return (
    <div
      ref={noteRef}
      id={`note-${note.id}`}
      className="absolute shadow-2xl flex flex-col items-center justify-center"
      style={{
        transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
        transformOrigin: "top left",
        backgroundColor: note.color,
        width: `${size.width * zoomLevel}px`,
        height: `${size.height * zoomLevel}px`,
        zIndex: note.zIndex,
        cursor: cursorStyle,
        fontSize: `calc(${note.fontSize} * ${zoomLevel})`,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchTap}
    >
      {isEditing ? (
        <textarea
          className="w-full h-full bg-transparent rounded-md resize-none border-none focus:outline-none focus:ring-0 placeholder-gray-400"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onBlur={handleTextareaBlur}
          autoFocus
          style={{
            fontSize: note.fontSize,
            lineHeight: 1.2,
            color: dynamicTextColor,
            textAlign: "center",
          }}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          placeholder="内容を入力..."
        />
      ) : (
        <p className="whitespace-pre-wrap break-words w-full select-none text-center" style={{ color: dynamicTextColor }}>
          {note.content || "ダブルタップして編集"}
        </p>
      )}
      {showResizeHandles && (
        <>
          {resizeHandlesDef.map((handle) => (
            <div
              key={handle.name}
              className={`w-3 h-3 resize-handle absolute rounded-full bg-blue-500 border border-white ${handle.classes}`}
              style={{
                cursor: handle.cursor,
                zIndex: (note.zIndex || 0) + 1,
                transform: `${handle.classes.includes("translate") ? handle.classes.substring(handle.classes.indexOf("translate")) : ""} scale(${
                  1 / zoomLevel
                })`,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, handle.name)}
              onTouchStart={(e) => handleResizeTouchStart(e, handle.name)}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default StickyNote;
