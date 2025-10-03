"use client";

import React from "react";

type DraggableWindowProps = {
  /** Control visibility */
  open: boolean;
  /** Called when the user clicks the X */
  onClose: () => void;
  /** Window content */
  children: React.ReactNode;
  /** Optional title text shown in the title bar */
  title?: string;
  /** Optional initial position (px) */
  initialX?: number;
  initialY?: number;
  /** Optional className for the outer window */
  className?: string;
};

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  open,
  onClose,
  children,
  title = "Window",
  initialX = 100,
  initialY = 100,
  className = "",
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState({ x: initialX, y: initialY });
  const dragState = React.useRef<{
    dragging: boolean;
    offsetX: number;
    offsetY: number;
    pointerId?: number;
  }>({ dragging: false, offsetX: 0, offsetY: 0 });

  // Keep position when the window size changes: clamp to viewport
  const clampToViewport = React.useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(0, vw - rect.width);
    const maxY = Math.max(0, vh - rect.height);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }, []);

  // Re-clamp on resize
  React.useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToViewport]);

  const onPointerDownTitle: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Start dragging from the title bar
    if (!ref.current) return;
    // Only left button or primary touch/pen
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const rect = ref.current.getBoundingClientRect();
    dragState.current.dragging = true;
    dragState.current.offsetX = e.clientX - rect.left;
    dragState.current.offsetY = e.clientY - rect.top;
    dragState.current.pointerId = e.pointerId;

    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // some browsers might throw—safe to ignore
    }

    // Prevent selecting text while dragging
    document.body.classList.add("select-none");
  };

  const onPointerMoveTitle: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragState.current.dragging) return;
    const next = clampToViewport(
      e.clientX - dragState.current.offsetX,
      e.clientY - dragState.current.offsetY
    );
    setPos(next);
  };

  const endDrag = React.useCallback(() => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    dragState.current.pointerId = undefined;
    document.body.classList.remove("select-none");
  }, []);

  const onPointerUpTitle: React.PointerEventHandler<HTMLDivElement> = () => endDrag();
  const onPointerCancelTitle: React.PointerEventHandler<HTMLDivElement> = () => endDrag();

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className={[
        "fixed", // stays on screen as you scroll
        "z-50",
        "shadow-2xl",
        "rounded-2xl",
        "border border-slate-200 dark:border-slate-700",
        "bg-white dark:bg-slate-900",
        "min-w-[280px] max-w-[min(90vw,800px)]",
        "select-auto",
        className,
      ].join(" ")}
      role="region"
      aria-label={title}
    >
      {/* Title bar */}
      <div
        className={[
          "cursor-grab active:cursor-grabbing",
          "flex items-center justify-between",
          "rounded-t-2xl",
          "px-3 py-2",
          "bg-slate-100 dark:bg-slate-800",
          "border-b border-slate-200 dark:border-slate-700",
        ].join(" ")}
        onPointerDown={onPointerDownTitle}
        onPointerMove={onPointerMoveTitle}
        onPointerUp={onPointerUpTitle}
        onPointerCancel={onPointerCancelTitle}
      >
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
          {title}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close window"
          className={[
            "h-7 w-7 grid place-items-center",
            "rounded-lg",
            "text-slate-500 hover:text-slate-900 dark:hover:text-white",
            "hover:bg-slate-200/60 dark:hover:bg-slate-700/60",
            "transition-colors",
          ].join(" ")}
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
};
