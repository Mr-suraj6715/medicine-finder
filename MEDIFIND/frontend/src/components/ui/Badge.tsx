"use client";

import * as React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
  size?: "sm" | "md";
}

const variantClasses: Record<string, string> = {
  default: "bg-[#078B5A] text-white",
  success: "bg-[#E8F3ED] text-[#075B46] border border-[#CDE3D5]",
  warning: "bg-[#FDF3E1] text-[#92400E] border border-[#FDE6B7]",
  error: "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]",
  info: "bg-[#F0F8F4] text-[#14243A] border border-[#E2EBE6]",
  outline: "border border-[#E2EBE6] text-[#64748B] bg-transparent",
};

const sizeClasses: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  children,
  className = "",
  variant = "default",
  size = "md",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  status:
    | "pending"
    | "processing"
    | "confirmed"
    | "rider_assigned"
    | "rider_at_pharmacy"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "failed";
}

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border border-amber-200",
  processing: "bg-blue-50 text-blue-800 border border-blue-200",
  confirmed: "bg-indigo-50 text-indigo-800 border border-indigo-200",
  rider_assigned: "bg-sky-50 text-sky-800 border border-sky-200",
  rider_at_pharmacy: "bg-teal-50 text-teal-800 border border-teal-200",
  out_for_delivery: "bg-purple-50 text-purple-800 border border-purple-200",
  delivered: "bg-[#E8F3ED] text-[#075B46] border border-[#CDE3D5]",
  cancelled: "bg-rose-50 text-rose-800 border border-rose-200",
  failed: "bg-slate-100 text-slate-700 border border-slate-200",
};

export function StatusPill({
  children,
  className = "",
  status,
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 border ${STATUS_CLASSES[status] ?? STATUS_CLASSES.pending} ${className}`}
    >
      {children}
    </span>
  );
}
