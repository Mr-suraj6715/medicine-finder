"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, ShoppingCart, Package, MapPin, Star, Pill, LogOut,
  User, Clock, CheckCircle, TrendingUp, Gift, ChevronRight, Search,
  Activity, History, Navigation, X, Menu, Trash2, Eye, Phone, Store, Award, Sparkles
} from "lucide-react";

type AuthUser = { id: string; email: string; name: string; role: string; loyaltyPoints: number };

import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-800 border-blue-200",
  CONFIRMED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  RIDER_ASSIGNED: "bg-sky-50 text-sky-800 border-sky-200",
  RIDER_AT_PHARMACY: "bg-teal-50 text-teal-800 border-teal-200",
  OUT_FOR_DELIVERY: "bg-purple-50 text-purple-800 border-purple-200",
  DELIVERED: "bg-[#E8F3ED] text-[#1E3A2F] border-[#CDE3D5]",
};

function LeafletMap({ lat, lng, title, zoom }: { lat: number; lng: number; title: string; zoom: number }) {
  const [icon, setIcon] = useState<any>(null);
  useEffect(() => {
    import("leaflet").then(L => {
      setIcon(L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41], iconAnchor: [12, 41],
      }));
    });
  }, []);
  if (!icon) return <div className="w-full h-full bg-[#EBF4EE] animate-pulse rounded-2xl" />;
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden">
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={icon}><Popup>{title}</Popup></Marker>
      </MapContainer>
    </div>
  );
}

