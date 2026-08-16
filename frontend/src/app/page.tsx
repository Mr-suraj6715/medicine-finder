"use client";
import React, { useState, useEffect, useCallback } from "react";
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
  Package, TrendingUp, Clock, CheckCircle, LogOut, ChevronDown, Check, ArrowRight, Truck, Award
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

  const nearestPharmacy = [...pharmacies].sort((a, b) => (a.distValue || 999) - (b.distValue || 999))[0];

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-inner border border-slate-200">
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        
        <Marker position={[lat, lng]} icon={userIcon}>
          <Popup>
            <div className="font-bold text-emerald-800">{title}</div>
            <div className="text-[10px] text-slate-400">Current Position</div>
          </Popup>
        </Marker>

        {pharmacies.map((p, i) => {
          const isNearest = nearestPharmacy && p.name === nearestPharmacy.name;
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
                    {p.price && <span className="text-[10px] font-black text-emerald-700">₹{p.price.toFixed(0)}</span>}
                  </div>
                  {isNearest && <div className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tighter">★ Fastest Delivery</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {focusLocation && (
          <Polyline 
            positions={[[userLocation?.lat || lat, userLocation?.lng || lng], [focusLocation.lat, focusLocation.lng]]}
            pathOptions={{ color: '#2D4A3E', weight: 4, opacity: 0.7, dashArray: '10, 10' }} 
          />
        )}

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
          <div className="w-10 h-10 bg-[#1E3A2F] rounded-xl flex items-center justify-center text-white"><HeartPulse size={20} /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Welcome back</h2><p className="text-xs text-slate-500">Sign in to your MediFind account</p></div>
        </div>

        <div className="flex gap-2 mb-6">
          {(["user", "shop_owner", "rider"] as const).map(r => (
            <button key={r} onClick={() => setRole(r)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${role === r ? "border-[#1E3A2F] bg-[#E8F3ED] text-[#1E3A2F]" : "border-slate-100 text-slate-400"}`}>
              {r.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="bg-[#F2F8F4] border border-[#D5E6DC] rounded-2xl p-4 mb-6 text-sm text-[#1E3A2F]">
          <p className="font-bold mb-1">Demo Credentials:</p>
          <p>👤 User: <code className="bg-[#E2EFE7] px-1 rounded">demo@medstore.com</code> / <code className="bg-[#E2EFE7] px-1 rounded">demo123</code></p>
          <p className="mt-1">🏪 Shop Owner: <code className="bg-[#E2EFE7] px-1 rounded">shop@medstore.com</code> / <code className="bg-[#E2EFE7] px-1 rounded">shop123</code></p>
          <p className="mt-1">🚴 Rider: <code className="bg-[#E2EFE7] px-1 rounded">rider@medstore.com</code> / <code className="bg-[#E2EFE7] px-1 rounded">rider123</code></p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm font-medium">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60">
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
          <div className="w-10 h-10 bg-[#1E3A2F] rounded-xl flex items-center justify-center text-white"><User size={20} /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Create Account</h2><p className="text-xs text-slate-500">Join MediFind today</p></div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm font-medium">{error}</div>}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" placeholder="Your full name" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" placeholder="you@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
            <input value={form.phone} onChange={e => set("phone", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" placeholder="+91 00000 00000" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
            <input value={form.location} onChange={e => set("location", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" placeholder="Mumbai, Maharashtra" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" placeholder="Min. 6 characters" required minLength={6} />
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
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.role === opt.v ? "border-[#1E3A2F] bg-[#E8F3ED]" : "border-slate-200 hover:border-slate-300"}`}>
                  <opt.icon size={18} className={form.role === opt.v ? "text-[#1E3A2F]" : "text-slate-400"} />
                  <p className="font-semibold text-sm mt-1">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60">
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
  const [safetyAge, setSafetyAge] = useState<string>("");
  const [safetyAllergies, setSafetyAllergies] = useState<string>("");
  const [safetyPregnancy, setSafetyPregnancy] = useState<boolean>(false);
  const [aiConsultResult, setAiConsultResult] = useState<any>(null);
  const [safetyQuestions, setSafetyQuestions] = useState<any>(null);
  const [escalatedRole, setEscalatedRole] = useState<"pharmacist" | "doctor" | null>(null);
  const [escalationMessage, setEscalationMessage] = useState<string>("");
  const [pharmacistChat, setPharmacistChat] = useState<{sender: "user" | "pharmacist", text: string}[]>([]);
  const [pharmacistInput, setPharmacistInput] = useState<string>("");
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
        setSuggestions(data.medicines?.slice(0, 5) || data.results?.slice(0, 5) || []);
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

  useEffect(() => {
    const activeRole = localStorage.getItem("medifind_active_role");
    const stored = activeRole ? localStorage.getItem(`medifind_user_${activeRole}`) : localStorage.getItem("medifind_user");
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
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
    localStorage.setItem(`medifind_user_${u.role}`, JSON.stringify(u));
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
    setVisibleMedicineCount(3);
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const combined = data.medicines || data.results || [];
      
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
  };

  const removeFromCart = (invId: string) => setCart(prev => prev.filter(i => i.inventory.id !== invId));

  const cartSubtotal = cart.reduce((a, i) => a + i.inventory.price * i.quantity, 0);
  const cartItems = cart.reduce((a, i) => a + i.quantity, 0);
  const cartDiscount = cartItems > 5 && cartSubtotal >= 100 ? cartSubtotal * 0.1 : 0;
  const cartTotal = cartSubtotal - cartDiscount;

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
          userId: user.id,
          totalAmount: cartFinalWithEmergency,
          items: cart.map(i => ({ inventoryId: i.inventory.id, quantity: i.quantity, priceAtTime: i.inventory.price })),
          isEmergency: isEmergencyMode,
          paymentMethod,
          deliveryAddress: selAddr?.address || "",
        }),
      });
      const data = await res.json();
      if (data.orderId || data.trackingNumber) { 
        setTrackingOrder(data); 
        localStorage.setItem("medifind_active_order_id", data.orderId || data.trackingNumber);
        setShowOrderSuccess(true); 
        setCart([]); 
        setIsCartOpen(false); 
        setIsEmergencyMode(false); 
        fetchLoyalty(); 
      }
    } catch {} finally { setIsOrdering(false); }
  };

  const handleSymptomCheck = async (overrideSafetyInfo?: any) => {
    if (!userSymptoms.trim()) return;
    setIsAnalyzingSymptoms(true);
    setSymptomMessage("");
    setAiRecommendation([]);
    setEscalatedRole(null);
    setEscalationMessage("");

    // Build safety info payload
    const sInfo: any = {};
    if (overrideSafetyInfo) {
      Object.assign(sInfo, overrideSafetyInfo);
    } else {
      if (safetyAge) sInfo.age = parseInt(safetyAge);
      if (safetyAllergies) sInfo.allergies = safetyAllergies;
      sInfo.pregnancy = safetyPregnancy;
    }

    try {
      const res = await fetch("/api/ai-consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user?.email || "user@example.com",
          symptoms: userSymptoms,
          safetyInfo: sInfo
        }),
      });
      const data = await res.json();
      setAiConsultResult(data);
      if (data.status === "NEEDS_SAFETY_INFO") {
        setSafetyQuestions(data.questions);
      } else {
        setSafetyQuestions(null);
      }
      if (data.advice) {
        setSymptomMessage(data.advice);
      }
      // Keep legacy fallback compatibility
      if (data.suggestedProducts) {
        setAiRecommendation(data.suggestedProducts.map((p: any) => p.name));
      }
    } catch (err) {
      console.error("AI consult failed:", err);
    } finally {
      setIsAnalyzingSymptoms(false);
    }
  };

  const sendPharmacistMessage = () => {
    if (!pharmacistInput.trim()) return;
    const userMsg = pharmacistInput;
    setPharmacistChat(prev => [...prev, { sender: "user", text: userMsg }]);
    setPharmacistInput("");

    setTimeout(() => {
      let reply = "I understand. Based on these symptoms, I recommend taking plenty of fluids and rest. Let me know if you have any existing allergies before taking any medications.";
      const msgLower = userMsg.toLowerCase();
      if (msgLower.includes("dose") || msgLower.includes("how much") || msgLower.includes("take")) {
        reply = "For general OTC medications like Paracetamol 500mg, the standard dose for adults is 1 tablet every 4-6 hours as needed, not exceeding 4 tablets in 24 hours. Always read the packaging label and take after meals.";
      } else if (msgLower.includes("side effect") || msgLower.includes("harm") || msgLower.includes("safe")) {
        reply = "Common side effects are mild, but if you experience any swelling, skin rash, or breathing difficulties, stop taking the medicine immediately and seek emergency medical help.";
      } else if (msgLower.includes("child") || msgLower.includes("baby") || msgLower.includes("kid")) {
        reply = "For children, dosing must be carefully calculated based on weight and age. Please consult a pediatrician before giving any adult OTC medicine to a child.";
      } else if (msgLower.includes("allergy") || msgLower.includes("allergic")) {
        reply = "If you have an allergy to aspirin or NSAIDs, avoid Ibuprofen or Diclofenac. Stick to Paracetamol or contact your doctor for an alternative prescription.";
      } else if (msgLower.includes("thank") || msgLower.includes("ok") || msgLower.includes("yes")) {
        reply = "You're welcome! Stay safe and feel free to ask any other questions. Your wellness is our priority.";
      }
      setPharmacistChat(prev => [...prev, { sender: "pharmacist", text: reply }]);
    }, 800);
  };


  useEffect(() => {
    const handleActiveOrder = async () => {
      const activeId = localStorage.getItem("medifind_active_order_id");
      if (activeId && user) {
        try {
          const res = await fetch(`/api/orders?email=${user.email}`);
          const data = await res.json();
          const activeOrder = data.orders.find((o: any) => o.id === activeId || o.realId === activeId);
          if (activeOrder) {
            if (activeOrder.status === "DELIVERED") {
              localStorage.removeItem("medifind_active_order_id");
              setTrackingOrder(null);
            } else {
              setTrackingOrder(activeOrder);
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
  const subtotal = bestOption ? bestOption.price * quantity : 0;
  const hasDiscount = quantity > 5 && subtotal >= 100;
  const discountAmt = hasDiscount ? subtotal * 0.1 : 0;
  const finalTotal = subtotal - discountAmt;

  const displayPharmacies = Array.from(
    inventory.reduce((map, inv: any) => {
      if (!map.has(inv.pharmacy.name)) {
        const predefined = NEARBY_PHARMACIES.find(p => p.name === inv.pharmacy.name);
        const distance = (inv.pharmacy.distance && inv.pharmacy.distance !== 0) ? inv.pharmacy.distance : (predefined ? (parseFloat(predefined.dist) || 1.2) : 1.5);
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
  ).sort((a: any, b: any) => a.distValue - b.distValue);

  const nearbyPharmacies = (displayPharmacies.length > 0 ? displayPharmacies : NEARBY_PHARMACIES.map(p => ({
    ...p,
    rating: "4.5",
    reviews: "(120+)",
    location: "Mumbai, MH",
    distValue: parseFloat(p.dist) || 1.2,
    time: "12 min",
    timeValue: 12
  }))) as PharmacyMarker[];

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F4F9F6] flex flex-col items-center justify-center">
        <div className="bg-[#1E3A2F] p-3.5 rounded-2xl text-white shadow-xl animate-bounce mb-4">
          <HeartPulse size={32} />
        </div>
        <p className="text-[#1E3A2F] font-bold animate-pulse text-sm">Authenticating...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6FAF7] font-sans text-slate-900 selection:bg-[#2D4A3E]/20">
      
      {/* ── TOP TICKER ANNOUNCEMENT BAR (Hers Style) ── */}
      <div className="bg-[#F0F6F2] border-b border-[#E2EFE7] text-[#2D4A3E] text-xs font-semibold py-2 px-4 overflow-x-auto whitespace-nowrap scrollbar-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 text-[11px] font-medium tracking-tight">
          <span className="flex items-center gap-1.5"><Award size={13} className="text-[#2D4A3E]" /> Why MediFind? <b>over 2M subscribers</b></span>
          <span className="flex items-center gap-1.5"><Truck size={13} className="text-[#2D4A3E]" /> Free & discreet shipping on all prescriptions</span>
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-[#2D4A3E]" /> Affordable pricing with no hidden fees</span>
          <span className="flex items-center gap-1.5"><Globe size={13} className="text-[#2D4A3E]" /> 100% online & 24/7 delivery</span>
          <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-[#2D4A3E]" /> Personalized to your needs</span>
        </div>
      </div>

      {/* ── PERSISTENT TRACKING BAR ── */}
      {trackingOrder && trackingOrder.status !== "DELIVERED" && (
        <div className="fixed top-16 left-0 right-0 z-[49] bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-xl px-4 py-3 animate-in slide-in-from-top duration-500">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 shrink-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${trackingOrder.isEmergency ? "bg-rose-500" : "bg-[#1E3A2F]"}`}>
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
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${trackingOrder.isEmergency ? "bg-rose-500" : "bg-[#1E3A2F]"}`}
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
              className="bg-[#1E3A2F] hover:bg-[#152a22] text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center gap-2"
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

      {/* ── CLEAN MINIMALIST NAVBAR (Hers Style) ── */}
      <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10">
          <div className="flex justify-between items-center h-20">
            
            {/* Logo */}
            <a href="/" className="flex items-center gap-2">
              <span className="text-3xl font-serif tracking-tighter text-[#1E3A2F] font-bold">medifind</span>
            </a>

            {/* Middle Nav Links */}
            <div className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-tight text-slate-700">
              <a href="#categories" className="hover:text-[#1E3A2F] transition-colors">Treatments</a>
              <a href="#search" className="hover:text-[#1E3A2F] transition-colors">Search Medicines</a>
              <a href="#nearby" className="hover:text-[#1E3A2F] transition-colors">Nearby Pharmacies</a>
              <a href="#ai" className="hover:text-[#1E3A2F] transition-colors">AI Health</a>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center gap-4">
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 bg-[#F0F6F2] hover:bg-[#E2EFE7] px-5 py-2.5 rounded-full text-xs font-bold text-[#1E3A2F] border border-[#D5E6DC] transition-all"
                  >
                    <User size={15} className="text-[#1E3A2F]" />
                    <span className="uppercase tracking-wider font-extrabold">{user.name?.split(" ")[0]}</span>
                    <ChevronDown size={14} className={`transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-[40]" onClick={() => setProfileOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 w-52 z-[50] animate-in fade-in zoom-in-95 duration-200">
                        <a href={user.role === "shop_owner" ? "/dashboard/shop" : user.role === "rider" ? "/dashboard/rider" : "/dashboard/user"} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 font-bold">
                          {user.role === "shop_owner" ? <Store size={15} /> : user.role === "rider" ? <Navigation size={15} /> : <Package size={15} />} Dashboard
                        </a>
                        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 text-rose-600 w-full text-left font-bold">
                          <LogOut size={15} /> Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowLogin(true)} 
                    className="border border-[#1E3A2F] text-[#1E3A2F] hover:bg-[#1E3A2F] hover:text-white px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all"
                  >
                    ACCOUNT
                  </button>
                </div>
              )}

              {/* Cart Button */}
              <button 
                onClick={() => setIsCartOpen(true)} 
                className="relative p-2.5 text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ShoppingCart size={22} />
                {cart.length > 0 && (
                  <span className="absolute top-1 right-1 bg-[#1E3A2F] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── EDITORIAL HERO HEADLINE (Hers Style) ── */}
      <section className="bg-[#F6FAF7] pt-12 pb-14 px-6 md:px-12 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-serif tracking-tight text-slate-900 leading-[1.08] mb-4">
            <span className="text-[#2D4A3E] font-normal block md:inline">Faster medicine</span>{" "}
            <span className="font-sans font-black tracking-tight text-slate-900 block md:inline">personalized to you</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg md:text-xl tracking-tight mb-8">
            Customized care starts here
          </p>

          {/* Search Input Box */}
          <div className="max-w-xl mx-auto relative">
            <div id="search" className="bg-white rounded-full shadow-lg border border-slate-200 p-2 flex items-center gap-3 px-6">
              <Search size={20} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search treatments, medicines, categories…"
                className="w-full py-3 text-slate-800 text-sm bg-transparent outline-none placeholder-slate-400 font-medium"
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); }}
                onKeyDown={e => { if (e.key === "Enter") { setSearchTerm(searchInput); handleSearch(searchInput); setShowSuggestions(false); } }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => searchInput.length >= 2 && setShowSuggestions(true)}
              />
              <button
                onClick={() => { setSearchTerm(searchInput); handleSearch(searchInput); setShowSuggestions(false); }}
                disabled={searchLoading}
                className="bg-[#1E3A2F] hover:bg-[#152a22] text-white px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shrink-0"
              >
                {searchLoading ? "Searching…" : "Search"}
              </button>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[100] text-left">
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSearchInput(s.name);
                      setSearchTerm(s.name);
                      handleSearch(s.name);
                      setShowSuggestions(false);
                    }}
                    className={`w-full flex items-center gap-3 px-6 py-3.5 hover:bg-[#F2F8F4] transition-colors ${i < suggestions.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#E8F3ED] flex items-center justify-center text-[#1E3A2F] shrink-0"><Pill size={16} /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[400px]">{s.description || "Verified inventory item"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>


      {/* ── SEARCH RESULTS & BEST PRICE SECTION ── */}
      <main className="max-w-7xl mx-auto px-6 md:px-10 pb-24 space-y-12">
        <div className="space-y-12">
          {/* Best Price Card */}
          {bestOption ? (
            <div className="bg-white rounded-[32px] shadow-xl border-2 border-emerald-400 p-6 md:p-8 relative overflow-hidden animate-in fade-in duration-500">
              <div className="inline-flex items-center gap-2 bg-[#1E3A2F] text-white px-4 py-1 rounded-full text-xs font-bold mb-5">
                <Star size={13} fill="currentColor" className="text-amber-400" /> BEST PRICE FOUND
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 bg-[#F2F8F4] rounded-2xl flex items-center justify-center shrink-0 border border-[#D5E6DC]"><Pill size={36} className="text-[#1E3A2F]" /></div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 mb-1">{selectedMedicine?.name || "Medicine"}</h2>
                    <p className="text-slate-500 text-sm mb-3">{selectedMedicine?.description}</p>
                    <div className="text-4xl font-black text-[#1E3A2F]">₹{bestOption.price.toFixed(2)}</div>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1 font-bold text-slate-700"><MapPin size={13} /> {bestOption.pharmacy.name}</span>
                      <span className="flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" /> {bestOption.pharmacy.rating}</span>
                      <span>{bestOption.pharmacy.distance} km</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#F6FAF7] rounded-2xl p-5 border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-slate-700 text-sm">Quantity</span>
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-100"><Minus size={16} /></button>
                      <span className="font-bold text-lg w-6 text-center">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 flex items-center justify-center text-[#1E3A2F] transition-colors rounded-lg hover:bg-emerald-50"><Plus size={16} /></button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    {hasDiscount && <div className="flex justify-between text-emerald-700 font-medium"><span className="flex items-center gap-1"><Gift size={13} /> Bulk discount</span><span>-₹{discountAmt.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-black text-base border-t pt-2"><span>Total</span><span className="text-[#1E3A2F]">₹{finalTotal.toFixed(2)}</span></div>
                  </div>
                  <button onClick={() => addToCart(bestOption, selectedMedicine, quantity)}
                    className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg">
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
            <div id="search-results" className="animate-in fade-in duration-700">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Available Treatments</h3>
                  <p className="text-slate-500 text-sm">We found {medicines.length} variants in our database</p>
                </div>
                <div className="text-[#1E3A2F] text-xs font-bold uppercase tracking-widest bg-[#E8F3ED] px-3 py-1 rounded-full">Results for "{searchTerm}"</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {medicines.slice(0, visibleMedicineCount).map(med => {
                  const bestInv = med.inventory?.sort((a: any, b: any) => a.price - b.price)[0];
                  return (
                    <div key={med.id} 
                      onClick={() => { setSelectedMedicine(med); fetchInventory(med.id); }}
                      className={`group cursor-pointer p-6 rounded-[32px] border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 flex flex-col ${selectedMedicine?.id === med.id ? "border-[#1E3A2F] bg-[#F2F8F4] shadow-xl" : "border-slate-100 bg-white hover:border-[#1E3A2F]/30"}`}>
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${selectedMedicine?.id === med.id ? "bg-[#1E3A2F] text-white shadow-lg" : "bg-[#E8F3ED] text-[#1E3A2F] group-hover:bg-[#1E3A2F] group-hover:text-white"}`}>
                          <Pill size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-lg truncate uppercase tracking-tight">{med.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Fast Delivery</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">15-30 Mins</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Starting From</p>
                          <p className="text-xl font-black text-[#1E3A2F]">₹{bestInv?.price?.toFixed(2) || " --"}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available In</p>
                          <p className="text-sm font-bold text-slate-700">{med.inventory?.length || 0} Stores</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${selectedMedicine?.id === med.id ? "bg-[#1E3A2F] animate-pulse" : "bg-slate-200"}`}></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Variant</span>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedMedicine?.id === med.id ? "bg-[#1E3A2F] text-white scale-110 shadow-lg" : "bg-slate-100 text-slate-400"}`}>
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
                    className="bg-white hover:bg-[#1E3A2F] border-2 border-slate-200 hover:border-[#1E3A2F] text-slate-800 hover:text-white px-10 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center gap-3 mx-auto shadow-sm hover:shadow-xl active:scale-95"
                  >
                    See More
                    <ChevronDown size={18} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CARE BANNER ── */}
        <div className="bg-[#6B8C9F] rounded-[36px] p-10 md:p-16 text-white text-center relative overflow-hidden shadow-xl">
          <span className="bg-[#E76F51] text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest inline-block mb-4">
            Hyperlocal Pharmacy Delivery | 24/7
          </span>
          <h2 className="text-4xl md:text-6xl font-serif tracking-tight mb-4 leading-tight">
            Care that evolves with you
          </h2>
          <p className="text-slate-100 max-w-lg mx-auto text-base md:text-lg font-medium mb-8">
            Access genuine medicines, transparent pricing, and instant rider delivery from verified neighborhood pharmacies.
          </p>
          <button
            onClick={() => document.getElementById("search")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-white text-[#1E3A2F] hover:bg-slate-100 px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
          >
            Start Your Order
          </button>
        </div>

        {/* ── AI HEALTH ASSISTANT ── */}
        <div id="ai" className="bg-[#1D352C] rounded-[36px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl border border-emerald-900/30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Side: Input & Safety Questions */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#2D4D3E] text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-4">
                  <Sparkles size={13} className="animate-pulse" /> Safety-First Guidance
                </div>
                <h2 className="text-3xl md:text-4xl font-serif mb-3 tracking-tight text-white">
                  Smart Health <span className="text-emerald-300 font-sans font-bold">Assistant</span>
                </h2>
                <p className="text-emerald-100/70 text-xs md:text-sm leading-relaxed font-medium">
                  Provide your symptoms to check for possible minor conditions, screen for safety risks, and search local store inventory for matching OTC products.
                </p>
              </div>

              {/* Symptom Input Textarea */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-emerald-300 uppercase tracking-widest">Describe Your Symptoms</label>
                <textarea
                  value={userSymptoms}
                  onChange={e => setUserSymptoms(e.target.value)}
                  placeholder="E.g., I have a mild headache, runny nose, and low fever since yesterday..."
                  className="w-full bg-[#14261F] border border-emerald-800/40 rounded-2xl p-4 text-white placeholder-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[100px] text-xs resize-none transition-all"
                />
              </div>

              {/* Safety Questionnaire if needed */}
              {safetyQuestions && (
                <div className="bg-[#14261F] border border-emerald-800/40 rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-300">
                  <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck size={14} /> Medical Safety Check
                  </h4>
                  <p className="text-slate-300 text-[11px]">To safely check OTC guidance, we require the following info:</p>
                  
                  {safetyQuestions.age && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold">{safetyQuestions.age}</label>
                      <input
                        type="number"
                        placeholder="Age in years"
                        value={safetyAge}
                        onChange={e => setSafetyAge(e.target.value)}
                        className="w-full bg-white/5 border border-emerald-800/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  )}

                  {safetyQuestions.allergies && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold">{safetyQuestions.allergies}</label>
                      <input
                        type="text"
                        placeholder="e.g. none, penicillin, aspirin"
                        value={safetyAllergies}
                        onChange={e => setSafetyAllergies(e.target.value)}
                        className="w-full bg-white/5 border border-emerald-800/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="preg_preg"
                      checked={safetyPregnancy}
                      onChange={e => setSafetyPregnancy(e.target.checked)}
                      className="rounded bg-white/5 border-emerald-800/40 text-emerald-500 focus:ring-0"
                    />
                    <label htmlFor="preg_preg" className="text-[11px] text-slate-300 font-medium">Pregnant or breastfeeding?</label>
                  </div>

                  <button
                    onClick={() => handleSymptomCheck()}
                    className="w-full bg-emerald-400 hover:bg-emerald-300 text-[#1D352C] font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all"
                  >
                    Confirm & Analyze
                  </button>
                </div>
              )}

              {/* Main Guidance Action */}
              {!safetyQuestions && (
                <button
                  onClick={() => handleSymptomCheck()}
                  disabled={isAnalyzingSymptoms || !userSymptoms.trim()}
                  className="w-full bg-white hover:bg-emerald-300 text-[#1E3A2F] hover:text-[#1E3A2F] py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-lg"
                >
                  {isAnalyzingSymptoms ? (
                    <><Brain className="animate-pulse" size={16} /> Analyzing Symptoms...</>
                  ) : (
                    <><Sparkles size={16} /> Get Safety Guidance</>
                  )}
                </button>
              )}

              {/* Escalation Options */}
              {aiConsultResult && (
                <div className="pt-2 border-t border-emerald-800/30 flex gap-3">
                  <button
                    onClick={() => {
                      setEscalatedRole("pharmacist");
                      setPharmacistChat([
                        { sender: "pharmacist", text: "Hello! I am Dr. Roy, your virtual pharmacist. How can I assist you with your health query today?" }
                      ]);
                    }}
                    className="flex-1 bg-white/5 border border-emerald-800/40 hover:bg-white/10 text-white rounded-xl py-3 text-xs font-bold text-center transition-colors"
                  >
                    Talk to Pharmacist
                  </button>
                  <button
                    onClick={() => setEscalatedRole("doctor")}
                    className="flex-1 bg-[#28483B] hover:bg-[#345d4d] text-emerald-300 rounded-xl py-3 text-xs font-bold text-center transition-colors"
                  >
                    Consult a Doctor
                  </button>
                </div>
              )}
            </div>

            {/* Right Side: Response Feed, Escalation Chat, Booking Calendar */}
            <div className="lg:col-span-7 bg-[#14261F] border border-emerald-800/20 rounded-[28px] p-6 min-h-[350px] flex flex-col">
              
              {/* Case 1: Simulated Chat with Pharmacist */}
              {escalatedRole === "pharmacist" && (
                <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">
                  <div className="flex justify-between items-center pb-3 border-b border-emerald-800/30 mb-4">
                    <div>
                      <h4 className="font-bold text-xs text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider"><Activity size={12} /> Pharmacist Desk (Live)</h4>
                      <p className="text-[9px] text-slate-400">Dr. Roy, Pharmacist • Registered MH/MUM/1042</p>
                    </div>
                    <button onClick={() => setEscalatedRole(null)} className="text-slate-400 hover:text-white p-1"><X size={16} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[220px] text-xs">
                    {pharmacistChat.map((msg, i) => (
                      <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${msg.sender === "user" ? "bg-emerald-600 text-white" : "bg-white/5 border border-emerald-850 text-slate-100"}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-800/30 flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask about side effects, dosing instructions..."
                      value={pharmacistInput}
                      onChange={e => setPharmacistInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendPharmacistMessage()}
                      className="flex-1 bg-white/5 border border-emerald-800/40 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                    <button
                      onClick={sendPharmacistMessage}
                      className="bg-emerald-400 hover:bg-emerald-300 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}

              {/* Case 2: Simulated Doctor Consultation Booking */}
              {escalatedRole === "doctor" && (
                <div className="flex-1 flex flex-col justify-between h-full animate-in fade-in duration-300">
                  <div>
                    <div className="flex justify-between items-center pb-3 border-b border-emerald-800/30 mb-4">
                      <div>
                        <h4 className="font-bold text-xs text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider"><Stethoscope size={12} /> Book Doctor Consultation</h4>
                        <p className="text-[9px] text-slate-400">Instantly schedule a 1-on-1 virtual medical consult</p>
                      </div>
                      <button onClick={() => setEscalatedRole(null)} className="text-slate-400 hover:text-white p-1"><X size={16} /></button>
                    </div>
                    {escalationMessage ? (
                      <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-2xl p-6 text-center space-y-3">
                        <CheckCircle size={32} className="text-emerald-300 mx-auto" />
                        <p className="text-sm font-bold text-white">{escalationMessage}</p>
                        <p className="text-xs text-slate-400">Our medical coordinator will send a join link to your email address before your appointment time.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 border border-emerald-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/10 transition-colors">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Today</p>
                            <p className="text-sm font-bold text-white">4:30 PM</p>
                          </div>
                          <div className="bg-white/5 border border-emerald-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/10 transition-colors">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Today</p>
                            <p className="text-sm font-bold text-white">6:00 PM</p>
                          </div>
                          <div className="bg-white/5 border border-emerald-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/10 transition-colors">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Tomorrow</p>
                            <p className="text-sm font-bold text-white">10:30 AM</p>
                          </div>
                          <div className="bg-white/5 border border-emerald-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/10 transition-colors">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Tomorrow</p>
                            <p className="text-sm font-bold text-white">2:00 PM</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {!escalationMessage && (
                    <button
                      onClick={() => setEscalationMessage("Appointment Confirmed! Teleconsultation booked for Today at 4:30 PM.")}
                      className="w-full bg-emerald-400 hover:bg-emerald-300 text-black py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Book Teleconsultation
                    </button>
                  )}
                </div>
              )}

              {/* Case 3: Display normal AI Result */}
              {!escalatedRole && (
                <div className="flex-1 flex flex-col justify-between">
                  {aiConsultResult ? (
                    <div className="space-y-4">
                      
                      {/* Sub-case 3a: RED FLAG detected */}
                      {aiConsultResult.status === "RED_FLAG" && (
                        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-5 space-y-3 animate-in fade-in duration-500">
                          <h3 className="text-xs font-black text-rose-400 flex items-center gap-1.5 uppercase tracking-widest">
                            🚨 Emergency Alert: Red Flags Found
                          </h3>
                          <p className="text-rose-100 text-xs font-semibold leading-relaxed">
                            {aiConsultResult.message}
                          </p>
                          <div className="bg-black/20 p-4 rounded-xl text-[11px] text-rose-200 leading-relaxed italic">
                            {aiConsultResult.advice}
                          </div>
                          <div className="bg-rose-900/40 border border-rose-700/50 p-3 rounded-xl text-xs text-white font-bold">
                            👉 {aiConsultResult.urgentAction}
                          </div>
                        </div>
                      )}

                      {/* Sub-case 3b: NEEDS SAFETY DETAILS */}
                      {aiConsultResult.status === "NEEDS_SAFETY_INFO" && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3 animate-in fade-in">
                          <ShieldCheck size={40} className="text-emerald-400 opacity-60" />
                          <p className="text-sm font-bold text-white">{aiConsultResult.message}</p>
                          <p className="text-xs text-slate-400 max-w-sm">Please answer the safety questions in the left panel to receive matched medicine options.</p>
                        </div>
                      )}

                      {/* Sub-case 3c: NO MATCH */}
                      {aiConsultResult.status === "NO_MATCH" && (
                        <div className="space-y-3 animate-in fade-in">
                          <div className="bg-white/5 border border-emerald-800/30 rounded-xl p-4 text-xs text-slate-300">
                            {aiConsultResult.message}
                          </div>
                          <p className="text-xs text-slate-400">{aiConsultResult.advice}</p>
                        </div>
                      )}

                      {/* Sub-case 3d: OK - MATCH SUCCESS */}
                      {aiConsultResult.status === "OK" && (
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar animate-in fade-in duration-500">
                          
                          {/* Match Header / Condition Advice */}
                          {aiConsultResult.conditions.map((c: any) => (
                            <div key={c.conditionKey} className="bg-white/5 border border-emerald-800/20 rounded-2xl p-4 space-y-2">
                              <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                                <Check size={12} /> {c.conditionLabel} Matches
                              </h4>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{c.description}</p>
                              <div className="text-[10px] text-slate-400 leading-relaxed"><span className="font-bold text-slate-300">Self-Care:</span> {c.selfCareAdvice}</div>
                              {c.warning && (
                                <div className="text-[9px] text-amber-300/90 leading-relaxed mt-1 font-bold">⚠️ Warning: {c.warning}</div>
                              )}
                            </div>
                          ))}

                          {/* Matching Products */}
                          <div className="space-y-2.5">
                            <h4 className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mt-3">Matched OTC Inventory Products</h4>
                            {aiConsultResult.suggestedProducts.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No matching OTC inventory products are in stock right now.</p>
                            ) : (
                              aiConsultResult.suggestedProducts.map((p: any) => (
                                <div key={p.medicineId} className="bg-[#1C2F27] hover:bg-[#253D33] border border-emerald-800/20 rounded-2xl p-4 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-xs text-white uppercase tracking-tight">{p.name}</span>
                                      <span className="bg-emerald-950 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">OTC</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">{p.generalUse}</p>
                                    
                                    {/* Pharmacy details dropdown/label */}
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <span className="text-[9px] font-black text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded">In Stock</span>
                                      <span className="text-[9px] font-medium text-slate-400">Available at {p.availableIn} stores</span>
                                    </div>

                                    {/* Warnings */}
                                    {p.warnings && p.warnings.map((w: string, idx: number) => (
                                      <p key={idx} className="text-[9px] font-black text-rose-400 mt-1 leading-tight">{w}</p>
                                    ))}
                                  </div>

                                  <div className="flex flex-row sm:flex-col items-end gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                                    <div className="text-right">
                                      <p className="text-[9px] font-bold text-slate-400">Starting From</p>
                                      <p className="text-sm font-black text-emerald-300">₹{p.startingPrice.toFixed(2)}</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        // Update state with medicine selection to load live local map details
                                        const mockMed = { id: p.medicineId, name: p.name, description: p.generalUse, category: p.category };
                                        setSelectedMedicine(mockMed);
                                        fetchInventory(p.medicineId);
                                        document.getElementById("nearby")?.scrollIntoView({ behavior: "smooth" });
                                      }}
                                      className="bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-black px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex items-center gap-0.5"
                                    >
                                      Map & Route <ArrowRight size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Safe Usage Disclaimer */}
                          <div className="text-[9px] text-slate-400 bg-black/10 rounded-xl p-3 border border-emerald-900/30 leading-relaxed">
                            {aiConsultResult.disclaimer}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-white/5 rounded-3xl bg-white/5 my-auto">
                      <Brain size={40} className="text-emerald-300/30 mb-3" />
                      <p className="text-emerald-100/60 text-xs font-semibold">Enter your symptoms on the left to receive safe, inventory-matched health guidance.</p>
                    </div>
                  )}

                  {/* Warning footer */}
                  {aiConsultResult && (
                    <div className="pt-3 border-t border-emerald-800/30 text-[9px] text-slate-450 italic leading-snug flex items-center gap-1">
                      <span>⚠️ {aiConsultResult.advice}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* ── NEARBY PHARMACIES MAP & ROUTING ── */}
        <div id="nearby" className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Live Local Map</h3>
                <p className="text-slate-500 text-sm">Nearby pharmacies stocking {selectedMedicine?.name || "your medicine"}</p>
              </div>
            </div>

            <div className="h-[420px] rounded-[32px] overflow-hidden shadow-md border border-slate-100 relative">
              <LeafletMap 
                lat={userLocation?.lat || 19.0760} 
                lng={userLocation?.lng || 72.8777} 
                zoom={13} 
                title="Your Location"
                focusLocation={mapFocus}
                pharmacies={nearbyPharmacies}
                onSelectPharmacy={(p) => setMapFocus({ lat: p.lat, lng: p.lng })}
                userLocation={userLocation}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 sticky top-0 bg-[#F6FAF7] py-2 z-10"><MapIcon size={18} className="text-[#1E3A2F]" /> Nearby Stores</h3>
            {nearbyPharmacies.map((p, i) => (
              <div key={`${p.name}-${i}`} 
                onClick={() => setMapFocus({ lat: p.lat, lng: p.lng })}
                className={`bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5 ${p.badge ? "border-emerald-200" : "border-slate-100"}`}>
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E8F3ED] flex items-center justify-center text-[#1E3A2F] shrink-0 font-black text-xl group-hover:bg-[#1E3A2F] group-hover:text-white transition-colors">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{p.name}</h4>
                      {p.badge && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${p.badge === "Closed" ? "text-rose-600 bg-rose-50" : "text-[#1E3A2F] bg-[#E8F3ED]"}`}>{p.badge}</span>
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
                    <div className="mb-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${(p as any).isAvailable === false ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-700"}`}>
                        {(p as any).open || "Open now"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black">
                      <span className="flex items-center gap-1 text-[#1E3A2F] bg-[#E8F3ED] px-2 py-1 rounded-lg">
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
                    {selectedMedicine?.name || "Medicine"}: <span className="text-[#1E3A2F]">₹{p.price.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      document.getElementById("nearby")?.scrollIntoView({ behavior: "smooth" });
                      setMapFocus({ lat: p.lat, lng: p.lng });
                    }}
                    className="text-[#1E3A2F] group-hover:text-black text-[11px] font-black flex items-center gap-0.5"
                  >
                    Route <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── CART SIDEBAR ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><ShoppingCart size={18} className="text-[#1E3A2F]" /> Your Cart ({cart.length})</h2>
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
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm"><Pill size={18} className="text-[#1E3A2F]" /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{item.medicine?.name}</h4>
                    <p className="text-[11px] text-slate-400">{item.inventory.pharmacy?.name}</p>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs font-bold text-[#1E3A2F]">₹{item.inventory.price.toFixed(2)} × {item.quantity}</span>
                      <span className="text-xs font-black">₹{(item.inventory.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-100 space-y-4">
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

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Delivery Address</p>
                    <button onClick={() => setShowAddressModal(true)} className="text-[10px] text-[#1E3A2F] font-bold hover:underline">+ Add New</button>
                  </div>
                  {userAddresses.length === 0 ? (
                    <div className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">No addresses saved. Please add one to continue.</div>
                  ) : (
                    <select 
                      value={selectedAddressId} 
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A2F] font-medium"
                    >
                      {userAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>{addr.label}: {addr.address}</option>
                      ))}
                    </select>
                  )}
                </div>

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
                      className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border-2 ${paymentMethod === "ONLINE" ? "border-[#1E3A2F] bg-[#E8F3ED] text-[#1E3A2F]" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                    >
                      Online Payment
                    </button>
                  </div>
                </div>

                <div className="text-sm space-y-1.5 pt-2 border-t border-slate-50">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{cartSubtotal.toFixed(2)}</span></div>
                  {cartDiscount > 0 && <div className="flex justify-between text-emerald-700 font-medium"><span>Bulk discount (10%)</span><span>-₹{cartDiscount.toFixed(2)}</span></div>}
                  {isEmergencyMode && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span className="flex items-center gap-1"><Navigation size={13} /> Emergency Delivery Fee</span>
                      <span>+₹{emergencyFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-base border-t pt-2">
                    <span>Total</span>
                    <span className={isEmergencyMode ? "text-rose-600" : "text-[#1E3A2F]"}>₹{cartFinalWithEmergency.toFixed(2)}</span>
                  </div>
                </div>
                {!user && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl text-center">Please <button onClick={() => { setIsCartOpen(false); setShowLogin(true); }} className="underline font-bold">sign in</button> to checkout</p>}
                <button onClick={user ? handlePlaceOrder : () => { setIsCartOpen(false); setShowLogin(true); }} disabled={isOrdering}
                  className={`w-full ${isEmergencyMode ? "bg-rose-500 hover:bg-rose-600" : "bg-[#1E3A2F] hover:bg-[#152a22]"} text-white py-3.5 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shadow-lg`}>
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
            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <CheckCircle size={48} />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-slate-900 mb-4">Order Confirmed!</h1>
            <p className="text-slate-500 mb-10 text-base">
              Your order has been placed successfully. You can track delivery progress in real time.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => {
                  setIsTrackingMode(true);
                  setShowOrderSuccess(false);
                }}
                className="w-full bg-[#1E3A2F] text-white py-4 rounded-full font-black text-sm uppercase tracking-wider shadow-xl hover:scale-[1.02] transition-transform"
              >
                Track Your Package
              </button>
              <button 
                onClick={() => {
                  if (user?.role === "shop_owner") window.location.href = "/dashboard/shop";
                  else window.location.href = "/dashboard/user";
                }}
                className="w-full bg-white text-slate-900 py-4 rounded-full font-black text-sm uppercase tracking-wider border border-slate-200 hover:bg-slate-50 transition-colors"
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
            <div className={`p-8 text-center text-white relative ${trackingOrder.isEmergency ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-[#1E3A2F]"}`}>
              <button onClick={() => setIsTrackingMode(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors"><X size={18} /></button>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                {trackingOrder.isEmergency ? <Activity size={32} className="text-rose-500 animate-pulse" /> : <CheckCircle size={32} className="text-[#1E3A2F]" />}
              </div>
              <h2 className="text-2xl font-black mb-1">{trackingOrder.isEmergency ? "Emergency Dispatch!" : "Order Confirmed!"}</h2>
              <div className="flex flex-col items-center gap-1">
                <p className="text-white/80 text-sm">Tracking: <code className="bg-white/20 px-2 py-0.5 rounded font-mono">{trackingOrder.trackingNumber}</code></p>
                {trackingOrder.isEmergency && <span className="text-[10px] font-black bg-white text-rose-600 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm mt-1">Priority Delivery Activated</span>}
              </div>
            </div>
            <div className="p-8">
              <div className="mb-12 relative px-4">
                <div className="absolute top-4 left-4 right-4 h-1 bg-slate-100 rounded-full"></div>
                <div 
                  className={`absolute top-4 left-4 h-1 rounded-full transition-all duration-1000 ${trackingOrder.isEmergency ? "bg-rose-500" : "bg-[#1E3A2F]"}`}
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
                        <div className={`w-3 h-3 rounded-full border-4 border-white shadow-sm transition-colors duration-500 ${active ? (trackingOrder.isEmergency ? "bg-rose-500" : "bg-[#1E3A2F]") : "bg-slate-300"}`}></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Clock size={16} className="text-[#1E3A2F]" /> Delivery Progress
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm transition-all duration-500 ${completed ? (trackingOrder.isEmergency ? "bg-rose-500 text-white" : "bg-[#1E3A2F] text-white") : "bg-slate-100 text-slate-400"}`}>
                            {completed ? <CheckCircle size={14} /> : <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-black transition-colors ${completed ? "text-slate-900" : "text-slate-400"}`}>{s.label}</p>
                            <p className={`text-[11px] leading-relaxed transition-colors ${completed ? "text-slate-500" : "text-slate-300"}`}>{s.desc}</p>
                          </div>
                          {active && !completed && <div className="absolute h-full w-0.5 left-[13px] bg-[#1E3A2F] animate-pulse"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="h-64 rounded-3xl overflow-hidden border border-slate-100 shadow-xl mb-6 relative">
                    <LeafletMap lat={19.076} lng={72.8777} title="Delivery Agent" zoom={14} />
                  </div>
                  <div className="bg-[#1E3A2F] rounded-3xl p-6 text-white shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Estimated Delivery</p>
                      <p className="text-xl font-black text-emerald-300">12:45 PM</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white"><Activity size={20} /></div>
                      <div>
                        <p className="font-bold text-sm">Rider Assigned</p>
                        <p className="text-[10px] text-slate-300">Rating: 4.8 ★</p>
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
      <footer className="bg-[#1E3A2F] text-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl font-serif font-bold tracking-tighter">medifind</span>
          </div>
          <p className="text-slate-300 text-sm max-w-md mx-auto mb-6">
            Connecting you to genuine medicines, local pharmacies, and instant delivery.
          </p>
          <div className="flex justify-center gap-8 text-xs font-bold text-emerald-200/80">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Pharmacy Partners</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>

      {/* ── ADDRESS MODAL ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddressModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><MapPin className="text-[#1E3A2F]" /> New Delivery Address</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Label</label>
                <div className="flex gap-2">
                  {["Home", "Work", "Other"].map(l => (
                    <button key={l} onClick={() => setNewAddress(p => ({ ...p, label: l }))} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${newAddress.label === l ? "bg-[#E8F3ED] border-[#1E3A2F] text-[#1E3A2F]" : "bg-slate-50 border-slate-100 text-slate-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Full Address</label>
                <textarea 
                  value={newAddress.address} 
                  onChange={e => setNewAddress(p => ({ ...p, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] min-h-[100px] resize-none text-slate-900"
                  placeholder="Street, Landmark, Apartment, City..."
                />
              </div>
              <button 
                onClick={handleAddAddress}
                className="w-full bg-[#1E3A2F] text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:bg-[#152a22]"
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
