"use client";

import { SCALE } from "@/app/constants";
import { getCheckerPattern } from "@/misc/Helpers";
import { drawSelectionOverlay } from "@/misc/selectionOverlay";
import { MetaSpriteEntry, Region, SelectedTiles, Sheet, Tile } from "@/types/EditorTypes";
import React, { useRef, useCallback, useEffect, useState } from "react";

export function MetaSpriteEditor(
  {
    entries, onClick, palettes, tilesheets, selected,
    highlightSelected = false, drawGrid = false, transparentIndex0 = false,
    selectedRegion, selectedTiles
  }: {
    entries: MetaSpriteEntry[];
    onClick: ({row, col} : {row: number, col: number}) => void;
    palettes: string[][];
    tilesheets: Sheet[];
    selectedRegion?: Region;
    selected: MetaSpriteEntry[];
    highlightSelected?: boolean;
    drawGrid?: boolean;
    selectedTiles?: SelectedTiles;  // <-- NEW
    transparentIndex0?:boolean;
  }) {

  const logicalTile = 8;
  const scale = SCALE;
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale;

  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // track the last snapped hover cell (canvas pixels, snapped to cellSize)
  const [hoverXY, setHoverXY] = useState<{x: number; y: number} | null>(null);

    // draw a single 8x8 tile at pixel (dx, dy) into ctx, using given palette
  const drawOneTile = (
    ctx: CanvasRenderingContext2D,
    tile: number[][],
    dx: number,
    dy: number,
    scale: number,
    palette: string[],
    transparent0: boolean,
  ) => {

    // Precompute pattern once per tile draw
    //const pattern = transparent0 ? getCheckerPattern(ctx, scale) : null;    

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const pix = tile[y][x];
        const rx = dx + x * scale;
        const ry = dy + y * scale;
        
        if( pix == 0) {
          if(transparent0) {
            // ctx.fillStyle = pattern!;
            // ctx.fillRect(rx, ry, scale, scale);
            continue;
          } else {
            ctx.fillStyle = palette[0] ?? "#000";
            ctx.fillRect(rx, ry, scale, scale);
          
          }
        } else {
          ctx.fillStyle = palette[pix] ?? "#000";
          ctx.fillRect(dx + x * scale, dy + y * scale, scale, scale);
        }
      }
    }
  };

  // choose where to anchor the preview block (hover cell > region top-left)
  const getPreviewAnchorPx = (
    hoverXY: {x:number;y:number}|null,
    selectedRegion: {startRow:number; startCol:number} | undefined,
    cellSize: number
  ) => {
    if (hoverXY) return { x: hoverXY.x, y: hoverXY.y };
    if (selectedRegion) return { x: selectedRegion.startCol * cellSize, y: selectedRegion.startRow * cellSize };
    return null;
  };

  // Normalize into [0,mod)
  const norm = (n: number, mod: number) => ((n % mod) + mod) % mod;

  function wrappedPositions(x: number, y: number, w: number, h: number, wrapW: number, wrapH: number): Array<[number, number]> {
    const xm = norm(x, wrapW);
    const ym = norm(y, wrapH);
    const pos: Array<[number, number]> = [[xm, ym]];
    const crossesRight = xm + w > wrapW;
    const crossesBottom = ym + h > wrapH;
    if (crossesRight) pos.push([xm - wrapW, ym]);
    if (crossesBottom) pos.push([xm, ym - wrapH]);
    if (crossesRight && crossesBottom) pos.push([xm - wrapW, ym - wrapH]);
    return pos;
  }


    // 2) Helper to turn Region (cell units) into pixel rect
  const regionToPixelRect = useCallback((r: {startRow:number; startCol:number; rows:number; cols:number}) => {
    const x = r.startCol * cellSize;
    const y = r.startRow * cellSize;
    const w = r.cols * cellSize;
    const h = r.rows * cellSize;
    return { x, y, w, h };
  }, [cellSize]);

  const getTilePixel = (tile: Tile, x: number, y: number, h: boolean, v: boolean, r: number) => {
    // shallow-spreading a 2D array creates an object with numeric keys; use original tile directly
    let xnew = h ? 7 - x : x;
    let ynew = v ? 7 - y : y;

    if (r < 0) {
      for (let ri = r; ri < 0; ri++) {
        const xtemp = ynew;
        ynew = 7 - xnew;
        xnew = xtemp;
      }
    } else if (r > 0) {
      for (let ri = 0; ri < r; ri++) {
        const ytemp = xnew;
        xnew = 7 - ynew;
        ynew = ytemp;
      }
    }
    return tile[ynew][xnew];
  };

  // Helper to sync the overlay size to the base canvas
  const syncOverlaySize = useCallback(() => {
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!base || !overlay) return;
    overlay.width = base.width;
    overlay.height = base.height;
    // keep CSS size identical too (helps with HiDPI crispness)
    overlay.style.width = base.style.width;
    overlay.style.height = base.style.height;
  }, []);

  /** BASE LAYER DRAW: redraws everything except transient selection */
  const drawMeta = useCallback(() => {
    const c = baseRef.current;
    if (!c) return;

    // set intrinsic pixel size
    c.width  = 8 * cols * scale + 4;
    c.height = 8 * rows * scale + 4;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    // background
    if (transparentIndex0) {
      // implied transparency behind *everything*
      ctx.fillStyle = getCheckerPattern(ctx, 32);
    } else {
      // your existing “color 0” background (same for all palettes)
      ctx.fillStyle = palettes[0][0] ?? "#000";
    }
    ctx.fillRect(0, 0, c.width, c.height);

    const WRAP_W = scale * 8 * cols;
    const WRAP_H = scale * 8 * rows;

    // tiles
    entries.forEach((e) => {
      const tile = tilesheets[e.tileSheetIndex].tiles[e.tileIndex];
      const dx = e.x;
      const dy = e.y;
      const tileW = 8 * scale;
      const tileH = 8 * scale;

      const positions = wrappedPositions(dx, dy, tileW, tileH, WRAP_W, WRAP_H);
      for (const [bx, by] of positions) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const pix = getTilePixel(tile, x, y, e.h, e.v, e.r);
            const wx = bx + x * scale;
            const wy = by + y * scale;

            if (pix === 0) {
              if (transparentIndex0) {
                // ctx.fillStyle = getCheckerPattern(ctx, scale);
                // ctx.fillRect(wx, wy, scale, scale);
                continue;
              } else {
                ctx.fillStyle = palettes[e.paletteIndex][0] ?? "#000";
                ctx.fillRect(wx, wy, scale, scale);
              }
            } else {
              ctx.fillStyle = palettes[e.paletteIndex][pix] ?? "#000";
              ctx.fillRect(wx, wy, scale, scale);
            }
          }
        }
      }
    });

    // selected border (base layer, so overlay can sit on top)
    // if (highlightSelected && selected) {
    //   const tileW = 8 * scale;
    //   const tileH = 8 * scale;
    //   const positions = wrappedPositions(selected.x, selected.y, tileW, tileH, WRAP_W, WRAP_H);
    //   ctx.lineWidth = 2;
    //   ctx.setLineDash([6, 4]);
    //   ctx.strokeStyle = "rgba(0, 150, 255, 1)";
    //   for (const [bx, by] of positions) {
    //     ctx.strokeRect(bx, by, tileW, tileH);
    //   }
    //   ctx.setLineDash([]);
    // }
    if (highlightSelected && selected?.length) {
      const cellSize = 8 * scale;
      drawSelectionOverlay(ctx, selected, cellSize, true);
    }    

    // grid (base layer)
    if (drawGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#555";
      ctx.setLineDash([7, 5]);
      const endx = scale * 8 * 16;
      const endy = scale * 8 * 16;
      for (let x = 1; x <= 8; x++) {

        ctx.beginPath();
        ctx.moveTo(scale * 16 * x + .5, 0);
        ctx.lineTo(scale * 16 * x + .5, endy);
        ctx.stroke();
      }
      for (let y = 1; y <= 8; y++) {
       
        ctx.beginPath();
        ctx.moveTo(0, scale * 16 * y + .5);
        ctx.lineTo(endx, scale * 16 * y + .5);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scale * 16 * 4 + .5, 0);
      ctx.lineTo(scale * 16 * 4 + .5, endy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, scale * 16 * 4 + .5);
      ctx.lineTo(endx, scale * 16 * 4 + .5);
      ctx.stroke();
    }

    // ensure overlay matches size after base redraw
    syncOverlaySize();
  }, [cols, rows, scale, palettes, entries, tilesheets, selected, highlightSelected, drawGrid, syncOverlaySize, ]);

  useEffect(() => { drawMeta(); }, [drawMeta]);

  /** OVERLAY LAYER DRAW: only draws transient selection box */
