"use client";

import { SCALE } from "@/app/constants";
import { getCheckerPattern, indexToRowCol } from "@/Helpers";
import { Contextable, PasteMode } from "@/state/EditorDoc";
import { Cell, Region, Tile } from "@/types/EditorTypes";
import React, { useRef, useCallback, useEffect, useState } from "react";




export function Tilesheet({
  palette = ["#dddddd"],
  drawGridLines = false,
  transparentIndex0 = false,
  tiles,
  onSelected, 
  selected,
  /** controlled region */
  selectedRegion,
  /** raised on drag end (tile-snapped) */
  onRegionSelected,
  /** ---- NEW: context menu callbacks/caps ---- */
  canCopy,
  canPaste,
  onCopy,
  onPaste,
  onDelete,
  onContextMenuOpen,
  onPasteSpecial
}: {
  onSelected: (selected: Cell) => void;
  selected: Cell | null;
  tiles: Tile[];
  transparentIndex0?: boolean;
  palette?: string[];
  drawGridLines?: boolean;
  selectedRegion?: Region;
  onRegionSelected: (region?: Region) => void;
  onPasteSpecial?: (ctx: { at: Cell; cell: Cell | null; region?: Region; mode: PasteMode }) => void;
} & Contextable) {
  // ----- grid config -----
  const logicalTile = 8;
  const scale = SCALE;
  const cols = 16;
  const rows = 16;
  const cellSize = logicalTile * scale;
  const cssWidth = cols * cellSize;
  const cssHeight = rows * cellSize;

  const tilesheetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ----- drag state (internal) -----
  const dragStartRef = useRef<{ col: number; row: number; moved?: boolean } | null>(null);
  const [draftRegion, setDraftRegion] = useState<Region | null>(null);

  // ----- CONTEXT MENU state -----
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuXY, setMenuXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [menuAt, setMenuAt] = useState<Cell | null>(null);

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
      startCol: left,
      startRow: top,
      cols: (right - left) + 1,
      rows: (bottom - top) + 1,
    };
  };

  const drawTiles = useCallback(() => {
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round((cssWidth + 2) * dpr);
    c.height = Math.round((cssHeight + 2) * dpr);
    c.style.width = `${cssWidth + 2}px`;
    c.style.height = `${cssHeight + 2}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssWidth + 2, cssHeight + 2);

    if (transparentIndex0) {
      // implied transparency behind *everything*
      ctx.fillStyle = getCheckerPattern(ctx, 32);
    } else {
      ctx.fillStyle = palette[0] ?? "#000";
    }

    ctx.fillRect(0, 0, cssWidth + 2, cssHeight + 2);

    tiles.forEach((tile, index) => {
      const { row, col } = indexToRowCol(index);
      const dx = col * logicalTile * scale;
      const dy = row * logicalTile * scale;

      for (let y = 0; y < logicalTile; y++) {
        for (let x = 0; x < logicalTile; x++) {
          const pix = tile[y][x];
          const wx = dx + (x * scale);
          const wy = dy + (y * scale);

          if (pix === 0) {
            if (transparentIndex0) {
              continue;
              // ctx.fillStyle = pattern!;
              // ctx.fillRect(wx, wy, scale, scale);
            } else {
              ctx.fillStyle = palette[0] ?? "#000";
              ctx.fillRect(wx, wy, scale, scale);
            }
          } else {
            ctx.fillStyle = palette[pix] ?? "#000";
            ctx.fillRect(wx, wy, scale, scale);
          }
        }
      }
    });

    if (selected) {
      const { col, row } = selected;
      const x = col * cellSize;
      const y = row * cellSize;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      ctx.strokeStyle = "rgba(0, 150, 255, 1)";
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      ctx.setLineDash([]);
    }

    const paintRegion = (region: Region, styles?: { stroke?: string; fill?: string }) => {
      const x = region.startCol * cellSize;
      const y = region.startRow * cellSize;
      const w = region.cols * cellSize;
      const h = region.rows * cellSize;
      if (styles?.fill) {
        ctx.fillStyle = styles.fill;
        ctx.fillRect(x, y, w, h);
      }
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.setLineDash([]);
    };

    if (selectedRegion) {
      paintRegion(selectedRegion, {
        fill: "rgba(0, 150, 255, 0.12)",
        stroke: "rgba(0, 150, 255, 0.9)",
      });
    }
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

  // 1) Track the last tile position under the pointer so paste has a natural target
const lastPointerTileRef = useRef<Cell | null>(null);

// Update it anywhere we know the pointer tile
const updateLastPointer = (cell: Cell) => { lastPointerTileRef.current = cell; };

  useEffect(() => {
    drawTiles();
  }, [drawTiles]);

  // ----- pointer handlers -----
  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    // Left/middle button begins drag-select as usual; right-button is handled in onContextMenu
    if (e.button !== 0 && e.button !== 1) return;

    const c = tilesheetCanvasRef.current;
    if (!c) return;

    c.setPointerCapture?.(e.pointerId);

    const rect = c.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const start = snapToTile(xCss, yCss);


    updateLastPointer(start);             // <-- add this
    dragStartRef.current = { ...start, moved: false };

    // onSelected({ row: start.row, col: start.col });
    // setDraftRegion(null);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!dragStartRef.current) return;
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const cur = snapToTile(xCss, yCss);

    updateLastPointer(cur);               // <-- add this
    const region = normRectToRegion(dragStartRef.current, cur);

    dragStartRef.current.moved = true;
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

    const moved = start.moved;
    setDraftRegion(null);

    if (!moved || (draftRegion?.cols === 1 && draftRegion?.rows === 1)) {
      onRegionSelected(undefined);
      onSelected({ row: start.row, col: start.col });
      return;
    }

    const rect = c.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;
    const cur = snapToTile(xCss, yCss);
    const region = normRectToRegion(start, cur);

    onSelected(null);
    onRegionSelected(region);
  };

  const handlePointerLeave: React.PointerEventHandler<HTMLCanvasElement> = () => {
    setDraftRegion(null);
    dragStartRef.current = null;
  };

  // ----- CONTEXT MENU: right-click -----
  const handleContextMenu: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    const c = tilesheetCanvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;

    const at = snapToTile(xCss, yCss);

    updateLastPointer(at);                // <-- add this    
    setMenuAt(at);

    // Let parent intercept/override if desired
    const intercepted = onContextMenuOpen?.({
      mouse: { x: e.clientX, y: e.clientY },
      at,
      cell: selected,
      region: selectedRegion,
    });

    if (intercepted === true) return;

    // Position menu in viewport coords so it isn’t clipped by canvas
    setMenuXY({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  // Close menu on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      // if click happens on menu itself, ignore (we’ll handle inside)
      const target = ev.target as HTMLElement | null;
      if (target && target.closest?.("[data-tilesheet-menu]")) return;
      setMenuOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenuOpen(false);
      // Shortcuts
      const metaOrCtrl = ev.metaKey || ev.ctrlKey;
      if (metaOrCtrl && ev.key.toLowerCase() === "c") {
        if (canCopy?.({ cell: selected, region: selectedRegion }) ?? !!onCopy) {
          onCopy?.({ cell: selected, region: selectedRegion });
          setMenuOpen(false);
        }
      } else if (metaOrCtrl && ev.key.toLowerCase() === "v") {
        if (menuAt && (canPaste?.({ cell: selected, region: selectedRegion }) ?? !!onPaste)) {
          onPaste?.({ at: menuAt, cell: selected, region: selectedRegion });
          setMenuOpen(false);
        }
      } else if (ev.key === "Delete" || ev.key === "Backspace") {
        if (onDelete) {
          onDelete({ cell: selected, region: selectedRegion });
          setMenuOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, canCopy, canPaste, onCopy, onPaste, onDelete, selected, selectedRegion, menuAt]);

// 2) Global hotkeys: document-level keydown, independent of menu state
useEffect(() => {
  const isTypingTarget = (el: EventTarget | null) => {
    const n = el as HTMLElement | null;
    if (!n) return false;
    const tag = n.tagName?.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      (n as HTMLElement).isContentEditable === true
    );
  };

  const handler = (ev: KeyboardEvent) => {
    // Avoid hijacking typing/copy in inputs etc.
    if (isTypingTarget(ev.target)) return;

    const metaOrCtrl = ev.metaKey || ev.ctrlKey;
    const hasCopy = canCopy?.({ cell: selected, region: selectedRegion }) ?? !!onCopy;
    const hasPaste = canPaste?.({ cell: selected, region: selectedRegion }) ?? !!onPaste;
    const hasDelete = !!onDelete;

    // Choose a destination for paste:
    // 1) last pointer tile if available, else 2) current selected cell, else 3) top-left
    const pasteAt: Cell = lastPointerTileRef.current
      ?? (selected ?? { row: 0, col: 0 });

    if (metaOrCtrl && ev.key.toLowerCase() === "c") {
      if (hasCopy) {
        ev.preventDefault();
        onCopy?.({ cell: selected, region: selectedRegion });
      }
      return;
    }

    if (metaOrCtrl && ev.key.toLowerCase() === "v") {
      if (hasPaste) {
        ev.preventDefault();
        onPaste?.({ at: pasteAt, cell: selected, region: selectedRegion });
      }
      return;
    }

    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (hasDelete) {
        ev.preventDefault();
        onDelete?.({ cell: selected, region: selectedRegion });
      }
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [canCopy, canPaste, onCopy, onPaste, onDelete, selected, selectedRegion]);  

  const copyEnabled = (canCopy?.({ cell: selected, region: selectedRegion }) ?? !!onCopy);
  const pasteEnabled = (canPaste?.({ cell: selected, region: selectedRegion }) ?? !!onPaste);
  const deleteEnabled = !!onDelete;

  return (
    <>
      <canvas
        ref={tilesheetCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
        style={{ border: "none", imageRendering: "pixelated", cursor: "pointer", borderRadius: "4px" }}
      />

      {/* ---- CONTEXT MENU POPUP ---- */}
      {menuOpen && (
        <div
          data-tilesheet-menu
          className="fixed z-50 min-w-40 rounded-lg border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur px-1 py-1 text-sm select-none"
          style={{
            top: menuXY.y,
            left: menuXY.x,
            transform: "translate(2px, 2px)",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MenuItem
            label="Copy Selected"
            kbd={navigator.platform.includes("Mac") ? "⌘C" : "Ctrl+C"}
            disabled={!copyEnabled}
            onClick={() => {
              if (!copyEnabled) return;
              onCopy?.({ cell: selected, region: selectedRegion });
              setMenuOpen(false);
            }}
          />
          <MenuItem
            label="Paste At Cursor"
            kbd={navigator.platform.includes("Mac") ? "⌘V" : "Ctrl+V"}
            disabled={!pasteEnabled || !menuAt}
            onClick={() => {
              if (!pasteEnabled || !menuAt) return;
              onPaste?.({ at: menuAt, cell: selected, region: selectedRegion });
              setMenuOpen(false);
            }}
          />
          <Submenu
            label="Paste Special"
            kbd={navigator.platform.includes("Mac") ? "⌘V" : "Ctrl+V"}
            disabled={!pasteEnabled || !menuAt}
          >
            <MenuItem
              label="Color Blend Using And (c1 & c2)"
              onClick={() => {
                if (!menuAt) return;
                onPasteSpecial?.({ mode: "and", at: menuAt, cell: selected, region: selectedRegion });
                setMenuOpen(false);
              }}
            />
            <MenuItem
              label="Color Blend Using Or (c1 | c2)"
              onClick={() => {
                if (!menuAt) return;
                onPasteSpecial?.({ mode: "or", at: menuAt, cell: selected, region: selectedRegion });
                setMenuOpen(false);
              }}
            />
            <MenuItem
              label="Color Blend Using XOR (c1 ^ c2)"
              onClick={() => {
                if (!menuAt) return;
                onPasteSpecial?.({ mode: "xor", at: menuAt, cell: selected, region: selectedRegion });
                setMenuOpen(false);
              }}
            />
          </Submenu>          
          {/* <MenuItem
            label="Paste Special"
            kbd={navigator.platform.includes("Mac") ? "⌘V" : "Ctrl+V"}
            disabled={!pasteEnabled || !menuAt}
            onClick={() => {
              if (!pasteEnabled || !menuAt) return;
              onPaste?.({ at: menuAt, cell: selected, region: selectedRegion });
              setMenuOpen(false);
            }}
          />           */}
          <hr className="my-1 border-slate-700" />
          <MenuItem
            label="Clear Selected"
            kbd="Del"
            destructive
            disabled={!deleteEnabled}
            onClick={() => {
              if (!deleteEnabled) return;
              onDelete?.({ cell: selected, region: selectedRegion });
              setMenuOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}

// Small internal item renderer for the popup
function MenuItem({
  label,
  kbd,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  kbd?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-slate-800/80 active:bg-slate-800"
      ].join(" ")}
    >
      <span className={destructive ? "text-rose-300" : ""}>{label}</span>
      {kbd ? <span className="text-xs text-slate-400">{kbd}</span> : null}
    </button>
  );
}


function Submenu({
  label,
  kbd,
  disabled,
  destructive,
  children, // submenu items (use <MenuItem> inside)
}: {
  label: string;
  kbd?: string;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [openLeft, setOpenLeft] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);

  // Flip to the left if we’d overflow the viewport on the right
  const positionSubmenu = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estWidth = 220; // rough submenu width
    const wouldOverflowRight = rect.right + estWidth > window.innerWidth - 8;
    setOpenLeft(wouldOverflowRight);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { positionSubmenu(); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => { positionSubmenu(); setOpen((v) => !v); }}
        className={[
          "flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-slate-800/80 active:bg-slate-800"
        ].join(" ")}
      >
        <span className={destructive ? "text-rose-300" : ""}>{label}</span>
        <div className="flex items-center gap-2">
          {kbd ? <span className="text-xs text-slate-400">{kbd}</span> : null}
          {/* chevron */}
          <svg
            className="h-3.5 w-3.5 opacity-70"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7.293 14.707a1 1 0 0 1 0-1.414L9.586 11 7.293 8.707a1 1 0 1 1 1.414-1.414l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0z" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${label} submenu`}
          className="absolute z-[60] min-w-48 rounded-lg border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur px-1 py-1 text-sm"
          style={
            openLeft
              ? { top: 0, right: "100%", marginRight: "0.25rem" }
              : { top: 0, left: "100%", marginLeft: "0.25rem" }
          }
          onContextMenu={(e) => e.preventDefault()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
