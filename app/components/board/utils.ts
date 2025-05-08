import type { Point, PanOffset } from "./constants";

// スクリーン座標からワールド座標へ変換
export const screenToWorld = (screenX: number, screenY: number, panOffset: PanOffset, zoomLevel: number, containerRect: DOMRect | null): Point => {
  if (!containerRect) return { x: 0, y: 0 };
  return {
    x: (screenX - containerRect.left) / zoomLevel + panOffset.x,
    y: (screenY - containerRect.top) / zoomLevel + panOffset.y,
  };
};

// ワールド座標からスクリーン座標へ変換
export const worldToScreen = (worldX: number, worldY: number, panOffset: PanOffset, zoomLevel: number, containerRect: DOMRect | null): Point => {
  if (!containerRect) return { x: 0, y: 0 };
  return {
    x: (worldX - panOffset.x) * zoomLevel + containerRect.left,
    y: (worldY - panOffset.y) * zoomLevel + containerRect.top,
  };
};

// ワールド座標からキャンバスのローカル座標へ変換
export const worldToCanvasLocal = (worldX: number, worldY: number, panOffset: PanOffset, zoomLevel: number): Point => {
  return {
    x: (worldX - panOffset.x) * zoomLevel,
    y: (worldY - panOffset.y) * zoomLevel,
  };
};

// 矩形の型定義
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 点が矩形内にあるかをチェック
export const isPointInRect = (point: Point, rect: Rect): boolean => {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
};

// 2点間の距離の二乗を計算
export function distanceSq(p1: Point, p2: Point): number {
  return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
}

// 点から線分への最短距離を計算
export function distancePointToSegment(p: Point, s1: Point, s2: Point): number {
  const l2 = distanceSq(s1, s2); // 線分の長さの二乗
  if (l2 === 0) return Math.sqrt(distanceSq(p, s1)); // 線分が点の場合

  // 点pを線分s1s2を含む直線へ射影
  let t = ((p.x - s1.x) * (s2.x - s1.x) + (p.y - s1.y) * (s2.y - s1.y)) / l2;

  // tを[0, 1]の範囲に制限して線分上の最近点を確保
  t = Math.max(0, Math.min(1, t));

  // 線分上の最近点を計算
  const closestPoint: Point = {
    x: s1.x + t * (s2.x - s1.x),
    y: s1.y + t * (s2.y - s1.y),
  };

  // 点pから最近点までの距離を返す
  return Math.sqrt(distanceSq(p, closestPoint));
}
