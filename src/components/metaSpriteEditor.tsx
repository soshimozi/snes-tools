"use client";
import { MetaSpriteEntry, Tile } from "@/types/editorTypes";
import React, { useRef, useCallback, useEffect } from "react";

export function MetaSpriteEditor(
  {
    entries, onClick, palettes, tiles, selected, highlightSelected = false, drawGrid = false
  }: {
    entries: MetaSpriteEntry[];
    onClick: ({row, col} : {row: number, col: number}) => void;
    palettes: string[][];
    tiles: Tile[];
    selected?: MetaSpriteEntry;
    highlightSelected?: boolean;
    drawGrid?: boolean;
  }) {

  const logicalTile = 8; // your underlying tile size
  const scale = 3; // scale factor (so each cell = 16px)
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale; // 16
  const cssWidth = cols * cellSize; // 256
  const cssHeight = rows * cellSize; // 256

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

/*
  const rotateTileCW = () => transformTile((src) => {
    const out = makeBlankTile();
    // out[y][x] = src[7 - x][y]
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[7 - x][y];
    return out;
  });

  const rotateTileCCW = () => transformTile((src) => {
    const out = makeBlankTile();
    // out[y][x] = src[x][7 - y]
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[y][x] = src[x][7 - y];
    return out;
  });
*/
    //}
    

    return newTile[ynew][xnew];
  }

  const drawMeta = useCallback(() => {
    const scale = 3; // preview scale per pixel
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

    // Pure render: draw tiles as-is in A/B/C/D positions, no flips or offsets
    entries.forEach((e, i) => {

      const dx = e.x; // * 8 * scale;
      const dy = e.y; // * 8 * scale;
      const tile = tiles[e.tileIndex];

      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const pix = getTilePixel(tile, x, y, e.h, e.v, e.r);
          if( pix !== 0) {
            const wx = dx + (x * scale);
            const wy = dy + (y * scale);
            ctx.fillStyle =  palettes[e.paletteIndex][pix] ?? "#000";
            ctx.fillRect(wx, wy, scale, scale);
          }
        }
      }
    });
    
    if(highlightSelected && selected) {
      const row = selected.y;
      const col = selected.x;

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff"
      ctx.beginPath();
      ctx.strokeRect(col, row, 8 * scale, 8 * scale);
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

  }, [entries, palettes, tiles, selected, highlightSelected, drawGrid]);

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
      style={{ border: "1px solid #ccc", imageRendering: "pixelated", cursor: "pointer", borderRadius: "4px" }} />
  );
}
