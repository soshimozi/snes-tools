"use client";

import React from "react";

export default function StyledButton(
  {
    width,
    className,
    onClick,
    children,
    disabled = false
  }
  :
  {
    width: number,
    className?: string,
    disabled?: boolean,
    onClick: () => void,
    children?: React.ReactElement | string
  }
) {

  const classes = [
    `w-${width}`,
    "p-2 inline-flex items-center justify-center rounded-md",
    disabled ? "bg-gray-700" : "bg-slate-900",
    "border border-white text-white",
    disabled ? "" : "transition-colors hover:bg-slate-800 active:bg-slate-700",
    disabled ? "" : "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
    className
  ];

  return <button disabled={disabled} onClick={onClick} className={classes.join(" ")}>{children}</button>
}