"use client";

import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padded?: boolean;
  hover?: boolean;
}

export function Card({
  children,
  className = "",
  padded = true,
  hover = false,
}: CardProps) {
  return (
    <div
      className={`
        bg-white border border-[#E2EBE6] rounded-2xl ${padded ? "p-6" : "p-0"}
        ${hover ? "hover:shadow-soft-md transition-shadow duration-200" : "shadow-soft"}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>{children}</div>
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function CardTitle({ children, className = "" }: CardTitleProps) {
  return (
    <h3
      className={`text-lg font-bold text-[#14243A] tracking-tight mb-1 ${className}`}
    >
      {children}
    </h3>
  );
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function CardDescription({
  children,
  className = "",
}: CardDescriptionProps) {
  return (
    <p className={`text-sm text-[#64748B] leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`mt-5 pt-4 border-t border-[#E2EBE6] flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}
