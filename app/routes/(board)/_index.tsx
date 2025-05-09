// src/Dashboard.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Pen, StickyNote, Type, ZoomIn, ZoomOut, Image as ImageIcon, LassoSelect } from "lucide-react";

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
  MainToolType,
} from "@/components/board/constants";
import { colorValues, RULER_DEFAULT_SCREEN_LENGTH, ERASER_RADIUS_WORLD } from "@/components/board/constants";
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

const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let crossings = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    if (((p1.y <= point.y && point.y < p2.y) || (p2.y <= point.y && point.y < p1.y)) && point.x < ((p2.x - p1.x) * (point.y - p1.y)) / (p2.y - p1.y) + p1.x) {
      crossings++;
    }
  }
  return crossings % 2 === 1;
};

const doesItemIntersectLasso = (item: DashboardItem, lassoPath: Point[]): boolean => {
  if (lassoPath.length < 3) return false;

  const itemCorners: Point[] = [];
  if (item.type === "note" || item.type === "text" || item.type === "image") {
    itemCorners.push({ x: item.x, y: item.y });
    itemCorners.push({ x: item.x + item.width, y: item.y });
    itemCorners.push({ x: item.x, y: item.y + (item.height === "auto" ? 50 : item.height) });
    itemCorners.push({ x: item.x + item.width, y: item.y + (item.height === "auto" ? 50 : item.height) });
  } else if (item.type === "line") {
    itemCorners.push(...item.points);
  }

  for (const corner of itemCorners) {
    if (isPointInPolygon(corner, lassoPath)) {
      return true;
    }
  }

  if (item.type === "note" || item.type === "text" || item.type === "image") {
    const itemHeight = item.height === "auto" ? 50 : item.height;
    for (const lassoPoint of lassoPath) {
      if (lassoPoint.x >= item.x && lassoPoint.x <= item.x + item.width && lassoPoint.y >= item.y && lassoPoint.y <= item.y + itemHeight) {
        return true;
      }
    }
  }
  return false;
};

type GroupDragStartDataItem =
  | { item: StickyNoteData; initialX: number; initialY: number; initialPoints?: undefined }
  | { item: TextNoteData; initialX: number; initialY: number; initialPoints?: undefined }
  | { item: ImageItemData; initialX: number; initialY: number; initialPoints?: undefined }
  | { item: DrawLineData; initialPoints: Point[]; initialX?: undefined; initialY?: undefined };

const Dashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [texts, setTexts] = useState<TextNoteData[]>([]);
  const [lines, setLines] = useState<DrawLineData[]>([]);
  const [images, setImages] = useState<ImageItemData[]>([]);

  const [currentTool, setCurrentTool] = useState<MainToolType>("select_pan");
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

  const [isLassoDrawing, setIsLassoDrawing] = useState(false);
  const [currentLassoPath, setCurrentLassoPath] = useState<Point[]>([]);
  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const [dragStartGroupData, setDragStartGroupData] = useState<GroupDragStartDataItem[]>([]);

  const justPannedRef = useRef(false);
  const panMovementThreshold = 5; // Pixels a mouse must move to be considered a pan, not a click
  const panStartedPointRef = useRef<Point | null>(null);

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

  const deselectAllItems = useCallback(() => {
    setNotes((prev) => prev.map((n) => ({ ...n, isSelected: false })));
    setTexts((prev) => prev.map((t) => ({ ...t, isSelected: false })));
    setLines((prev) => prev.map((l) => ({ ...l, isSelected: false })));
    setImages((prev) => prev.map((i) => ({ ...i, isSelected: false })));
  }, []);

  const countSelectedItems = useCallback(() => {
    return (
      notes.filter((i) => i.isSelected).length +
      texts.filter((i) => i.isSelected).length +
      lines.filter((i) => i.isSelected).length +
      images.filter((i) => i.isSelected).length
    );
  }, [notes, texts, lines, images]);

  const getAllSelectedItems = useCallback((): DashboardItem[] => {
    return [
      ...notes.filter((i) => i.isSelected),
      ...texts.filter((i) => i.isSelected),
      ...lines.filter((i) => i.isSelected),
      ...images.filter((i) => i.isSelected),
    ];
  }, [notes, texts, lines, images]);

  const handleSelectItem = (type: ItemType, id: number) => {
    if (justPannedRef.current) {
      // justPannedRef.current = false; // Reset immediately after check or in mouseup
      return;
    }
    if (editingItem && (editingItem.id !== id || editingItem.type !== type)) {
      setEditingItem(null);
    }
    if (editingItem && editingItem.id === id && editingItem.type === type) return;

    deselectAllItems();
    let newlySelectedItem: DashboardItem | null = null;

    if (type === "note") {
      const noteToSelect = notes.find((n) => n.id === id);
      if (noteToSelect) newlySelectedItem = { ...noteToSelect, isSelected: true };
      setNotes((prevNotes) => prevNotes.map((n) => (n.id === id ? { ...n, isSelected: true } : n)));
    } else if (type === "text") {
      const textToSelect = texts.find((t) => t.id === id);
      if (textToSelect) newlySelectedItem = { ...textToSelect, isSelected: true };
      setTexts((prevTexts) => prevTexts.map((t) => (t.id === id ? { ...t, isSelected: true } : t)));
    } else if (type === "line") {
      const lineToSelect = lines.find((l) => l.id === id);
      if (lineToSelect) newlySelectedItem = { ...lineToSelect, isSelected: true };
      setLines((prevLines) => prevLines.map((l) => (l.id === id ? { ...l, isSelected: true } : l)));
    } else if (type === "image") {
      const imageToSelect = images.find((i) => i.id === id);
      if (imageToSelect) newlySelectedItem = { ...imageToSelect, isSelected: true };
      setImages((prevImages) => prevImages.map((i) => (i.id === id ? { ...i, isSelected: true } : i)));
    }
    setSelectedItem(newlySelectedItem);
  };

  const handleDeselect = useCallback(() => {
    if (justPannedRef.current) return;
    if (editingItem && !isPinchZooming) return;
    setSelectedItem(null);
    deselectAllItems();
  }, [editingItem, isPinchZooming, deselectAllItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (justPannedRef.current) {
        return;
      }
      if (editingItem || isPinchZooming || isLassoDrawing || isGroupDragging) return;

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
        currentTool !== "lasso" &&
        !isDrawing
      ) {
        handleDeselect();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [
    selectedItem,
    editingItem,
    handleDeselect,
    notes,
    texts,
    lines,
    images,
    currentTool,
    isDrawing,
    rulerConfig.active,
    isPinchZooming,
    isLassoDrawing,
    isGroupDragging,
  ]);

  const addNote = () => {
    if (!containerRect) return;
    const newZ = getNextZIndex();
    deselectAllItems();
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
    setNotes((prev) => [...prev, newNote]);
    setSelectedItem(newNote);
    setEditingItem({ type: "note", id: newNote.id });
    setCurrentTool("select_pan");
  };

  const addText = () => {
    if (!containerRect) return;
    const newZ = getNextZIndex();
    deselectAllItems();
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
    setTexts((prev) => [...prev, newText]);
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
        deselectAllItems();
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

        setImages((prev) => [...prev, newImageItem]);
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

    if (selectedItem && selectedItem.id === id && selectedItem.type === type && countSelectedItems() <= 1) {
      if (!isTemporary || type === "image" || type === "text" || type === "note") {
        setSelectedItem(itemUpdatedInArray ? itemUpdatedInArray : (prev) => (prev ? ({ ...prev, ...updatedItemData } as DashboardItem) : null));
      }
    } else if (itemUpdatedInArray && itemUpdatedInArray.isSelected && countSelectedItems() > 1) {
      if (selectedItem && selectedItem.id === id && selectedItem.type === type) {
        setSelectedItem(itemUpdatedInArray);
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

  const duplicateItemAndReturn = (type: ItemType, id: number): DashboardItem | null => {
    let newItem: DashboardItem | null = null;
    let originalItem: DashboardItem | undefined;
    const newId = Date.now() + Math.random();
    const newZ = getNextZIndex();

    if (type === "note") {
      originalItem = notes.find((item) => item.id === id);
      if (originalItem)
        newItem = { ...(originalItem as StickyNoteData), id: newId, x: originalItem.x + 20, y: originalItem.y + 20, zIndex: newZ, isSelected: false };
      if (newItem) setNotes((prev) => [...prev, newItem as StickyNoteData]);
    } else if (type === "text") {
      originalItem = texts.find((item) => item.id === id);
      if (originalItem)
        newItem = { ...(originalItem as TextNoteData), id: newId, x: originalItem.x + 20, y: originalItem.y + 20, zIndex: newZ, isSelected: false };
      if (newItem) setTexts((prev) => [...prev, newItem as TextNoteData]);
    } else if (type === "line") {
      originalItem = lines.find((item) => item.id === id);
      if (originalItem)
        newItem = {
          ...(originalItem as DrawLineData),
          id: newId,
          points: (originalItem as DrawLineData).points.map((p) => ({ x: p.x + 20, y: p.y + 20 })),
          zIndex: newZ,
          isSelected: false,
        };
      if (newItem) setLines((prev) => [...prev, newItem as DrawLineData]);
    } else if (type === "image") {
      originalItem = images.find((item) => item.id === id);
      if (originalItem)
        newItem = { ...(originalItem as ImageItemData), id: newId, x: originalItem.x + 20, y: originalItem.y + 20, zIndex: newZ, isSelected: false };
      if (newItem) setImages((prev) => [...prev, newItem as ImageItemData]);
    }
    return newItem;
  };

  const handleEditItem = (type: ItemType, id: number) => {
    if (type === "image") {
      handleSelectItem(type, id);
      return;
    }
    deselectAllItems();
    let itemToEditAndSelect: DashboardItem | null = null;

    if (type === "note") {
      const noteToEdit = notes.find((n) => n.id === id);
      if (noteToEdit) itemToEditAndSelect = { ...noteToEdit, isSelected: true };
      setNotes((prev) => prev.map((n) => (n.id === id ? (itemToEditAndSelect as StickyNoteData) : n)));
    } else if (type === "text") {
      const textToEdit = texts.find((t) => t.id === id);
      if (textToEdit) itemToEditAndSelect = { ...textToEdit, isSelected: true };
      setTexts((prev) => prev.map((t) => (t.id === id ? (itemToEditAndSelect as TextNoteData) : t)));
    }

    if (itemToEditAndSelect) {
      setSelectedItem(itemToEditAndSelect);
      setEditingItem({ type, id });
    } else {
      setSelectedItem(null);
      setEditingItem(null);
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

    panStartedPointRef.current = { x: clientX, y: clientY };
    justPannedRef.current = false;

    const targetElement = event.target as HTMLElement;
    const isResizeHandleTarget = targetElement.closest(".resize-handle") || targetElement.closest(".resize-handle-img");

    let eventTargetIsItem = false;
    let clickedItem: DashboardItem | null = null;

    if (!isResizeHandleTarget) {
      const allItemsFlat = [...notes, ...texts, ...lines, ...images];
      for (const item of allItemsFlat) {
        const itemElement = document.getElementById(`${item.type}-${item.id}`);
        if (itemElement && itemElement.contains(targetElement)) {
          eventTargetIsItem = true;
          clickedItem = item;
          break;
        }
      }
    }

    if (currentTool === "select_pan") {
      if (clickedItem && clickedItem.isSelected && countSelectedItems() > 1 && !isResizeHandleTarget) {
        if (isTouch && event.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
        event.stopPropagation();
        setIsGroupDragging(true);
        setPanStartMouse({ x: clientX, y: clientY });
        setDragStartGroupData(
          getAllSelectedItems().map((selectedItemInstance) => {
            if (selectedItemInstance.type === "line") {
              return {
                item: selectedItemInstance,
                initialPoints: selectedItemInstance.points.map((p) => ({ ...p })),
              };
            } else {
              return {
                item: selectedItemInstance,
                initialX: selectedItemInstance.x,
                initialY: selectedItemInstance.y,
              };
            }
          }) as GroupDragStartDataItem[]
        );
      } else if (targetElement === containerRef.current || (eventTargetIsItem && !clickedItem?.isSelected && !isResizeHandleTarget)) {
        if (isTouch && event.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
        setIsPanning(true);
        setPanStartMouse({ x: clientX, y: clientY });
        setPanStartOffset({ ...panOffset });
        if (targetElement === containerRef.current) {
          handleDeselect();
        }
      }
    } else if (currentTool === "pen") {
      if (isTouch && event.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      setIsDrawing(true);
      let startCoords = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);
      if (rulerConfig.active && currentPenType !== "eraser") {
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
    } else if (currentTool === "lasso") {
      if (isTouch && event.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      setIsLassoDrawing(true);
      const startPointWorld = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);
      setCurrentLassoPath([startPointWorld]);
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
    if (isTouch && (event as React.TouchEvent<HTMLDivElement>).touches.length > 1) return;
    if (isPinchZooming) return;

    if (
      panStartedPointRef.current &&
      (Math.abs(clientX - panStartedPointRef.current.x) > panMovementThreshold || Math.abs(clientY - panStartedPointRef.current.y) > panMovementThreshold)
    ) {
      justPannedRef.current = true; // Mark as panned if movement exceeds threshold
    }

    const worldDx = (clientX - panStartMouse.x) / zoomLevel;
    const worldDy = (clientY - panStartMouse.y) / zoomLevel;

    if (isGroupDragging) {
      if (isTouch && event?.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      dragStartGroupData.forEach((data) => {
        const { item } = data;
        if (item.type === "line") {
          const updatedProps: Partial<DrawLineData> & { type: "line"; id: number } = {
            type: "line",
            id: item.id,
            points: data.initialPoints!.map((p) => ({ x: p.x + worldDx, y: p.y + worldDy })),
          };
          updateItem(updatedProps, true);
        } else {
          const updatedProps: Partial<typeof item> & { type: typeof item.type; id: number } = {
            type: item.type,
            id: item.id,
            x: data.initialX! + worldDx,
            y: data.initialY! + worldDy,
          };
          updateItem(updatedProps, true);
        }
      });
    } else if (isDrawing && currentTool === "pen") {
      if (isTouch && event?.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      let currentCoords = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);
      if (currentPenType !== "eraser") {
        if (rulerConfig.active && currentLinePoints.length > 0) {
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
            if (dist < line.width / 2 + ERASER_RADIUS_WORLD) {
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
    } else if (isLassoDrawing && currentTool === "lasso") {
      if (isTouch && event?.nativeEvent instanceof TouchEvent && event.cancelable) event.preventDefault();
      const currentPointWorld = screenToWorld(clientX, clientY, panOffset, zoomLevel, containerRect);
      setCurrentLassoPath((prev) => [...prev, currentPointWorld]);
    }
  };

  const handleCanvasInteractionEnd = () => {
    if (isPinchZooming) return;

    const wasPanning = isPanning; // Check if panning was active before resetting
    panStartedPointRef.current = null; // Reset pan start point

    if (isGroupDragging) {
      setIsGroupDragging(false);
      dragStartGroupData.forEach((data) => {
        let currentItemInState: DashboardItem | undefined;
        const { item } = data;
        if (item.type === "note") currentItemInState = notes.find((n) => n.id === item.id);
        else if (item.type === "text") currentItemInState = texts.find((t) => t.id === item.id);
        else if (item.type === "line") currentItemInState = lines.find((l) => l.id === item.id);
        else if (item.type === "image") currentItemInState = images.find((i) => i.id === item.id);

        if (currentItemInState) {
          updateItem(currentItemInState as DashboardItem & { type: ItemType; id: number }, false);
        }
      });
      setDragStartGroupData([]);
    } else if (isDrawing && currentTool === "pen") {
      if (currentPenType !== "eraser" && currentPenType !== "ruler" && currentLinePoints.length > 1) {
        const newLine: DrawLineData = {
          id: Date.now(),
          type: "line",
          points: currentLinePoints,
          color: drawingColor,
          width: drawingWidth,
          penType: currentPenType,
          zIndex: getNextZIndex(),
          isSelected: false,
        };
        setLines((prev) => [...prev, newLine]);
      }
      setIsDrawing(false);
      setCurrentLinePoints([]);
    } else if (isPanning && currentTool === "select_pan") {
      setIsPanning(false);
    } else if (isLassoDrawing && currentTool === "lasso") {
      setIsLassoDrawing(false);
      if (currentLassoPath.length > 2 && containerRect) {
        const allItems: DashboardItem[] = [...notes, ...texts, ...lines, ...images];
        const newlySelectedItems: DashboardItem[] = [];

        allItems.forEach((item) => {
          if (doesItemIntersectLasso(item, currentLassoPath)) {
            newlySelectedItems.push(item);
          }
        });

        if (newlySelectedItems.length > 0) {
          deselectAllItems();
          const newSelectedIds = new Set(newlySelectedItems.map((it) => it.id));
          setNotes((prev) => prev.map((n) => ({ ...n, isSelected: newSelectedIds.has(n.id) })));
          setTexts((prev) => prev.map((t) => ({ ...t, isSelected: newSelectedIds.has(t.id) })));
          setLines((prev) => prev.map((l) => ({ ...l, isSelected: newSelectedIds.has(l.id) })));
          setImages((prev) => prev.map((i) => ({ ...i, isSelected: newSelectedIds.has(i.id) })));
          setSelectedItem(newlySelectedItems[0]);
        } else {
          setSelectedItem(null);
        }
      }
      setCurrentLassoPath([]);
      setCurrentTool("select_pan");
    }

    // Reset justPannedRef after a very short delay if it was a pan,
    // to ensure click-like events (e.g., item selection) are not suppressed
    // if they happen immediately after a pan action (which they shouldn't if pan was significant).
    if (wasPanning) {
      setTimeout(() => {
        justPannedRef.current = false;
      }, 0);
    }
  };

  const handleCanvasMouseDownCapture = (e: React.MouseEvent<HTMLDivElement>) => handleCanvasInteractionStart(e.clientX, e.clientY, false, e);
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => handleCanvasInteractionMove(e.clientX, e.clientY, false, e);
  const handleCanvasMouseUp = () => handleCanvasInteractionEnd();

  const handleCanvasTouchStartCapture = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRect) return;
    const touches = e.touches;

    if (touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      setIsPinchZooming(true);
      setIsPanning(false);
      setIsDrawing(false);
      setIsLassoDrawing(false);
      setIsGroupDragging(false);
      setCurrentLinePoints([]);
      setCurrentLassoPath([]);

      if (editingItem) {
        setEditingItem(null);
      }
      handleDeselect();

      const t1 = { x: touches[0].clientX, y: touches[0].clientY };
      const t2 = { x: touches[1].clientX, y: touches[1].clientY };
      const dist = getDistance(t1, t2);
      const mid = getMidpoint(t1, t2);

      setPinchStartDistance(dist);
      setPinchStartZoom(zoomLevel);
      setPinchStartMidpointScreen(mid);
      setPinchStartPanOffset({ ...panOffset });
    } else if (touches.length === 1) {
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
    if (isPinchZooming && e.touches.length === 0) {
      setIsPinchZooming(false);
      setPinchStartMidpointScreen(null);
    } else if (!isPinchZooming) {
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

  const numCurrentlySelected = countSelectedItems();
  const representativeSelectedItem = numCurrentlySelected > 0 ? getAllSelectedItems()[0] || null : selectedItem;

  return (
    <div className="flex flex-col h-dvh antialiased overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: "none" }} />
      <div className="w-full absolute top-0 left-0 p-2.5 flex items-center justify-end select-none z-[10000]">
        <div id="zoom-controls" className="flex items-center space-x-1">
          <button onClick={() => handleZoomViaButtons("out")} title="縮小" className="p-2 text-amber-300">
            <ZoomOut size={20} />
          </button>
          <span className="text-xs text-black w-10 text-center">{(zoomLevel * 100).toFixed(0)}%</span>
          <button onClick={() => handleZoomViaButtons("in")} title="拡大" className="p-2 text-amber-300">
            <ZoomIn size={20} />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-grow relative overflow-hidden touch-none"
        style={{
          ...getDotBackgroundStyle(panOffset, zoomLevel),
          cursor:
            currentTool === "pen"
              ? currentPenType === "eraser"
                ? "alias"
                : "crosshair"
              : currentTool === "lasso"
              ? "crosshair"
              : isPanning || isGroupDragging
              ? "grabbing"
              : "grab",
        }}
        onMouseDownCapture={handleCanvasMouseDownCapture}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onTouchStartCapture={handleCanvasTouchStartCapture}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        onTouchCancel={handleCanvasTouchEnd}
      >
        {notes.map((note) => (
          <StickyNoteComponent
            key={note.id}
            note={note}
            onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "note"; id: number }, temp)}
            onSelectItem={handleSelectItem}
            isEditing={editingItem?.type === "note" && editingItem?.id === note.id}
            onEdit={() => handleEditItem("note", note.id)}
            onSave={handleSaveEditedItem}
            panOffset={panOffset}
            zoomLevel={zoomLevel}
            currentPenType={currentTool === "pen" ? currentPenType : ""}
            isPinchZooming={isPinchZooming}
          />
        ))}
        {texts.map((text) => (
          <TextNoteComponent
            key={text.id}
            text={text}
            onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "text"; id: number }, temp)}
            onSelectItem={handleSelectItem}
            isEditing={editingItem?.type === "text" && editingItem?.id === text.id}
            onEdit={() => handleEditItem("text", text.id)}
            onSave={handleSaveEditedItem}
            panOffset={panOffset}
            zoomLevel={zoomLevel}
            currentPenType={currentTool === "pen" ? currentPenType : ""}
            isPinchZooming={isPinchZooming}
          />
        ))}
        {lines.map((line) => (
          <DrawLineComponent
            key={line.id}
            line={line}
            isSelected={line.isSelected}
            onSelect={handleSelectItem}
            onUpdate={(updated, temp) => updateItem(updated as DashboardItem & { type: "line"; id: number }, temp)}
            panOffset={panOffset}
            zoomLevel={zoomLevel}
            currentPenType={currentTool === "pen" ? currentPenType : ""}
            onItemEraserClick={handleItemEraserClick}
            containerRect={containerRect}
            isPinchZooming={isPinchZooming}
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
            isPinchZooming={isPinchZooming}
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
              strokeWidth={drawingWidth * zoomLevel}
              strokeOpacity={currentPenType === "highlighter" ? 0.4 : 1}
              fill="none"
              strokeLinecap={currentPenType === "highlighter" ? "butt" : "round"}
              strokeLinejoin="round"
            />
          </svg>
        )}
        {isLassoDrawing && currentLassoPath.length > 0 && (
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: highestZIndex + 101 }}>
            <path
              d={
                currentLassoPath.reduce((acc, p, i) => {
                  const screenP = worldToCanvasLocal(p.x, p.y, panOffset, zoomLevel);
                  return acc + (i === 0 ? "M" : "L") + `${screenP.x} ${screenP.y} `;
                }, "") + (currentLassoPath.length > 2 ? " Z" : "")
              }
              stroke="rgba(0, 122, 255, 0.8)"
              strokeWidth={1.5 * zoomLevel}
              fill="rgba(0, 122, 255, 0.2)"
              strokeDasharray={`${4 * zoomLevel} ${2 * zoomLevel}`}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {currentTool === "pen" && (
          <CanvasRuler
            ref={rulerRef}
            panOffset={panOffset}
            zoomLevel={zoomLevel}
            rulerConfig={rulerConfig}
            setRulerConfig={setRulerConfig}
            containerRect={containerRect}
          />
        )}
      </div>
      {!representativeSelectedItem && !editingItem && (currentTool === "select_pan" || currentTool === "lasso") && (
        <div id="main-toolbar" className="bg-black p-2.5 shadow-md flex items-center justify-center select-none flex-shrink-0">
          <div className="w-full max-w-2xl flex items-center space-x-2 justify-evenly">
            {[
              {
                tool: "lasso" as MainToolType,
                title: "範囲選択",
                icon: LassoSelect,
                action: () => {
                  setCurrentTool((prevState) => (prevState === "lasso" ? "select_pan" : "lasso"));
                  handleDeselect();
                },
              },
              {
                tool: "pen" as MainToolType,
                title: "ペン",
                icon: Pen,
                action: () => {
                  setCurrentTool("pen");
                  setCurrentPenType("pen");
                  handleDeselect();
                },
              },
              { tool: "note" as MainToolType, title: "付箋追加", icon: StickyNote, action: addNote },
              { tool: "text" as MainToolType, title: "テキスト追加", icon: Type, action: addText },
              { tool: "image" as MainToolType, title: "画像追加", icon: ImageIcon, action: triggerImageUpload },
            ].map(({ tool, title, icon: Icon, action }) => (
              <button
                key={tool}
                title={title}
                onClick={action}
                className={`p-2 rounded-lg transition-colors hover:bg-gray-700 ${currentTool === tool ? "bg-gray-600 text-white" : "text-amber-300"}`}
              >
                <Icon size={20} />
              </button>
            ))}
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
            if (isDrawing) {
              setIsDrawing(false);
              if (currentPenType !== "eraser" && currentPenType !== "ruler" && currentLinePoints.length > 1) {
                const newLine: DrawLineData = {
                  id: Date.now(),
                  type: "line",
                  points: currentLinePoints,
                  color: drawingColor,
                  width: drawingWidth,
                  penType: currentPenType,
                  zIndex: getNextZIndex(),
                  isSelected: false,
                };
                setLines((prev) => [...prev, newLine]);
              }
              setCurrentLinePoints([]);
            }
          }}
          rulerActive={rulerConfig.active}
          setRulerActive={(val) =>
            setRulerConfig((prev) => {
              if (!val) return { ...prev, active: val };
              const viewportCenterX = (containerRect?.left || 0) + (containerRect?.width || 0) / 2;
              const viewportCenterY = (containerRect?.top || 0) + (containerRect?.height || 0) / 2;
              const newP1: Point = { x: viewportCenterX - RULER_DEFAULT_SCREEN_LENGTH / 2, y: viewportCenterY };
              const newP2: Point = { x: viewportCenterX + RULER_DEFAULT_SCREEN_LENGTH / 2, y: viewportCenterY };
              return { ...prev, active: val, p1: newP1, p2: newP2 };
            })
          }
        />
      )}
      {representativeSelectedItem && !editingItem && (currentTool === "select_pan" || currentTool === "lasso") && (
        <ItemToolbar
          item={representativeSelectedItem}
          isGroupSelected={numCurrentlySelected > 1}
          onDelete={() => {
            const itemsToDelete = getAllSelectedItems();
            if (itemsToDelete.length > 0) {
              itemsToDelete.forEach((item) => handleDeleteItem(item.type, item.id));
            }
            setSelectedItem(null);
          }}
          onDuplicate={() => {
            const itemsToDuplicate = getAllSelectedItems();
            const newlyDuplicatedItems: DashboardItem[] = [];
            if (itemsToDuplicate.length > 0) {
              itemsToDuplicate.forEach((item) => {
                const duplicated = duplicateItemAndReturn(item.type, item.id);
                if (duplicated) newlyDuplicatedItems.push(duplicated);
              });
              if (newlyDuplicatedItems.length > 0) {
                deselectAllItems();
                const newSelectedIds = new Set(newlyDuplicatedItems.map((it) => it.id));
                setNotes((prev) =>
                  prev.map((n) => ({ ...n, isSelected: newSelectedIds.has(n.id) && newlyDuplicatedItems.find((it) => it.id === n.id)?.type === "note" }))
                );
                setTexts((prev) =>
                  prev.map((t) => ({ ...t, isSelected: newSelectedIds.has(t.id) && newlyDuplicatedItems.find((it) => it.id === t.id)?.type === "text" }))
                );
                setLines((prev) =>
                  prev.map((l) => ({ ...l, isSelected: newSelectedIds.has(l.id) && newlyDuplicatedItems.find((it) => it.id === l.id)?.type === "line" }))
                );
                setImages((prev) =>
                  prev.map((i) => ({ ...i, isSelected: newSelectedIds.has(i.id) && newlyDuplicatedItems.find((it) => it.id === i.id)?.type === "image" }))
                );
                setSelectedItem(newlyDuplicatedItems[0]);
              }
            }
          }}
          onUpdateItem={handleUpdateItemProps}
        />
      )}
    </div>
  );
};

export default Dashboard;
