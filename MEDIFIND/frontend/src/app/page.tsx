"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr: false });
const UseMapEvents = dynamic(() => import("react-leaflet").then(m => {
  const { useMap } = m;
  function FlyTo({ lat, lng, zoom = 16 }: { lat: number; lng: number; zoom?: number }) {
    const map = useMap();
    useEffect(() => { 
      if (lat && lng) map.flyTo([lat, lng], zoom, { animate: true, duration: 1.5 }); 
    }, [lat, lng, zoom, map]);
    return null;
  }
  return FlyTo;
}), { ssr: false });

let L: any;
if (typeof window !== "undefined") L = require("leaflet");

// ─── Pharmacy data with coordinates ───────────────────────────────
const NEARBY_PHARMACIES = [
  { name: "Apollo Pharmacy",    dist: "0.8 km", open: "Open till 10 PM", price: 15,    badge: "Cheapest", lat: 19.0760, lng: 72.8777 },
  { name: "HealthPlus Medicos", dist: "1.2 km", open: "24/7 Open",       price: 18.50, badge: null,        lat: 19.0795, lng: 72.8810 },
  { name: "City Pharma",        dist: "0.3 km", open: "Closes in 1 hr",  price: 20,    badge: null,        lat: 19.0740, lng: 72.8750 },
];

