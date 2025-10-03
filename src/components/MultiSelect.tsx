"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MultiSelectProps = {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;              // optional hidden input name (comma-joined)
  className?: string;         // extra classes for the trigger
  searchable?: boolean;       // show search input in dropdown
  maxDropdownHeight?: number; // px, defaults to 240
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  name,
  className = "",
  searchable = true,
  maxDropdownHeight = 240,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  // Filter options by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Ensure activeIndex stays in range after filtering
  useEffect(() => {
    if (!filtered.length) {
      setActiveIndex(-1);
    } else if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.findIndex((o) => !o.disabled));
    }
  }, [filtered, activeIndex]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !listRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next) {
      // focus search or list on open
      setTimeout(() => {
        if (searchable && searchRef.current) searchRef.current.focus();
        else listRef.current?.focus();
      }, 0);
      // initialize active index to first enabled option
      const firstIdx = filtered.findIndex((o) => !o.disabled);
      setActiveIndex(firstIdx);
    }
  };

  const commitToggle = (opt: Option) => {
    if (opt.disabled) return;
    const has = value.includes(opt.value);
    const next = has ? value.filter((v) => v !== opt.value) : [...value, opt.value];
    onChange(next);
  };

  const selectAll = () => {
    const allEnabled = filtered.filter((o) => !o.disabled).map((o) => o.value);
    onChange(Array.from(new Set([...value, ...allEnabled])));
  };

  const clearAll = () => onChange([]);

  const onKeyDownTrigger: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        toggleOpen();
      } else {
        // if already open, move focus into list
        listRef.current?.focus();
      }
    }
  };

  const moveActive = (delta: number) => {
    if (!filtered.length) return;
    let i = activeIndex;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) {
        setActiveIndex(i);
        break;
      }
    }
  };

  const onKeyDownList: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = filtered.findIndex((o) => !o.disabled);
      setActiveIndex(first);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = [...filtered].reverse().findIndex((o) => !o.disabled);
      setActiveIndex(last >= 0 ? filtered.length - 1 - last : -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex >= 0) commitToggle(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      selectAll();
    }
  };

  const selectedOptions = useMemo(
    () => value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as Option[],
    [value, options]
  );

  const selectedLabel =
    selectedOptions.length === 0
      ? ""
      : selectedOptions.length <= 3
      ? selectedOptions.map((o) => o!.label).join(", ")
      : `${selectedOptions.length} selected`;

  return (
    <div className="relative inline-block w-full">
      {/* Hidden input (comma-joined) for simple form POSTs if desired */}
      {name && <input type="hidden" name={name} value={value.join(",")} />}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        onKeyDown={onKeyDownTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${className}`}
      >
        <div className="flex flex-wrap items-center gap-1">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            <>
              {selectedOptions.slice(0, 3).map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-sm"
                >
                  {opt.label}
                  <button
                    type="button"
                    className="ml-1 rounded hover:bg-slate-200 focus:outline-none"
                    aria-label={`Remove ${opt.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(value.filter((v) => v !== opt.value));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedOptions.length > 3 && (
                <span className="text-sm text-slate-500">{selectedLabel}</span>
              )}
            </>
          )}
          <span className="ml-auto text-slate-400">▾</span>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {searchable && (
            <div className="p-2 border-b border-slate-200">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            tabIndex={0}
            onKeyDown={onKeyDownList}
            className="max-h-[var(--ms-height)] overflow-auto py-1 focus:outline-none"
            style={{ ["--ms-height" as any]: `${maxDropdownHeight}px` }}
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">No results</li>
            )}

            {filtered.map((opt, i) => {
              const selected = value.includes(opt.value);
              const isActive = i === activeIndex;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={opt.disabled || undefined}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()} // keep focus for keyboard users
                  onClick={() => commitToggle(opt)}
                  className={[
                    "flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm",
                    selected ? "bg-indigo-50 text-indigo-700" : "",
                    isActive ? "bg-slate-100" : "",
                    opt.disabled ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    tabIndex={-1}
                    checked={selected}
                    readOnly
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{opt.label}</span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-2">
            <div className="text-xs text-slate-500">
              {value.length} selected
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md px-2 py-1 text-xs hover:bg-slate-100"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md px-2 py-1 text-xs hover:bg-slate-100"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
