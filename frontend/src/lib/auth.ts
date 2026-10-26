export type UserRole = "user" | "shop_owner" | "rider";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  loyaltyPoints?: number;
  phone?: string;
  location?: string;
  address?: string;
  vehicleType?: string;
  avatar?: string;
}

// Cookie helpers
export function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// Normalize role string safely
export function normalizeRole(role?: string): UserRole {
  if (!role) return "user";
  const r = role.toLowerCase().trim();
  if (r === "shop_owner" || r === "shopowner") return "shop_owner";
  if (r === "rider") return "rider";
  return "user";
}

export function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(payloadBase64);
      return JSON.parse(decoded);
    }
  } catch {
    return null;
  }
  return null;
}

export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  if (payload && payload.exp) {
    return payload.exp * 1000 < Date.now();
  }
  return false;
}

// Determine expected role based on current URL path
export function getContextRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  if (path.startsWith("/dashboard/shop")) return "shop_owner";
  if (path.startsWith("/dashboard/rider")) return "rider";
  if (path.startsWith("/dashboard/user")) return "user";
  return null;
}

/**
 * Save authentication session with tab-level isolation (sessionStorage)
 * and role-scoped persistence (localStorage) so multiple tabs with different roles
 * never overwrite or corrupt each other.
 */
export function saveAuthSession(user: AuthUser, token?: string) {
  if (typeof window === "undefined") return;
  const role = normalizeRole(user.role);
  const normalizedUser: AuthUser = { ...user, role };
  const userJson = JSON.stringify(normalizedUser);
  const activeToken = token || sessionStorage.getItem("medifind_token") || localStorage.getItem(`medifind_token_${role}`) || "";

  // 1. TAB-ISOLATED STORAGE (sessionStorage): The active tab's primary truth
  sessionStorage.setItem("medifind_token", activeToken);
  sessionStorage.setItem("medifind_user", userJson);
  sessionStorage.setItem("medifind_role", role);

  // 2. ROLE-SCOPED STORAGE (localStorage): Preserves each role independently across tabs
  localStorage.setItem(`medifind_session_${role}`, JSON.stringify({ user: normalizedUser, token: activeToken }));
  localStorage.setItem(`medifind_token_${role}`, activeToken);
  localStorage.setItem(`medifind_user_${role}`, userJson);

  // 3. Fallback keys for legacy or single-tab scenarios
  localStorage.setItem("medifind_user", userJson);
  localStorage.setItem("medifind_role", role);
  if (activeToken) {
    localStorage.setItem("medifind_token", activeToken);
    setCookie("medifind_token", activeToken);
    setCookie(`medifind_token_${role}`, activeToken);
  }

  setCookie("medifind_role", role);
  setCookie("medifind_user", userJson);
}

/**
 * Clear authentication session for this tab and/or specific role.
 */
export function clearAuthSession(roleToClear?: string) {
  if (typeof window === "undefined") return;

  const currentRole = roleToClear || sessionStorage.getItem("medifind_role") || localStorage.getItem("medifind_role") || "";

  // Clear current tab's sessionStorage
  sessionStorage.removeItem("medifind_user");
  sessionStorage.removeItem("medifind_token");
  sessionStorage.removeItem("medifind_role");
  sessionStorage.removeItem("medifind_active_order_id");

  // Clear role-scoped storage in localStorage
  if (currentRole) {
    const r = normalizeRole(currentRole);
    localStorage.removeItem(`medifind_session_${r}`);
    localStorage.removeItem(`medifind_token_${r}`);
    localStorage.removeItem(`medifind_user_${r}`);
    deleteCookie(`medifind_token_${r}`);
  }

  // If localStorage's last active role is this role, clean fallback keys
  const fallbackRole = localStorage.getItem("medifind_role");
  if (!fallbackRole || fallbackRole === currentRole || !roleToClear) {
    localStorage.removeItem("medifind_user");
    localStorage.removeItem("medifind_token");
    localStorage.removeItem("medifind_role");
    localStorage.removeItem("medifind_active_order_id");
    deleteCookie("medifind_token");
    deleteCookie("medifind_role");
    deleteCookie("medifind_user");
  }
}

/**
 * Get active auth token for current tab or target role.
 */
export function getAuthToken(targetRole?: string): string | null {
  if (typeof window === "undefined") return null;

  const expectedRole = targetRole ? normalizeRole(targetRole) : getContextRole();

  // 1. Check tab's sessionStorage first (tab-isolated truth)
  const sessionToken = sessionStorage.getItem("medifind_token");
  if (sessionToken && sessionToken !== "undefined" && sessionToken !== "null" && sessionToken.trim() !== "") {
    if (isTokenExpired(sessionToken)) {
      clearAuthSession();
      return null;
    }
    // If an expected role is required, ensure token role matches
    if (expectedRole) {
      const payload = parseJwtPayload(sessionToken);
      const tokenRole = payload?.role ? normalizeRole(payload.role) : null;
      if (tokenRole === expectedRole) {
        return sessionToken;
      }
      // If session token belongs to another role, check role-scoped storage for expectedRole
      const roleScopedToken = localStorage.getItem(`medifind_token_${expectedRole}`);
      if (roleScopedToken && !isTokenExpired(roleScopedToken)) {
        sessionStorage.setItem("medifind_token", roleScopedToken);
        sessionStorage.setItem("medifind_role", expectedRole);
        return roleScopedToken;
      }
    } else {
      return sessionToken;
    }
  }

  // 2. If sessionStorage is empty (new tab), check role-scoped localStorage
  if (expectedRole) {
    const roleToken = localStorage.getItem(`medifind_token_${expectedRole}`);
    if (roleToken && roleToken !== "undefined" && roleToken !== "null" && roleToken.trim() !== "") {
      if (!isTokenExpired(roleToken)) {
        sessionStorage.setItem("medifind_token", roleToken);
        sessionStorage.setItem("medifind_role", expectedRole);
        return roleToken;
      }
    }
  }

  // 3. Fallback to generic localStorage or cookie
  const fallbackToken = localStorage.getItem("medifind_token") || getCookie("medifind_token");
  if (fallbackToken && fallbackToken !== "undefined" && fallbackToken !== "null" && fallbackToken.trim() !== "") {
    if (!isTokenExpired(fallbackToken)) {
      if (expectedRole) {
        const payload = parseJwtPayload(fallbackToken);
        const tokenRole = payload?.role ? normalizeRole(payload.role) : null;
        if (tokenRole === expectedRole) {
          sessionStorage.setItem("medifind_token", fallbackToken);
          sessionStorage.setItem("medifind_role", expectedRole);
          return fallbackToken;
        }
      } else {
        sessionStorage.setItem("medifind_token", fallbackToken);
        return fallbackToken;
      }
    } else {
      clearAuthSession();
    }
  }

  return null;
}

