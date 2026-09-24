"use client";
import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ArrowRight } from "lucide-react";

function ResetPasswordQueryHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      router.replace(`/reset-password/${encodeURIComponent(token)}`);
    }
  }, [token, router]);

  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <p className="text-sm text-slate-600">Redirecting to secure reset page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <KeyRound size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Password Reset</h2>
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 mb-6 text-xs font-semibold">
          This password reset link is invalid or has expired. Please request a new reset link.
        </div>
        <button
          type="button"
          onClick={() => router.push('/forgot-password')}
          className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2"
        >
          Request New Reset Link <ArrowRight size={16} />
        </button>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordFallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordQueryHandler />
    </Suspense>
  );
}
