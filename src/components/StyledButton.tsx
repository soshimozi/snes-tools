import React from "react";

export default function StyledButton(
  {
    width,
    className,
    onClick,
    children
  }
  :
  {
    width: number,
    className?: string,
    onClick: () => void,
    children?: React.ReactElement | string
  }
) {

  const classes = [
    `w-${width}`,
    "p-2 inline-flex items-center justify-center rounded-md",
    "bg-slate-900 border border-white text-white",
    "transition-colors hover:bg-slate-800 active:bg-slate-700",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
    className
  ];

  return <button onClick={onClick} className={classes.join(" ")}>{children}</button>
}