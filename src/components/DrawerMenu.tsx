// DrawerMenu.tsx
import React, { useState, useMemo } from "react";
import type { MenuNode } from "./Menu";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}>
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Disclosure({
  label,
  icon,
  open,
  onToggle,
  level = 0,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  level?: number;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={[
          "w-full px-3 py-2 rounded inline-flex items-center gap-2 cursor-pointer",
          level ? "pl-3" : ""
        ].join(" ")}
      >
        {icon}
        <span className="flex-1 text-left cursor-pointer">{label}</span>
        <Chevron open={open} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden cursor-pointer">{children}</div>
      </div>
    </div>
  );
}

function Leaf({
  node,
  onPick,
  level = 0,
}: {
  node: MenuNode;
  onPick: (n: MenuNode) => void;
  level?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(node)}
      className={[
        "w-full px-3 py-2 rounded inline-flex items-center gap-2 cursor-pointer",
        level ? "pl-7" : ""
      ].join(" ")}
    >
      {node.icon}
      <span className="text-left">{node.label}</span>
    </button>
  );
}

export function DrawerMenu({
  tree,
  onPick,
  accordion = false, // if true: only one top-level group open
}: {
  tree: MenuNode[];
  onPick: (n: MenuNode) => void;
  accordion?: boolean;
}) {
  // Track which groups are open (by id)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string, isTopLevel: boolean) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      const isOpen = next.has(id);
      if (isOpen) next.delete(id);
      else {
        if (accordion && isTopLevel) {
          // close other top-level groups
          for (const top of tree) {
            if (top.id !== id) next.delete(top.id);
          }
        }
        next.add(id);
      }
      return next;
    });
  };

  const renderNode = (node: MenuNode, level = 0, isTopLevel = false): React.ReactNode => {
    if (node.children?.length) {
      const open = openIds.has(node.id);
      return (
        <Disclosure
          key={node.id}
          label={node.label}
          icon={node.icon}
          open={open}
          onToggle={() => toggle(node.id, isTopLevel)}
          level={level}
        >
          <ul className="py-1">
            {node.children.map(child => (
              <li key={child.id}>{renderNode(child, level + 1, false)}</li>
            ))}
          </ul>
        </Disclosure>
      );
    }
    return <Leaf key={node.id} node={node} onPick={onPick} level={level} />;
  };

  return (
    <nav className="h-full flex flex-col bg-black">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-base font-semibold">SNES Tools</h2>
      </div>
      <ul className="p-2 space-y-1 text-sm">
        {tree.map(n => (
          <li key={n.id}>{renderNode(n, 0, true)}</li>
        ))}
      </ul>
      <div className="mt-auto p-3 border-t border-slate-200 text-xs text-slate-500">
        v0.1 • 4bpp • 8×8
      </div>
    </nav>
  );
}
