"use client";
import { SCALE } from "@/app/constants";
import { indexToRowCol } from "@/helpers";
import { Cell, Tile } from "@/types/editorTypes";
import React, { useRef, useCallback, useEffect } from "react";

export function Tilesheet(
  {
    palette = ["#dddddd"], drawGridLines = false, tiles, onSelected, selected
  }: {
    onSelected: (selected: Cell) => void;
    selected: Cell | null;
    tiles: Tile[];
    palette?: string[];
    drawGridLines?: boolean;
  }) {

  // ----- grid config -----
  const logicalTile = 8; // your underlying tile size
  const scale = SCALE; // scale factor (so each cell = 16px)
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale; // 16
  const cssWidth = (cols * cellSize) + 4; // 256
  const cssHeight = (rows * cellSize) + 4; // 256

  const tilesheetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawTiles = useCallback(() => {
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    // Backing store size (actual pixels) vs CSS size (layout pixels)
    c.width = Math.round(cssWidth * dpr);
    c.height = Math.round(cssHeight * dpr);
    c.style.width = `${cssWidth + 4}px`;
    c.style.height = `${cssHeight + 4}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Normalize drawing to CSS pixel units
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = palette[0] ?? "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    tiles.forEach((tile, index) => {

      const { row, col } = indexToRowCol(index);

      const dx = col * 8 * scale;
      const dy = row * 8 * scale;

      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const pix = tile[y][x];
          const wx = dx + (x * scale);
          const wy = dy + (y * scale);
          ctx.fillStyle = palette[pix] ?? "#000";
          ctx.fillRect(wx, wy, scale, scale);
        }
      }
    });

    // Highlight selected cell
    if (selected) {
      const { col, row } = selected;
      const x = col * cellSize;
      const y = row * cellSize;

      // Border highlight
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }
  }, [palette, selected, cssWidth, cssHeight, cellSize, cols, rows, drawGridLines, tiles]);

  useEffect(() => {
    drawTiles();
  }, [drawTiles]);

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect(); // CSS pixels
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const col = Math.floor(xCss / cellSize);
    const row = Math.floor(yCss / cellSize);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      onSelected({ row, col });
    }
  };

  return (
    <canvas
      ref={tilesheetCanvasRef}
      onPointerDown={handlePointerDown}
      style={{ imageRendering: "pixelated", cursor: "pointer", borderRadius: "3px" }} />
  );
}
