"use client";

import React from "react";

/**
 * MediFind Official Brand Logo Icon
 * Based on the user-provided dark green (#1E3A2F) squircle with heartbeat ECG line.
 */
export function MediFindLogo({ className = "", size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="MediFind Logo"
    >
      <rect width="80" height="80" rx="24" fill="#1E3A2F" />
      {/* Heart Outline */}
      <path
        d="M40 60 C38.5 58.5 22 46 22 34 C22 28 26.5 23.5 32.5 23.5 C36.2 23.5 39 25.5 40 27.5 C41 25.5 43.8 23.5 47.5 23.5 C53.5 23.5 58 28 58 34 C58 46 41.5 58.5 40 60 Z"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* ECG Heartbeat pulse line */}
      <path
        d="M24 37 H34 L37.5 32 L41.5 43 L45 35 L47 37 H56"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full MediFind Brand Lockup (Logo Icon + Typography)
 */
export function MediFindBrandLockup({ 
  className = "", 
  size = 36,
  textClassName = "text-2xl sm:text-3xl"
}: { 
  className?: string; 
  size?: number;
  textClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <MediFindLogo size={size} />
      <span className={`font-serif tracking-tighter text-[#1E3A2F] font-bold ${textClassName}`}>
        medifind
      </span>
    </div>
  );
}

export function MediFindWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif tracking-tighter text-[#1E3A2F] font-bold ${className}`}>
      medifind
    </span>
  );
}

export function MediFindTagline({ className = "" }: { className?: string }) {
  return (
    <span className={`text-xs font-medium text-slate-500 uppercase tracking-wider ${className}`}>
      Find Cheapest Medicine Near You
    </span>
  );
}
