// src/Dashboard.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Pen, StickyNote, Type, ZoomIn, ZoomOut, Image as ImageIcon } from "lucide-react";

import StickyNoteComponent from "@/components/board/StickyNote";
import TextNoteComponent from "@/components/board/TextNote";
import DrawLineComponent from "@/components/board/DrawLine";
import ImageNoteComponent from "@/components/board/ImageNote";
import ItemToolbar from "@/components/board/ItemToolbar";
import PenDrawingToolbar from "@/components/board/PenDrawingToolbar";
import CanvasRuler from "@/components/board/CanvasRuler";
import type {
  Point,
  PanOffset,
  ContainerRect,
  ItemType,
  PenToolType,
  StickyNoteData,
  TextNoteData,
  DrawLineData,
  ImageItemData,
  DashboardItem,
  RulerConfig,
} from "@/components/board/constants";
import { colorValues, RULER_DEFAULT_SCREEN_LENGTH, HIGHLIGHTER_THICKNESS, ERASER_RADIUS_WORLD } from "@/components/board/constants";
import { loadDataFromDB, saveDataToDB, type DashboardStorageDataV2 } from "@/components/board/db";

const getDotBackgroundStyle = (panOffset: PanOffset, zoomLevel: number) => ({
  backgroundImage: `radial-gradient(circle, #888 ${1 * zoomLevel}px, transparent ${1 * zoomLevel}px)`,
  backgroundSize: `${25 * zoomLevel}px ${25 * zoomLevel}px`,
  backgroundColor: "white",
  backgroundPosition: `${-panOffset.x * zoomLevel}px ${-panOffset.y * zoomLevel}px`,
});

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
  const closestPoint: Point = { x: s1.x + t * (s2.x - s1.x), y: s1.y + t * (s2.y - s1.y) };
  return Math.sqrt(distanceSq(p, closestPoint));
}

const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getMidpoint = (p1: Point, p2: Point): Point => {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
};

const Dashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [texts, setTexts] = useState<TextNoteData[]>([]);
  const [lines, setLines] = useState<DrawLineData[]>([]);
  const [images, setImages] = useState<ImageItemData[]>([]);

  const [currentTool, setCurrentTool] = useState<"select_pan" | "pen" | "note" | "text" | "image">("select_pan");
  const [currentPenType, setCurrentPenType] = useState<PenToolType>("pen");

  const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: ItemType; id: number } | null>(null);

  const [highestZIndex, setHighestZIndex] = useState(0);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLinePoints, setCurrentLinePoints] = useState<Point[]>([]);
  const [drawingColor, setDrawingColor] = useState(colorValues[5]);
  const [drawingWidth, setDrawingWidth] = useState(4);

  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStartMouse, setPanStartMouse] = useState<Point>({ x: 0, y: 0 });
  const [panStartOffset, setPanStartOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);

  const [isPinchZooming, setIsPinchZooming] = useState(false);
  const [pinchStartDistance, setPinchStartDistance] = useState<number>(0);
  const [pinchStartZoom, setPinchStartZoom] = useState<number>(1);
  const [pinchStartMidpointScreen, setPinchStartMidpointScreen] = useState<Point | null>(null);
  const [pinchStartPanOffset, setPinchStartPanOffset] = useState<PanOffset>({ x: 0, y: 0 });

  const initialRulerP1Screen: Point = { x: 100, y: 100 };
  const initialRulerP2Screen: Point = { x: 100 + RULER_DEFAULT_SCREEN_LENGTH, y: 100 };

  const [rulerConfig, setRulerConfig] = useState<RulerConfig>({
    active: false,
    p1: initialRulerP1Screen,
    p2: initialRulerP2Screen,
  });
  const [containerRect, setContainerRect] = useState<ContainerRect | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect());
    }
    const updateRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, []);

  useEffect(() => {
    loadDataFromDB()
      .then((data) => {
        setNotes(data.notes);
        setTexts(data.texts);
        setLines(data.lines);
        setImages(data.images);
        setPanOffset(data.panOffset);
        setZoomLevel(data.zoomLevel);
        setRulerConfig({ active: false, p1: initialRulerP1Screen, p2: initialRulerP2Screen });

        const maxZ = Math.max(
          0,
          ...data.notes.map((n) => n.zIndex || 0),
          ...data.texts.map((t) => t.zIndex || 0),
          ...data.lines.map((l) => l.zIndex || 0),
          ...data.images.map((i) => i.zIndex || 0)
        );
        setHighestZIndex(maxZ);
      })
      .catch((error) => {
        console.error("Error loading data from DB in component:", error);
      });
  }, []);

  useEffect(() => {
    const dataToSave: DashboardStorageDataV2 = { notes, texts, lines, images, panOffset, zoomLevel };
    const hasDataToSave =
      notes.length > 0 || texts.length > 0 || lines.length > 0 || images.length > 0 || panOffset.x !== 0 || panOffset.y !== 0 || zoomLevel !== 1;

    if (hasDataToSave) {
      saveDataToDB(dataToSave)
        .then((response) => {
          if (!response.success) {
            console.warn("Failed to save to DB:", response.message);
          }
        })
        .catch((error) => {
          console.error("Error saving data to DB in component:", error);
        });
    }
  }, [notes, texts, lines, images, panOffset, zoomLevel]);

  const getNextZIndex = (): number => {
    const newZ = highestZIndex + 1;
    setHighestZIndex(newZ);
    return newZ;
  };

  const handleSelectItem = (type: ItemType, id: number) => {
    if (editingItem && editingItem.id === id && editingItem.type === type) return;
    if (editingItem) setEditingItem(null);

    let newlySelectedItem: DashboardItem | null = null;

    if (type === "note") {
      const noteToSelect = notes.find((n) => n.id === id);
      if (noteToSelect) newlySelectedItem = { ...noteToSelect, isSelected: true };
    } else if (type === "text") {
      const textToSelect = texts.find((t) => t.id === id);
      if (textToSelect) newlySelectedItem = { ...textToSelect, isSelected: true };
    } else if (type === "line") {
      const lineToSelect = lines.find((l) => l.id === id);
      if (lineToSelect) newlySelectedItem = { ...lineToSelect, isSelected: true };
    } else if (type === "image") {
      const imageToSelect = images.find((i) => i.id === id);
      if (imageToSelect) newlySelectedItem = { ...imageToSelect, isSelected: true };
    }

    if (newlySelectedItem) {
      setSelectedItem(newlySelectedItem);

      setNotes((prevNotes) => prevNotes.map((n) => (n.id === id && type === "note" ? (newlySelectedItem as StickyNoteData) : { ...n, isSelected: false })));
      setTexts((prevTexts) => prevTexts.map((t) => (t.id === id && type === "text" ? (newlySelectedItem as TextNoteData) : { ...t, isSelected: false })));
      setLines((prevLines) => prevLines.map((l) => (l.id === id && type === "line" ? (newlySelectedItem as DrawLineData) : { ...l, isSelected: false })));
      setImages((prevImages) => prevImages.map((i) => (i.id === id && type === "image" ? (newlySelectedItem as ImageItemData) : { ...i, isSelected: false })));
    } else {
      handleDeselect();
    }
  };

  const handleDeselect = useCallback(() => {
    if (editingItem) return;
    setSelectedItem(null);
    setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
    setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
    setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
    setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));
  }, [editingItem]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingItem) return;
      if (isPinchZooming) return;

      const target = event.target as Node;
      const itemToolbar = document.getElementById("item-action-toolbar");
      const mainToolbar = document.getElementById("main-toolbar");
      const penDrawingToolbar = document.getElementById("pen-drawing-toolbar");
      const zoomControls = document.getElementById("zoom-controls");

      let clickedOnAnyItemElement = false;
      let clickedOnRuler = false;

      if (rulerRef.current && rulerRef.current.contains(target)) {
        clickedOnRuler = true;
      }

      if (containerRef.current && containerRef.current.contains(target) && !clickedOnRuler) {
        clickedOnAnyItemElement = [...notes, ...texts, ...lines, ...images].some((item) => {
          const itemElement = document.getElementById(`${item.type}-${item.id}`);
          return itemElement && itemElement.contains(target);
        });
      }

      if (
        containerRef.current &&
        containerRef.current.contains(target) &&
        !clickedOnAnyItemElement &&
        !clickedOnRuler &&
        (!itemToolbar || !itemToolbar.contains(target)) &&
        (!mainToolbar || !mainToolbar.contains(target)) &&
        (!penDrawingToolbar || !penDrawingToolbar.contains(target)) &&
        (!zoomControls || !zoomControls.contains(target)) &&
        currentTool !== "pen" &&
        !isDrawing
      ) {
        handleDeselect();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedItem, editingItem, handleDeselect, notes, texts, lines, images, currentTool, isDrawing, rulerConfig.active, isPinchZooming]);

  const addNote = () => {
    if (!containerRect) return;
    const newZ = getNextZIndex();
    const newNote: StickyNoteData = {
      id: Date.now(),
      type: "note",
      content: "",
      color: colorValues[Math.floor(Math.random() * colorValues.length)],
      fontSize: "16px",
      x: containerRect.width / 2 / zoomLevel + panOffset.x - 100,
      y: containerRect.height / 2 / zoomLevel + panOffset.y - 100,
      width: 200,
      height: 200,
      zIndex: newZ,
      isSelected: true,
    };
    setNotes((prev) => [...prev.map((n) => ({ ...n, isSelected: false })), newNote]);
    setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
    setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
    setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));

    setSelectedItem(newNote);
    setEditingItem({ type: "note", id: newNote.id });
    setCurrentTool("select_pan");
  };

  const addText = () => {
    if (!containerRect) return;
    const newZ = getNextZIndex();
    const newText: TextNoteData = {
      id: Date.now(),
      type: "text",
      content: "新しいテキスト",
      fontSize: "18px",
      textAlign: "left",
      color: colorValues[2],
      x: containerRect.width / 2 / zoomLevel + panOffset.x - 100,
      y: containerRect.height / 2 / zoomLevel + panOffset.y - 25,
      width: 200,
      height: "auto",
      zIndex: newZ,
      isSelected: true,
    };
    setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
    setTexts((prev) => [...prev.map((t) => ({ ...t, isSelected: false })), newText]);
    setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
    setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));

    setSelectedItem(newText);
    setEditingItem({ type: "text", id: newText.id });
    setCurrentTool("select_pan");
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!containerRect) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      if (!imageUrl) return;

      const img = new window.Image();
      img.onload = () => {
        const newZ = getNextZIndex();
        const MAX_INITIAL_DIM_WORLD = 300;
        let newWidth = img.naturalWidth;
        let newHeight = img.naturalHeight;

        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          newWidth = 150;
          newHeight = 150;
        }
        const aspectRatio = newWidth / newHeight;

        if (newWidth > MAX_INITIAL_DIM_WORLD) {
          newWidth = MAX_INITIAL_DIM_WORLD;
          newHeight = newWidth / aspectRatio;
        }
        if (newHeight > MAX_INITIAL_DIM_WORLD) {
          newHeight = MAX_INITIAL_DIM_WORLD;
          newWidth = newHeight * aspectRatio;
        }

        const newImageItem: ImageItemData = {
          id: Date.now(),
          type: "image",
          src: imageUrl,
          x: containerRect.width / 2 / zoomLevel + panOffset.x - newWidth / 2,
          y: containerRect.height / 2 / zoomLevel + panOffset.y - newHeight / 2,
          width: newWidth,
          height: newHeight,
          zIndex: newZ,
          isSelected: true,
        };

        setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
        setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
        setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
        setImages((prev) => [...prev.map((i) => ({ ...i, isSelected: false })), newImageItem]);

        setSelectedItem(newImageItem);
        setCurrentTool("select_pan");
      };
      img.onerror = () => alert("画像の読み込みに失敗しました。ファイル形式を確認してください。");
      img.src = imageUrl;
    };
    reader.onerror = () => alert("ファイルの読み込みに失敗しました。");
    reader.readAsDataURL(file);

    if (event.target) event.target.value = "";
  };

  const updateItem = (updatedItemData: Partial<DashboardItem> & { type: ItemType; id: number }, isTemporary: boolean = false) => {
    const { type, id } = updatedItemData;
    let itemUpdatedInArray: DashboardItem | undefined;

    if (type === "note") {
      setNotes((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            itemUpdatedInArray = { ...item, ...updatedItemData } as StickyNoteData;
            return itemUpdatedInArray;
          }
          return item;
        })
      );
    } else if (type === "text") {
      setTexts((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            itemUpdatedInArray = { ...item, ...updatedItemData } as TextNoteData;
            return itemUpdatedInArray;
          }
          return item;
        })
      );
    } else if (type === "line") {
      setLines((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            itemUpdatedInArray = { ...item, ...updatedItemData } as DrawLineData;
            return itemUpdatedInArray;
          }
          return item;
        })
      );
    } else if (type === "image") {
      setImages((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            itemUpdatedInArray = { ...item, ...updatedItemData } as ImageItemData;
            return itemUpdatedInArray;
          }
          return item;
        })
      );
    }

    if (selectedItem && selectedItem.id === id && selectedItem.type === type) {
      if (!isTemporary || type === "image" || type === "text" || type === "note") {
        setSelectedItem(itemUpdatedInArray ? itemUpdatedInArray : (prev) => (prev ? ({ ...prev, ...updatedItemData } as DashboardItem) : null));
      }
    }
  };

  const handleDeleteItem = (type: ItemType, id: number) => {
    if (type === "note") setNotes((prev) => prev.filter((item) => item.id !== id));
    else if (type === "text") setTexts((prev) => prev.filter((item) => item.id !== id));
    else if (type === "line") setLines((prev) => prev.filter((item) => item.id !== id));
    else if (type === "image") setImages((prev) => prev.filter((item) => item.id !== id));

    if (selectedItem && selectedItem.id === id && selectedItem.type === type) setSelectedItem(null);
    if (editingItem && editingItem.id === id && editingItem.type === type) setEditingItem(null);
  };

  const handleDuplicateItem = (type: ItemType, id: number) => {
    let newItem: DashboardItem | null = null;
    let originalItem: DashboardItem | undefined;

    setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
    setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
    setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
    setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));

    if (type === "note") {
      originalItem = notes.find((item) => item.id === id);
      if (originalItem) newItem = { ...(originalItem as StickyNoteData), id: Date.now(), x: originalItem.x + 20, y: originalItem.y + 20, isSelected: true };
      if (newItem) setNotes((prev) => [...prev, newItem as StickyNoteData]);
    } else if (type === "text") {
      originalItem = texts.find((item) => item.id === id);
      if (originalItem) newItem = { ...(originalItem as TextNoteData), id: Date.now(), x: originalItem.x + 20, y: originalItem.y + 20, isSelected: true };
      if (newItem) setTexts((prev) => [...prev, newItem as TextNoteData]);
    } else if (type === "line") {
      originalItem = lines.find((item) => item.id === id);
      if (originalItem)
        newItem = {
          ...(originalItem as DrawLineData),
          id: Date.now(),
          points: (originalItem as DrawLineData).points.map((p) => ({ x: p.x + 20, y: p.y + 20 })),
          isSelected: true,
        };
      if (newItem) setLines((prev) => [...prev, newItem as DrawLineData]);
    } else if (type === "image") {
      originalItem = images.find((item) => item.id === id);
      if (originalItem) newItem = { ...(originalItem as ImageItemData), id: Date.now(), x: originalItem.x + 20, y: originalItem.y + 20, isSelected: true };
      if (newItem) setImages((prev) => [...prev, newItem as ImageItemData]);
    }
    if (newItem) setSelectedItem(newItem);
  };

  const handleEditItem = (type: ItemType, id: number) => {
    if (type === "image") {
      handleSelectItem(type, id);
      return;
    }

    let itemToEditAndSelect: DashboardItem | null = null;

    if (type === "note") {
      const noteToEdit = notes.find((n) => n.id === id);
      if (noteToEdit) itemToEditAndSelect = { ...noteToEdit, isSelected: true };
    } else if (type === "text") {
      const textToEdit = texts.find((t) => t.id === id);
      if (textToEdit) itemToEditAndSelect = { ...textToEdit, isSelected: true };
    }

    if (itemToEditAndSelect) {
      setSelectedItem(itemToEditAndSelect);
      setEditingItem({ type, id });
      if (type === "note") {
        setNotes((prev) => prev.map((n) => (n.id === id ? (itemToEditAndSelect as StickyNoteData) : { ...n, isSelected: false })));
        setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
        setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
        setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));
      } else if (type === "text") {
        setTexts((prev) => prev.map((t) => (t.id === id ? (itemToEditAndSelect as TextNoteData) : { ...t, isSelected: false })));
        setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
        setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
        setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));
      }
    } else {
      setSelectedItem(null);
      setEditingItem(null);

      setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
      setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
      setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
      setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));
    }
  };

  const handleSaveEditedItem = () => setEditingItem(null);

  const handleUpdateItemProps = (updatedProps: Partial<DashboardItem>) => {
    if (selectedItem) {
      const fullUpdatedItem = { ...selectedItem, ...updatedProps };
      if (fullUpdatedItem.type && typeof fullUpdatedItem.id === "number") {
        updateItem(fullUpdatedItem as DashboardItem & { type: ItemType; id: number }, false);
      }
    }
  };

  const handleItemEraserClick = (itemType: ItemType, itemId: number) => {
    if (currentTool === "pen" && currentPenType === "eraser") {
      if (itemType === "line") {
        handleDeleteItem(itemType, itemId);
      }
    }
  };

  const handleCanvasInteractionStart = (
    clientX: number,
    clientY: number,
    isTouch: boolean = false,
    event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!containerRect) return;

    if (isTouch && (event as React.TouchEvent<HTMLDivElement>).touches.length > 1) return;
    if (isPinchZooming) return;

    if (isTouch && event.target !== containerRef.current && currentTool === "select_pan") {
      let isItemTarget = false;
      const allItems = [...notes, ...texts, ...lines, ...images];
      for (const item of allItems) {
        const itemElement = document.getElementById(`${item.type}-${item.id}`);
        if (itemElement && itemElement.contains(event.target as Node)) {
          isItemTarget = true;
          break;
        }
      }
      if (isItemTarget && !(event.target as HTMLElement).closest(".resize-handle") && !(event.target as HTMLElement).closest(".resize-handle-img")) return;
    }

    if (event.target === containerRef.current && currentTool === "select_pan") {
      if (isTouch && event.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      setIsPanning(true);
      setPanStartMouse({ x: clientX, y: clientY });
      setPanStartOffset({ ...panOffset });
      handleDeselect();
    } else if (currentTool === "pen") {
      if (isTouch && event.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      setIsDrawing(true);
      let startCoords = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);

      if (rulerConfig.active && currentPenType !== "eraser" && currentPenType !== "highlighter") {
        const rulerP1World = screenToWorld(rulerConfig.p1.x, rulerConfig.p1.y, panOffset, zoomLevel, containerRect);
        const rulerP2World = screenToWorld(rulerConfig.p2.x, rulerConfig.p2.y, panOffset, zoomLevel, containerRect);

        const dx = rulerP2World.x - rulerP1World.x;
        const dy = rulerP2World.y - rulerP1World.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq > 0) {
          const t = ((startCoords.x - rulerP1World.x) * dx + (startCoords.y - rulerP1World.y) * dy) / lenSq;
          startCoords = { x: rulerP1World.x + t * dx, y: rulerP1World.y + t * dy };
        }
      }
      if (currentPenType !== "eraser") setCurrentLinePoints([startCoords]);
      handleDeselect();
    }
  };

  const handleCanvasInteractionMove = (
    clientX: number,
    clientY: number,
    isTouch: boolean = false,
    event?: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!containerRect) return;
    if (isPinchZooming) return;

    if (isDrawing && currentTool === "pen") {
      if (isTouch && event?.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      let currentCoords = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);

      if (currentPenType !== "eraser") {
        if (rulerConfig.active && currentPenType !== "highlighter" && currentLinePoints.length > 0) {
          const firstPointOfStroke = currentLinePoints[0];
          const rulerP1World = screenToWorld(rulerConfig.p1.x, rulerConfig.p1.y, panOffset, zoomLevel, containerRect);
          const rulerP2World = screenToWorld(rulerConfig.p2.x, rulerConfig.p2.y, panOffset, zoomLevel, containerRect);

          const dxRulerWorld = rulerP2World.x - rulerP1World.x;
          const dyRulerWorld = rulerP2World.y - rulerP1World.y;
          const lenSqRulerWorld = dxRulerWorld * dxRulerWorld + dyRulerWorld * dyRulerWorld;

          if (lenSqRulerWorld > 0) {
            const vecCurrentRelToFirst = { x: currentCoords.x - firstPointOfStroke.x, y: currentCoords.y - firstPointOfStroke.y };
            const projectedLengthOntoRulerDir = (vecCurrentRelToFirst.x * dxRulerWorld + vecCurrentRelToFirst.y * dyRulerWorld) / lenSqRulerWorld;
            currentCoords.x = firstPointOfStroke.x + projectedLengthOntoRulerDir * dxRulerWorld;
            currentCoords.y = firstPointOfStroke.y + projectedLengthOntoRulerDir * dyRulerWorld;
          }
        }
        setCurrentLinePoints((prev) => [...prev, currentCoords]);
      } else {
        const linesToDelete = new Set<number>();
        lines.forEach((line) => {
          if (linesToDelete.has(line.id)) return;
          for (let i = 0; i < line.points.length - 1; i++) {
            const s1 = line.points[i];
            const s2 = line.points[i + 1];
            const dist = distancePointToSegment(currentCoords, s1, s2);
            const lineThicknessWorld = line.penType === "highlighter" ? HIGHLIGHTER_THICKNESS : line.width || 2;
            if (dist < lineThicknessWorld / 2 + ERASER_RADIUS_WORLD) {
              linesToDelete.add(line.id);
              break;
            }
          }
        });
        linesToDelete.forEach((id) => handleDeleteItem("line", id));
      }
    } else if (isPanning && currentTool === "select_pan") {
      if (isTouch && event?.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      const dxScreen = clientX - panStartMouse.x;
      const dyScreen = clientY - panStartMouse.y;
      setPanOffset({
        x: panStartOffset.x - dxScreen / zoomLevel,
        y: panStartOffset.y - dyScreen / zoomLevel,
      });
    }
  };

  const handleCanvasInteractionEnd = () => {
    if (isPinchZooming) return;

    if (isDrawing && currentTool === "pen") {
      setIsDrawing(false);
      if (currentPenType !== "eraser" && currentLinePoints.length > 1) {
        const newLine: DrawLineData = {
          id: Date.now(),
          type: "line",
          points: currentLinePoints,
          color: drawingColor,
          width: currentPenType === "highlighter" ? HIGHLIGHTER_THICKNESS : drawingWidth,
          penType: currentPenType,
          zIndex: getNextZIndex(),
          isSelected: false,
        };
        setLines((prev) => [...prev, newLine]);
      }
      setCurrentLinePoints([]);
    } else if (isPanning && currentTool === "select_pan") {
      setIsPanning(false);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => handleCanvasInteractionStart(e.clientX, e.clientY, false, e);
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => handleCanvasInteractionMove(e.clientX, e.clientY, false, e);
  const handleCanvasMouseUp = () => handleCanvasInteractionEnd();

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRect) return;
    const touches = e.touches;

    if (touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      setIsPinchZooming(true);
      setIsPanning(false);
      setIsDrawing(false);
      setCurrentLinePoints([]);

      const t1 = { x: touches[0].clientX, y: touches[0].clientY };
      const t2 = { x: touches[1].clientX, y: touches[1].clientY };
      const dist = getDistance(t1, t2);
      const mid = getMidpoint(t1, t2);

      setPinchStartDistance(dist);
      setPinchStartZoom(zoomLevel);
      setPinchStartMidpointScreen(mid);
      setPinchStartPanOffset({ ...panOffset });
      handleDeselect();
    } else if (touches.length === 1) {
      if (isPinchZooming) {
        setIsPinchZooming(false);
        setPinchStartMidpointScreen(null);
      }
      handleCanvasInteractionStart(touches[0].clientX, touches[0].clientY, true, e);
    } else {
      if (isPinchZooming) {
        setIsPinchZooming(false);
        setPinchStartMidpointScreen(null);
      }
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRect) return;
    const touches = e.touches;
    const minZoom = 0.1;
    const maxZoom = 2.0;

    if (isPinchZooming && touches.length === 2 && pinchStartMidpointScreen) {
      if (e.cancelable) e.preventDefault();
      const t1 = { x: touches[0].clientX, y: touches[0].clientY };
      const t2 = { x: touches[1].clientX, y: touches[1].clientY };
      const currentDist = getDistance(t1, t2);
      const currentMidpointScreen = getMidpoint(t1, t2);

      if (pinchStartDistance > 0) {
        const scaleRatio = currentDist / pinchStartDistance;
        const targetZoom = pinchStartZoom * scaleRatio;
        const newZoom = Math.min(Math.max(targetZoom, minZoom), maxZoom);

        const worldPointAtInitialPinchCenter = screenToWorld(
          pinchStartMidpointScreen.x,
          pinchStartMidpointScreen.y,
          pinchStartPanOffset,
          pinchStartZoom,
          containerRect
        );

        const newPanX = worldPointAtInitialPinchCenter.x - (currentMidpointScreen.x - containerRect.left) / newZoom;
        const newPanY = worldPointAtInitialPinchCenter.y - (currentMidpointScreen.y - containerRect.top) / newZoom;

        setZoomLevel(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
      }
    } else if (!isPinchZooming && touches.length === 1) {
      handleCanvasInteractionMove(touches[0].clientX, touches[0].clientY, true, e);
    } else if (isPinchZooming && touches.length !== 2) {
      setIsPinchZooming(false);
      setPinchStartMidpointScreen(null);
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPinchZooming) {
      if (e.touches.length < 2) {
        setIsPinchZooming(false);
        setPinchStartMidpointScreen(null);
      }
    } else {
      handleCanvasInteractionEnd();
    }
  };

  const handleZoomViaButtons = (direction: "in" | "out") => {
    if (!containerRect) return;
    const oldZoom = zoomLevel;
    const minZoom = 0.1;
    const maxZoom = 2.0;
    const epsilon = 1e-9;

    let newZoom;

    if (direction === "in") {
      if (oldZoom >= maxZoom) {
        newZoom = maxZoom;
      } else {
        newZoom = (Math.floor(oldZoom * 10 + epsilon) + 1) / 10;
      }
    } else {
      if (oldZoom <= minZoom) {
        newZoom = minZoom;
      } else {
        newZoom = (Math.ceil(oldZoom * 10 - epsilon) - 1) / 10;
      }
    }

    newZoom = parseFloat(newZoom.toFixed(1));

    newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));

    if (newZoom === oldZoom) return;

    const viewportCenterX_screen = containerRect.left + containerRect.width / 2;
    const viewportCenterY_screen = containerRect.top + containerRect.height / 2;

    const worldPointAtViewportCenter = screenToWorld(viewportCenterX_screen, viewportCenterY_screen, panOffset, oldZoom, containerRect);

    const newPanX = worldPointAtViewportCenter.x - (viewportCenterX_screen - containerRect.left) / newZoom;
    const newPanY = worldPointAtViewportCenter.y - (viewportCenterY_screen - containerRect.top) / newZoom;

    setZoomLevel(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  return (
    <div className="flex flex-col h-dvh antialiased overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: "none" }} />
      <div
        ref={containerRef}
        className="flex-grow relative overflow-hidden touch-none"
        style={{
          ...getDotBackgroundStyle(panOffset, zoomLevel),
          cursor: currentTool === "pen" ? (currentPenType === "eraser" ? "alias" : "crosshair") : isPanning ? "grabbing" : "grab",
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        onTouchCancel={handleCanvasTouchEnd}
      >
        <div>
          {notes.map((note) => (
            <StickyNoteComponent
              key={note.id}
              note={note}
              onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "note"; id: number }, temp)}
              onDelete={() => handleDeleteItem("note", note.id)}
              onDuplicate={() => handleDuplicateItem("note", note.id)}
              onSelectItem={handleSelectItem}
              isEditing={editingItem?.type === "note" && editingItem?.id === note.id}
              onEdit={() => handleEditItem("note", note.id)}
              onSave={handleSaveEditedItem}
              panOffset={panOffset}
              zoomLevel={zoomLevel}
              currentPenType={currentTool === "pen" ? currentPenType : ""}
              onItemEraserClick={handleItemEraserClick}
              containerRect={containerRect}
            />
          ))}
          {texts.map((text) => (
            <TextNoteComponent
              key={text.id}
              text={text}
              onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "text"; id: number }, temp)}
              onDelete={() => handleDeleteItem("text", text.id)}
              onDuplicate={() => handleDuplicateItem("text", text.id)}
              onSelectItem={handleSelectItem}
              isEditing={editingItem?.type === "text" && editingItem?.id === text.id}
              onEdit={() => handleEditItem("text", text.id)}
              onSave={handleSaveEditedItem}
              panOffset={panOffset}
              zoomLevel={zoomLevel}
              currentPenType={currentTool === "pen" ? currentPenType : ""}
              onItemEraserClick={handleItemEraserClick}
              containerRect={containerRect}
            />
          ))}
          {lines.map((line) => (
            <DrawLineComponent
              key={line.id}
              line={line}
              isSelected={selectedItem?.type === "line" && selectedItem?.id === line.id}
              onSelect={handleSelectItem}
              onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "line"; id: number }, temp)}
              onDelete={() => handleDeleteItem("line", line.id)}
              panOffset={panOffset}
              zoomLevel={zoomLevel}
              currentPenType={currentTool === "pen" ? currentPenType : ""}
              onItemEraserClick={handleItemEraserClick}
              containerRect={containerRect}
            />
          ))}
          {images.map((image) => (
            <ImageNoteComponent
              key={image.id}
              image={image}
              onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "image"; id: number }, temp)}
              onSelectItem={handleSelectItem}
              panOffset={panOffset}
              zoomLevel={zoomLevel}
              currentPenType={currentTool === "pen" ? currentPenType : ""}
              containerRect={containerRect}
            />
          ))}
          {isDrawing && currentTool === "pen" && currentPenType !== "eraser" && currentPenType !== "ruler" && currentLinePoints.length > 0 && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: highestZIndex + 100 }}>
              <path
                d={currentLinePoints.reduce((acc, p, i) => {
                  const screenP = worldToCanvasLocal(p.x, p.y, panOffset, zoomLevel);
                  return acc + (i === 0 ? "M" : "L") + `${screenP.x} ${screenP.y} `;
                }, "")}
                stroke={drawingColor}
                strokeWidth={(currentPenType === "highlighter" ? HIGHLIGHTER_THICKNESS : drawingWidth) * zoomLevel}
                strokeOpacity={currentPenType === "highlighter" ? 0.4 : 1}
                fill="none"
                strokeLinecap={currentPenType === "highlighter" ? "butt" : "round"}
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <CanvasRuler
          ref={rulerRef}
          panOffset={panOffset}
          zoomLevel={zoomLevel}
          rulerConfig={rulerConfig}
          setRulerConfig={setRulerConfig}
          containerRect={containerRect}
        />
      </div>
      {!selectedItem && !editingItem && currentTool === "select_pan" && (
        <div id="main-toolbar" className="bg-black p-2.5 shadow-md flex items-center justify-between select-none flex-shrink-0">
          <div className="flex items-center space-x-2">
            {[
              {
                tool: "pen" as "pen",
                title: "ペン",
                icon: Pen,
                action: () => {
                  setCurrentTool("pen");
                  setCurrentPenType("pen");
                  handleDeselect();
                },
              },
              { tool: "note" as "note", title: "付箋追加", icon: StickyNote, action: addNote },
              { tool: "text" as "text", title: "テキスト追加", icon: Type, action: addText },
              { tool: "image" as "image", title: "画像追加", icon: ImageIcon, action: triggerImageUpload },
            ].map(({ tool, title, icon: Icon, action }) => (
              <button key={tool} title={title} onClick={action} className="p-2 rounded-lg transition-colors text-gray-300 hover:bg-gray-700 hover:text-white">
                <Icon size={20} />
              </button>
            ))}
          </div>
          <div id="zoom-controls" className="flex items-center space-x-1">
            <button onClick={() => handleZoomViaButtons("out")} title="縮小" className="p-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white">
              <ZoomOut size={20} />
            </button>
            <span className="text-xs text-gray-400 w-10 text-center">{(zoomLevel * 100).toFixed(0)}%</span>
            <button onClick={() => handleZoomViaButtons("in")} title="拡大" className="p-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white">
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
      )}
      {currentTool === "pen" && (
        <PenDrawingToolbar
          currentPenType={currentPenType}
          setCurrentPenType={setCurrentPenType}
          drawingColor={drawingColor}
          setDrawingColor={setDrawingColor}
          drawingWidth={drawingWidth}
          setDrawingWidth={setDrawingWidth}
          onDone={() => {
            setCurrentTool("select_pan");
          }}
          rulerActive={rulerConfig.active}
          setRulerActive={(val) =>
            setRulerConfig((prev) => {
              if (!val) return { ...prev, active: val };
              const viewportCenterX = (containerRect?.left || 0) + (containerRect?.width || 0) / 2;
              const viewportCenterY = (containerRect?.top || 0) + (containerRect?.height || 0) / 2;

              const newP1: Point = {
                x: viewportCenterX - RULER_DEFAULT_SCREEN_LENGTH / 2,
                y: viewportCenterY,
              };
              const newP2: Point = {
                x: viewportCenterX + RULER_DEFAULT_SCREEN_LENGTH / 2,
                y: viewportCenterY,
              };
              return { ...prev, active: val, p1: newP1, p2: newP2 };
            })
          }
        />
      )}
      {selectedItem && !editingItem && currentTool === "select_pan" && (
        <ItemToolbar
          item={selectedItem}
          onDelete={() => handleDeleteItem(selectedItem.type, selectedItem.id)}
          onDuplicate={() => handleDuplicateItem(selectedItem.type, selectedItem.id)}
          onUpdateItem={handleUpdateItemProps}
        />
      )}
    </div>
  );
};

export default Dashboard;
