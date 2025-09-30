import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type SingleOption = {
  value: string;
  lines: string[];     // multi-line label (each string renders on its own line)
  disabled?: boolean;
};

type SingleSelectListProps = {
  options: SingleOption[];
  value: string | null;                 // selected id (or null)
  onChange: (next: string) => void;
  className?: string;
  maxHeight?: number;                   // px; defaults to 280
  minHeight?: number;
};

export function SingleSelectList({
  options,
  value,
  onChange,
  className = "",
  maxHeight = 280,
  minHeight = 100,
}: SingleSelectListProps) {
  const groupId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex(o => o.value === value && !o.disabled))
  );

  useEffect(() => {
    // keep activeIndex in range and prefer the selected item
    const selIdx = options.findIndex(o => o.value === value && !o.disabled);
    if (selIdx >= 0) setActiveIndex(selIdx);
    else if (activeIndex >= options.length) setActiveIndex(options.length - 1);
  }, [options, value]);

  const move = (delta: number) => {
    if (!options.length) return;
    let i = activeIndex;
    for (let step = 0; step < options.length; step++) {
      i = (i + delta + options.length) % options.length;
      if (!options[i].disabled) {
        setActiveIndex(i);
        break;
      }
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(options.length - 1); }
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt && !opt.disabled) onChange(opt.value);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <ul
        ref={listRef}
        role="radiogroup"
        aria-labelledby={groupId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-slate-300 bg-white p-1 outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ maxHeight, overflow: "auto", minHeight }}
      >
        {options.map((opt, i) => {
          const selected = value === opt.value;
          const active = i === activeIndex;
          const base =
            "flex items-start gap-3 rounded-md px-3 py-1 cursor-pointer select-none";
          const state =
            (opt.disabled ? "opacity-50 cursor-not-allowed " : "") +
            (selected ? "bg-indigo-50 ring-1 ring-indigo-300 " : active ? "bg-slate-100 " : "");

          return (
            <li
              key={opt.value}
              role="radio"
              aria-checked={selected}
              aria-disabled={opt.disabled || undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => !opt.disabled && onChange(opt.value)}
              className={base + " " + state}
            >
              {/* Multi-line label */}
              <div className="flex min-w-0 flex-col">
                {opt.lines.map((line, idx) => (
                  <span
                    key={idx}
                    className={idx === 0 ? "text-sm font-medium text-slate-800" : "text-xs text-slate-600"}
                  >
                    {line}
                  </span>
                ))}
              </div>
            </li>
          );
        })}

        {options.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500">No items</li>
        )}
      </ul>
    </div>
  );
}
