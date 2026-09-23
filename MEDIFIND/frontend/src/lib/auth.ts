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

// Session persistence
export function saveAuthSession(user: AuthUser, token?: string) {
  if (typeof window === "undefined") return;
  const role = normalizeRole(user.role);
  const normalizedUser: AuthUser = { ...user, role };
  const userJson = JSON.stringify(normalizedUser);
  
  // Clean up legacy multi-role keys to eliminate cross-role contamination
  localStorage.removeItem("medifind_active_role");
  localStorage.removeItem("medifind_user_user");
  localStorage.removeItem("medifind_user_shop_owner");
  localStorage.removeItem("medifind_user_rider");

  // Set single authoritative user in localStorage
  localStorage.setItem("medifind_user", userJson);
  localStorage.setItem("medifind_role", role);
  if (token) {
    localStorage.setItem("medifind_token", token);
    setCookie("medifind_token", token);
  }
  
  // Set in cookies for middleware and server route guards
  setCookie("medifind_role", role);
  setCookie("medifind_user", userJson);
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("medifind_user");
  localStorage.removeItem("medifind_token");
  localStorage.removeItem("medifind_role");
  localStorage.removeItem("medifind_active_role");
  localStorage.removeItem("medifind_user_user");
  localStorage.removeItem("medifind_user_shop_owner");
  localStorage.removeItem("medifind_user_rider");
  localStorage.removeItem("medifind_active_order_id");

  deleteCookie("medifind_token");
  deleteCookie("medifind_role");
  deleteCookie("medifind_user");
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

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("medifind_token") || getCookie("medifind_token");
  if (!token || token === "undefined" || token === "null" || token.trim() === "") return null;

  // Validate token expiration if it is a standard JWT
  const payload = parseJwtPayload(token);
  if (payload) {
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuthSession();
      return null;
    }
  }

  return token;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) {
    if (localStorage.getItem("medifind_user")) {
      clearAuthSession();
    }
    return null;
  }

  // Cryptographic token claims are the source of truth for user identity and role
  const tokenPayload = parseJwtPayload(token);
  const tokenRole = tokenPayload?.role ? normalizeRole(tokenPayload.role) : null;
  const tokenUserId = tokenPayload?.userId || tokenPayload?.id;
  const tokenEmail = tokenPayload?.email || tokenPayload?.sub;
  const tokenName = tokenPayload?.name;

  const raw = localStorage.getItem("medifind_user") || getCookie("medifind_user");
  let user: AuthUser | null = null;
  if (raw && raw !== "undefined" && raw !== "null") {
    try {
      user = JSON.parse(raw);
    } catch {
      user = null;
    }
  }

  // If localStorage user is missing or role conflicts with the signed token, enforce token truth
  if (!user && tokenEmail) {
    user = {
      id: tokenUserId || "",
      email: tokenEmail,
      name: tokenName || tokenEmail.split("@")[0],
      role: tokenRole || "user",
    };
    saveAuthSession(user, token);
    return user;
  }

  if (user && tokenRole && user.role !== tokenRole) {
    user.role = tokenRole;
    if (tokenUserId) user.id = tokenUserId;
    if (tokenEmail) user.email = tokenEmail;
    saveAuthSession(user, token);
  }

  return user;
}

export function getDashboardUrl(role?: string): string {
  const r = normalizeRole(role);
  if (r === "shop_owner") return "/dashboard/shop";
  if (r === "rider") return "/dashboard/rider";
  return "/dashboard/user";
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
