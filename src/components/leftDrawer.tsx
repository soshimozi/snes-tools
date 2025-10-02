// LeftDrawer.tsx
import React, { useEffect, useRef } from "react";

type LeftDrawerProps = {
  open: boolean;
  onClose: () => void;
  widthClass?: string; // Tailwind width (defaults to w-64)
  children: React.ReactNode;
  /**
   * If true, the drawer is always visible on lg+ screens (acts like a left rail),
   * and only behaves like an overlay drawer on smaller screens.
   */
  persistentLg?: boolean;
  ariaLabel?: string;
};

export function LeftDrawer({
  open,
  onClose,
  widthClass = "w-64",
  children,
  persistentLg = true,
  ariaLabel = "Navigation drawer",
}: LeftDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when open (mobile)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop (mobile/tablet only) */}
      <div
        className={[
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          persistentLg ? "lg:hidden" : ""
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding panel (overlay on <lg) */}
      <aside
        role="dialog"
        aria-label={ariaLabel}
        aria-modal="true"
        ref={panelRef}
        className={[
          "fixed inset-y-0 left-0 z-50",
          widthClass,
          "transform transition-transform duration-300 will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // On lg+, if persistent, keep it visible and static
          persistentLg ? "lg:translate-x-0 lg:static lg:inset-auto lg:z-auto" : ""
        ].join(" ")}
      >
        <div className="h-full bg-white border-r border-slate-200 shadow-lg lg:shadow-none">
          {children}
        </div>
      </aside>
    </>
  );
}
