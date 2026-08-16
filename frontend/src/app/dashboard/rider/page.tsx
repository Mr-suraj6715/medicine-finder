"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, Package, LogOut, Navigation, CheckCircle, 
  Clock, Activity, MapPin, DollarSign, List, Play, Check, ChevronRight, ShoppingCart, Pill, Globe, X, Star, Award, UserCheck, Edit3, Save, Phone, Home, Truck, AlertCircle
} from "lucide-react";
import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr: false });

type AuthUser = { id: string; email: string; name: string; role: string; phone?: string; address?: string; vehicleType?: string };

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-800 border-blue-200",
  CONFIRMED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  RIDER_ASSIGNED: "bg-sky-50 text-sky-800 border-sky-200",
  RIDER_AT_PHARMACY: "bg-teal-50 text-teal-800 border-teal-200",
  RIDER_PICKED_UP: "bg-teal-50 text-teal-800 border-teal-200",
  OUT_FOR_DELIVERY: "bg-purple-50 text-purple-800 border-purple-200",
  REACHED_CUSTOMER: "bg-pink-50 text-pink-800 border-pink-200",
  DELIVERED: "bg-[#E8F3ED] text-[#1E3A2F] border-[#CDE3D5]",
  CANCELLED: "bg-rose-50 text-rose-800 border-rose-200",
  FAILED: "bg-slate-100 text-slate-700 border-slate-200",
};

function DeliveryMap({ pharmacy, customer, rider }: { pharmacy: any; customer: any; rider: any }) {
  let L: any;
  if (typeof window !== "undefined") L = require("leaflet");

  const shopIcon = typeof window !== "undefined" ? L?.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }) : undefined;

  const customerIcon = typeof window !== "undefined" ? L?.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }) : undefined;

  const riderIcon = typeof window !== "undefined" ? L?.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
    iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
  }) : undefined;

  const centerLat = (pharmacy.lat + customer.lat) / 2;
  const centerLng = (pharmacy.lng + customer.lng) / 2;

  return (
    <div className="w-full h-full rounded-[28px] overflow-hidden shadow-inner border border-[#E2EFE7]">
      <MapContainer center={[centerLat, centerLng]} zoom={14} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        <Marker position={[pharmacy.lat, pharmacy.lng]} icon={shopIcon}><Popup>Pharmacy</Popup></Marker>
        <Marker position={[customer.lat, customer.lng]} icon={customerIcon}><Popup>Customer Destination</Popup></Marker>
        {rider && <Marker position={[rider.lat, rider.lng]} icon={riderIcon}><Popup>Your Location</Popup></Marker>}
        <Polyline 
          positions={[[pharmacy.lat, pharmacy.lng], [customer.lat, customer.lng]]}
          pathOptions={{ color: '#1E3A2F', weight: 4, opacity: 0.7, dashArray: '8, 8' }} 
        />
        {rider && (
          <Polyline 
            positions={[[rider.lat, rider.lng], [customer.lat, customer.lng]]}
            pathOptions={{ color: '#059669', weight: 4, opacity: 0.8 }} 
          />
        )}
      </MapContainer>
    </div>
  );
}

