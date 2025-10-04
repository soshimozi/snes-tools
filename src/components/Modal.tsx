import React, { useEffect, useRef, useState } from "react";

type CloseReason = "backdrop-clicked" | "esc-pressed" | "close-button";

interface ModalProps {
  isOpen: boolean;
  title?: string;
  children: React.ReactElement;
  onClose?: (reason: CloseReason) => void;
  draggable?: boolean;
  /** Enable click outside to close (default: true) */
  closeOnBackdropClick?: boolean;
  /** Enable ESC key to close (default: true) */
  closeOnEsc?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title = "Modal",
  children,
  draggable = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
}) => {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const startPointerRef = useRef<{ x: number; y: number } | null>(null);
  const startOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const boxSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // helper
  const isInteractive = (el: HTMLElement | null) =>
    !!el?.closest("button, a, input, textarea, select, [role='button'], [data-no-drag]");

  useEffect(() => {
    if (isOpen) setOffset({ x: 0, y: 0 });
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!closeOnEsc) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose?.("esc-pressed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEsc, onClose]);

  if (!isOpen) return null;

  const clampOffset = (nx: number, ny: number) => {
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = boxSizeRef.current.w || 0;
    const h = boxSizeRef.current.h || 0;
    const maxX = Math.max(0, (vw - w) / 2 - margin);
    const maxY = Math.max(0, (vh - h) / 2 - margin);
    return { x: Math.min(maxX, Math.max(-maxX, nx)), y: Math.min(maxY, Math.max(-maxY, ny)) };
  };

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    if(isInteractive(e.target as HTMLElement)) return;

    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      boxSizeRef.current = { w: rect.width, h: rect.height };
    }
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { ...offset };
    document.body.style.userSelect = "none";
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !startPointerRef.current) return;
    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;
    const { x, y } = clampOffset(startOffsetRef.current.x + dx, startOffsetRef.current.y + dy);
    setOffset({ x, y });
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    document.body.style.userSelect = "";
  };


  // Backdrop click to close (make sure it's the backdrop, not inner box)
  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) return;
    if (e.target === e.currentTarget) {
      onClose?.("backdrop-clicked");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        ref={boxRef}
        className="bg-white rounded-lg shadow-lg max-w-md w-full fixed"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        // Stop clicks inside from bubbling to backdrop
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Title Bar (drag handle) */}
        <div
          className={`flex items-center justify-between bg-gray-100 px-4 py-2 rounded-t-lg border-b ${
            draggable ? "cursor-move select-none" : ""
          }`}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <h2 id="modal-title" className="text-lg font-semibold text-gray-800">
            {title}
          </h2>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onClose?.("close-button")}
            className="relative text-gray-500 hover:text-gray-700 text-xl leading-none p-1.5 rounded-full transition duration-150 hover:bg-gray-200 active:bg-gray-300 cursor-pointer"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