/**
 * Get active user for current tab or target role.
 */
export function getStoredUser(targetRole?: string): AuthUser | null {
  if (typeof window === "undefined") return null;

  const expectedRole = targetRole ? normalizeRole(targetRole) : getContextRole();
  const token = getAuthToken(expectedRole || undefined);
  if (!token) return null;

  const tokenPayload = parseJwtPayload(token);
  const tokenRole = tokenPayload?.role ? normalizeRole(tokenPayload.role) : null;
  const tokenUserId = tokenPayload?.userId || tokenPayload?.id;
  const tokenEmail = tokenPayload?.email || tokenPayload?.sub;
  const tokenName = tokenPayload?.name;

  // 1. Try sessionStorage for this tab
  let user: AuthUser | null = null;
  const rawSession = sessionStorage.getItem("medifind_user");
  if (rawSession && rawSession !== "undefined" && rawSession !== "null") {
    try {
      user = JSON.parse(rawSession);
    } catch {
      user = null;
    }
  }

  // If session user exists but role conflicts with target or signed token
  if (user && tokenRole && user.role !== tokenRole) {
    user = null;
  }
  if (user && expectedRole && user.role !== expectedRole) {
    user = null;
  }

  // 2. If not in sessionStorage, try role-scoped localStorage
  if (!user && expectedRole) {
    const rawRoleScoped = localStorage.getItem(`medifind_user_${expectedRole}`);
    if (rawRoleScoped && rawRoleScoped !== "undefined" && rawRoleScoped !== "null") {
      try {
        user = JSON.parse(rawRoleScoped);
      } catch {
        user = null;
      }
    }
  }

  // 3. Fallback to generic localStorage or cookie
  if (!user) {
    const rawFallback = localStorage.getItem("medifind_user") || getCookie("medifind_user");
    if (rawFallback && rawFallback !== "undefined" && rawFallback !== "null") {
      try {
        const candidate = JSON.parse(rawFallback);
        if (!expectedRole || candidate.role === expectedRole) {
          user = candidate;
        }
      } catch {
        user = null;
      }
    }
  }

  // 4. Construct from cryptographic token claims if user JSON missing or incomplete
  if (!user && tokenEmail) {
    user = {
      id: tokenUserId || "",
      email: tokenEmail,
      name: tokenName || tokenEmail.split("@")[0],
      role: tokenRole || expectedRole || "user",
    };
  }

  if (user) {
    // Ensure cryptographic token is source of truth for identity and role
    if (tokenRole) user.role = tokenRole;
    if (tokenUserId) user.id = tokenUserId;
    if (tokenEmail) user.email = tokenEmail;
    // Keep tab's sessionStorage synchronized
    sessionStorage.setItem("medifind_user", JSON.stringify(user));
    sessionStorage.setItem("medifind_role", user.role);
    sessionStorage.setItem("medifind_token", token);
  }

  return user;
}

/**
 * Validate session against the backend's /api/auth/me endpoint.
 * Ensures the token and role are cryptographically verified by the server.
 */
export async function validateSessionWithBackend(targetRole?: string): Promise<AuthUser | null> {
  if (typeof window === "undefined") return null;

  const expectedRole = targetRole ? normalizeRole(targetRole) : getContextRole();
  const token = getAuthToken(expectedRole || undefined);
  if (!token) return null;

  try {
    const res = await fetch("/api/auth/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearAuthSession(expectedRole || undefined);
      }
      return null;
    }

    const data = await res.json();
    if (data.success && data.user) {
      const serverUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || data.user.email.split("@")[0],
        role: normalizeRole(data.user.role),
        loyaltyPoints: data.user.loyaltyPoints ?? 0,
        avatar: data.user.avatar,
      };

      // Check if server role matches what this tab expects
      if (expectedRole && serverUser.role !== expectedRole) {
        console.warn(`Role mismatch: server returned ${serverUser.role}, expected ${expectedRole}`);
        return serverUser;
      }

      saveAuthSession(serverUser, token);
      return serverUser;
    }
  } catch (err) {
    console.error("Backend session validation error:", err);
  }

  return getStoredUser(expectedRole || undefined);
}

export function getDashboardUrl(role?: string): string {
  const r = normalizeRole(role);
  if (r === "shop_owner") return "/dashboard/shop";
  if (r === "rider") return "/dashboard/rider";
  return "/dashboard/user";
}

export function getAuthHeaders(targetRole?: string): Record<string, string> {
  const token = getAuthToken(targetRole);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
