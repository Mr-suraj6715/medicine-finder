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
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  CONFIRMED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  RIDER_ASSIGNED: "bg-sky-100 text-sky-700 border-sky-200",
  RIDER_AT_PHARMACY: "bg-cyan-100 text-cyan-700 border-cyan-200",
  RIDER_PICKED_UP: "bg-teal-100 text-teal-700 border-teal-200",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700 border-purple-200",
  REACHED_CUSTOMER: "bg-pink-100 text-pink-700 border-pink-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
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
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      <MapContainer center={[centerLat, centerLng]} zoom={14} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        <Marker position={[pharmacy.lat, pharmacy.lng]} icon={shopIcon}><Popup>Pharmacy</Popup></Marker>
        <Marker position={[customer.lat, customer.lng]} icon={customerIcon}><Popup>Customer</Popup></Marker>
        {rider && <Marker position={[rider.lat, rider.lng]} icon={riderIcon}><Popup>Rider (You)</Popup></Marker>}
        <Polyline 
          positions={[[pharmacy.lat, pharmacy.lng], [customer.lat, customer.lng]]}
          pathOptions={{ color: '#0ea5e9', weight: 4, opacity: 0.6, dashArray: '8, 8' }} 
        />
        {rider && (
          <Polyline 
            positions={[[rider.lat, rider.lng], [customer.lat, customer.lng]]}
            pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.8 }} 
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
        setProfileForm({
          name: data.riderStats.name || "",
          phone: data.riderStats.phone || "",
          address: data.riderStats.address || "",
          vehicleType: data.riderStats.vehicleType || "Motorcycle",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("medifind_user_rider") || localStorage.getItem("medifind_user");
    if (!stored) { window.location.href = "/"; return; }
    try {
      const u = JSON.parse(stored);
      if (u.role !== "rider") {
        if (u.role === "shop_owner") window.location.href = "/dashboard/shop";
        else if (u.role === "user") window.location.href = "/dashboard/user";
        else window.location.href = "/";
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
    } catch { window.location.href = "/"; }
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

    // Client-side Validation
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
        
        // Update user state and local storage
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col z-20">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-gradient-to-tr from-sky-500 to-green-500 p-2 rounded-xl text-white shadow-lg shadow-sky-100">
              <HeartPulse size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-green-600 tracking-tight">MediFind</span>
          </div>

          <nav className="space-y-1">
            {[
              { id: "active", label: "Active Delivery", icon: Play },
              { id: "available", label: "Available Tasks", icon: List },
              { id: "history", label: "History", icon: Package },
              { id: "earnings", label: "Earnings", icon: DollarSign },
              { id: "profile", label: "Edit Profile", icon: UserCheck },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  tab === item.id ? "bg-sky-500 text-white shadow-lg shadow-sky-100" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 p-2 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer" onClick={() => setTab("profile")}>
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-sky-600 font-black">
              {user?.name?.[0] || "R"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Rider</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {tab === "active" && "Current Delivery"}
              {tab === "available" && "Available Deliveries"}
              {tab === "history" && "Delivery History"}
              {tab === "earnings" && "Your Earnings"}
              {tab === "profile" && "Rider Profile Settings 🚴"}
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {tab === "profile" ? "Manage your rider profile information and vehicle details." : "Manage your pharmacy medicine deliveries in real-time."}
            </p>
          </div>
          {tab === "earnings" && (
            <div className="bg-sky-500 text-white px-6 py-3 rounded-2xl shadow-xl shadow-sky-100 flex items-center gap-3">
              <DollarSign size={24} />
              <div>
                <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">Total Earnings</p>
                <p className="text-2xl font-black">₹{totalEarnings.toFixed(2)}</p>
              </div>
            </div>
          )}
        </header>

        {/* Rider Performance Stats */}
        {riderStats && tab !== "profile" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 pt-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rider Rating</p>
                <div className="bg-amber-50 text-amber-600 p-1.5 rounded-xl"><Star size={14} fill="currentColor" /></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">{(riderStats.rating || 3).toFixed(1)}</span>
                <StarRating rating={riderStats.rating || 3} />
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loyalty Points</p>
                <div className="bg-purple-50 text-purple-600 p-1.5 rounded-xl"><Award size={14} /></div>
              </div>
              <p className="text-2xl font-black text-slate-900">{riderStats.loyaltyPoints || 0}</p>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                <div className="bg-green-50 text-green-600 p-1.5 rounded-xl"><CheckCircle size={14} /></div>
              </div>
              <p className="text-2xl font-black text-slate-900">{riderStats.completedDeliveries || 0}</p>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
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
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-2xl mt-4">
            {profileMsg && (
              <div className={`p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-3 ${profileMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                {profileMsg.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Email Address (Read only)</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 font-medium text-slate-400 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Residential Address / Base Location</label>
                <div className="relative">
                  <Home size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Enter your city/address"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Vehicle Type</label>
                <div className="relative">
                  <Truck size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <select
                    value={profileForm.vehicleType}
                    onChange={(e) => setProfileForm({ ...profileForm, vehicleType: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 text-sm bg-white"
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
                  className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-sky-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
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
            <Activity className="text-sky-500 animate-spin" size={40} />
          </div>
        ) : tab !== "profile" && (
          <div className="space-y-6">
            {tab === "active" && activeOrders.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <Navigation size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No active delivery</h3>
                <p className="text-slate-400 text-sm">Pick up an order from the available tasks.</p>
                <button onClick={() => setTab("available")} className="mt-6 bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-sky-100 transition-all active:scale-95">View Available Tasks</button>
              </div>
            )}

            {tab === "available" && availableOrders.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <List size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No available orders</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">Orders will appear here once the pharmacy accepts them. Check back in a few moments or refresh.</p>
              </div>
            )}

            {(tab === "active" ? activeOrders : tab === "available" ? availableOrders : historyOrders).map((order) => (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${order.isEmergency ? "bg-rose-500 shadow-rose-100" : "bg-sky-500 shadow-sky-100"}`}>
                        <Navigation size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900">Order #{order.id.slice(-6)}</h4>
                          {order.isEmergency && <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100">EMERGENCY</span>}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Customer: {order.customer}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-black px-3 py-1 rounded-full border mb-1 inline-block ${STATUS_COLORS[order.status]}`}>
                        {order.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold block uppercase tracking-tighter">{order.time}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <MapPin size={18} className="text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pick up from</p>
                          <p className="text-sm font-bold text-slate-800">{order.pharmacyName || "Local Pharmacy"}</p>
                          <p className="text-xs text-slate-500 font-medium">{order.pharmacyAddress || "Mumbai, MH"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <Navigation size={18} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Deliver to</p>
                          <p className="text-sm font-bold text-slate-800">{order.customer}</p>
                          <p className="text-xs text-slate-500 font-medium">{order.customerAddress || "Mumbai, MH"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <ShoppingCart size={18} className="text-sky-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Order Details</p>
                          <div className="space-y-1 mt-1">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-slate-600 font-medium">{item.name} × {item.qty}</span>
                                <span className="text-slate-400">₹{(item.price || 0).toFixed(0)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between border-t border-slate-50 pt-1 mt-1 font-black text-slate-900">
                              <span>Order Value</span>
                              <span className="text-sky-600">₹{order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Delivery Progress</p>
                          <div className="flex justify-between items-center mt-1">
                            <div>
                               <p className="text-sm font-bold text-slate-800">Distance: {order.deliveryDistance?.toFixed(1) || "1.0"} km</p>
                               <p className="text-[10px] text-slate-400 font-medium">Goal: Under {((order.deliveryDistance || 1.0) * 10).toFixed(0)} min for 5⭐</p>
                            </div>
                            {order.deliveryStartTime && (
                              <div className="text-right">
                                <p className="text-xs font-black text-sky-600 animate-pulse">
                                  Timer Started
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {Math.round((new Date().getTime() - new Date(order.deliveryStartTime).getTime()) / 60000)} min elapsed
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {tab === "active" && (
                      <div className="h-[280px] lg:h-auto min-h-[280px] relative">
                         <DeliveryMap 
                           pharmacy={order.pharmacyCoord} 
                           customer={order.customerCoord} 
                           rider={riderLocation} 
                         />
                      </div>
                    )}
                  </div>

                  {tab === "available" && (
                    <button 
                      onClick={() => acceptOrder(order.realId || order.id)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                    >
                      Accept Delivery - ₹{order.isEmergency ? order.surgeFee : 0} Earnings
                    </button>
                  )}

                  {tab === "active" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      {order.status === "RIDER_ASSIGNED" && (
                        <button onClick={() => updateStatus(order.realId || order.id, "RIDER_AT_PHARMACY")} className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                          <Navigation size={14} /> Navigate to Pharmacy
                        </button>
                      )}
                      {order.status === "RIDER_AT_PHARMACY" && (
                        <button onClick={() => updateStatus(order.realId || order.id, "RIDER_PICKED_UP")} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                          <Package size={14} /> Pick Up Order
                        </button>
                      )}
                      {order.status === "RIDER_PICKED_UP" && (
                        <button onClick={() => updateStatus(order.realId || order.id, "OUT_FOR_DELIVERY")} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                          <Navigation size={14} /> Out for Delivery
                        </button>
                      )}
                      {order.status === "OUT_FOR_DELIVERY" && (
                        <button onClick={() => updateStatus(order.realId || order.id, "REACHED_CUSTOMER")} className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                          <MapPin size={14} /> Reached Customer Location
                        </button>
                      )}
                      {order.status === "REACHED_CUSTOMER" && (
                        <div className="sm:col-span-2 p-3 bg-green-50 text-green-700 rounded-xl text-center font-bold text-xs border border-green-100 border-dashed">
                          Reached destination. Waiting for customer confirmation or shop delivery completion.
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "active" && order.status !== "DELIVERED" && order.status !== "CANCELLED" && order.status !== "FAILED" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                      <button 
                         onClick={() => { if(window.confirm("Cancel this delivery assignment? The order will be returned to the available pool for reassignment.")) updateStatus(order.realId || order.id, "CANCELLED"); }}
                         className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Cancel Delivery
                      </button>
                      <button 
                         onClick={() => { if(window.confirm("Mark as failed? This will affect your performance stats.")) updateStatus(order.realId || order.id, "FAILED"); }}
                         className="text-[10px] font-bold text-slate-400 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Mark as Failed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {tab === "earnings" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Emergency Orders</p>
                  <p className="text-3xl font-black text-slate-900">{emergencyDeliveries.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Normal Orders</p>
                  <p className="text-3xl font-black text-slate-900">{historyOrders.length - emergencyDeliveries.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Avg. per Emergency</p>
                  <p className="text-3xl font-black text-slate-900">₹{emergencyDeliveries.length ? (totalEarnings / emergencyDeliveries.length).toFixed(0) : 0}</p>
                </div>
                
                <div className="md:col-span-3 overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
                  <table className="w-full text-left bg-white">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <tr>
                        <th className="px-6 py-4">Order Details</th>
                        <th className="px-6 py-4">Distance</th>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">Rating</th>
                        <th className="px-6 py-4">Loyalty</th>
                        <th className="px-6 py-4">Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-bold text-slate-700">
                      {historyOrders.map(o => (
                        <tr key={o.id} className="border-t border-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-black truncate">#{o.id.slice(-6)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{o.time}</p>
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-600">{o.deliveryDistance?.toFixed(1) || "1.0"} km</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-500">{o.deliveryDuration || "--"} min</td>
                          <td className="px-6 py-4">
                            {o.ratingEarned ? (
                              <div className="flex items-center gap-1">
                                <span className="text-amber-500">{o.ratingEarned}</span>
                                <StarRating rating={o.ratingEarned} />
                              </div>
                            ) : (
                              <span className="text-slate-300">--</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {o.pointsChange !== undefined ? (
                              <span className={o.pointsChange >= 0 ? "text-green-600" : "text-rose-500"}>
                                {o.pointsChange >= 0 ? `+${o.pointsChange}` : o.pointsChange}
                              </span>
                            ) : "--"}
                          </td>
                          <td className="px-6 py-4 text-green-600">₹{o.isEmergency ? o.surgeFee : "0.00"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
