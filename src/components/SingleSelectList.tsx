"use client";

import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useId, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  title: string;
  lines: string[];     // multi-line label (each string renders on its own line)
  disabled?: boolean;
};

type SelectListProps = {
  options: SelectOption[];
  values: string[];                        // <-- CHANGED: multi selected ids
  onChange: (next: string[]) => void;      // <-- CHANGED: emit array
  onDeleteItem?: (itemId: string) => void;
  className?: string;
  maxHeight?: number;                      // px; defaults to 280
  minHeight?: number;
  onDrop?: (fromIndex: number, toIndex: number) => void;
  onDropMulti?: (fromIndices: number[], toIndex: number) => void; // <-- NEW
};

export function SelectList({
  options,
  values,
  onChange,
  onDeleteItem,
  onDrop,
  onDropMulti,
  className = "",
  maxHeight = 280,
  minHeight = 100,
}: SelectListProps) {
  const groupId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);

  // Find a sensible active index: prefer the first selected, else first enabled
  const firstSelectedIndex = Math.max(
    0,
    options.findIndex(o => values.includes(o.value) && !o.disabled)
  );
  const firstEnabledIndex = Math.max(0, options.findIndex(o => !o.disabled));

  const [activeIndex, setActiveIndex] = useState(
    firstSelectedIndex >= 0 ? firstSelectedIndex : firstEnabledIndex
  );

  // Anchor for range selection (set on the first plain click)
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);

  /* ----------------------------- effects ----------------------------- */
  useEffect(() => {
    // keep activeIndex in range and prefer a selected item
    const selIdx = options.findIndex(o => values.includes(o.value) && !o.disabled);
    if (selIdx >= 0) setActiveIndex(selIdx);
    else if (activeIndex >= options.length) setActiveIndex(Math.max(0, options.length - 1));
  }, [options, values]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----------------------------- helpers ----------------------------- */
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

  const indicesInRange = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const result: number[] = [];
    for (let i = lo; i <= hi; i++) {
      if (!options[i]?.disabled) result.push(i);
    }
    return result;
  };

  const selectSingleIndex = (i: number) => {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange([opt.value]);
    setAnchorIndex(i);
  };

  const selectRangeToIndex = (i: number) => {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    const start = anchorIndex ?? i;
    const idxs = indicesInRange(start, i);
    onChange(idxs.map(ix => options[ix].value));
  };

  /* ----------------------------- keyboard ---------------------------- */
  const onKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(options.length - 1); }
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) selectRangeToIndex(activeIndex);
      else selectSingleIndex(activeIndex);
    } else if ((e.key === "Delete" || e.key === "Backspace") && onDeleteItem) {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) {
        onDeleteItem(options[activeIndex].value);
      }
    }
  };

  // inside your SelectList component
const addIndexToSelectRange = (i: number) => {
  const opt = options[i];
  if (!opt || opt.disabled) return;

  const isSelected = values.includes(opt.value);

  let next: string[];
  if (isSelected) {
    // remove it
    next = values.filter(v => v !== opt.value);
  } else {
    // add it (then normalize order by options)
    next = [...values, opt.value];
    const order = new Map(options.map((o, idx) => [o.value, idx]));
    next.sort((a, b) => (order.get(a)! - order.get(b)!));
  }

  onChange(next);

  // Update focus and (optionally) the anchor.
  setActiveIndex(i);

  // Common + intuitive behavior: let Shift use the last clicked item as anchor.
  // If you prefer to preserve the previous anchor on Ctrl clicks, just guard this:
  // if (anchorIndex === null) setAnchorIndex(i);
  setAnchorIndex(i);
};

  /* -------------------------- drag & drop state ----------------------- */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragSet, setDragSet] = useState<number[] | null>(null); // <-- NEW

  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [overEnd, setOverEnd] = useState<boolean>(false);

const handleDragStart = (index: number, e: React.DragEvent) => {
  if (options[index]?.disabled) { e.preventDefault(); return; }
  setDragIndex(index);

  // If the row we grabbed is selected, drag all selected (enabled) rows.
  const grabbedIsSelected = values.includes(options[index].value);
  if (grabbedIsSelected) {
    const selectedEnabledIndices = options
      .map((o, i) => (!o.disabled && values.includes(o.value) ? i : -1))
      .filter(i => i >= 0);
    setDragSet(selectedEnabledIndices);
  } else {
    setDragSet([index]);
  }

  setOverIndex(null);
  setOverEnd(false);
  e.dataTransfer.effectAllowed = "move";
};

  const handleDragEnterRow = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null) return;
    setOverEnd(false);
    setOverIndex(index);
  };

  const handleDragOverRow = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null) return;
    e.dataTransfer.dropEffect = "move";
    setOverEnd(false);
    setOverIndex(index);
  };

  const handleDragEnterEnd = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null) return;
    setOverIndex(null);
    setOverEnd(true);
  };

  const handleDragOverEnd = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null) return;
    e.dataTransfer.dropEffect = "move";
    setOverIndex(null);
    setOverEnd(true);
  };

