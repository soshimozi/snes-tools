"use client";
import { SCALE } from "@/app/constants";
import { indexToRowCol } from "@/Helpers";
import { Cell, Tile } from "@/types/EditorTypes";
import React, { useRef, useCallback, useEffect, useState } from "react";

/** Region is expressed in tile units (cols/rows) with a tile-aligned top-left */
export type Region = {
  col: number;   // left (tile)
  row: number;   // top (tile)
  cols: number;  // width  (in tiles)
  rows: number;  // height (in tiles)
};

export function Tilesheet({
  palette = ["#dddddd"],
  drawGridLines = false,
  tiles,
  onSelected,
  selected,
  /** NEW: controlled region */
  selectedRegion,
  /** NEW: raised on drag end (tile-snapped) */
  onRegionSelected,
}: {
  onSelected: (selected: Cell) => void;
  selected: Cell | null;
  tiles: Tile[];
  palette?: string[];
  drawGridLines?: boolean;
  selectedRegion?: Region;
  onRegionSelected: (region?: Region) => void;
}) {
  // ----- grid config -----
  const logicalTile = 8;                // each SNES/8×8 tile
  const scale = SCALE;                  // pixel scale factor for display
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale; // CSS px per tile
  const cssWidth = cols * cellSize;     // canvas CSS size
  const cssHeight = rows * cellSize;

  const tilesheetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ----- drag state (internal) -----
  const dragStartRef = useRef<{ col: number; row: number } | null>(null);
  const [draftRegion, setDraftRegion] = useState<Region | null>(null); // rubber-band while dragging

  // Helpers
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const snapToTile = (xCss: number, yCss: number) => {
    const col = clamp(Math.floor(xCss / cellSize), 0, cols - 1);
    const row = clamp(Math.floor(yCss / cellSize), 0, rows - 1);
    return { col, row };
  };
  const normRectToRegion = (a: { col: number; row: number }, b: { col: number; row: number }): Region => {
    const left = Math.min(a.col, b.col);
    const top = Math.min(a.row, b.row);
    const right = Math.max(a.col, b.col);
    const bottom = Math.max(a.row, b.row);
    return {
      col: left,
      row: top,
      cols: (right - left) + 1,
      rows: (bottom - top) + 1,
    };
  };

  const drawTiles = useCallback(() => {
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    // Backing store size vs CSS size
    c.width = Math.round((cssWidth + 2) * dpr);
    c.height = Math.round((cssHeight + 2) * dpr);
    c.style.width = `${cssWidth + 2}px`;
    c.style.height = `${cssHeight + 2}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Normalize drawing to CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.clearRect(0, 0, cssWidth + 2, cssHeight + 2);
    ctx.fillStyle = palette[0] ?? "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Draw tiles
    tiles.forEach((tile, index) => {
      const { row, col } = indexToRowCol(index);
      const dx = col * logicalTile * scale;
      const dy = row * logicalTile * scale;

      for (let y = 0; y < logicalTile; y++) {
        for (let x = 0; x < logicalTile; x++) {
          const pix = tile[y][x];
          const wx = dx + (x * scale);
          const wy = dy + (y * scale);
          ctx.fillStyle = palette[pix] ?? "#000";
          ctx.fillRect(wx, wy, scale, scale);
        }
      }
    });

    // Optional gridlines
    if (drawGridLines) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      for (let cIdx = 1; cIdx < cols; cIdx++) {
        const x = cIdx * cellSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
        ctx.stroke();
      }
      for (let rIdx = 1; rIdx < rows; rIdx++) {
        const y = rIdx * cellSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }
    }

    // Highlight single selected cell
    if (selected && !selectedRegion) {
      const { col, row } = selected;
      const x = col * cellSize;
      const y = row * cellSize;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }

    // Draw a region (controlled prop)
    const paintRegion = (region: Region, styles?: { stroke?: string; fill?: string }) => {
      const x = region.col * cellSize;
      const y = region.row * cellSize;
      const w = region.cols * cellSize;
      const h = region.rows * cellSize;
      if (styles?.fill) {
        ctx.fillStyle = styles.fill;
        ctx.fillRect(x, y, w, h);
      }
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = styles?.stroke ?? "rgba(0,0,0,0.85)";
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.setLineDash([]);
    };

    // Controlled selectedRegion (if any)
    if (selectedRegion) {
      paintRegion(selectedRegion, {
        fill: "rgba(0, 150, 255, 0.12)",
        stroke: "rgba(0, 150, 255, 0.9)",
      });
    }

    // Draft region while dragging (rubber band)
    if (draftRegion) {
      paintRegion(draftRegion, {
        fill: "rgba(255, 255, 255, 0.18)",
        stroke: "rgba(255, 255, 255, 0.95)",
      });
    }
  }, [
    palette,
    selected,
    selectedRegion,
    draftRegion,
    cssWidth,
    cssHeight,
    cellSize,
    cols,
    rows,
    drawGridLines,
    logicalTile,
    scale,
    tiles,
  ]);

  useEffect(() => {
    drawTiles();
  }, [drawTiles]);

  // ----- pointer handlers -----
const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
  const c = tilesheetCanvasRef.current;
  if (!c) return;

  c.setPointerCapture?.(e.pointerId);

  const rect = c.getBoundingClientRect();
  const xCss = e.clientX - rect.left;
  const yCss = e.clientY - rect.top;

  const start = snapToTile(xCss, yCss);
  dragStartRef.current = start;

  // Track whether the user dragged
  (dragStartRef.current as any).moved = false;

  // Still preserve single cell selection
  onSelected({ row: start.row, col: start.col });

  setDraftRegion(null); // no draft until actual move
};

const handlePointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
  if (!dragStartRef.current) return;
  const c = tilesheetCanvasRef.current;
  if (!c) return;

  const rect = c.getBoundingClientRect();
  const xCss = e.clientX - rect.left;
  const yCss = e.clientY - rect.top;

  const cur = snapToTile(xCss, yCss);
  const region = normRectToRegion(dragStartRef.current, cur);

  // mark as moved
  (dragStartRef.current as any).moved = true;

  setDraftRegion(region);
};

const handlePointerUp: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
  const start = dragStartRef.current;
  dragStartRef.current = null;

  const c = tilesheetCanvasRef.current;
  if (!c) return;
  c.releasePointerCapture?.(e.pointerId);

  if (!start) {
    setDraftRegion(null);
    return;
  }

  const moved = (start as any).moved;
  setDraftRegion(null);

  if (!moved || (draftRegion?.cols === 1 && draftRegion?.rows === 1)) {
    // No drag → clear region selection
    onRegionSelected(undefined);
    return;
  }

  const rect = c.getBoundingClientRect();
  const xCss = e.clientX - rect.left;
  const yCss = e.clientY - rect.top;
  const cur = snapToTile(xCss, yCss);
  const region = normRectToRegion(start, cur);

  onRegionSelected(region);
};


  const handlePointerLeave: React.PointerEventHandler<HTMLCanvasElement> = () => {
    // If the pointer leaves while dragging, cancel the draft but do not emit.
    setDraftRegion(null);
    dragStartRef.current = null;
  };

  return (
    <canvas
      ref={tilesheetCanvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className="rounded-[3px]"
      style={{ imageRendering: "pixelated", cursor: "crosshair" }}
    />
  );
}

// "use client";
// import { SCALE } from "@/app/constants";
// import { indexToRowCol } from "@/helpers";
// import { Cell, Tile } from "@/types/editorTypes";
// import React, { useRef, useCallback, useEffect } from "react";

// export function Tilesheet(
//   {
//     palette = ["#dddddd"], drawGridLines = false, tiles, onSelected, selected
//   }: {
//     onSelected: (selected: Cell) => void;
//     selected: Cell | null;
//     tiles: Tile[];
//     palette?: string[];
//     drawGridLines?: boolean;
//   }) {

//   // ----- grid config -----
//   const logicalTile = 8; // your underlying tile size
//   const scale = SCALE; // scale factor (so each cell = 16px)
//   const cols = 16;
//   const rows = 16;
//   const cellSize = logicalTile * scale; // 16
//   const cssWidth = (cols * cellSize) + 4; // 256
//   const cssHeight = (rows * cellSize) + 4; // 256

//   const tilesheetCanvasRef = useRef<HTMLCanvasElement | null>(null);

//   const drawTiles = useCallback(() => {
//     const c = tilesheetCanvasRef.current;
//     if (!c) return;

//     const dpr = window.devicePixelRatio || 1;
//     // Backing store size (actual pixels) vs CSS size (layout pixels)
//     c.width = Math.round(cssWidth * dpr);
//     c.height = Math.round(cssHeight * dpr);
//     c.style.width = `${cssWidth + 4}px`;
//     c.style.height = `${cssHeight + 4}px`;

//     const ctx = c.getContext("2d");
//     if (!ctx) return;

//     // Normalize drawing to CSS pixel units
//     ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

//     // Background
//     ctx.clearRect(0, 0, cssWidth, cssHeight);
//     ctx.fillStyle = palette[0] ?? "#ffffff";
//     ctx.fillRect(0, 0, cssWidth, cssHeight);

//     tiles.forEach((tile, index) => {

//       const { row, col } = indexToRowCol(index);

//       const dx = col * 8 * scale;
//       const dy = row * 8 * scale;

//       for (let y = 0; y < 8; y++) {
//         for (let x = 0; x < 8; x++) {
//           const pix = tile[y][x];
//           const wx = dx + (x * scale);
//           const wy = dy + (y * scale);
//           ctx.fillStyle = palette[pix] ?? "#000";
//           ctx.fillRect(wx, wy, scale, scale);
//         }
//       }
//     });

//     // Highlight selected cell
//     if (selected) {
//       const { col, row } = selected;
//       const x = col * cellSize;
//       const y = row * cellSize;

//       // Border highlight
//       ctx.lineWidth = 2;
//       ctx.strokeStyle = "rgba(255, 255, 255, 1)";
//       ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
//     }
//   }, [palette, selected, cssWidth, cssHeight, cellSize, cols, rows, drawGridLines, tiles]);

//   useEffect(() => {
//     drawTiles();
//   }, [drawTiles]);

//   const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
//     const c = tilesheetCanvasRef.current;
//     if (!c) return;

//     const rect = c.getBoundingClientRect(); // CSS pixels
//     const xCss = e.clientX - rect.left;
//     const yCss = e.clientY - rect.top;

//     const col = Math.floor(xCss / cellSize);
//     const row = Math.floor(yCss / cellSize);

//     if (col >= 0 && col < cols && row >= 0 && row < rows) {
//       onSelected({ row, col });
//     }
//   };

//   return (
//     <canvas
//       ref={tilesheetCanvasRef}
//       onPointerDown={handlePointerDown}
//       style={{ imageRendering: "pixelated", cursor: "pointer", borderRadius: "3px" }} />
//   );
// }
