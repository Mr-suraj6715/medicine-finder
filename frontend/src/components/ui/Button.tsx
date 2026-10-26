"use client";

import * as React from "react";

type Variant =
  | "primary"
  | "primary-outline"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#078B5A] hover:bg-[#075B46] active:bg-[#054a38] text-white shadow-sm",
  "primary-outline":
    "border border-[#078B5A] bg-transparent text-[#078B5A] hover:bg-[#078B5A]/10 active:bg-[#078B5A]/20",
  secondary:
    "bg-[#F0F8F4] hover:bg-[#DCEBDF] text-[#14243A] shadow-sm",
  ghost:
    "hover:bg-[#F0F8F4] text-[#64748B] hover:text-[#14243A]",
  danger:
    "bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-sm",
  success:
    "bg-[#15803D] hover:bg-[#14532D] text-white shadow-sm",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-sm",
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full font-bold text-xs uppercase tracking-wider
        transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078B5A]/30 disabled:opacity-50 disabled:pointer-events-none
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}
