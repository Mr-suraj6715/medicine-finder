"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { AuthUser, saveAuthSession } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
        };
      };
    };
  }
}

interface GoogleAuthButtonProps {
  mode: "signin" | "signup";
  role?: "user" | "shop_owner" | "rider";
  onSuccess: (user: AuthUser, token?: string) => void;
  onError: (errorMessage: string) => void;
  disabled?: boolean;
}

export default function GoogleAuthButton({
  mode,
  role = "user",
  onSuccess,
  onError,
  disabled = false,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [configMissing, setConfigMissing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAuthenticatingRef = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const isPlaceholder = !clientId || clientId === "YOUR_GOOGLE_CLIENT_ID";

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    setLoading(true);

    try {
      if (!response.credential) {
        throw new Error("No Google credential returned. Please try again.");
      }

      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data.detail || data.error || data.message || "Google authentication failed";
        onError(detail);
        return;
      }

      if (data.success && data.user) {
        saveAuthSession(data.user, data.token);
        onSuccess(data.user, data.token);
      } else {
        onError("Unexpected response from authentication server.");
      }
    } catch (err: any) {
      onError(err.message || "Network error during Google sign-in. Please try again.");
    } finally {
      setLoading(false);
      isAuthenticatingRef.current = false;
    }
  }, [role, onSuccess, onError]);

  useEffect(() => {
    if (isPlaceholder) {
      setConfigMissing(true);
      return;
    }

    let isMounted = true;

    const loadGsi = () => {
      if (typeof window === "undefined") return;

      if (window.google?.accounts?.id) {
        initializeGoogleSignIn();
        return;
      }

      const existingScript = document.getElementById("google-jssdk");
      if (existingScript) {
        existingScript.addEventListener("load", initializeGoogleSignIn);
        return;
      }

      const script = document.createElement("script");
      script.id = "google-jssdk";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted) initializeGoogleSignIn();
      };
      script.onerror = () => {
        if (isMounted) {
          onError("Could not load Google Identity Services. Check your internet connection.");
        }
      };
      document.body.appendChild(script);
    };

    const initializeGoogleSignIn = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Clear any previous child nodes to prevent duplicated buttons
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: mode === "signup" ? "signup_with" : "continue_with",
            shape: "pill",
            logo_alignment: "left",
            width: containerRef.current.clientWidth || 360,
          });
        }
      } catch (e: any) {
        console.error("GIS initialization error:", e);
      }
    };

    loadGsi();

    return () => {
      isMounted = false;
    };
  }, [clientId, isPlaceholder, mode, handleCredentialResponse, onError]);

  const handleCustomButtonClick = () => {
    if (disabled || loading) return;

    if (configMissing) {
      onError(
        "Google Sign-In is awaiting Google Cloud Client ID configuration. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local."
      );
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (err: any) {
        onError("Could not initiate Google prompt. Please try again.");
      }
    } else {
      onError("Google Identity Services is still loading. Please wait a moment.");
    }
  };

  return (
    <div className="w-full">
      {/* Official GIS Button Container (rendered when client ID is valid) */}
      {!configMissing && (
        <div
          ref={containerRef}
          className={`w-full flex justify-center items-center min-h-[44px] ${
            loading || disabled ? "opacity-60 pointer-events-none" : ""
          }`}
        />
      )}

      {/* Styled Google Fallback / Direct Trigger Button */}
      {configMissing && (
        <button
          type="button"
          onClick={handleCustomButtonClick}
          disabled={disabled || loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 border border-slate-300 rounded-full shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-60 text-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-[#1E3A2F] rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>
            {loading
              ? "Verifying with Google..."
              : mode === "signup"
              ? "Sign up with Google"
              : "Continue with Google"}
          </span>
        </button>
      )}
    </div>
  );
}