const handleDropOnRow = (index: number, e: React.DragEvent) => {
  e.preventDefault();
  if (dragIndex === null || !dragSet || dragSet.length === 0) { clearDnD(); return; }

  // If dropping on one of the dragged rows, do nothing
  if (dragSet.includes(index)) { clearDnD(); return; }

  // Sort ascending to preserve original order
  const from = [...dragSet].sort((a, b) => a - b);

  // Adjust target to account for removals above the target
  let insertAt = index;
  for (const i of from) {
    if (i < insertAt) insertAt--;
  }

  if (typeof onDropMulti === "function") {
    onDropMulti(from, insertAt);
  } else if (typeof onDrop === "function") {
    // backward compatible fallback: move only the first
    onDrop(from[0], insertAt);
  }

  clearDnD();
};

const handleDropOnEnd = (e: React.DragEvent) => {
  e.preventDefault();
  if (dragIndex === null || !dragSet || dragSet.length === 0) { clearDnD(); return; }

  const from = [...dragSet].sort((a, b) => a - b);

  // When dropping at the end, remaining length is options.length - from.length
  const insertAt = options.length - from.length;

  if (typeof onDropMulti === "function") {
    onDropMulti(from, insertAt);
  } else if (typeof onDrop === "function") {
    onDrop(from[0], insertAt);
  }

  clearDnD();
};

const clearDnD = () => {
  setDragIndex(null);
  setDragSet(null);          // <-- reset
  setOverIndex(null);
  setOverEnd(false);
};

  /* ------------------------------- render ---------------------------- */
  return (
    <div className={`relative ${className}`}>
      <ul
        ref={listRef}
        role="listbox"
        aria-labelledby={groupId}
        aria-multiselectable="true"
        tabIndex={0}
        onDragEnd={clearDnD}
        onKeyDown={onKeyDown}
        className="w-full rounded border border-slate-300 bg-white p-1 outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ maxHeight, overflow: "auto", minHeight }}
      >
        {options.map((opt, i) => {
          const selected = values.includes(opt.value);
          const active = i === activeIndex;

          const base =
            "flex items-center justify-between gap-3 rounded-md px-3 py-1 cursor-pointer select-none";
          const state =
            (opt.disabled ? "opacity-50 cursor-not-allowed " : "") +
            (selected ? "bg-indigo-50 ring-1 ring-indigo-300 " : active ? "bg-slate-100 " : "");

          const dndTopBar =
            overIndex === i
              ? "relative before:absolute before:-top-0.5 before:left-0 before:right-0 before:h-1 before:bg-blue-400 before:rounded-t"
              : "";

          const draggable = !opt.disabled;

          return (
            <li
              key={opt.value}
              role="option"
              title={opt.title}
              aria-selected={selected}
              aria-disabled={opt.disabled || undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                if (opt.disabled) return;
                if (e.shiftKey) {
                  // range select based on anchor (or self)
                  selectRangeToIndex(i);
                } else if (e.ctrlKey || e.metaKey)  {
                  addIndexToSelectRange(i);
                } else {
                  // single selection + set anchor
                  selectSingleIndex(i);
                }
              }}
              className={`${base} ${state} ${dndTopBar}`}
              draggable={draggable}
              onDragStart={(e) => handleDragStart(i, e)}
              onDragEnter={(e) => handleDragEnterRow(i, e)}
              onDragOver={(e) => handleDragOverRow(i, e)}
              onDrop={(e) => handleDropOnRow(i, e)}
            >
              <span
                className="mr-1 shrink-0 cursor-grab text-slate-400"
                title="Drag to reorder"
                aria-hidden="true"
                onMouseDown={(e) => e.stopPropagation()}
              >
                ⋮⋮
              </span>

              <div className="flex w-full items-center justify-between">
                <div className="flex min-w-0 flex-col">
                  {opt.lines.map((line, idx) => (
                    <span
                      key={idx}
                      className={idx === 0 ? "text-xs font-medium text-slate-800" : "text-xs text-slate-600"}
                    >
                      {line}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  aria-label="Delete item"
                  title="Delete"
                  className="ml-3 shrink-0 rounded-md border border-red-600 bg-red-600 px-2 py-1 text-white text-[10px]
                             hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 active:brightness-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteItem) onDeleteItem(opt.value);
                  }}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </li>
          );
        })}

        {options.length > 0 && (
          <li
            className={`h-3 mx-1 my-1 rounded ${overEnd ? "bg-blue-400" : "bg-transparent"}`}
            onDragEnter={handleDragEnterEnd}
            onDragOver={handleDragOverEnd}
            onDrop={handleDropOnEnd}
          />
        )}

        {options.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500">No items</li>
        )}
      </ul>
    </div>
  );
}


