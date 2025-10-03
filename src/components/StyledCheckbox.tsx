"use client";

import React from "react";
import { v4 as uuid } from "uuid";

export default function StyledCheckbox(
  {
    checked,
    label,
    className,
    onChange
  }
  :
  {
    checked: boolean,
    label?: string,
    className?: string,
    onChange?: (value:  React.ChangeEvent<HTMLInputElement>) => void;
  }
) {

  const id = uuid();

    const classes = [
      "relative peer shrink-0",
      "appearance-none w-4 h-4 border-2 border-blue-500 rounded-sm bg-white",
      "mt-1",
      "scale-150 accent-blue-500",
      "checked:bg-blue-800 checked:border-0",
      "focus:outline-none focus:ring-offset-0 focus:ring-2 focus:ring-blue-100",
      "disabled:border-steel-400 disabled:bg-steel-400",
      className
    ];

  return (
  <div className="flex">
    <input type="checkbox" checked={checked} className={classes.join(" ")} onChange={onChange}  />
    <label>{label}</label>
    <svg
      className="
        absolute 
        w-4 h-4 mt-1
        hidden peer-checked:block
        pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </div>  
  );

}