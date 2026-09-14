"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [role, setRole] = useState<"user" | "shop_owner" | "rider">("user");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Forgot password request failed");
      }
      setSuccess(data.message || "If an account exists, a reset link has been sent.");
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
          <h2 className="text-xl font-bold text-slate-900">Forgot Password</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">Select your role and enter the email associated with your account.</p>
        <div className="flex gap-2 mb-4">
          {(["user", "shop_owner", "rider"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r); setError(""); }}
              className={`flex-1 py-2.5 px-2 rounded-xl text-[11px] font-bold text-center border-2 transition-all ${
                role === r ? "border-[#1E3A2F] bg-[#E8F3ED] text-[#1E3A2F] shadow-sm" : "border-slate-100 text-slate-500 hover:border-slate-200"
              }`}
            >
              {r === "user" ? "User / Customer" : r === "shop_owner" ? "Shop Owner" : "Rider"}
            </button>
          ))}
        </div>
        {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 mb-4 text-xs font-semibold">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 mb-4 text-xs font-semibold">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50"
              placeholder="you@example.com"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-[#1E3A2F] font-semibold hover:underline"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