// 3) Overlay draw now renders: (a) selectedRegion, (b) hover cell
const drawOverlaySelection = useCallback(
  (xy: {x:number; y:number} | null) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const octx = overlay.getContext("2d");
    if (!octx) return;

    octx.clearRect(0, 0, overlay.width, overlay.height);

    if (selectedTiles?.tileIndices?.length && tilesheets[selectedTiles.tilesheetIndex]) {
      const anchor = getPreviewAnchorPx(xy, selectedRegion, cellSize);
      if (anchor) {
        const ts = tilesheets[selectedTiles.tilesheetIndex];
        const palette = palettes[selectedTiles.paletteIndex] ?? palettes[0] ?? ["#000000"];
        const alpha = selectedTiles.opacity ?? 1;

        octx.save();
        octx.globalAlpha = alpha;

        // draw each tile in the 2D grid
        for (let r = 0; r < selectedTiles.tileIndices.length; r++) {
          const row = selectedTiles.tileIndices[r];
          for (let c = 0; c < row.length; c++) {
            const tileIndex = row[c];
            const tile = ts.tiles[tileIndex];
            if (!tile) continue;

            const dx = anchor.x + c * cellSize;
            const dy = anchor.y + r * cellSize;

            // clip to canvas bounds (optional but avoids overdraw)
            if (dx + cellSize < 0 || dy + cellSize < 0 || dx >= overlay.width || dy >= overlay.height) continue;

            drawOneTile(octx, tile, dx, dy, scale, palette, transparentIndex0);
          }
        }

        octx.restore();
      }
    }

    // (a) draw selectedRegion if provided
    if (selectedRegion && xy) {

      const { x, y, w, h } = regionToPixelRect({ startRow: xy.y, startCol: xy.x, cols: selectedRegion.cols, rows: selectedRegion.rows });

      console.log("x ", xy.x, ", y ", xy.y, ", w ", w, ", h ", h)
      // filled light tint + strong border
      octx.lineWidth = 2;
      octx.strokeStyle = "rgba(0, 150, 255, 1)";
      octx.fillStyle = "rgba(0, 150, 255, 0.12)";
      octx.fillRect(xy.x + 0.5, xy.y + 0.5, w - 1, h - 1);
      octx.setLineDash([6, 4]);
      octx.strokeRect(xy.x + 0.5, xy.y + 0.5, w - 1, h - 1);
      octx.setLineDash([]);

    } else   if (xy) { // (b) draw the current hover cell (on top)


      octx.lineWidth = 2;
      octx.strokeStyle = "rgba(0, 150, 255, 1)";
      octx.fillStyle = "rgba(0, 150, 255, 0.10)";
      octx.fillRect(xy.x + 0.5, xy.y + 0.5, cellSize - 1, cellSize - 1);
      octx.setLineDash([6, 4]);
      octx.strokeRect(xy.x + 0.5, xy.y + 0.5, cellSize - 1, cellSize - 1);
      octx.setLineDash([]);

      
    }
  },
  [cellSize, selectedRegion, regionToPixelRect, selectedTiles, tilesheets, scale]
);


