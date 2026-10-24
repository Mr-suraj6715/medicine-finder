"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { KeyRound, ArrowRight, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const routeParams = useParams();
  const token = (routeParams?.token as string) || "";

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "Token verification failed");
        setVerifying(false);
      } catch (err: any) {
        setError(err.message);
        setVerifying(false);
      }
    };
    verify();
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Password reset failed");
      setSuccessMessage(data.message || "Password successfully reset! You can now sign in.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#1E3A2F] rounded-xl flex items-center justify-center text-white">
            <KeyRound size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
        </div>
        {verifying ? (
          <p className="text-sm text-slate-600">Verifying token…</p>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 mb-4 text-xs font-semibold">{error}</div>
        ) : successMessage ? (
          <div className="space-y-4 py-2 text-center">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100">
              <CheckCircle size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Password Reset Complete</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">{successMessage}</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
            >
              Sign In Now <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60 shadow-md"
            >
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-[#1E3A2F] font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
