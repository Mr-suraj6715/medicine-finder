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

// Session persistence
export function saveAuthSession(user: AuthUser, token?: string) {
  if (typeof window === "undefined") return;
  const userJson = JSON.stringify(user);
  
  // Set in localStorage
  localStorage.setItem("medifind_user", userJson);
  localStorage.setItem("medifind_role", user.role);
  localStorage.setItem("medifind_active_role", user.role);
  localStorage.setItem(`medifind_user_${user.role}`, userJson);
  if (token) {
    localStorage.setItem("medifind_token", token);
    setCookie("medifind_token", token);
  }
  
  // Set in cookies for middleware and server route guards
  setCookie("medifind_role", user.role);
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

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("medifind_token") || getCookie("medifind_token");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const activeRole = localStorage.getItem("medifind_active_role") || getCookie("medifind_role");
  const raw = (activeRole ? localStorage.getItem(`medifind_user_${activeRole}`) : null) 
    || localStorage.getItem("medifind_user") 
    || getCookie("medifind_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getDashboardUrl(role?: string): string {
  if (role === "shop_owner") return "/dashboard/shop";
  if (role === "rider") return "/dashboard/rider";
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