// import { faTrash } from "@fortawesome/free-solid-svg-icons";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import React, { useEffect, useId, useMemo, useRef, useState } from "react";

// export type SelectOption = {
//   value: string;
//   lines: string[];     // multi-line label (each string renders on its own line)
//   disabled?: boolean;
// };

// type SelectListProps = {
//   options: SelectOption[];
//   value: string | null;                 // selected id (or null)
//   onChange: (next: string) => void;
//   onDeleteItem?: (itemId: string) => void; // <-- NEW
//   className?: string;
//   maxHeight?: number;                   // px; defaults to 280
//   minHeight?: number;
//   onDrop?: (fromIndex: number, toIndex: number) => void;
// };

// export function SelectList({
//   options,
//   value,
//   onChange,
//   onDeleteItem,
//   onDrop,
//   className = "",
//   maxHeight = 280,
//   minHeight = 100,
// }: SelectListProps) {
//   const groupId = useId();
//   const listRef = useRef<HTMLUListElement | null>(null);
//   const [activeIndex, setActiveIndex] = useState(() =>
//     Math.max(0, options.findIndex(o => o.value === value && !o.disabled))
//   );

//   // DnD state
//   const [dragIndex, setDragIndex] = useState<number | null>(null);
//   const [overIndex, setOverIndex] = useState<number | null>(null); // which row are we hovering
//   const [overEnd, setOverEnd] = useState<boolean>(false); // hovering the end drop zone


//   useEffect(() => {
//     // keep activeIndex in range and prefer the selected item
//     const selIdx = options.findIndex(o => o.value === value && !o.disabled);
//     if (selIdx >= 0) setActiveIndex(selIdx);
//     else if (activeIndex >= options.length) setActiveIndex(options.length - 1);
//   }, [options, value]);

//   const move = (delta: number) => {
//     if (!options.length) return;
//     let i = activeIndex;
//     for (let step = 0; step < options.length; step++) {
//       i = (i + delta + options.length) % options.length;
//       if (!options[i].disabled) {
//         setActiveIndex(i);
//         break;
//       }
//     }
//   };

//   const onKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
//     if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
//     else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
//     else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
//     else if (e.key === "End") { e.preventDefault(); setActiveIndex(options.length - 1); }
//     else if (e.key === " " || e.key === "Enter") {
//       e.preventDefault();
//       const opt = options[activeIndex];
//       if (opt && !opt.disabled) onChange(opt.value);
//     } else if ((e.key === "Delete" || e.key === "Backspace") && onDeleteItem) {
//       e.preventDefault();
//       if (activeIndex >= 0 && activeIndex < options.length) {
//         onDeleteItem(options[activeIndex].value);
//       }
//     }
//   };

//   const handleDragStart = (index: number, e: React.DragEvent) => {
//     if (options[index]?.disabled) { e.preventDefault(); return; }
//     setDragIndex(index);
//     setOverIndex(null);
//     setOverEnd(false);
//     e.dataTransfer.effectAllowed = "move";
//     // Optional: nicer drag preview
//     // e.dataTransfer.setDragImage(customImage, x, y);
//   };

//   const handleDragEnterRow = (index: number, e: React.DragEvent) => {
//     e.preventDefault();
//     if (dragIndex === null) return;
//     setOverEnd(false);
//     setOverIndex(index);
//   };

//   const handleDragOverRow = (index: number, e: React.DragEvent) => {
//     e.preventDefault(); // allow drop
//     if (dragIndex === null) return;
//     e.dataTransfer.dropEffect = "move";
//     setOverEnd(false);
//     setOverIndex(index);
//   };

//   const handleDropOnRow = (index: number, e: React.DragEvent) => {
//     e.preventDefault();
//     if (dragIndex === null || dragIndex === index) { clearDnD(); return; }
//     onDrop?.(dragIndex, index); // insert before target index
//     clearDnD();
//   };

//   const handleDragEnterEnd = (e: React.DragEvent) => {
//     e.preventDefault();
//     if (dragIndex === null) return;
//     setOverIndex(null);
//     setOverEnd(true);
//   };