export default function RiderDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<"active" | "available" | "history" | "earnings" | "profile">("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [riderStats, setRiderStats] = useState<{
    rating: number;
    loyaltyPoints: number;
    completedDeliveries: number;
    cancelledDeliveries: number;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    vehicleType?: string;
  } | null>(null);

  const [profileLoaded, setProfileLoaded] = useState(false);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    address: "",
    vehicleType: "Motorcycle",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const StarRating = ({ rating }: { rating: number }) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return (
      <div className="flex items-center gap-0.5 text-amber-500">
        {[...Array(fullStars)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
        {hasHalfStar && <Star size={14} className="opacity-50" fill="currentColor" />}
        {[...Array(Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0)))].map((_, i) => <Star key={i} size={14} className="text-slate-200" />)}
      </div>
    );
  };

  // Update location
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setRiderLocation(loc);
          if (user) {
            fetch("/api/rider/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ riderId: user.id, latitude: loc.lat, longitude: loc.lng })
            });
          }
        },
        (err) => console.log(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user]);

  const fetchRiderData = useCallback(async (userId: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/rider/orders?riderId=${userId}`);
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
      }
      if (data.riderStats) {
        setRiderStats(data.riderStats);
        // Only set profile form once on initial load so typing is not wiped out
        setProfileLoaded(prev => {
          if (!prev) {
            setProfileForm({
              name: data.riderStats.name || "",
              phone: data.riderStats.phone || "",
              address: data.riderStats.address || "",
              vehicleType: data.riderStats.vehicleType || "Motorcycle",
            });
            return true;
          }
          return prev;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("medifind_user_rider");
    const fallback = localStorage.getItem("medifind_user");
    let u: AuthUser | null = null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.role === "rider") u = parsed;
      } catch {}
    }
    if (!u && fallback) {
      try {
        const parsed = JSON.parse(fallback);
        if (parsed.role === "rider") u = parsed;
      } catch {}
    }

    if (!u) {
      window.location.href = "/";
      return;
    }

    setUser(u);
    setProfileForm({
      name: u.name || "",
      phone: u.phone || "",
      address: u.address || "",
      vehicleType: u.vehicleType || "Motorcycle",
    });
    fetchRiderData(u.id);
    
    const interval = setInterval(() => fetchRiderData(u.id, true), 5000);
    return () => clearInterval(interval);
  }, [fetchRiderData]);

  const handleLogout = () => {
    localStorage.removeItem("medifind_user");
    localStorage.removeItem("medifind_role");
    localStorage.removeItem("medifind_active_role");
    localStorage.removeItem("medifind_user_user");
    localStorage.removeItem("medifind_user_shop_owner");
    localStorage.removeItem("medifind_user_rider");
    window.location.href = "/";
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/rider/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, riderId: user?.id }),
      });
      if (res.ok) {
        fetchRiderData(user!.id, true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const acceptOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/rider/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, riderId: user?.id }),
      });
      if (res.ok) {
        setTab("active");
        fetchRiderData(user!.id, true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!profileForm.name || profileForm.name.trim().length < 2) {
      setProfileMsg({ type: "error", text: "Name must be at least 2 characters long." });
      return;
    }

    if (profileForm.phone && profileForm.phone.trim() !== "") {
      const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
      if (!phoneRegex.test(profileForm.phone.trim())) {
        setProfileMsg({ type: "error", text: "Please enter a valid phone number (7-15 digits)." });
        return;
      }
    }

    setProfileSaving(true);
    setProfileMsg(null);

    try {
      const res = await fetch('/api/rider/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: profileForm.name,
          phone: profileForm.phone,
          address: profileForm.address,
          vehicleType: profileForm.vehicleType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProfileMsg({ type: "success", text: "Profile updated successfully!" });
        
        const updatedUser = { ...user, ...data.user };
        setUser(updatedUser);
        localStorage.setItem("medifind_user_rider", JSON.stringify(updatedUser));
        localStorage.setItem("medifind_user", JSON.stringify(updatedUser));

        fetchRiderData(user.id, true);
        setTimeout(() => setProfileMsg(null), 4000);
      } else {
        setProfileMsg({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch (err) {
      console.error(err);
      setProfileMsg({ type: "error", text: "Network error while saving profile." });
    } finally {
      setProfileSaving(false);
    }
  };

  const availableOrders = orders.filter(o => o.status === "CONFIRMED" && !o.riderId);
  const activeOrders = orders.filter(o => o.riderId === user?.id && !["DELIVERED", "CANCELLED", "FAILED"].includes(o.status));
  const historyOrders = orders.filter(o => o.riderId === user?.id && ["DELIVERED", "CANCELLED", "FAILED"].includes(o.status));
  
  const emergencyDeliveries = historyOrders.filter(o => o.isEmergency);
  const totalEarnings = emergencyDeliveries.reduce((sum, o) => sum + (o.surgeFee || 0), 0);

  return (
    <div className="min-h-screen bg-[#F6FAF7] flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar (Hers Aesthetic) */}
      <aside className="w-full md:w-72 bg-white border-r border-[#E2EFE7] flex flex-col z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <a href="/" className="text-3xl font-serif font-bold tracking-tighter text-[#1E3A2F]">medifind</a>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: "active", label: "Active Delivery", icon: Play },
              { id: "available", label: "Available Tasks", icon: List },
              { id: "history", label: "Delivery History", icon: Package },
              { id: "earnings", label: "My Earnings", icon: DollarSign },
              { id: "profile", label: "Rider Profile", icon: UserCheck },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                  tab === item.id ? "bg-[#1E3A2F] text-white shadow-md" : "text-slate-600 hover:bg-[#F6FAF7] hover:text-[#1E3A2F]"
                }`}
              >
                <item.icon size={17} /> {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-[#E2EFE7]">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-[#F6FAF7] border border-[#E2EFE7] cursor-pointer" onClick={() => setTab("profile")}>
            <div className="w-10 h-10 rounded-xl bg-[#E8F3ED] flex items-center justify-center text-[#1E3A2F] font-serif font-black text-lg">
              {user?.name?.[0]?.toUpperCase() || "R"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] font-black text-[#1E3A2F] uppercase tracking-widest">Active Dispatcher</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-serif tracking-tight text-slate-900">
              {tab === "active" && "Active Delivery"}
              {tab === "available" && "Available Tasks"}
              {tab === "history" && "Delivery History"}
              {tab === "earnings" && "My Earnings & Payouts"}
              {tab === "profile" && "Rider Profile 🚴"}
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {tab === "profile" ? "Update your personal details and vehicle configuration." : "Instant medicine pickups and door-to-door delivery tracking."}
            </p>
          </div>
          {tab === "earnings" && (
            <div className="bg-[#1E3A2F] text-white px-7 py-3.5 rounded-full shadow-lg flex items-center gap-3">
              <DollarSign size={22} className="text-emerald-300" />
              <div>
                <p className="text-[10px] font-black uppercase opacity-80 tracking-widest text-emerald-200">Surge Earnings</p>
                <p className="text-xl font-black">₹{totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          )}
        </header>

        {/* Rider Performance Stats */}
        {riderStats && tab !== "profile" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-[24px] border border-[#E2EFE7] shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rider Rating</p>
                <div className="bg-amber-50 text-amber-600 p-1.5 rounded-xl"><Star size={14} fill="currentColor" /></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">{(riderStats.rating || 3).toFixed(1)}</span>
                <StarRating rating={riderStats.rating || 3} />
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-[24px] border border-[#E2EFE7] shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loyalty Points</p>
                <div className="bg-[#E8F3ED] text-[#1E3A2F] p-1.5 rounded-xl"><Award size={14} /></div>
              </div>
              <p className="text-2xl font-black text-slate-900">{riderStats.loyaltyPoints || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-[#E2EFE7] shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded-xl"><CheckCircle size={14} /></div>
              </div>
              <p className="text-2xl font-black text-slate-900">{riderStats.completedDeliveries || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-[#E2EFE7] shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelled</p>
                <div className="bg-rose-50 text-rose-600 p-1.5 rounded-xl"><X size={14} /></div>
              </div>
              <p className="text-2xl font-black text-slate-900">{riderStats.cancelledDeliveries || 0}</p>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <div className="bg-white rounded-[32px] p-8 border border-[#E2EFE7] shadow-sm max-w-2xl">
            {profileMsg && (
              <div className={`p-4 rounded-2xl mb-6 text-xs font-bold flex items-center gap-3 ${profileMsg.type === "success" ? "bg-[#E8F3ED] text-[#1E3A2F] border border-[#CDE3D5]" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                {profileMsg.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F6FAF7] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] font-medium text-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-medium text-slate-400 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F6FAF7] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] font-medium text-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Residential Base / City</label>
                <div className="relative">
                  <Home size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Enter your city/address"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F6FAF7] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] font-medium text-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Vehicle Type</label>
                <div className="relative">
                  <Truck size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <select
                    value={profileForm.vehicleType}
                    onChange={(e) => setProfileForm({ ...profileForm, vehicleType: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F6FAF7] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] font-medium text-slate-800 text-sm"
                  >
                    <option value="Motorcycle">Motorcycle / Scooter</option>
                    <option value="Bicycle">Bicycle</option>
                    <option value="EV Scooter">EV Scooter</option>
                    <option value="Car">Car / Van</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="bg-[#1E3A2F] hover:bg-[#152a22] text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save size={16} />
                  {profileSaving ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && tab !== "profile" ? (
          <div className="flex items-center justify-center h-64">
            <Activity className="text-[#1E3A2F] animate-spin" size={40} />
          </div>
        ) : tab !== "profile" && (
          <div className="space-y-6">
            {tab === "active" && activeOrders.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-[#D5E6DC]">
                <Navigation size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No active deliveries right now</h3>
                <p className="text-slate-400 text-sm mt-1">Accept a pending task from the available orders list.</p>
                <button onClick={() => setTab("available")} className="mt-6 bg-[#1E3A2F] hover:bg-[#152a22] text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95">View Available Orders</button>
              </div>
            )}

            {tab === "available" && availableOrders.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-[#D5E6DC]">
                <List size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No orders awaiting dispatch</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">Orders will appear here once local pharmacies confirm & pack them.</p>
              </div>
            )}

            {(tab === "active" ? activeOrders : tab === "available" ? availableOrders : historyOrders).map((order) => (
              <div key={order.id} className="bg-white rounded-[28px] shadow-sm border border-[#E2EFE7] overflow-hidden p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${order.isEmergency ? "bg-rose-500" : "bg-[#1E3A2F]"}`}>
                      <Navigation size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">Order #{order.id.slice(-6)}</h4>
                        {order.isEmergency && <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full border border-rose-100 uppercase">EMERGENCY</span>}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Customer: {order.customer || "Customer"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-black px-3 py-1 rounded-full border mb-1 inline-block uppercase ${STATUS_COLORS[order.status]}`}>
                      {order.status.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold block uppercase tracking-tighter">{order.time || "Recent"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-[#F6FAF7] p-4 rounded-2xl border border-[#E2EFE7]">
                      <MapPin size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pick up from</p>
                        <p className="text-sm font-bold text-slate-800">{order.pharmacyName || "Local Pharmacy"}</p>
                        <p className="text-xs text-slate-500 font-medium">{order.pharmacyAddress || "Mumbai, MH"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-[#F6FAF7] p-4 rounded-2xl border border-[#E2EFE7]">
                      <Navigation size={18} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Deliver to</p>
                        <p className="text-sm font-bold text-slate-800">{order.customer || "Customer"}</p>
                        <p className="text-xs text-slate-500 font-medium">{order.customerAddress || "Mumbai, MH"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-[#F6FAF7] p-4 rounded-2xl border border-[#E2EFE7]">
                      <ShoppingCart size={18} className="text-[#1E3A2F] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Order Items</p>
                        <div className="space-y-1 mt-1">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-slate-600 font-medium">{item.name} × {item.qty}</span>
                              <span className="text-slate-400">₹{(item.price || 0).toFixed(0)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-black text-slate-900">
                            <span>Order Total</span>
                            <span className="text-[#1E3A2F]">₹{(order.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {tab === "active" && (
                    <div className="h-[280px] lg:h-auto min-h-[280px] relative">
                       <DeliveryMap 
                         pharmacy={order.pharmacyCoord || { lat: 19.0760, lng: 72.8777 }} 
                         customer={order.customerCoord || { lat: 19.0800, lng: 72.8800 }} 
                         rider={riderLocation} 
                       />
                    </div>
                  )}
                </div>

                {tab === "available" && (
                  <button 
                    onClick={() => acceptOrder(order.realId || order.id)}
                    className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-4 rounded-full font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                  >
                    Accept Delivery {order.isEmergency ? `— ₹${order.surgeFee} Surge Earnings` : "— Standard Delivery"}
                  </button>
                )}

                {tab === "active" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {order.status === "RIDER_ASSIGNED" && (
                      <button onClick={() => updateStatus(order.realId || order.id, "RIDER_AT_PHARMACY")} className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                        <Navigation size={14} /> At Pharmacy
                      </button>
                    )}
                    {order.status === "RIDER_AT_PHARMACY" && (
                      <button onClick={() => updateStatus(order.realId || order.id, "RIDER_PICKED_UP")} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                        <Package size={14} /> Order Picked Up
                      </button>
                    )}
                    {order.status === "RIDER_PICKED_UP" && (
                      <button onClick={() => updateStatus(order.realId || order.id, "OUT_FOR_DELIVERY")} className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                        <Navigation size={14} /> Out for Delivery
                      </button>
                    )}
                    {order.status === "OUT_FOR_DELIVERY" && (
                      <button onClick={() => updateStatus(order.realId || order.id, "REACHED_CUSTOMER")} className="w-full bg-pink-600 hover:bg-pink-700 text-white py-3.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                        <MapPin size={14} /> Reached Destination
                      </button>
                    )}
                    {order.status === "REACHED_CUSTOMER" && (
                      <div className="sm:col-span-2 p-4 bg-[#E8F3ED] text-[#1E3A2F] rounded-2xl text-center font-bold text-xs border border-[#CDE3D5]">
                        Rider reached customer location. Awaiting final order verification.
                      </div>
                    )}
                  </div>
                )}

                {tab === "active" && order.status !== "DELIVERED" && order.status !== "CANCELLED" && order.status !== "FAILED" && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                    <button 
                       onClick={() => { if(window.confirm("Cancel this delivery assignment? The order will be released for reassignment.")) updateStatus(order.realId || order.id, "CANCELLED"); }}
                       className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-full transition-all"
                    >
                      Release Order
                    </button>
                    <button 
                       onClick={() => { if(window.confirm("Mark delivery as failed?")) updateStatus(order.realId || order.id, "FAILED"); }}
                       className="text-xs font-bold text-slate-400 hover:bg-slate-50 px-4 py-2 rounded-full transition-all"
                    >
                      Report Issue
                    </button>
                  </div>
                )}
              </div>
            ))}

            {tab === "earnings" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[28px] border border-[#E2EFE7] shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Emergency Orders</p>
                  <p className="text-3xl font-black text-slate-900">{emergencyDeliveries.length}</p>
                </div>
                <div className="bg-white p-6 rounded-[28px] border border-[#E2EFE7] shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Standard Orders</p>
                  <p className="text-3xl font-black text-slate-900">{historyOrders.length - emergencyDeliveries.length}</p>
                </div>
                <div className="bg-white p-6 rounded-[28px] border border-[#E2EFE7] shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Surge Payouts</p>
                  <p className="text-3xl font-black text-[#1E3A2F]">₹{totalEarnings.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
