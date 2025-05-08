export interface Point {
  x: number;
  y: number;
}

export interface PanOffset extends Point {}

export interface ContainerRect extends DOMRectReadOnly {}

export type ItemType = "note" | "text" | "line";
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

export type DashboardItem = StickyNoteData | TextNoteData | DrawLineData;

export interface RulerConfig {
  active: boolean;
  p1: Point;
  p2: Point;
}

export interface NoteItem extends BaseItem {
  type: "note";
  content: string;
  color: string;
  fontSize: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextItem extends BaseItem {
  type: "text";
  content: string;
  fontSize: string;
  textAlign: TextAlign;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number | "auto";
}

export interface LineItem extends BaseItem {
  type: "line";
  points: Point[];
  color: string;
  width: number;
  penType: PenToolType;
}

export interface DashboardData {
  notes: NoteItem[];
  texts: TextItem[];
  lines: LineItem[];
  panOffset: PanOffset;
  zoomLevel: number;
  rulerConfig: RulerConfig;
}

export const colorValues: string[] = ["#FFFFFF", "#808080", "#000000", "#FF0000", "#FFA500", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#800080", "#FF00FF", "#FFC0CB"];

// マーカーの太さ
export const HIGHLIGHTER_THICKNESS = 20;

// 定規の初期長さ
export const RULER_THICKNESS_SCREEN = 50;
export const RULER_DEFAULT_SCREEN_LENGTH = 200;


export const ERASER_RADIUS_WORLD: number = 5;