const clearOverlay = () => {
  const overlay = overlayRef.current;
  const octx = overlay?.getContext("2d");
  if (overlay && octx) octx.clearRect(0, 0, overlay.width, overlay.height);
};

const handlePointerOut: React.PointerEventHandler<HTMLCanvasElement> = () => {
  setHoverXY(null);
  clearOverlay();
};


  // whenever hoverXY changes, redraw overlay
  useEffect(() => {
    if(!hoverXY) return;
    drawOverlaySelection(hoverXY);
  }, [hoverXY, drawOverlaySelection, drawMeta, selectedRegion, selectedTiles, tilesheets, palettes]);


  // pointer logic (use the OVERLAY for interaction so you never disturb the base)
  const handlePointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    // snap to cell
    const sx = Math.floor(xCss / cellSize) * cellSize;
    const sy = Math.floor(yCss / cellSize) * cellSize;

    // only update state if the snapped cell changed (prevents redundant paints)
    setHoverXY((prev) => (prev && prev.x === sx && prev.y === sy) ? prev : { x: sx, y: sy });
  };

  const handlePointerLeave: React.PointerEventHandler<HTMLCanvasElement> = () => {
    clearOverlay();
    setHoverXY(null); // clears overlay
  };

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const col = Math.floor(xCss / cellSize) * cellSize;
    const row = Math.floor(yCss / cellSize) * cellSize;

    if (col >= 0 && row >= 0) {
      onClick({ row, col });
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: (8 * cols * scale + 4) + "px",
        height: (8 * rows * scale + 4) + "px",
        borderRadius: "4px",
        overflow: "hidden"
      }}
    >
      {/* base layer */}
      <canvas
        ref={baseRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          imageRendering: "pixelated",
          cursor: "pointer",
          borderRadius: "4px"
        }}
      />
      {/* overlay layer */}
      <canvas
        ref={overlayRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerOut={handlePointerOut}   // optional, but helps across browsers
        onPointerDown={handlePointerDown}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          imageRendering: "pixelated",
          cursor: "crosshair",
          borderRadius: "4px"
        }}
      />
    </div>
  );
}
