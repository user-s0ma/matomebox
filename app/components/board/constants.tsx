export interface Point {
  x: number;
  y: number;
}

export interface PanOffset extends Point {}

export interface ContainerRect extends DOMRectReadOnly {}

export type ItemType = "note" | "text" | "line" | "image";
export type PenToolType = "pen" | "highlighter" | "eraser" | "ruler";
export type TextAlign = "left" | "center" | "right";

interface BaseItem {
  id: number;
  zIndex: number;
  isSelected: boolean;
  x: number;
  y: number;
}

export interface StickyNoteData extends BaseItem {
  type: "note";
  content: string;
  color: string;
  fontSize: string;
  width: number;
  height: number;
}

export interface TextNoteData extends BaseItem {
  type: "text";
  content: string;
  fontSize: string;
  textAlign: TextAlign;
  color: string;
  width: number;
  height: number | "auto";
}

export interface DrawLineData {
  id: number;
  type: "line";
  points: Point[];
  color: string;
  width: number;
  penType: PenToolType;
  zIndex: number;
  isSelected: boolean;
}

export interface ImageItemData extends BaseItem {
  type: "image";
  src: string;
  width: number;
  height: number;
}

export type DashboardItem = StickyNoteData | TextNoteData | DrawLineData | ImageItemData;

export interface RulerConfig {
  active: boolean;
  p1: Point;
  p2: Point;
}

export interface DashboardData {
  notes: StickyNoteData[];
  texts: TextNoteData[];
  lines: DrawLineData[];
  images: ImageItemData[];
  panOffset: PanOffset;
  zoomLevel: number;
  rulerConfig: RulerConfig;
}

export const colorValues: string[] = [
  "#FFFFFF",
  "#808080",
  "#000000",
  "#FF0000",
  "#FFA500",
  "#FFFF00",
  "#00FF00",
  "#00FFFF",
  "#0000FF",
  "#800080",
  "#FF00FF",
  "#FFC0CB",
];

// 定規の初期長さ
export const RULER_THICKNESS_SCREEN = 50;
export const RULER_DEFAULT_SCREEN_LENGTH = 200;

export const ERASER_RADIUS_WORLD: number = 5;
