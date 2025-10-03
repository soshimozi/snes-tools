"use client";
import { SCALE } from "@/app/constants";
import { MetaSpriteEntry, Sheet, Tile } from "@/types/EditorTypes";
import React, { useRef, useCallback, useEffect } from "react";

export function MetaSpriteEditor(
  {
    entries, onClick, palettes, tilesheets, selected, highlightSelected = false, drawGrid = false
  }: {
    entries: MetaSpriteEntry[];
    onClick: ({row, col} : {row: number, col: number}) => void;
    palettes: string[][];
    tilesheets: Sheet[];
    selected?: MetaSpriteEntry;
    highlightSelected?: boolean;
    drawGrid?: boolean;
  }) {

  const logicalTile = 8; // your underlying tile size
  const scale = SCALE; // scale factor (so each cell = 16px)
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale; // 16

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Normalize into [0,mod)
  const norm = (n: number, mod: number) => ((n % mod) + mod) % mod;

  /**
   * For a rectangle at (x,y) with size (w,h), return all positions
   * we need to draw at to achieve seamless wrap within (wrapW, wrapH).
   * Positions are normalized to the 0..wrap range.
   */
  function wrappedPositions(x: number, y: number, w: number, h: number, wrapW: number, wrapH: number): Array<[number, number]> {
    const xm = norm(x, wrapW);
    const ym = norm(y, wrapH);

    const pos: Array<[number, number]> = [[xm, ym]];

    const crossesRight = xm + w > wrapW;
    const crossesBottom = ym + h > wrapH;

    if (crossesRight) pos.push([xm - wrapW, ym]);           // copy on left
    if (crossesBottom) pos.push([xm, ym - wrapH]);          // copy on top
    if (crossesRight && crossesBottom) pos.push([xm - wrapW, ym - wrapH]); // top-left corner

    return pos;
  }

  const getTilePixel = (tile: Tile, x: number, y: number, h: boolean, v: boolean, r: number) => {
    const newTile: number[][] = {...tile};
    
    let xnew = h ? 7 - x : x;
    let ynew = v ? 7 - y : y;

    if(r < 0) {
      // counter clockwise
      for(let ri = r; ri < 0; ri++) {
        let xtemp = ynew;
        ynew = 7 - xnew;
        xnew = xtemp;
      }
    } else if(r > 0) {
      // clockwise
      for(let ri = 0; ri < r; ri++) {
      let ytemp = xnew;
      xnew = 7 - ynew;
      ynew = ytemp;       
      }
    }

    return newTile[ynew][xnew];
  }

  const drawMeta = useCallback(() => {
    const scale = SCALE; // preview scale per pixel
    const c = canvasRef.current;
    if (!c) return;
    c.width = 8 * cols * scale + 4;
    c.height = 8 * rows * scale + 4;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = palettes[0][0];
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = palettes[0][0];
    ctx.fillRect(0, 0, scale * 8 * 16 + 2, scale * 8 * 16 + 2);

    const WRAP_W = scale * 8 * cols; // e.g., 16 tiles * 8px * scale
    const WRAP_H = scale * 8 * rows;

    entries.forEach((e) => {
      const tile = tilesheets[e.tileSheetIndex].tiles[e.tileIndex];

      // tile top-left (already in world pixel coordinates, can be negative or > WRAP)
      const dx = e.x;
      const dy = e.y;

      // one tile’s rendered size in pixels
      const tileW = 8 * scale;
      const tileH = 8 * scale;

      // where should we draw this tile (including wrap copies)?
      const positions = wrappedPositions(dx, dy, tileW, tileH, WRAP_W, WRAP_H);

      for (const [bx, by] of positions) {
        // draw the 8x8 tile pixels at this base position
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const pix = getTilePixel(tile, x, y, e.h, e.v, e.r);
            if (pix !== 0) {
              const wx = bx + x * scale;
              const wy = by + y * scale;
              ctx.fillStyle = palettes[e.paletteIndex][pix] ?? "#000";
              ctx.fillRect(wx, wy, scale, scale);
            }
          }
        }
      }
    });    

    if (highlightSelected && selected) {
      const tileW = 8 * scale;
      const tileH = 8 * scale;
      const positions = wrappedPositions(selected.x, selected.y, tileW, tileH, WRAP_W, WRAP_H);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      for (const [bx, by] of positions) {
        ctx.strokeRect(bx, by, tileW, tileH);
      }
    }    

    if(drawGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#555";

      // render grid
      ctx.setLineDash([7, 5]);
      const endx = scale * 8 * 16;
      const endy = scale * 8 * 16;
      for (var x = 1; x <= 8; x++) {
        ctx.beginPath();
        ctx.moveTo(scale * 16 * x + .5, 0);
        ctx.lineTo(scale * 16 * x + .5, endy);
        ctx.stroke();
      }
      for (var y = 1; y <= 8; y++) {
        ctx.beginPath();
        ctx.moveTo(0, scale * 16 * y + .5);
        ctx.lineTo(endx, scale * 16 * y + .5);
        ctx.stroke();
      }

      // render center lines
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(scale * 16 * 4 + .5, 0);
      ctx.lineTo(scale * 16 * 4 + .5, endy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, scale * 16 * 4 + .5);
      ctx.lineTo(endx, scale * 16 * 4 + .5);
      ctx.stroke();

      ctx.setLineDash([]);
    }

  }, [entries, palettes, tilesheets, selected, highlightSelected, drawGrid]);

  useEffect(() => { drawMeta(); }, [drawMeta]);

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const c = canvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect(); // CSS pixels
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const col = Math.floor(xCss / cellSize) * cellSize;
    const row = Math.floor(yCss / cellSize) * cellSize;

    if (col >= 0 && row >= 0) {
      onClick({row, col});
    }
  };
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      style={{ border: "none", imageRendering: "pixelated", cursor: "pointer", borderRadius: "4px" }} />
  );
}