// ── Order Details Modal ────────────────────────────────────────────
function OrderDetailsModal({ order, onClose }: { order: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto border border-slate-100">
        {/* Header */}
        <div className={`p-6 text-white relative ${order.isEmergency ? "bg-rose-600" : "bg-[#1E3A2F]"}`}>
          <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Order Details</p>
              <h2 className="text-xl font-black">{order.trackingNumber || order.id?.slice(-8)}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full bg-white/20 uppercase tracking-wide`}>
              {order.status?.replace(/_/g, " ")}
            </span>
            {order.isEmergency && <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white text-rose-600 animate-pulse uppercase">EMERGENCY</span>}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Medicines */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Medicines Ordered</h3>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 bg-[#F6FAF7] border border-[#E2EFE7] rounded-2xl p-3">
                  <div className="w-10 h-10 bg-[#E8F3ED] rounded-xl flex items-center justify-center shrink-0 text-[#1E3A2F]">
                    <Pill size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{item.inventory?.medicine?.name || item.name || "Medicine"}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Store size={10} /> {item.inventory?.pharmacy?.name || order.pharmacy?.name || "Neighborhood Pharmacy"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-800">×{item.quantity || item.qty || 1}</p>
                    <p className="text-[11px] font-bold text-[#1E3A2F]">₹{((item.priceAtTime ?? item.price ?? 0) * (item.quantity || item.qty || 1)).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-[#F2F8F4] border border-[#E2EFE7] rounded-2xl p-4">
            <h3 className="text-xs font-black text-[#1E3A2F] uppercase tracking-widest mb-3">Price Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>₹{((order.totalAmount || 0) - (order.surgeFee || 0) + (order.discountApplied || 0)).toFixed(2)}</span>
              </div>
              {(order.discountApplied || 0) > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span className="flex items-center gap-1"><Gift size={12} /> Bulk Discount</span>
                  <span>-₹{(order.discountApplied || 0).toFixed(2)}</span>
                </div>
              )}
              {order.isEmergency && (order.surgeFee || 0) > 0 && (
                <div className="flex justify-between text-rose-500 font-medium">
                  <span>Emergency Surge Fee</span>
                  <span>+₹{(order.surgeFee || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base border-t border-[#D5E6DC] pt-2 mt-1">
                <span>Total Paid</span>
                <span className="text-[#1E3A2F]">₹{(order.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Delivery Info</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 bg-[#F6FAF7] border border-[#E2EFE7] rounded-xl p-3">
                <MapPin size={16} className="text-[#1E3A2F] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Delivery Address</p>
                  <p className="text-[11px] text-slate-500">{order.deliveryAddress || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[#F6FAF7] border border-[#E2EFE7] rounded-xl p-3">
                <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Order Date</p>
                  <p className="text-[11px] text-slate-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[#F6FAF7] border border-[#E2EFE7] rounded-xl p-3">
                <Package size={16} className="text-[#1E3A2F] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Payment Method</p>
                  <p className="text-[11px] text-slate-500">{order.paymentMethod === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "Online Payment"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Rider Info */}
          {order.rider && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Delivery Partner</h3>
              <div className="flex items-center gap-3 bg-[#1E3A2F] text-white rounded-2xl p-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white text-xl font-black shrink-0">
                  {order.rider.name?.[0]?.toUpperCase() || "R"}
                </div>
                <div className="flex-1">
                  <p className="font-black">{order.rider.name}</p>
                  <p className="text-[11px] text-emerald-200">{order.rider.email}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-amber-400">{(order.rider.riderRating || order.rider.rating || 5).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loyalty Points Earned */}
          {(order.loyaltyEarned || 0) > 0 && (
            <div className="bg-[#EBF4EE] border border-[#D5E6DC] rounded-2xl p-4 flex items-center gap-3">
              <Gift size={20} className="text-[#1E3A2F] shrink-0" />
              <div>
                <p className="font-black text-[#1E3A2F] text-sm">+{order.loyaltyEarned} Loyalty Points Earned!</p>
                <p className="text-[11px] text-[#2D4A3E]">Points have been credited to your balance.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-[#F6FAF7] border-t border-[#E2EFE7]">
          <button onClick={onClose} className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<"orders" | "profile" | "health">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "Home", address: "" });
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchAddresses = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/user/address?userId=${uid}`);
      const data = await res.json();
      if (data.addresses) setUserAddresses(data.addresses);
    } catch (err) { console.error(err); }
  }, []);

  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [isTrackingMode, setIsTrackingMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("medifind_user_user");
    const fallback = localStorage.getItem("medifind_user");
    let u: AuthUser | null = null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.role === "user") u = parsed;
      } catch {}
    }
    if (!u && fallback) {
      try {
        const parsed = JSON.parse(fallback);
        if (parsed.role === "user") u = parsed;
      } catch {}
    }

    if (!u) {
      window.location.href = "/";
      return;
    }

    setUser(u);
    setLoyaltyPoints(u.loyaltyPoints || 0);
  }, []);

  const fetchLoyalty = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/loyalty?email=${email}`);
      const data = await res.json();
      if (data.points !== undefined) setLoyaltyPoints(data.points);
      else if (data.loyaltyPoints !== undefined) setLoyaltyPoints(data.loyaltyPoints);
    } catch {}
  }, []);

  const fetchOrders = useCallback(async (email: string, silent = false) => {
    try {
      if (!silent) setLoadingOrders(true);
      const res = await fetch(`/api/orders?email=${email}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {} finally { if (!silent) setLoadingOrders(false); }
  }, []);

  const fetchHealthLogs = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/ai-prescribe?email=${email}`);
      const data = await res.json();
      setHealthLogs(data.healthLogs || data.logs || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders(user.email);
      fetchLoyalty(user.email);
      fetchAddresses(user.id);
      fetchHealthLogs(user.email);
      
      const interval = setInterval(() => {
        fetchOrders(user.email, true);
        fetchLoyalty(user.email);
      }, 5000);
      return () => { if (interval) clearInterval(interval); };
    }
  }, [user, fetchOrders, fetchLoyalty, fetchAddresses, fetchHealthLogs]);

  useEffect(() => {
    if (isTrackingMode && trackingOrder) {
      const updated = orders.find(o => o.id === trackingOrder.id || o.realId === trackingOrder.id);
      if (updated && updated.status !== trackingOrder.status) {
        setTrackingOrder(updated);
      }
    }
  }, [orders, isTrackingMode, trackingOrder]);

  const handleLogout = () => {
    localStorage.removeItem("medifind_user");
    localStorage.removeItem("medifind_role");
    localStorage.removeItem("medifind_active_role");
    localStorage.removeItem("medifind_user_user");
    localStorage.removeItem("medifind_user_shop_owner");
    localStorage.removeItem("medifind_user_rider");
    window.location.href = "/";
  };

  const handleAddAddress = async () => {
    if (!user || !newAddress.address.trim()) return;
    try {
      const res = await fetch("/api/user/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...newAddress }),
      });
      if (res.ok) {
        setNewAddress({ label: "Home", address: "" });
        setShowAddressModal(false);
        fetchAddresses(user.id);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    setDeletingAddressId(id);
    try {
      const res = await fetch(`/api/user/address?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setUserAddresses(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) { console.error(err); }
    finally { setDeletingAddressId(null); }
  };

  const totalSpent = orders.reduce((a, o) => a + (o.totalAmount || 0), 0);
  const deliveredCount = orders.filter(o => o.status === "DELIVERED").length;

  if (!user) return (
    <div className="min-h-screen bg-[#F6FAF7] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-[#1E3A2F] border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6FAF7] font-sans text-slate-900">
      
      {/* Top Nav (Hers Aesthetic) */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-[#E2EFE7] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2">
              <span className="text-3xl font-serif font-bold tracking-tighter text-[#1E3A2F]">medifind</span>
            </a>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-xs font-black uppercase tracking-wider text-[#2D4A3E] bg-[#E8F3ED] px-3 py-1 rounded-full hidden sm:inline">Customer Portal</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#F0F6F2] border border-[#D5E6DC] px-4 py-2 rounded-full text-xs">
              <Award size={15} className="text-[#1E3A2F]" />
              <span className="font-black text-[#1E3A2F]">{loyaltyPoints} Loyalty Pts</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-600 text-xs font-bold px-3 py-2 rounded-full hover:bg-rose-50 transition-colors">
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-serif tracking-tight text-slate-900 mb-2">
            Welcome back, <span className="text-[#1E3A2F] font-sans font-black">{user.name?.split(" ")[0]}</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm">Manage your prescriptions, orders, and delivery addresses.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Package, label: "Total Orders", value: orders.length, color: "text-[#1E3A2F] bg-[#E8F3ED]" },
            { icon: CheckCircle, label: "Delivered", value: deliveredCount, color: "text-emerald-700 bg-emerald-50" },
            { icon: TrendingUp, label: "Total Spent", value: `₹${totalSpent.toFixed(0)}`, color: "text-teal-800 bg-teal-50" },
            { icon: Gift, label: "Loyalty Points", value: loyaltyPoints, color: "text-amber-700 bg-amber-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-[24px] p-6 border border-[#E2EFE7] shadow-sm">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icon size={18} /></div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs Bar */}
        <div className="flex gap-2 bg-[#EBF4EE] p-1.5 rounded-full mb-8 w-fit border border-[#D5E6DC]">
          {[
            { id: "orders", label: "Order History", icon: Package },
            { id: "health", label: "AI Health Logs", icon: Activity },
            { id: "profile", label: "Profile & Addresses", icon: User }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${tab === t.id ? "bg-[#1E3A2F] text-white shadow-md" : "text-slate-600 hover:text-slate-900"}`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-serif font-bold text-slate-900">Your Orders</h2>
              <a href="/" className="flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#152a22] text-white px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-md">
                <Search size={14} /> Order Medicines
              </a>
            </div>
            {loadingOrders ? (
              <div className="text-center py-16 text-slate-400">
                <div className="animate-spin w-8 h-8 border-4 border-[#1E3A2F] border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-xs font-bold uppercase tracking-wider">Loading orders…</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-[32px] border border-[#E2EFE7] p-16 text-center shadow-sm">
                <Package size={44} className="mx-auto mb-4 text-slate-300" />
                <h3 className="font-bold text-slate-700 text-lg mb-2">No orders placed yet</h3>
                <p className="text-sm text-slate-400 mb-6">Compare medicines and get fast doorstep delivery.</p>
                <a href="/" className="inline-flex items-center gap-2 bg-[#1E3A2F] text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-wider">
                  <Search size={14} /> Explore Catalog
                </a>
              </div>
            ) : orders.map(order => (
              <div key={order.id} className="bg-white rounded-[28px] border border-[#E2EFE7] shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <code className="text-xs bg-[#F0F6F2] text-[#1E3A2F] px-2.5 py-1 rounded-full font-mono font-bold">{order.trackingNumber || "—"}</code>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {order.status?.replace(/_/g, " ")}
                      </span>
                      {order.isEmergency && (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                          <Activity size={10} /> EMERGENCY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xl text-[#1E3A2F]">₹{(order.totalAmount || 0).toFixed(2)}</p>
                    {order.isEmergency && <p className="text-[10px] text-rose-500 font-bold">Inc. ₹{order.surgeFee || 0} surge</p>}
                    {(order.discountApplied || 0) > 0 && <p className="text-xs text-emerald-700 font-bold">Saved ₹{(order.discountApplied || 0).toFixed(2)}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 bg-[#F6FAF7] border border-[#E2EFE7] rounded-2xl p-3.5">
                      <div className="w-10 h-10 bg-[#E8F3ED] rounded-xl flex items-center justify-center text-[#1E3A2F] shrink-0"><Pill size={18} /></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 truncate">{item.inventory?.medicine?.name || item.name || "Medicine"}</h4>
                        <p className="text-[11px] text-slate-400 font-medium">{item.inventory?.pharmacy?.name || order.pharmacy?.name || "Local Pharmacy"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-700">×{item.quantity || item.qty || 1}</p>
                        <p className="text-xs font-bold text-[#1E3A2F]">₹{(item.priceAtTime ?? item.price ?? 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={14} className="text-[#1E3A2F]" />
                    {order.status === "DELIVERED" ? (
                      <span>Delivered on <strong>{new Date(order.createdAt).toLocaleDateString()}</strong></span>
                    ) : (
                      <span>Est. delivery: <strong className="text-slate-700">{new Date(order.estimatedDelivery || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center gap-2 bg-[#EBF4EE] hover:bg-[#E2EFE7] text-[#1E3A2F] px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all"
                    >
                      <Eye size={13} /> Details
                    </button>
                    {order.status !== "DELIVERED" && (
                      <button
                        onClick={() => { setTrackingOrder(order); setIsTrackingMode(true); }}
                        className="flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#152a22] text-white px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow"
                      >
                        <Navigation size={13} /> Live Track
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Health Log Tab */}
        {tab === "health" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-serif font-bold text-slate-900">AI Health Consultations</h2>
              <a href="/#ai" className="flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#152a22] text-white px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-md">
                <Sparkles size={14} /> New Consultation
              </a>
            </div>
            {healthLogs.length === 0 ? (
              <div className="bg-white rounded-[32px] border border-[#E2EFE7] p-16 text-center shadow-sm">
                <Activity size={44} className="mx-auto mb-4 text-slate-300" />
                <h3 className="font-bold text-slate-700 text-lg mb-2">No consultations recorded</h3>
                <p className="text-sm text-slate-400 mb-6">Describe your symptoms to get verified medicine suggestions.</p>
                <a href="/#ai" className="inline-flex items-center gap-2 bg-[#1E3A2F] text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-wider">
                  Start Consultation
                </a>
              </div>
            ) : healthLogs.map((log: any) => (
              <div key={log.id} className="bg-white rounded-[28px] border border-[#E2EFE7] shadow-sm p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-[#E8F3ED] rounded-xl flex items-center justify-center text-[#1E3A2F]"><Activity size={15} /></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {log.createdAt ? new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent"}
                  </span>
                </div>
                <div className="bg-[#F6FAF7] rounded-2xl p-4 mb-3 border border-[#E2EFE7]">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Symptoms Described</p>
                  <p className="text-sm text-slate-800 font-medium">{log.symptoms}</p>
                </div>
                {log.prescription && (
                  <div className="bg-[#EBF4EE] rounded-2xl p-4 border border-[#D5E6DC]">
                    <p className="text-[10px] text-[#1E3A2F] font-black uppercase tracking-widest mb-1">Recommended Treatments</p>
                    <p className="text-sm text-[#1E3A2F] font-bold">{log.prescription}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Profile Tab */}
        {tab === "profile" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[32px] border border-[#E2EFE7] shadow-sm p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-[#1E3A2F] rounded-2xl flex items-center justify-center text-white text-2xl font-serif font-black shadow-md">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xl">{user.name}</h3>
                  <p className="text-sm text-slate-500">{user.email}</p>
                  <span className="text-xs bg-[#E8F3ED] text-[#1E3A2F] px-3 py-0.5 rounded-full font-bold mt-1 inline-block">Verified Patient</span>
                </div>
              </div>
              <div className="space-y-3">
                {[{ label: "Email", value: user.email }, { label: "Account Type", value: "Customer" }, { label: "Loyalty Balance", value: `${loyaltyPoints} pts` }].map(f => (
                  <div key={f.label} className="flex justify-between py-2.5 border-b border-slate-100 last:border-0 text-sm">
                    <span className="text-slate-500 font-medium">{f.label}</span>
                    <span className="font-bold text-slate-900">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Addresses Card */}
            <div className="bg-white rounded-[32px] border border-[#E2EFE7] shadow-sm p-8">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Saved Addresses</h4>
                <button onClick={() => setShowAddressModal(true)} className="text-xs text-[#1E3A2F] font-black uppercase tracking-wider hover:underline">+ Add New</button>
              </div>
              {userAddresses.length === 0 ? (
                <p className="text-xs text-slate-400 bg-[#F6FAF7] p-6 rounded-2xl border border-dashed border-[#D5E6DC] text-center">No addresses saved yet.</p>
              ) : (
                <div className="space-y-3">
                  {userAddresses.map(addr => (
                    <div key={addr.id} className="p-4 bg-[#F6FAF7] rounded-2xl border border-[#E2EFE7] flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <MapPin size={16} className="text-[#1E3A2F] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#1E3A2F] uppercase">{addr.label}</p>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{addr.address}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteAddress(addr.id)}
                        disabled={deletingAddressId === addr.id}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── ADDRESS MODAL ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 relative animate-in fade-in duration-200">
            <button onClick={() => setShowAddressModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><MapPin className="text-[#1E3A2F]" /> New Delivery Address</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Label</label>
                <div className="flex gap-2">
                  {["Home", "Work", "Other"].map(l => (
                    <button key={l} onClick={() => setNewAddress(p => ({ ...p, label: l }))} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${newAddress.label === l ? "bg-[#E8F3ED] border-[#1E3A2F] text-[#1E3A2F]" : "bg-slate-50 border-slate-100 text-slate-500"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Full Address</label>
                <textarea 
                  value={newAddress.address} 
                  onChange={e => setNewAddress(p => ({ ...p, address: e.target.value }))}
                  className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] min-h-[100px] resize-none text-slate-900"
                  placeholder="Street, Landmark, Apartment, City..."
                />
              </div>
              <button 
                onClick={handleAddAddress}
                className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md"
              >
                Save Address
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
