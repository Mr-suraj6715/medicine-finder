"use client";

import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
}

export function Input({
  className = "",
  label,
  error,
  helper,
  leftIcon,
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <div
        className={`relative ${leftIcon ? "pl-10" : ""}`}
      >
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          id={id}
          className={`w-full px-4 py-3 rounded-xl bg-[#F6FAF7] border border-slate-200 text-slate-900 font-medium text-sm
            focus:outline-none focus:ring-2 focus:ring-[#078B5A]/50 focus:border-[#078B5A]
            transition-all duration-200 ${error ? "border-rose-400" : ""} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-[10px] text-rose-500 mt-1 font-medium">
            {error}
          </p>
        )}
        {helper && !error && (
          <p className="text-[10px] text-slate-400 mt-1 font-medium">{helper}</p>
        )}
      </div>
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export function Textarea({
  className = "",
  label,
  error,
  helper,
  id,
  ...props
}: TextareaProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`w-full px-4 py-3 rounded-xl bg-[#F6FAF7] border border-slate-200 text-slate-900 font-medium text-sm
          focus:outline-none focus:ring-2 focus:ring-[#078B5A]/50 focus:border-[#078B5A]
          transition-all duration-200 resize-none ${error ? "border-rose-400" : ""} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[10px] text-rose-500 mt-1 font-medium">{error}</p>
      )}
      {helper && !error && (
        <p className="text-[10px] text-slate-400 mt-1 font-medium">{helper}</p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export function Select({
  className = "",
  label,
  error,
  helper,
  id,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <div
        className={`relative ${className.includes("pl-10") ? "" : ""}`}
      >
        <select
          id={id}
          className={`w-full px-4 py-3 rounded-xl bg-[#F6FAF7] border border-slate-200 text-slate-900 font-medium text-sm
            focus:outline-none focus:ring-2 focus:ring-[#078B5A]/50 focus:border-[#078B5A]
            transition-all duration-200 ${error ? "border-rose-400" : ""} ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
      {error && (
        <p className="text-[10px] text-rose-500 mt-1 font-medium">{error}</p>
      )}
      {helper && !error && (
        <p className="text-[10px] text-slate-400 mt-1 font-medium">{helper}</p>
      )}
    </div>
  );
}