//   const handleDragOverEnd = (e: React.DragEvent) => {
//     e.preventDefault();
//     if (dragIndex === null) return;
//     e.dataTransfer.dropEffect = "move";
//     setOverIndex(null);
//     setOverEnd(true);
//   };

//   const handleDropOnEnd = (e: React.DragEvent) => {
//     e.preventDefault();
//     if (dragIndex === null) { clearDnD(); return; }
//     onDrop?.(dragIndex, options.length); // move to end
//     clearDnD();
//   };

//   const clearDnD = () => {
//     setDragIndex(null);
//     setOverIndex(null);
//     setOverEnd(false);
//   };  

//   return (
//     <div className={`relative ${className}`}>
//       <ul
//         ref={listRef}
//         role="radiogroup"
//         aria-labelledby={groupId}
//         tabIndex={0}
//         onDragEnd={clearDnD}
//         onKeyDown={onKeyDown}
//         className="w-full rounded-lg border border-slate-300 bg-white p-1 outline-none focus:ring-2 focus:ring-indigo-500"
//         style={{ maxHeight, overflow: "auto", minHeight }}
//       >
//         {options.map((opt, i) => {
//           const selected = value === opt.value;
//           const active = i === activeIndex;

//           const base =
//             "flex items-center justify-between gap-3 rounded-md px-3 py-1 cursor-pointer select-none";
//           const state =
//             (opt.disabled ? "opacity-50 cursor-not-allowed " : "") +
//             (selected ? "bg-indigo-50 ring-1 ring-indigo-300 " : active ? "bg-slate-100 " : "");

//           // DnD highlight: show a blue bar at the top of the hovered target row
//           const dndTopBar =
//             overIndex === i
//               ? "relative before:absolute before:-top-0.5 before:left-0 before:right-0 before:h-1 before:bg-blue-400 before:rounded-t"
//               : "";

//           const draggable = !opt.disabled;

//           return (
//             <li
//               key={opt.value}
//               role="radio"
//               aria-checked={selected}
//               aria-disabled={opt.disabled || undefined}
//               onMouseEnter={() => setActiveIndex(i)}
//               onMouseDown={(e) => e.preventDefault()}
//               onClick={() => !opt.disabled && onChange(opt.value)}
//               className={`${base} ${state} ${dndTopBar}`}
//               draggable={draggable}
//               // DnD handlers
//               onDragStart={(e) => handleDragStart(i, e)}
//               onDragEnter={(e) => handleDragEnterRow(i, e)}
//               onDragOver={(e) => handleDragOverRow(i, e)}
//               onDrop={(e) => handleDropOnRow(i, e)}
//             >
//               {/* Drag handle (optional): you can make a visible handle if you prefer */}
//               <span
//                 className="mr-1 shrink-0 cursor-grab text-slate-400"
//                 title="Drag to reorder"
//                 aria-hidden="true"
//                 onMouseDown={(e) => e.stopPropagation()}
//               >
//                 ⋮⋮
//               </span>
//               {/* Multi-line label */}
//               <div className="flex w-full items-center justify-between">
//                 <div className="flex min-w-0 flex-col">
//                   {opt.lines.map((line, idx) => (
//                     <span
//                       key={idx}
//                       className={idx === 0 ? "text-sm font-medium text-slate-800" : "text-xs text-slate-600"}
//                     >
//                       {line}
//                     </span>
//                   ))}
//                 </div>
//                 <button
//                   type="button"
//                   aria-label="Delete item"
//                   title="Delete"
//                   className="ml-3 shrink-0 rounded-md border border-red-600 bg-red-600 px-2 py-1 text-white text-xs
//                             hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 active:brightness-110"
//                   onClick={(e) => {
//                     e.stopPropagation(); // prevent selecting the row
//                     if (onDeleteItem) onDeleteItem(opt.value);
//                   }}

//                 draggable={false}
//                 onDragStart={(e) => e.preventDefault()}
//                 onMouseDown={(e) => e.stopPropagation()}                  
//                 >
//                    <FontAwesomeIcon icon={faTrash} />
//                 </button>             
//               </div> 
//             </li>
//           );
//         })}

//         {/* End drop zone (appears as a blue bar when hovered during drag) */}
//         {options.length > 0 && (
//           <li
//             className={`h-3 mx-1 my-1 rounded ${overEnd ? "bg-blue-400" : "bg-transparent"}`}
//             onDragEnter={handleDragEnterEnd}
//             onDragOver={handleDragOverEnd}
//             onDrop={handleDropOnEnd}
//           />
//         )}

//         {options.length === 0 && (
//           <li className="px-3 py-2 text-sm text-slate-500">No items</li>
//         )}
//       </ul>
//     </div>
//   );
// }
