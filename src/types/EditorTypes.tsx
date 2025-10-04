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
  tileSheetIndex: number;
  tileIndex: number;
  paletteIndex: number;
  x: number;
  y: number;
  h: boolean;
  v: boolean;
  r: number;
};


export type Cell = { row: number; col: number } | null;

export type Metasprite = {
  name: string;
  entries: MetaSpriteEntry[]
};

export type Sheet = {
  tiles: number[][][]
}

/** Region is expressed in tile units (cols/rows) with a tile-aligned top-left */
export type Region = {
  startCol: number;   // left (tile)
  startRow: number;   // top (tile)
  cols: number;  // width  (in tiles)
  rows: number;  // height (in tiles)
};

export type TileRegionPayload = {
  tiles: Tile[];   // row-major tiles
  rows: number;    // height (in tiles)
  cols: number;    // width  (in tiles)
};

export type SelectedTiles = {
  tilesheetIndex: number;         // which tilesheet to pull tiles from
  paletteIndex: number;           // which palette to color with
  tileIndices: number[][];        // 2D grid of tile indices (rows x cols)
  opacity?: number;               // optional preview alpha (0..1), default 1
};