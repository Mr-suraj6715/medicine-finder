"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, ShoppingCart, Package, MapPin, Star, Pill, LogOut,
  User, Clock, CheckCircle, TrendingUp, Gift, ChevronRight, Search,
  Activity, History, Navigation, X, Menu
} from "lucide-react";

type AuthUser = { id: string; email: string; name: string; role: string; loyaltyPoints: number };

import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  CONFIRMED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  RIDER_ASSIGNED: "bg-sky-100 text-sky-700 border-sky-200",
  RIDER_AT_PHARMACY: "bg-cyan-100 text-cyan-700 border-cyan-200",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700 border-purple-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
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
  if (!icon) return <div className="w-full h-full bg-slate-100 animate-pulse" />;
  return (
    <div className="w-full h-full">
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={icon}><Popup>{title}</Popup></Marker>
      </MapContainer>
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

  const fetchAddresses = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/user/address?userId=${uid}`);
      const data = await res.json();
      if (data.addresses) setUserAddresses(data.addresses);
    } catch (err) { console.error(err); }
  }, []);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [isTrackingMode, setIsTrackingMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("medifind_user_user") || localStorage.getItem("medifind_user");
    if (!stored) { window.location.href = "/"; return; }
    try {
      const u = JSON.parse(stored);
      // Strictly verify role for this dashboard
      if (u.role !== "user") {
        if (u.role === "shop_owner") window.location.href = "/dashboard/shop";
        else if (u.role === "rider") window.location.href = "/dashboard/rider";
        else window.location.href = "/";
        return;
      }

      setUser(u);
      setLoyaltyPoints(u.loyaltyPoints || 0);
    } catch { window.location.href = "/"; }
  }, []);

  const fetchLoyalty = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/loyalty?email=${email}`);
      const data = await res.json();
      if (data.loyaltyPoints !== undefined) setLoyaltyPoints(data.loyaltyPoints);
    } catch {}
  }, []);

  const fetchOrders = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/orders?email=${email}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {} finally { setLoadingOrders(false); }
  }, []);

  const fetchHealthLogs = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/ai-prescribe?email=${email}`);
      const data = await res.json();
      setHealthLogs(data.logs || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders(user.email);
      fetchLoyalty(user.email);
      fetchAddresses(user.id);
      fetchHealthLogs(user.email);
      
      const interval = setInterval(() => {
        fetchOrders(user.email);
        fetchLoyalty(user.email);
      }, 5000); // Poll every 5 seconds
      return () => { if (interval) clearInterval(interval); };
    }
  }, [user, fetchOrders, fetchLoyalty, fetchAddresses, fetchHealthLogs]);

  useEffect(() => {
    if (isTrackingMode && trackingOrder) {
      const updated = orders.find(o => o.id === trackingOrder.id);
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

  const totalSpent = orders.reduce((a, o) => a + o.totalAmount, 0);
  const deliveredCount = orders.filter(o => o.status === "DELIVERED").length;

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-sky-500 to-green-500 p-1.5 rounded-lg text-white"><HeartPulse size={18} /></div>
              <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-green-600">MediFind</span>
            </a>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-semibold text-slate-600">Customer Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-sm">
              <Gift size={14} className="text-amber-500" />
              <span className="font-bold text-amber-700">{loyaltyPoints} pts</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors">
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900">Welcome back, {user.name?.split(" ")[0]}! 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">{user.email}</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Package, label: "Total Orders", value: orders.length, color: "text-sky-500 bg-sky-50" },
            { icon: CheckCircle, label: "Delivered", value: deliveredCount, color: "text-green-500 bg-green-50" },
            { icon: TrendingUp, label: "Total Spent", value: `₹${totalSpent.toFixed(0)}`, color: "text-purple-500 bg-purple-50" },
            { icon: Gift, label: "Loyalty Points", value: loyaltyPoints, color: "text-amber-500 bg-amber-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icon size={18} /></div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 w-fit">
          {[{ id: "orders", label: "Order History", icon: Package }, { id: "health", label: "AI Health Log", icon: Activity }, { id: "profile", label: "My Profile", icon: User }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? "bg-white shadow text-sky-600" : "text-slate-500 hover:text-slate-700"}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-slate-900">Order History</h2>
              <a href="/" className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                <Search size={14} /> Order More
              </a>
            </div>
            {loadingOrders ? (
              <div className="text-center py-12 text-slate-400">
                <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Loading orders…</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
                <Package size={40} className="mx-auto mb-4 text-slate-300" />
                <h3 className="font-bold text-slate-500 mb-2">No orders yet</h3>
                <p className="text-sm text-slate-400 mb-4">Search for medicines to place your first order</p>
                <a href="/" className="inline-flex items-center gap-2 bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                  <Search size={14} /> Search Medicines
                </a>
              </div>
            ) : orders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">{order.trackingNumber || "—"}</code>
                      {order.isEmergency && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                          <Activity size={10} /> EMERGENCY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">₹{order.totalAmount.toFixed(2)}</p>
                    {order.isEmergency && <p className="text-[10px] text-rose-500 font-bold">Inc. ₹{order.surgeFee} surge</p>}
                    {order.discountApplied > 0 && <p className="text-xs text-green-600">Saved ₹{order.discountApplied.toFixed(2)}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0"><Pill size={16} className="text-sky-500" /></div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{item.inventory?.medicine?.name}</h4>
                        <p className="text-[11px] text-slate-400">{item.inventory?.pharmacy?.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-700">×{item.quantity}</p>
                        <p className="text-xs text-slate-500">₹{item.priceAtTime.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={13} className="text-sky-500" />
                    {order.status === "DELIVERED" ? (
                      <span>Delivered on <strong>{new Date(order.createdAt).toLocaleDateString()}</strong></span>
                    ) : (
                      <span>Est. delivery: <strong className="text-slate-700">{new Date(order.estimatedDelivery || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
                    )}
                  </div>
                  {order.status !== "DELIVERED" && (
                    <button 
                      onClick={() => { setTrackingOrder(order); setIsTrackingMode(true); }}
                      className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
                    >
                      <Navigation size={12} /> Track Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Health Log Tab */}
        {tab === "health" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-slate-900">AI Health Consultations</h2>
              <a href="/#ai" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                <Activity size={14} /> New Consultation
              </a>
            </div>
            {healthLogs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
                <Activity size={40} className="mx-auto mb-4 text-slate-300" />
                <h3 className="font-bold text-slate-500 mb-2">No consultations yet</h3>
                <p className="text-sm text-slate-400 mb-4">Use the AI Health Assistant to get medicine suggestions</p>
                <a href="/#ai" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm">Start Consultation</a>
              </div>
            ) : healthLogs.map(log => (
              <div key={log.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center"><Activity size={14} className="text-indigo-500" /></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">Symptoms</p>
                  <p className="text-sm text-slate-800 font-medium">{log.symptoms}</p>
                </div>
                {log.prescription && (
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-green-600 font-bold uppercase tracking-wide mb-1">Recommended Medicines</p>
                    <p className="text-sm text-green-800 font-medium">{log.prescription}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Profile Tab */}
        {tab === "profile" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{user.name}</h3>
                  <p className="text-sm text-slate-500">{user.email}</p>
                  <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full font-bold">Customer</span>
                </div>
              </div>
              <div className="space-y-3">
                {[{ label: "Email", value: user.email }, { label: "Account Type", value: "Customer" }, { label: "Loyalty Points", value: `${loyaltyPoints} pts` }].map(f => (
                  <div key={f.label} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-500 font-medium">{f.label}</span>
                    <span className="text-sm font-bold text-slate-900">{f.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Saved Addresses</h4>
                  <button onClick={() => setShowAddressModal(true)} className="text-xs text-sky-600 font-bold hover:underline">+ Add New</button>
                </div>
                {userAddresses.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">No addresses saved yet.</p>
                ) : (
                  <div className="space-y-3">
                    {userAddresses.map(addr => (
                      <div key={addr.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                        <MapPin size={16} className="text-sky-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-700">{addr.label}</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed truncate">{addr.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Gift size={18} className="text-amber-600" /></div>
                  <div>
                    <h4 className="font-black text-slate-900">Loyalty Rewards</h4>
                    <p className="text-xs text-slate-500">Earn 1 point per ₹100 order</p>
                  </div>
                </div>
                <div className="text-4xl font-black text-amber-600 mb-1">{loyaltyPoints}</div>
                <p className="text-xs text-slate-500">Total points earned</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-3 text-sm">Quick Actions</h4>
                <div className="space-y-2">
                  <a href="/" className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2"><Search size={14} className="text-sky-500" /> Search Medicines</span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </a>
                  <a href="/#nearby" className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2"><MapPin size={14} className="text-green-500" /> Nearby Pharmacies</span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </a>
                  <button onClick={handleLogout} className="flex items-center justify-between p-3 hover:bg-rose-50 rounded-xl transition-colors w-full text-left">
                    <span className="text-sm font-medium text-rose-600 flex items-center gap-2"><LogOut size={14} /> Sign Out</span>
                    <ChevronRight size={14} className="text-rose-200" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ORDER TRACKING MODAL ── */}
      {isTrackingMode && trackingOrder && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden overflow-y-auto max-h-[90vh]">
            <div className={`p-8 text-center text-white relative ${trackingOrder.isEmergency ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-sky-500 to-sky-700"}`}>
              <button onClick={() => setIsTrackingMode(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-full"><X size={18} /></button>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                {trackingOrder.isEmergency ? <Activity size={32} className="text-rose-500 animate-pulse" /> : <CheckCircle size={32} className="text-green-500" />}
              </div>
              <h2 className="text-2xl font-black mb-1">{trackingOrder.isEmergency ? "Emergency Dispatch!" : "Order Confirmed!"}</h2>
              <div className="flex flex-col items-center gap-1">
                <p className="text-white/80 text-sm">Tracking: <code className="bg-white/20 px-2 py-0.5 rounded font-mono">{trackingOrder.id}</code></p>
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
                      { id: "PROCESSING", label: "Packing Medicines", desc: "The pharmacy is preparing your package." },
                      { id: "CONFIRMED", label: "Ready for Pickup", desc: "Order is packed and waiting for a delivery partner." },
                      { id: "RIDER_ASSIGNED", label: "Rider Accepted", desc: "A delivery partner has accepted your request." },
                      { id: "RIDER_AT_PHARMACY", label: "Heading to Store", desc: "The rider is on the way to the pharmacy." },
                      { id: "RIDER_PICKED_UP", label: "Order Picked Up", desc: "Rider has picked up your medicines." },
                      { id: "OUT_FOR_DELIVERY", label: "On the Way", desc: "Your medicines are on the way to your location." },
                      { id: "REACHED_CUSTOMER", label: "Reached Destination", desc: "Rider has arrived at your location." },
                      { id: "DELIVERED", label: "Delivered", desc: "Your medicines have been successfully delivered." }
                    ].map((s, i) => {
                      const statusSteps = ["PENDING", "PROCESSING", "CONFIRMED", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "RIDER_PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER", "DELIVERED"];
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
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="h-64 rounded-3xl overflow-hidden border border-slate-100 shadow-xl mb-6 relative">
                    <LeafletMap 
                      lat={trackingOrder.deliveryLat || 19.076} 
                      lng={trackingOrder.deliveryLng || 72.8777} 
                      title="Delivery Location" 
                      zoom={14} 
                    />
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
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── ADDRESS MODAL ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[100px] resize-none"
                  placeholder="Street, Landmark, Apartment, City..."
                />
              </div>
              <button 
                onClick={async () => {
                  if (!user || !newAddress.address.trim()) return;
                  const res = await fetch("/api/user/address", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.id, ...newAddress })
                  });
                  if (res.ok) { fetchAddresses(user.id); setShowAddressModal(false); setNewAddress({ label: "Home", address: "" }); }
                }}
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
