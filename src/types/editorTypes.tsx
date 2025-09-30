import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type Tile = number[][]; // [y][x] => 0..15 palette index
export type Palette = string[]; // 16 hex colors: "#RRGGBB"

export type Tool = {
  type: "brush" | "fill" | "picker" | "eraser";
  icon: IconDefinition
}

export type HistoryEntry = {
  tiles: Tile[];
};

export type MetaSpriteEntry = {
  id: string;
  tileIndex: number;
  paletteIndex: number;
  x: number;
  y: number;
};