import {
  Search, MapPin, HeartPulse, Menu, Star, Map as MapIcon,
  Navigation, Pill, ChevronRight, ShieldCheck, Globe,
  ShoppingCart, Minus, Plus, Gift, Brain, Sparkles, X,
  Activity, History, Stethoscope, User, Store, Eye, EyeOff,
  Package, TrendingUp, Clock, CheckCircle, LogOut, ChevronDown, ChevronUp
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
type AuthUser = { id: string; email: string; name: string; role: "user" | "shop_owner" | "rider"; loyaltyPoints: number };
type CartItem = { inventory: any; medicine: any; quantity: number };
interface PharmacyMarker { 
  name: string; 
  lat: number; 
  lng: number; 
  price?: number; 
  distValue?: number; 
  time?: string; 
  dist?: string;
  badge?: string | null;
  rating?: string;
  reviews?: string;
  location?: string;
};

interface UserAddress {
  id: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

// ─── LeafletMap Sub-Component ─────────────────────────────────────
function LeafletMap({
  lat, lng, zoom = 13, title = "Your Location",
  focusLocation,
  pharmacies = [],
  onSelectPharmacy,
  userLocation
}: {
  lat: number; lng: number; zoom?: number; title?: string;
  focusLocation?: { lat: number; lng: number } | null;
  pharmacies?: PharmacyMarker[];
  onSelectPharmacy?: (p: any) => void;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const userIcon = typeof window !== "undefined" ? L?.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }) : undefined;

  const pharmacyIcon = typeof window !== "undefined" ? L?.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }) : undefined;

  const nearestIcon = typeof window !== "undefined" ? L?.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [28, 45], iconAnchor: [14, 45], popupAnchor: [1, -34], shadowSize: [45, 45],
  }) : undefined;

  // Find the nearest pharmacy based on distValue
  const nearestPharmacy = [...pharmacies].sort((a, b) => (a.distValue || 999) - (b.distValue || 999))[0];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative shadow-inner border border-slate-200">
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        
        {/* User Location */}
        <Marker position={[lat, lng]} icon={userIcon}>
          <Popup>
            <div className="font-bold text-sky-600">{title}</div>
            <div className="text-[10px] text-slate-400">Current Position</div>
          </Popup>
        </Marker>

        {/* Pharmacy Markers */}
        {pharmacies.map((p, i) => {
          const isNearest = nearestPharmacy && p.name === nearestPharmacy.name;
          const isSelected = focusLocation && focusLocation.lat === p.lat && focusLocation.lng === p.lng;
          
          return (
            <Marker 
              key={i} 
              position={[p.lat, p.lng]} 
              icon={isNearest ? nearestIcon : pharmacyIcon}
              eventHandlers={{
                click: () => {
                  if (onSelectPharmacy) onSelectPharmacy(p);
                },
              }}
            >
              <Popup>
                <div className="p-1">
                  <div className="text-sm font-black text-slate-900">{p.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{p.distValue ? `${p.distValue.toFixed(1)} km` : "Nearby"}</span>
                    {p.price && <span className="text-[10px] font-black text-green-600">₹{p.price.toFixed(0)}</span>}
                  </div>
                  {isNearest && <div className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tighter">★ Fastest Delivery</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Shortest Route Line */}
        {focusLocation && (
          <Polyline 
            positions={[[userLocation?.lat || lat, userLocation?.lng || lng], [focusLocation.lat, focusLocation.lng]]}
            pathOptions={{ 
              color: '#0ea5e9', 
              weight: 4, 
              opacity: 0.7, 
              dashArray: '10, 10',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Center/Zoom focus */}
        {focusLocation ? (
          <UseMapEvents lat={focusLocation.lat} lng={focusLocation.lng} zoom={16} />
        ) : (
          <UseMapEvents lat={lat} lng={lng} zoom={zoom} />
        )}
      </MapContainer>
    </div>
  );
}

// ─── Login Modal ──────────────────────────────────────────────────
function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (u: AuthUser) => void }) {
  const [email, setEmail] = useState("demo@medstore.com");
  const [password, setPassword] = useState("demo123");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<"user" | "shop_owner" | "rider">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-detect role from credentials, but allow manual override
  useEffect(() => {
    if (email === "demo@medstore.com") setRole("user");
    else if (email === "shop@medstore.com") setRole("shop_owner");
    else if (email === "rider@medstore.com") setRole("rider");
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("medifind_user", JSON.stringify(data.user));
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-sky-700 rounded-xl flex items-center justify-center text-white"><HeartPulse size={20} /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Welcome back</h2><p className="text-xs text-slate-500">Sign in to your MediFind account</p></div>
        </div>

        <div className="flex gap-2 mb-6">
          {(["user", "shop_owner", "rider"] as const).map(r => (
            <button key={r} onClick={() => setRole(r)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${role === r ? "border-sky-500 bg-sky-50 text-sky-600" : "border-slate-100 text-slate-400"}`}>
              {r.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-6 text-sm text-sky-800">
          <p className="font-bold mb-1">Demo Credentials:</p>
          <p>👤 User: <code className="bg-sky-100 px-1 rounded">demo@medstore.com</code> / <code className="bg-sky-100 px-1 rounded">demo123</code></p>
          <p className="mt-1">🏪 Shop Owner: <code className="bg-sky-100 px-1 rounded">shop@medstore.com</code> / <code className="bg-sky-100 px-1 rounded">shop123</code></p>
          <p className="mt-1">🚴 Rider: <code className="bg-sky-100 px-1 rounded">rider@medstore.com</code> / <code className="bg-sky-100 px-1 rounded">rider123</code></p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm font-medium">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Signup Modal ─────────────────────────────────────────────────
function SignupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (u: AuthUser) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", location: "", role: "user" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      localStorage.setItem("medifind_user", JSON.stringify(data.user));
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center text-white"><User size={20} /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Create Account</h2><p className="text-xs text-slate-500">Join MediFind today</p></div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm font-medium">{error}</div>}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" placeholder="Your full name" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" placeholder="you@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" placeholder="+91 00000 00000" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
            <input value={form.location} onChange={e => set("location", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" placeholder="Mumbai, Maharashtra" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" placeholder="Min. 6 characters" required minLength={6} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "user", label: "Customer", icon: User, desc: "Order medicines" }, 
                { v: "shop_owner", label: "Shop Owner", icon: Store, desc: "Manage your store" },
                { v: "rider", label: "Rider", icon: Navigation, desc: "Deliver medicines" }
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => set("role", opt.v)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.role === opt.v ? "border-green-500 bg-green-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <opt.icon size={18} className={form.role === opt.v ? "text-green-600" : "text-slate-400"} />
                  <p className="font-semibold text-sm mt-1">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [medicines, setMedicines] = useState<any[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [isTrackingMode, setIsTrackingMode] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [visibleAltCount, setVisibleAltCount] = useState(3);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [userSymptoms, setUserSymptoms] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState<any[]>([]);
  const [isAnalyzingSymptoms, setIsAnalyzingSymptoms] = useState(false);
  const [symptomMessage, setSymptomMessage] = useState("");
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "CASH_ON_DELIVERY">("CASH_ON_DELIVERY");
  const [userAddresses, setUserAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "Home", address: "" });
  const [mapOverlayMinimized, setMapOverlayMinimized] = useState(false);
  const [visibleMedicineCount, setVisibleMedicineCount] = useState(3);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Geolocation watch
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Geo error:", err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Fetch addresses
  const fetchAddresses = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/user/address?userId=${uid}`);
      const data = await res.json();
      if (data.addresses) {
        setUserAddresses(data.addresses);
        if (data.addresses.length > 0) setSelectedAddressId(data.addresses[0].id);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (user) fetchAddresses(user.id);
  }, [user, fetchAddresses]);

  // Autocomplete logic
  useEffect(() => {
    const getSuggestions = async () => {
      if (searchInput.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchInput)}`);
        const data = await res.json();
        setSuggestions(data.medicines?.slice(0, 5) || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Suggestion fetch failed:", err);
      }
    };
    const timer = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleAddAddress = async () => {
    if (!user || !newAddress.address.trim()) return;
    try {
      const res = await fetch("/api/user/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...newAddress,
          latitude: userLocation?.lat,
          longitude: userLocation?.lng
        })
      });
      if (res.ok) {
        setNewAddress({ label: "Home", address: "" });
        setShowAddressModal(false);
        fetchAddresses(user.id);
      }
    } catch (err) { console.error(err); }
  };
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);

  // Restore user session and redirect if role is rider or shop_owner
  useEffect(() => {
    const activeRole = localStorage.getItem("medifind_active_role");
    const stored = activeRole ? localStorage.getItem(`medifind_user_${activeRole}`) : localStorage.getItem("medifind_user");
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        
        // Immediate redirect logic
        if (parsed.role === "shop_owner") {
          window.location.replace("/dashboard/shop");
          return;
        } else if (parsed.role === "rider") {
          window.location.replace("/dashboard/rider");
          return;
        }
      } catch (e) {
        console.error("Session restore failed:", e);
      }
    }
    setIsAuthChecking(false);
  }, []);

  const handleAuthSuccess = (u: AuthUser) => {
    setUser(u);
    setShowLogin(false);
    setShowSignup(false);
    // Store role-specific session to prevent conflicts across multiple tabs
    localStorage.setItem(`medifind_user_${u.role}`, JSON.stringify(u));
    // For general landing page, keep track of the last active role
    localStorage.setItem("medifind_active_role", u.role);
    
    if (u.role === "shop_owner") {
      window.location.href = "/dashboard/shop";
    } else if (u.role === "rider") {
      window.location.href = "/dashboard/rider";
    } else {
      window.location.href = "/dashboard/user";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("medifind_user");
    localStorage.removeItem("medifind_role");
    localStorage.removeItem("medifind_active_role");
    localStorage.removeItem("medifind_user_user");
    localStorage.removeItem("medifind_user_shop_owner");
    localStorage.removeItem("medifind_user_rider");
    setUser(null);
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    setVisibleMedicineCount(3); // Reset count for new search
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const combined = data.medicines || [];
      
      setMedicines(combined);
      
      if (combined.length > 0) setSelectedMedicine(combined[0]);
      else { setSelectedMedicine(null); setInventory([]); }
    } catch {}
    finally { setSearchLoading(false); }
  }, []);

  const fetchInventory = useCallback(async (medicineId: string) => {
    try {
      const res = await fetch(`/api/inventory/${medicineId}`);
      const data = await res.json();
      setInventory((data.inventory || []).sort((a: any, b: any) => a.price - b.price));
    } catch {}
  }, []);

  const fetchLoyalty = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/loyalty?email=${user.email}`);
      const data = await res.json();
      if (data.loyaltyPoints !== undefined) setLoyaltyPoints(data.loyaltyPoints);
    } catch {}
  }, [user]);

  useEffect(() => { handleSearch("Paracetamol"); }, [handleSearch]);
  useEffect(() => { if (selectedMedicine) { fetchInventory(selectedMedicine.id); const interval = setInterval(() => fetchInventory(selectedMedicine.id), 5000); return () => clearInterval(interval); } }, [selectedMedicine, fetchInventory]);
  useEffect(() => { fetchLoyalty(); }, [fetchLoyalty]);

  const addToCart = (inv: any, med: any, qty: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.inventory.id === inv.id);
      if (existing) return prev.map(i => i.inventory.id === inv.id ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, { inventory: inv, medicine: med, quantity: qty }];
    });
    // Cart popup does NOT open here — only opens when the cart icon is clicked
  };

  const removeFromCart = (invId: string) => setCart(prev => prev.filter(i => i.inventory.id !== invId));

  const cartSubtotal = cart.reduce((a, i) => a + i.inventory.price * i.quantity, 0);
  const cartItems = cart.reduce((a, i) => a + i.quantity, 0);
  const cartDiscount = cartItems > 5 && cartSubtotal >= 100 ? cartSubtotal * 0.1 : 0;
  const cartTotal = cartSubtotal - cartDiscount;

  // Emergency Mode constants
  const maxCartDistance = cart.reduce((max, i) => Math.max(max, i.inventory.pharmacy?.distance || 0), 0);
  const emergencyFee = isEmergencyMode ? (maxCartDistance <= 2 ? 30 : 60) : 0;
  const cartFinalWithEmergency = cartTotal + emergencyFee;

  const handlePlaceOrder = async () => {
    if (!user || cart.length === 0) return;
    const selAddr = userAddresses.find(a => a.id === selectedAddressId);
    if (!selAddr) { alert("Please select a delivery address."); return; }
    
    setIsOrdering(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          items: cart.map(i => ({ inventoryId: i.inventory.id, quantity: i.quantity })),
          isEmergency: isEmergencyMode,
          paymentMethod,
          deliveryAddress: selAddr?.address || "",
          deliveryLat: selAddr?.latitude || (userLocation?.lat || 19.076),
          deliveryLng: selAddr?.longitude || (userLocation?.lng || 72.8777)
        }),
      });
      const data = await res.json();
      if (data.order) { 
        setTrackingOrder(data.order); 
        localStorage.setItem("medifind_active_order_id", data.order.id);
        setShowOrderSuccess(true); 
        setCart([]); 
        setIsCartOpen(false); 
        setIsEmergencyMode(false); 
        fetchLoyalty(); 
      }
    } catch {} finally { setIsOrdering(false); }
  };

  const handleSymptomCheck = async () => {
    if (!userSymptoms.trim()) return;
    setIsAnalyzingSymptoms(true);
    setSymptomMessage(""); // Clear previous message
    setAiRecommendation([]); // Clear previous recommendations
    try {
      const res = await fetch("/api/ai-consultant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email || "user@example.com", message: userSymptoms }),
      });
      const data = await res.json();
      if (data.reply) {
        setSymptomMessage(data.reply);
        if (data.prescription) {
          setAiRecommendation(data.prescription);
        }
      }
    } catch (err) {
      console.error("AI consult failed:", err);
    } finally {
      setIsAnalyzingSymptoms(false);
    }
  };

  useEffect(() => {
    const handleActiveOrder = async () => {
      const activeId = localStorage.getItem("medifind_active_order_id");
      if (activeId && user) {
        try {
          const res = await fetch(`/api/orders?email=${user.email}`);
          const data = await res.json();
          const activeOrder = data.orders.find((o: any) => o.id === activeId);
          if (activeOrder) {
            if (activeOrder.status === "DELIVERED") {
              // Only clear if confirmed by shop owner
              localStorage.removeItem("medifind_active_order_id");
              setTrackingOrder(null);
            } else {
              setTrackingOrder(activeOrder);
            }
          } else if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
            // Only remove if we have a valid list and it's definitely not there
            // This prevents clearing on temporary API empty results or sync delays
            const isReallyGone = data.orders.length > 0;
            if (isReallyGone) {
              localStorage.removeItem("medifind_active_order_id");
              setTrackingOrder(null);
            }
          }
        } catch {}
      }
    };

    handleActiveOrder();
    const interval = setInterval(handleActiveOrder, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const bestOption = inventory[0];
  // Pagination: show 3 initially, +5 per "See More" click
  const altInventory = inventory.slice(1, 1 + visibleAltCount);
  const hasMoreAlt = inventory.length - 1 > visibleAltCount;
  const subtotal = bestOption ? bestOption.price * quantity : 0;
  const hasDiscount = quantity > 5 && subtotal >= 100;
  const discountAmt = hasDiscount ? subtotal * 0.1 : 0;
  const finalTotal = subtotal - discountAmt;

  const displayPharmacies = Array.from(
    inventory.reduce((map, inv: any) => {
      // Group by pharmacy name to avoid duplicates in the list
      if (!map.has(inv.pharmacy.name)) {
        const predefined = NEARBY_PHARMACIES.find(p => p.name === inv.pharmacy.name);
        const distance = (inv.pharmacy.distance && inv.pharmacy.distance !== 0) ? inv.pharmacy.distance : (predefined ? (parseFloat(predefined.dist) || 1.2) : 1.5);
        // Use real availability from DB if available, else fall back to predefined
        const isAvailable = inv.pharmacy.isAvailable !== undefined ? inv.pharmacy.isAvailable : true;
        const openingTime = inv.pharmacy.openingTime || "9:00 AM";
        const closingTime = inv.pharmacy.closingTime || "9:00 PM";
        const openLabel = isAvailable
          ? `Open till ${closingTime}`
          : `Closed (Opens at ${openingTime})`;
        map.set(inv.pharmacy.name, {
          name: inv.pharmacy.name,
          rating: (4.0 + Math.random() * 0.9).toFixed(1),
          reviews: "(120+)",
          location: predefined ? "Mumbai, MH" : (inv.pharmacy.location || "Nearby"),
          dist: `${distance.toFixed(1)} km`,
          distValue: distance,
          timeValue: Math.round(distance * 12 + 5),
          time: `${Math.round(distance * 12 + 5)} min`,
          open: predefined ? predefined.open : openLabel,
          isAvailable,
          badge: predefined ? predefined.badge : (isAvailable ? null : "Closed"),
          lat: (inv.pharmacy.latitude && inv.pharmacy.latitude !== 0) ? inv.pharmacy.latitude : (predefined ? predefined.lat : 19.0760),
          lng: (inv.pharmacy.longitude && inv.pharmacy.longitude !== 0) ? inv.pharmacy.longitude : (predefined ? predefined.lng : 72.8777),
          price: inv.price,
        });
      }
      return map;
    }, new Map<string, any>()).values()
  ).sort((a: any, b: any) => {
    // Sort by smallest route (distValue) -> least price -> fastest delivery (timeValue)
    if (a.distValue !== b.distValue) return a.distValue - b.distValue;
    if (a.price !== b.price) return a.price - b.price;
    return a.timeValue - b.timeValue;
  });
  const nearbyPharmacies = (displayPharmacies.length > 0 ? displayPharmacies : NEARBY_PHARMACIES.map(p => ({
    ...p,
    rating: "4.5",
    reviews: "(120+)",
    location: "Central Park, NY",
    distValue: parseFloat(p.dist) || 1.2,
    time: "12 min",
    timeValue: 12
  }))) as PharmacyMarker[];

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-gradient-to-tr from-sky-500 to-green-500 p-3 rounded-2xl text-white shadow-xl animate-bounce mb-4">
          <HeartPulse size={32} />
        </div>
        <p className="text-slate-500 font-bold animate-pulse text-sm">Authenticating...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* ── PERSISTENT TRACKING BAR ── */}
      {trackingOrder && trackingOrder.status !== "DELIVERED" && (
        <div className="fixed top-16 left-0 right-0 z-[49] bg-white border-b border-slate-100 shadow-xl px-4 py-3 animate-in slide-in-from-top duration-500">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 shrink-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${trackingOrder.isEmergency ? "bg-rose-500" : "bg-sky-500"}`}>
                <Navigation size={20} className={trackingOrder.isEmergency ? "animate-pulse" : ""} />
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Delivery Status</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">
                    {trackingOrder.status === "PENDING" && "Order Placed"}
                    {trackingOrder.status === "PROCESSING" && "Packing Medicines..."}
                    {trackingOrder.status === "CONFIRMED" && "Waiting for Rider"}
                    {trackingOrder.status === "RIDER_ASSIGNED" && "Rider Accepted Delivery"}
                    {trackingOrder.status === "RIDER_AT_PHARMACY" && "Rider at Pharmacy"}
                    {trackingOrder.status === "RIDER_PICKED_UP" && "Order Picked Up"}
                    {trackingOrder.status === "OUT_FOR_DELIVERY" && "On the Way"}
                    {trackingOrder.status === "REACHED_CUSTOMER" && "Rider Reached Location"}
                  </span>
                  {trackingOrder.isEmergency && <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100">PRIORITY</span>}
                </div>
              </div>
            </div>

            <div className="flex-1 max-w-xl h-2 bg-slate-100 rounded-full relative overflow-hidden hidden sm:block">
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${trackingOrder.isEmergency ? "bg-rose-500" : "bg-sky-500"}`}
                style={{
                  width: `${
                    trackingOrder.status === "PENDING" ? "15%" :
                    trackingOrder.status === "PROCESSING" ? "30%" :
                    trackingOrder.status === "CONFIRMED" ? "45%" :
                    trackingOrder.status === "RIDER_ASSIGNED" ? "60%" :
                    trackingOrder.status === "RIDER_AT_PHARMACY" ? "75%" :
                    trackingOrder.status === "OUT_FOR_DELIVERY" ? "90%" : "0%"
                  }`
                }}
              />
            </div>

            <button 
              onClick={() => setIsTrackingMode(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Activity size={14} /> Full View
            </button>
          </div>
        </div>
      )}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={handleAuthSuccess} />}
      {showSignup && <SignupModal onClose={() => setShowSignup(false)} onSuccess={handleAuthSuccess} />}

      {/* ── EMERGENCY MODE MODAL ── */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowEmergencyModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            <div className="text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-rose-100">
                <Activity size={32} className="animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2">Activate Emergency Mode?</h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Emergency Mode provides faster medicine delivery with priority dispatch. Additional surge delivery charges will apply based on distance.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => { setIsEmergencyMode(true); setShowEmergencyModal(false); }}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold transition-all active:scale-95"
                >
                  Yes, Use Emergency Mode
                </button>
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-sky-500 to-green-500 p-1.5 rounded-lg text-white shadow"><HeartPulse size={22} strokeWidth={2.5} /></div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-green-600 tracking-tight">MediFind</span>
            </a>

            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <a href="#search" className="text-slate-600 hover:text-sky-600 transition-colors">Search</a>
              <a href="#nearby" className="text-slate-600 hover:text-sky-600 transition-colors">Nearby</a>
              <a href="#ai" className="text-slate-600 hover:text-sky-600 transition-colors">AI Health</a>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <ShoppingCart size={20} />
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cart.length}</span>}
              </button>
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  >
                    <User size={16} className="text-sky-600" />
                    <span className="max-w-[80px] truncate">{user.name?.split(" ")[0]}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-[40]" onClick={() => setProfileOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 w-48 z-[50] animate-in fade-in zoom-in-95 duration-200">
                    <a href={user.role === "shop_owner" ? "/dashboard/shop" : user.role === "rider" ? "/dashboard/rider" : "/dashboard/user"} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">
                      {user.role === "shop_owner" ? <Store size={15} /> : user.role === "rider" ? <Navigation size={15} /> : <Package size={15} />} Dashboard
                    </a>
                        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 text-rose-600 w-full text-left">
                          <LogOut size={15} /> Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={() => setShowLogin(true)} className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">Log in</button>
                  <button onClick={() => setShowSignup(true)} className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-4 py-2 rounded-full shadow transition-all active:scale-95">Sign up</button>
                </>
              )}
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={20} /></button>
            </div>
          </div>
          {menuOpen && (
            <div className="md:hidden py-3 border-t border-slate-100 flex flex-col gap-2 text-sm font-medium">
              <a href="#search" onClick={() => setMenuOpen(false)} className="px-2 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700">Search Medicine</a>
              <a href="#nearby" onClick={() => setMenuOpen(false)} className="px-2 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700">Nearby Pharmacies</a>
              <a href="#ai" onClick={() => setMenuOpen(false)} className="px-2 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700">AI Health</a>
              {!user && <button onClick={() => { setShowLogin(true); setMenuOpen(false); }} className="px-2 py-1.5 rounded-lg bg-sky-50 text-sky-600 font-semibold text-left">Sign In</button>}
            </div>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> 500+ pharmacies connected
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 leading-tight">
              Find the <span className="text-sky-300">Cheapest</span> Medicine Near You
            </h1>
            <p className="text-lg text-sky-100 max-w-xl mx-auto mb-10">Compare prices across local pharmacies. Save money. Get faster.</p>

            {/* ── SEARCH BAR ── */}
            <div className="relative max-w-2xl mx-auto">
              <div id="search" className="bg-white rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 px-4">
                  <Search size={18} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search medicines, vitamins, supplements…"
                    className="w-full py-2.5 text-slate-800 text-sm bg-transparent border-none outline-none placeholder-slate-400"
                    value={searchInput}
                    onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); }}
                    onKeyDown={e => { if (e.key === "Enter") { setSearchTerm(searchInput); handleSearch(searchInput); setShowSuggestions(false); } }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => searchInput.length >= 2 && setShowSuggestions(true)}
                  />
                </div>
                <button
                  onClick={() => { setSearchTerm(searchInput); handleSearch(searchInput); setShowSuggestions(false); }}
                  disabled={searchLoading}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2 justify-center shrink-0">
                  {searchLoading ? "Searching…" : <><Search size={16} /> Search</>}
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSearchInput(s.name);
                        setSearchTerm(s.name);
                        handleSearch(s.name);
                        setShowSuggestions(false);
                      }}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors ${i < suggestions.length - 1 ? "border-b border-slate-50" : ""}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0"><Pill size={16} /></div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{s.name}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[400px]">{s.description || "In our verified database"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Paracetamol", "Amoxicillin", "Vitamin C", "Ibuprofen", "Dolo 650"].map(q => (
                <button key={q} onClick={() => { setSearchInput(q); setSearchTerm(q); handleSearch(q); }}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1 rounded-full text-xs font-medium transition-colors">{q}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 -mt-12 pb-24 space-y-12">
        {/* Search Results Section - Restored to appear above AI Assistant */}
        <div className="space-y-12">
          {/* Best Price Card */}
          {bestOption ? (
            <div className="bg-white rounded-3xl shadow-xl border-2 border-green-400 p-6 md:p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
              <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-bl-[200px] -mr-12 -mt-12 opacity-40"></div>
              <div className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-1 rounded-full text-xs font-bold mb-5"><Star size={13} fill="currentColor" /> BEST PRICE FOUND</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 bg-sky-50 rounded-2xl flex items-center justify-center shrink-0 border border-sky-100"><Pill size={36} className="text-sky-500" /></div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 mb-1">{selectedMedicine?.name || "Medicine"}</h2>
                    <p className="text-slate-500 text-sm mb-3">{selectedMedicine?.description}</p>
                    <div className="text-4xl font-black text-green-600">₹{bestOption.price.toFixed(2)}</div>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><MapPin size={13} /> {bestOption.pharmacy.name}</span>
                      <span className="flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" /> {bestOption.pharmacy.rating}</span>
                      <span>{bestOption.pharmacy.distance} km</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-slate-700 text-sm">Quantity</span>
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-100"><Minus size={16} /></button>
                      <span className="font-bold text-lg w-6 text-center">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 flex items-center justify-center text-sky-600 hover:text-sky-800 transition-colors rounded-lg hover:bg-sky-50"><Plus size={16} /></button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    {hasDiscount && <div className="flex justify-between text-green-600 font-medium"><span className="flex items-center gap-1"><Gift size={13} /> Bulk discount</span><span>-₹{discountAmt.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-black text-base border-t pt-2"><span>Total</span><span className="text-green-600">₹{finalTotal.toFixed(2)}</span></div>
                  </div>
                  <button onClick={() => addToCart(bestOption, selectedMedicine, quantity)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                    <ShoppingCart size={17} /> Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ) : searchLoading ? (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-20 text-center">
              <Search size={40} className="mx-auto mb-4 text-slate-300 animate-spin" />
              <p className="text-slate-400 font-medium">Searching…</p>
            </div>
          ) : medicines.length === 0 && searchTerm ? (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-20 text-center">
              <Pill size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-medium">No results for "<strong>{searchTerm}</strong>"</p>
              <p className="text-slate-400 text-sm mt-1">Try a different search term.</p>
            </div>
          ) : null}

          {/* Matching Medicines */}
          {medicines.length > 0 && (
            <div id="search-results" className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Top Recommended</h3>
                  <p className="text-slate-500 text-sm">We found {medicines.length} variants in our database</p>
                </div>
                <div className="text-sky-600 text-xs font-bold uppercase tracking-widest bg-sky-50 px-3 py-1 rounded-full">Results for "{searchTerm}"</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {medicines.slice(0, visibleMedicineCount).map(med => {
                  const bestInv = med.inventory?.sort((a: any, b: any) => a.price - b.price)[0];
                  return (
                    <div key={med.id} 
                      onClick={() => { setSelectedMedicine(med); fetchInventory(med.id); }}
                      className={`group cursor-pointer p-6 rounded-[32px] border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 flex flex-col ${selectedMedicine?.id === med.id ? "border-sky-500 bg-sky-50/80 shadow-xl shadow-sky-500/10" : "border-slate-100 bg-white hover:border-sky-200"}`}>
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${selectedMedicine?.id === med.id ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30" : "bg-sky-50 text-sky-500 group-hover:bg-sky-500 group-hover:text-white"}`}>
                          <Pill size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-lg truncate group-hover:text-sky-600 transition-colors uppercase tracking-tight">{med.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Fast Delivery</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">15-30 Mins</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 transition-colors group-hover:bg-white group-hover:border-sky-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Starting From</p>
                          <p className="text-xl font-black text-slate-900">₹{bestInv?.price?.toFixed(2) || " --"}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 transition-colors group-hover:bg-white group-hover:border-sky-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available In</p>
                          <p className="text-sm font-bold text-slate-700">{med.inventory?.length || 0} Stores</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${selectedMedicine?.id === med.id ? "bg-sky-500 animate-pulse" : "bg-slate-200"}`}></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Variant</span>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedMedicine?.id === med.id ? "bg-sky-500 text-white scale-110 shadow-lg shadow-sky-500/20" : "bg-slate-100 text-slate-400"}`}>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {medicines.length > visibleMedicineCount && (
                <div className="text-center mt-10">
                  <button
                    onClick={() => setVisibleMedicineCount(Math.min(15, medicines.length))}
                    className="bg-white hover:bg-slate-900 border-2 border-slate-200 hover:border-slate-900 text-slate-800 hover:text-white px-10 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center gap-3 mx-auto shadow-sm hover:shadow-xl active:scale-95"
                  >
                    See More
                    <ChevronDown size={18} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Health Assistant - Now appears below Search Results */}
        <div id="ai" className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-7 md:p-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl -mr-40 -mt-40"></div>
          <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-10">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-sky-400 text-xs font-black tracking-widest uppercase mb-5"><Sparkles size={13} /> AI-Powered</div>
              <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">Smart Health <span className="text-sky-400">Assistant</span></h2>
              <p className="text-slate-400 mb-7 text-sm leading-relaxed">Describe your symptoms and get AI-powered medicine suggestions from our verified database.</p>
              <textarea
                value={userSymptoms}
                onChange={e => setUserSymptoms(e.target.value)}
                placeholder="E.g. I have a dry cough, sore throat, and slight fever..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 min-h-[120px] text-sm resize-none mb-4"
              />
              <button onClick={handleSymptomCheck} disabled={isAnalyzingSymptoms || !userSymptoms.trim()}
                className="w-full bg-white text-slate-900 hover:bg-sky-400 hover:text-white py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isAnalyzingSymptoms ? <><Brain className="animate-pulse" size={18} /> Analyzing…</> : <><Sparkles size={18} /> Consult AI Assistant</>}
              </button>
            </div>
            <div>
              {symptomMessage || aiRecommendation.length > 0 ? (
                <div className="space-y-6">
                  {symptomMessage && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                      <h3 className="text-lg font-black mb-3 flex items-center gap-2 text-sky-400 uppercase tracking-widest text-[10px]">AI Consultant Answer</h3>
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl text-slate-200 text-sm leading-relaxed italic shadow-inner">
                        "{symptomMessage}"
                      </div>
                    </div>
                  )}

                  {aiRecommendation.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                      <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-white"><Stethoscope className="text-sky-400" size={20} /> Suggested Medicines</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {aiRecommendation.map(med => {
                          const bestInv = med.inventory?.sort((a: any, b: any) => (a.pharmacy?.distance || 0) - (b.pharmacy?.distance || 0))[0];
                          return (
                            <div key={med.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all flex flex-col gap-4 group">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center text-sky-400 shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors"><Pill size={20} /></div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-white text-base">{med.name}</h4>
                                    {bestInv && <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg uppercase tracking-wider">In Stock</span>}
                                  </div>
                                  <p className="text-xs text-slate-400 line-clamp-1">{med.description || "Found in our verified database"}</p>
                                </div>
                              </div>
                              
                              {bestInv && (
                                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 flex justify-between items-center text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <Store size={14} className="text-sky-400" />
                                    <span className="text-slate-300 font-bold">{bestInv.pharmacy?.name}</span>
                                    <span className="text-slate-500">• {bestInv.pharmacy?.distance || "0.5"} km</span>
                                  </div>
                                  <span className="text-sky-400 font-black">₹{bestInv.price.toFixed(2)}</span>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                <button 
                                  onClick={() => {
                                    if (bestInv) {
                                      addToCart(bestInv, med, 1);
                                      setIsCartOpen(true);
                                    } else {
                                      handleSearch(med.name);
                                      document.getElementById("search")?.scrollIntoView({ behavior: "smooth" });
                                    }
                                  }}
                                  className="bg-sky-600 hover:bg-sky-500 text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                  <ShoppingCart size={14} /> {bestInv ? "Add to Cart" : "Find Nearby"}
                                </button>
                                <button 
                                  onClick={() => { handleSearch(med.name); document.getElementById("search")?.scrollIntoView({ behavior: "smooth" }); }}
                                  className="bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                                >
                                  <Search size={14} /> Find More
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed min-h-[200px]">
                  <Brain size={40} className="text-slate-600 mb-3" />
                  <h4 className="font-bold text-white/50 mb-1">Awaiting Symptoms</h4>
                  <p className="text-slate-600 text-xs">Describe your symptoms to get medicine suggestions</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alternatives */}
        {inventory.length > 1 && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-black text-slate-900">Alternative Options</h3>
                <p className="text-slate-500 text-sm mt-0.5">Other stores with "{selectedMedicine?.name}"</p>
              </div>
              <div className="flex gap-2">
                <button className="w-9 h-9 rounded-xl border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50"><ChevronRight className="rotate-180" size={18} /></button>
                <button className="w-9 h-9 rounded-xl border-2 border-slate-100 flex items-center justify-center text-sky-600 hover:bg-sky-50"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {altInventory.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-500"><Pill size={20} /></div>
                    <span className="text-xl font-black text-slate-900">₹{item.price.toFixed(2)}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 mb-1 truncate">{item.pharmacy.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1 text-amber-500"><Star size={11} fill="currentColor" /> {item.pharmacy.rating}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} /> {item.pharmacy.distance} km</span>
                  </div>
                  <button onClick={() => addToCart(item, selectedMedicine, 1)}
                    className="w-full bg-slate-900 hover:bg-sky-600 text-white py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2">
                    <ShoppingCart size={14} /> Add to Cart
                  </button>
                </div>
              ))}
            </div>
            {hasMoreAlt && (
              <div className="text-center mt-5">
                <button
                  onClick={() => setVisibleAltCount(v => v + 30)}
                  className="bg-white border border-slate-200 hover:border-sky-400 text-slate-700 hover:text-sky-600 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 mx-auto shadow-sm"
                >
                  See More
                  <ChevronDown size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <div id="nearby" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 h-[480px] overflow-hidden relative">
            <LeafletMap
              lat={userLocation?.lat || 19.076} 
              lng={userLocation?.lng || 72.8777}
              title={userLocation ? "You are here" : "Your Location — Mumbai"}
              zoom={13}
              focusLocation={mapFocus}
              pharmacies={nearbyPharmacies}
              onSelectPharmacy={setMapFocus}
              userLocation={userLocation}
            />
            {/* Map Overlay mimic Fast Route */}
            {mapFocus && (
              <div className={`absolute bottom-6 right-6 z-[1000] bg-slate-900 text-white rounded-3xl shadow-2xl transition-all duration-300 overflow-hidden ${mapOverlayMinimized ? "w-48 p-4" : "max-w-[300px] p-6"}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className={mapOverlayMinimized ? "hidden" : ""}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1">Fastest Route</p>
                    <h4 className="text-lg font-black leading-tight">To {nearbyPharmacies.find(p => p.lat === mapFocus.lat)?.name || "Pharmacy"}</h4>
                  </div>
                  <div className={`text-right ${mapOverlayMinimized ? "flex-1 flex justify-between items-center" : ""}`}>
                    {mapOverlayMinimized && <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">Route Info</p>}
                    <div>
                      <p className={`${mapOverlayMinimized ? "text-lg" : "text-2xl"} font-black text-sky-400 leading-none`}>{nearbyPharmacies.find(p => p.lat === mapFocus.lat)?.time || "8 min"}</p>
                      <p className="text-[10px] text-slate-400">{nearbyPharmacies.find(p => p.lat === mapFocus.lat)?.dist || "0.8 km"}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMapOverlayMinimized(!mapOverlayMinimized)}
                    className="ml-3 p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
                  >
                    {mapOverlayMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {!mapOverlayMinimized && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    {/* Address Selection */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Delivery Address</p>
                        <button onClick={() => setShowAddressModal(true)} className="text-[10px] text-sky-400 font-bold hover:underline">+ Add New</button>
                      </div>
                      {userAddresses.length === 0 ? (
                        <div className="text-[10px] text-slate-400 bg-white/5 p-3 rounded-xl border border-dashed border-white/10">No addresses saved. Please add one to continue.</div>
                      ) : (
                        <select 
                          value={selectedAddressId} 
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-white"
                        >
                          {userAddresses.map(addr => (
                            <option key={addr.id} value={addr.id} className="bg-slate-900">{addr.label}: {addr.address}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Payment Selection */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Payment Method</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                          className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border-2 ${paymentMethod === "CASH_ON_DELIVERY" ? "border-slate-700 bg-slate-800 text-white" : "border-white/5 bg-white/5 text-slate-500"}`}
                        >
                          Cash On Delivery
                        </button>
                        <button 
                          onClick={() => setPaymentMethod("ONLINE")}
                          className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border-2 ${paymentMethod === "ONLINE" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-white/5 bg-white/5 text-slate-500"}`}
                        >
                          Online Payment
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 py-2 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
                        <p className="text-[11px] text-slate-300">Head South on Broadway</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                        <p className="text-[11px] text-slate-500">Turn right onto 42nd St</p>
                      </div>
                    </div>
                    <button className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-sky-600/20">
                      Start Navigation <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 sticky top-0 bg-slate-50 py-2 z-10"><MapIcon size={18} className="text-sky-600" /> Nearby Pharmacies</h3>
            {nearbyPharmacies.map((p, i) => (
              <div key={`${p.name}-${i}`} 
                onClick={() => setMapFocus({ lat: p.lat, lng: p.lng })}
                className={`bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5 ${p.badge ? "border-sky-100" : "border-slate-100"}`}>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0 font-black text-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{p.name}</h4>
                      {p.badge && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${p.badge === "Closed" ? "text-rose-600 bg-rose-50" : "text-sky-600 bg-sky-50"}`}>{p.badge}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <div className="flex items-center gap-0.5 text-amber-500"><Star size={10} fill="currentColor" /></div>
                      <span className="text-[10px] font-black text-slate-700">{p.rating || "4.5"}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{p.reviews || "(120+)"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1 font-medium truncate">
                      <MapPin size={10} className="text-slate-400" /> {p.location || "Mumbai, Maharashtra"}
                    </div>
                    {/* Open/Closed status */}
                    <div className="mb-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${(p as any).isAvailable === false ? "bg-rose-50 text-rose-500" : "bg-green-50 text-green-600"}`}>
                        {(p as any).open || "Open now"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black">
                      <span className="flex items-center gap-1 text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
                        <Clock size={10} /> {p.time || "12 min"}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        <MapPin size={10} /> {p.dist}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div className="text-xs text-slate-700 font-bold">
                    {selectedMedicine?.name || "Medicine"}: <span className="text-sky-600">₹{p.price.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      document.getElementById("nearby")?.scrollIntoView({ behavior: "smooth" });
                      setMapFocus({ lat: p.lat, lng: p.lng });
                    }}
                    className="text-sky-600 group-hover:text-sky-800 text-[11px] font-black flex items-center gap-0.5"
                  >
                    Route <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: ShieldCheck, color: "text-green-500 bg-green-50", title: "Verified Stores", desc: "All pharmacies verified by our team" },
            { icon: Globe, color: "text-sky-500 bg-sky-50", title: "Real-time Stock", desc: "Live inventory across 500+ stores" },
            { icon: TrendingUp, color: "text-amber-500 bg-amber-50", title: "Best Prices", desc: "Compare and save up to 40%" },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
              <div className={`w-12 h-12 ${f.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}><f.icon size={22} /></div>
              <h3 className="font-bold text-slate-900 mb-1 text-sm">{f.title}</h3>
              <p className="text-xs text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── CART SIDEBAR ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><ShoppingCart size={18} className="text-sky-600" /> Your Cart ({cart.length})</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Your cart is empty</p>
                </div>
              ) : cart.map(item => (
                <div key={item.inventory.id} className="flex gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <button onClick={() => removeFromCart(item.inventory.id)} className="absolute -top-1.5 -right-1.5 bg-white shadow rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 border border-rose-100"><X size={13} /></button>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm"><Pill size={18} className="text-sky-500" /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{item.medicine?.name}</h4>
                    <p className="text-[11px] text-slate-400">{item.inventory.pharmacy?.name}</p>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs font-bold text-sky-600">₹{item.inventory.price.toFixed(2)} × {item.quantity}</span>
                      <span className="text-xs font-black">₹{(item.inventory.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-100 space-y-4">
                {/* Emergency Mode Toggle */}
                <div className={`p-4 rounded-2xl border-2 transition-all ${isEmergencyMode ? "border-rose-500 bg-rose-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEmergencyMode ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                        <Activity size={16} className={isEmergencyMode ? "animate-pulse" : ""} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase tracking-wide">Emergency Mode</p>
                        <p className="text-[10px] text-slate-500 font-medium">Faster delivery with surge fee</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!isEmergencyMode) setShowEmergencyModal(true);
                        else setIsEmergencyMode(false);
                      }}
                      className={`w-10 h-5 rounded-full relative transition-colors ${isEmergencyMode ? "bg-rose-500" : "bg-slate-300"}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isEmergencyMode ? "right-1" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                {/* Address Selection */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Delivery Address</p>
                    <button onClick={() => setShowAddressModal(true)} className="text-[10px] text-sky-600 font-bold hover:underline">+ Add New</button>
                  </div>
                  {userAddresses.length === 0 ? (
                    <div className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">No addresses saved. Please add one to continue.</div>
                  ) : (
                    <select 
                      value={selectedAddressId} 
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                    >
                      {userAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>{addr.label}: {addr.address}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Payment Selection */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none px-1">Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                      className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border-2 ${paymentMethod === "CASH_ON_DELIVERY" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                    >
                      Cash On Delivery
                    </button>
                    <button 
                      onClick={() => setPaymentMethod("ONLINE")}
                      className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border-2 ${paymentMethod === "ONLINE" ? "border-sky-500 bg-sky-50 text-sky-600" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                    >
                      Online Payment
                    </button>
                  </div>
                </div>

                <div className="text-sm space-y-1.5 pt-2 border-t border-slate-50">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{cartSubtotal.toFixed(2)}</span></div>
                  {cartDiscount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Bulk discount (10%)</span><span>-₹{cartDiscount.toFixed(2)}</span></div>}
                  {isEmergencyMode && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span className="flex items-center gap-1"><Navigation size={13} /> Emergency Delivery Fee</span>
                      <span>+₹{emergencyFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-base border-t pt-2">
                    <span>Total</span>
                    <span className={isEmergencyMode ? "text-rose-600" : "text-green-600"}>₹{cartFinalWithEmergency.toFixed(2)}</span>
                  </div>
                </div>
                {!user && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl text-center">Please <button onClick={() => { setIsCartOpen(false); setShowLogin(true); }} className="underline font-bold">sign in</button> to checkout</p>}
                <button onClick={user ? handlePlaceOrder : () => { setIsCartOpen(false); setShowLogin(true); }} disabled={isOrdering}
                  className={`w-full ${isEmergencyMode ? "bg-rose-500 hover:bg-rose-600" : "bg-sky-600 hover:bg-sky-700"} text-white py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm`}>
                  {isOrdering ? "Placing order…" : <>{isEmergencyMode ? <Activity size={16} /> : <ShoppingCart size={16} />} Checkout — ₹{cartFinalWithEmergency.toFixed(2)}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ORDER SUCCESS SCREEN ── */}
      {showOrderSuccess && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-md w-full">
            <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <CheckCircle size={48} />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6">Order Confirmed!</h1>
            <p className="text-slate-500 mb-12 text-lg">
              Your order has been placed successfully. You can track the delivery progress in real time.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => {
                  setIsTrackingMode(true);
                  setShowOrderSuccess(false);
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-full font-black text-lg shadow-xl shadow-slate-200 hover:scale-105 transition-transform"
              >
                Track Your Package
              </button>
              <button 
                onClick={() => {
                  if (user?.role === "shop_owner") window.location.href = "/dashboard/shop";
                  else window.location.href = "/dashboard/user";
                }}
                className="w-full bg-white text-slate-900 py-4 rounded-full font-black text-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER TRACKING MODAL ── */}
      {isTrackingMode && trackingOrder && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden overflow-y-auto max-h-[90vh]">
            <div className={`p-8 text-center text-white relative ${trackingOrder.isEmergency ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-sky-500 to-sky-700"}`}>
              <button onClick={() => setIsTrackingMode(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors"><X size={18} /></button>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                {trackingOrder.isEmergency ? <Activity size={32} className="text-rose-500 animate-pulse" /> : <CheckCircle size={32} className="text-green-500" />}
              </div>
              <h2 className="text-2xl font-black mb-1">{trackingOrder.isEmergency ? "Emergency Dispatch!" : "Order Confirmed!"}</h2>
              <div className="flex flex-col items-center gap-1">
                <p className="text-white/80 text-sm">Tracking: <code className="bg-white/20 px-2 py-0.5 rounded font-mono">{trackingOrder.trackingNumber}</code></p>
                {trackingOrder.isEmergency && <span className="text-[10px] font-black bg-white text-rose-600 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm mt-1">Priority Delivery Activated</span>}
              </div>
            </div>
            <div className="p-8">
              {/* Progress Line */}
              <div className="mb-12 relative px-4">
                <div className="absolute top-4 left-4 right-4 h-1 bg-slate-100 rounded-full"></div>
                <div 
                  className={`absolute top-4 left-4 h-1 rounded-full transition-all duration-1000 ${trackingOrder.isEmergency ? "bg-rose-500" : "bg-sky-500"}`}
                  style={{ 
                    width: `${
                      trackingOrder.status === "PENDING" ? "5%" :
                      trackingOrder.status === "PROCESSING" ? "20%" :
                      trackingOrder.status === "CONFIRMED" ? "40%" :
                      trackingOrder.status === "RIDER_ASSIGNED" ? "60%" :
                      trackingOrder.status === "RIDER_AT_PHARMACY" ? "80%" :
                      trackingOrder.status === "OUT_FOR_DELIVERY" ? "90%" :
                      trackingOrder.status === "DELIVERED" ? "100%" : "0%"
                    }` 
                  }}
                ></div>
                <div className="flex justify-between relative mt-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((step) => {
                    const statusSteps = ["PENDING", "PROCESSING", "CONFIRMED", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "OUT_FOR_DELIVERY", "DELIVERED"];
                    const currentIndex = statusSteps.indexOf(trackingOrder.status);
                    const active = (step - 1) <= currentIndex;
                    return (
                      <div key={step} className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-4 border-white shadow-sm transition-colors duration-500 ${active ? (trackingOrder.isEmergency ? "bg-rose-500" : "bg-sky-500") : "bg-slate-300"}`}></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Clock size={16} className="text-sky-500" /> Delivery Progress
                  </h3>
                  <div className="space-y-6 relative">
                    <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-slate-100"></div>
                    {[
                      { id: "PENDING", label: "Order Placed", desc: "The pharmacy has received your order." },
                      { id: "PROCESSING", label: "Shop Owner Checking", desc: "The pharmacy is verifying and preparing the medicines." },
                      { id: "CONFIRMED", label: "Confirmed by Pharmacy", desc: "The medicines are packed and ready for pickup." },
                      { id: "RIDER_ASSIGNED", label: "Rider Assigned", desc: "A delivery rider has been assigned to your order." },
                      { id: "RIDER_AT_PHARMACY", label: "Rider Arrived at Pharmacy", desc: "The rider has arrived and picked up your order." },
                      { id: "OUT_FOR_DELIVERY", label: "Out for Delivery", desc: "The rider is on the way to your location." },
                      { id: "DELIVERED", label: "Delivered", desc: "Your medicines have been successfully delivered." }
                    ].map((s, i) => {
                      const statusSteps = ["PENDING", "PROCESSING", "CONFIRMED", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "OUT_FOR_DELIVERY", "DELIVERED"];
                      const currentIndex = statusSteps.indexOf(trackingOrder.status);
                      const completed = i <= currentIndex;
                      const active = i === currentIndex;

                      return (
                        <div key={s.id} className="flex gap-4 items-start relative z-10">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm transition-all duration-500 ${completed ? (trackingOrder.isEmergency ? "bg-rose-500 text-white" : "bg-sky-600 text-white") : "bg-slate-100 text-slate-400"}`}>
                            {completed ? <CheckCircle size={14} /> : <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-black transition-colors ${completed ? "text-slate-900" : "text-slate-400"}`}>{s.label}</p>
                            <p className={`text-[11px] leading-relaxed transition-colors ${completed ? "text-slate-500" : "text-slate-300"}`}>{s.desc}</p>
                          </div>
                          {active && !completed && <div className="absolute h-full w-0.5 left-[13px] bg-sky-500 animate-pulse"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="h-64 rounded-3xl overflow-hidden border border-slate-100 shadow-xl mb-6 relative">
                    <LeafletMap lat={19.076} lng={72.8777} title="Delivery Agent" zoom={14} />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                      <p className="text-[10px] font-black uppercase text-sky-600">Near Chembur</p>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Delivery</p>
                      <p className="text-xl font-black text-sky-400">12:45 PM</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl">
                      <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white"><Activity size={20} /></div>
                      <div>
                        <p className="font-bold text-sm">Rider: Aryan Singh</p>
                        <p className="text-[10px] text-slate-400">Rating: 4.8 ★</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <button onClick={() => setIsTrackingMode(false)} className="bg-white border border-slate-200 text-slate-900 px-8 py-3 rounded-2xl font-black text-sm hover:bg-slate-100 transition-colors shadow-sm">
                Return Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3 text-slate-400">
            <HeartPulse size={20} />
            <span className="text-base font-bold">MediFind</span>
          </div>
          <p className="text-slate-400 text-sm">© 2026 MediFind. Helping you find accessible healthcare.</p>
          <div className="flex justify-center gap-6 mt-4 text-xs text-slate-400">
            <a href="#" className="hover:text-sky-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-sky-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-sky-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* ── ADDRESS MODAL ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddressModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><MapPin className="text-sky-500" /> New Delivery Address</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Label</label>
                <div className="flex gap-2">
                  {["Home", "Work", "Other"].map(l => (
                    <button key={l} onClick={() => setNewAddress(p => ({ ...p, label: l }))} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${newAddress.label === l ? "bg-sky-50 border-sky-200 text-sky-600" : "bg-slate-50 border-slate-100 text-slate-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Full Address</label>
                <textarea 
                  value={newAddress.address} 
                  onChange={e => setNewAddress(p => ({ ...p, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[100px] resize-none text-slate-900"
                  placeholder="Street, Landmark, Apartment, City..."
                />
              </div>
              <button 
                onClick={handleAddAddress}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:bg-slate-800"
              >
                Save Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
