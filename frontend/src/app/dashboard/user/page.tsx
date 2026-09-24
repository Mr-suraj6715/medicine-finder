"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, ShoppingCart, Package, MapPin, Star, Pill, LogOut,
  User, Clock, CheckCircle, TrendingUp, Gift, ChevronRight, Search,
  Activity, History, Navigation, X, Menu, Trash2, Eye, Phone, Store, Award, Sparkles, Truck, AlertCircle
} from "lucide-react";
import { getStoredUser, clearAuthSession, getDashboardUrl, getAuthHeaders, getAuthToken, AuthUser } from "@/lib/auth";

import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr: false });

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

// ── Live Tracking Map & Modal ───────────────────────────────────────
function TrackingMap({ pharmacyCoord, customerCoord, riderCoord }: { pharmacyCoord: { lat: number; lng: number }; customerCoord: { lat: number; lng: number }; riderCoord?: { lat: number; lng: number } | null }) {
  let L: any;
  if (typeof window !== "undefined") {
    try {
      L = require("leaflet");
    } catch {}
  }

  const shopIcon = typeof window !== "undefined" && L ? L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }) : undefined;

  const customerIcon = typeof window !== "undefined" && L ? L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }) : undefined;

  const riderIcon = typeof window !== "undefined" && L ? L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
    iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
  }) : undefined;

  const centerLat = riderCoord ? (riderCoord.lat + customerCoord.lat) / 2 : (pharmacyCoord.lat + customerCoord.lat) / 2;
  const centerLng = riderCoord ? (riderCoord.lng + customerCoord.lng) / 2 : (pharmacyCoord.lng + customerCoord.lng) / 2;

  return (
    <div className="w-full h-64 sm:h-72 rounded-[24px] overflow-hidden border border-[#E2EFE7] shadow-inner relative z-0">
      <MapContainer center={[centerLat, centerLng]} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[pharmacyCoord.lat, pharmacyCoord.lng]} icon={shopIcon}>
          <Popup>Pharmacy Pickup</Popup>
        </Marker>
        <Marker position={[customerCoord.lat, customerCoord.lng]} icon={customerIcon}>
          <Popup>Your Delivery Address</Popup>
        </Marker>
        {riderCoord && (
          <Marker position={[riderCoord.lat, riderCoord.lng]} icon={riderIcon}>
            <Popup>Delivery Partner Live Location</Popup>
          </Marker>
        )}
        <Polyline
          positions={[[pharmacyCoord.lat, pharmacyCoord.lng], [customerCoord.lat, customerCoord.lng]]}
          pathOptions={{ color: '#1E3A2F', weight: 3, opacity: 0.5, dashArray: '6, 6' }}
        />
        {riderCoord && (
          <Polyline
            positions={[[riderCoord.lat, riderCoord.lng], [customerCoord.lat, customerCoord.lng]]}
            pathOptions={{ color: '#059669', weight: 4, opacity: 0.8 }}
          />
        )}
      </MapContainer>
    </div>
  );
}

function LiveTrackingModal({ order, onClose }: { order: any; onClose: () => void }) {
  const pharmacyCoord = {
    lat: order.pharmacy?.latitude || order.pharmacy?.lat || 19.0760,
    lng: order.pharmacy?.longitude || order.pharmacy?.lng || 72.8777
  };
  const customerCoord = {
    lat: order.deliveryLat || 19.0820,
    lng: order.deliveryLng || 72.8810
  };
  const riderCoord = order.rider ? {
    lat: order.rider?.latitude || order.rider?.lat || 19.0780,
    lng: order.rider?.longitude || order.rider?.lng || 72.8790
  } : null;

  const steps = [
    { label: "Order Placed", done: true },
    { label: "Confirmed", done: ["CONFIRMED", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "RIDER_PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER", "DELIVERED"].includes(order.status) },
    { label: "Rider Assigned", done: ["RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "RIDER_PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER", "DELIVERED"].includes(order.status) },
    { label: "Out for Delivery", done: ["RIDER_PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER", "DELIVERED"].includes(order.status) },
    { label: "Delivered", done: order.status === "DELIVERED" },
  ];

  const getStatusDisplay = () => {
    switch (order.status) {
      case "PENDING": return { title: "Order Placed", desc: "Waiting for pharmacy confirmation", badge: "bg-amber-50 text-amber-800" };
      case "CONFIRMED": return { title: "Order Confirmed", desc: "Pharmacy is packing your medicines", badge: "bg-blue-50 text-blue-800" };
      case "RIDER_ASSIGNED": return { title: "Delivery Partner Assigned", desc: `${order.rider?.name || 'Rider'} is heading to the pharmacy`, badge: "bg-sky-50 text-sky-800" };
      case "RIDER_AT_PHARMACY": return { title: "Rider at Pharmacy", desc: "Verifying medicines and prescription", badge: "bg-teal-50 text-teal-800" };
      case "RIDER_PICKED_UP": return { title: "Order Picked Up", desc: "On the way to your delivery address", badge: "bg-indigo-50 text-indigo-800" };
      case "OUT_FOR_DELIVERY": return { title: "Out for Delivery", desc: "Rider is approaching your location", badge: "bg-purple-50 text-purple-800" };
      case "REACHED_CUSTOMER": return { title: "Arrived at Your Location", desc: "Please collect your package", badge: "bg-pink-50 text-pink-800" };
      case "DELIVERED": return { title: "Successfully Delivered", desc: "Package handed over safely", badge: "bg-emerald-50 text-emerald-800" };
      default: return { title: order.status?.replace(/_/g, " "), desc: "Delivery in progress", badge: "bg-slate-100 text-slate-700" };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-[#1E3A2F] text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Live Delivery Tracking</p>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-serif tracking-tight">{order.trackingNumber || order.id}</h2>
            <p className="text-xs text-white/70 mt-0.5">Est. Delivery: <strong>Today, 30-45 mins</strong></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Status Card */}
          <div className="bg-[#F6FAF7] border border-[#E2EFE7] rounded-[24px] p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${statusInfo.badge}`}>
                  {order.status?.replace(/_/g, " ")}
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-2">{statusInfo.title}</h3>
                <p className="text-xs text-slate-500 font-medium">{statusInfo.desc}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#E8F3ED] text-[#1E3A2F] flex items-center justify-center shrink-0">
                <Navigation size={22} className="animate-pulse" />
              </div>
            </div>

            {/* Stepper */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="grid grid-cols-5 gap-1 text-center">
                {steps.map((st, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      st.done ? "bg-[#1E3A2F] text-white shadow" : "bg-slate-200 text-slate-400"
                    }`}>
                      {st.done ? "✓" : i + 1}
                    </div>
                    <span className={`text-[9px] font-bold mt-1.5 uppercase tracking-tighter leading-tight ${
                      st.done ? "text-[#1E3A2F]" : "text-slate-400"
                    }`}>
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Map */}
          <div>
            <div className="flex justify-between items-center mb-2 px-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Delivery Route</p>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live GPS Active
              </span>
            </div>
            <TrackingMap pharmacyCoord={pharmacyCoord} customerCoord={customerCoord} riderCoord={riderCoord} />
          </div>

          {/* Rider & Pharmacy Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Rider Card */}
            <div className="bg-white rounded-2xl p-4 border border-[#E2EFE7] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Partner</p>
              {order.rider ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#E8F3ED] text-[#1E3A2F] flex items-center justify-center font-bold font-serif text-lg">
                      {order.rider.name?.[0]?.toUpperCase() || "R"}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{order.rider.name || order.rider.email}</p>
                      <p className="text-xs text-slate-500">{order.rider.vehicleType || "Motorcycle"} • ⭐ {(order.rider.rating || order.rider.riderRating || 5).toFixed(1)}</p>
                    </div>
                  </div>
                  {order.rider.phone && (
                    <a
                      href={`tel:${order.rider.phone}`}
                      className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                      title="Call Rider"
                    >
                      <Phone size={15} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-slate-400 font-medium">
                  ⏳ Assigning nearby verified rider...
                </div>
              )}
            </div>

            {/* Pharmacy Card */}
            <div className="bg-white rounded-2xl p-4 border border-[#E2EFE7] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pickup Pharmacy</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Store size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{order.pharmacy?.name || "Local Chemist"}</p>
                    <p className="text-xs text-slate-500 truncate">{order.pharmacy?.location || "Mumbai, Maharashtra"}</p>
                  </div>
                </div>
                {order.pharmacy?.phone && (
                  <a
                    href={`tel:${order.pharmacy.phone}`}
                    className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                    title="Call Pharmacy"
                  >
                    <Phone size={15} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-[#F6FAF7] border border-[#E2EFE7] rounded-2xl p-4 flex items-start gap-3">
            <MapPin size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Destination</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{order.deliveryAddress || "Home Address"}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F6FAF7] border-t border-[#E2EFE7] shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-full font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow"
          >
            Close Tracking
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "profile" | "health">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: "Home",
    fullName: "",
    phone: "",
    houseNumber: "",
    street: "",
    landmark: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "",
    isDefault: false
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [addressFeedback, setAddressFeedback] = useState<{ type: "error" | "success"; msg: string } | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchAddresses = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/user/address?userId=${uid}`, { headers: getAuthHeaders() });
      if (res.status === 401) {
        clearAuthSession();
        window.location.replace("/?auth=login&role=user");
        return;
      }
      const data = await res.json();
      if (data.addresses) setUserAddresses(data.addresses);
    } catch (err) { console.error(err); }
  }, []);

  const resetAddressForm = () => {
    setAddressForm({
      label: "Home",
      fullName: user?.name || "",
      phone: user?.phone || "",
      houseNumber: "",
      street: "",
      landmark: "",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "",
      isDefault: false
    });
    setAddressErrors({});
    setAddressFeedback(null);
    setEditingAddress(null);
  };

  const validateAddressForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!addressForm.fullName.trim() || addressForm.fullName.trim().length < 2) {
      errs.fullName = "Full name is required (min 2 characters)";
    }
    let cleanPhone = addressForm.phone.replace(/[\s\-\(\)\+]/g, "");
    if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) cleanPhone = cleanPhone.slice(2);
    else if (cleanPhone.length === 13 && cleanPhone.startsWith("091")) cleanPhone = cleanPhone.slice(3);
    else if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = "Enter a valid 10-digit Indian mobile number (e.g. 9820011221 or +91 98200 11221)";
    }
    if (!addressForm.houseNumber.trim()) {
      errs.houseNumber = "House / Flat / Building is required";
    }
    if (!addressForm.street.trim() || addressForm.street.trim().length < 2) {
      errs.street = "Street / Area is required";
    }
    if (!addressForm.city.trim() || addressForm.city.trim().length < 2) {
      errs.city = "City is required";
    }
    if (!addressForm.state.trim() || addressForm.state.trim().length < 2) {
      errs.state = "State is required";
    }
    const cleanPin = addressForm.pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      errs.pincode = "Enter a valid 6-digit Indian PIN code";
    }
    setAddressErrors(errs);
    if (Object.keys(errs).length > 0) {
      setAddressFeedback({ type: "error", msg: "Please fill all required fields correctly." });
      return false;
    }
    return true;
  };

  const handleSaveAddress = async () => {
    const token = getAuthToken();
    if (!user || !token) {
      setAddressFeedback({ type: "error", msg: "Your session has expired. Please sign in again." });
      clearAuthSession();
      setUser(null);
      setTimeout(() => {
        window.location.replace("/?auth=login&role=user");
      }, 1200);
      return;
    }
    if (!validateAddressForm()) return;
    setAddressSaving(true);
    setAddressFeedback(null);
    try {
      const isEditing = !!editingAddress;
      const url = isEditing ? `/api/user/address?id=${editingAddress!.id}` : "/api/user/address";
      const method = isEditing ? "PUT" : "POST";
      let cleanPhone = addressForm.phone.replace(/[\s\-\(\)\+]/g, "");
      if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) cleanPhone = cleanPhone.slice(2);
      else if (cleanPhone.length === 13 && cleanPhone.startsWith("091")) cleanPhone = cleanPhone.slice(3);
      else if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) cleanPhone = cleanPhone.slice(1);
      const parts = [
        addressForm.houseNumber.trim(),
        addressForm.street.trim(),
        addressForm.landmark ? addressForm.landmark.trim() : null,
        addressForm.city.trim(),
        addressForm.state.trim(),
        addressForm.pincode.trim()
      ].filter(Boolean);
      const combined = parts.join(", ");
      const payload: any = {
        ...addressForm,
        fullName: addressForm.fullName.trim(),
        phone: cleanPhone,
        houseNumber: addressForm.houseNumber.trim(),
        street: addressForm.street.trim(),
        landmark: addressForm.landmark ? addressForm.landmark.trim() : null,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
        address: combined,
        deliveryAddress: combined,
      };
      if (!isEditing) payload.userId = user.id;
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setAddressFeedback({ type: "error", msg: "Your session has expired. Please sign in again." });
          clearAuthSession();
          setUser(null);
          setTimeout(() => {
            window.location.replace("/?auth=login&role=user");
          }, 1200);
          return;
        }
        const errMsg = typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((d: any) => {
                const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
                const msg = (d.msg || "").replace(/^Value error,\s*/i, "");
                return field && field !== "body" ? `${field}: ${msg}` : msg;
              }).join(". ")
            : "Failed to save address";
        setAddressFeedback({ type: "error", msg: errMsg });
        return;
      }
      setAddressFeedback({ type: "success", msg: isEditing ? "Address updated successfully!" : "Address saved successfully!" });
      await fetchAddresses(user.id);
      setTimeout(() => { setShowAddressModal(false); resetAddressForm(); }, 800);
    } catch (err) {
      setAddressFeedback({ type: "error", msg: "Unable to save address. Please try again." });
    } finally {
      setAddressSaving(false);
    }
  };

  const handleEditAddress = (addr: any) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label || "Home",
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      houseNumber: addr.houseNumber || "",
      street: addr.street || "",
      landmark: addr.landmark || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      isDefault: addr.isDefault || false,
    });
    setAddressErrors({});
    setAddressFeedback(null);
    setShowAddressModal(true);
  };

  const handleSetDefault = async (addrId: string) => {
    if (!user) return;
    try {
      await fetch(`/api/user/address?id=${addrId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isDefault: true }),
      });
      fetchAddresses(user.id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    setDeletingAddressId(id);
    try {
      const res = await fetch(`/api/user/address?id=${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchAddresses(user.id);
      }
    } catch (err) { console.error(err); }
    finally { setDeletingAddressId(null); }
  };

  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [trackingOrder, setTrackingOrder] = useState<any>(null);
  const [isTrackingMode, setIsTrackingMode] = useState(false);

  useEffect(() => {
    const u = getStoredUser();

    if (!u) {
      window.location.replace("/?auth=login&role=user");
      return;
    }

    if (u.role !== "user") {
      window.location.replace(getDashboardUrl(u.role));
      return;
    }

    setUser(u as any);
    setLoyaltyPoints(u.loyaltyPoints || 0);
    setAuthLoading(false);
  }, []);

  const fetchLoyalty = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/loyalty?email=${email}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.points !== undefined) setLoyaltyPoints(data.points);
      else if (data.loyaltyPoints !== undefined) setLoyaltyPoints(data.loyaltyPoints);
    } catch {}
  }, []);

  const fetchOrders = useCallback(async (email: string, silent = false) => {
    try {
      if (!silent) setLoadingOrders(true);
      const res = await fetch(`/api/orders?email=${email}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {} finally { if (!silent) setLoadingOrders(false); }
  }, []);

  const fetchHealthLogs = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/ai-prescribe?email=${email}`, { headers: getAuthHeaders() });
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
    clearAuthSession();
    window.location.replace("/?auth=login&role=user");
  };

  const totalSpent = orders.reduce((a, o) => a + (o.totalAmount || 0), 0);
  const deliveredCount = orders.filter(o => o.status === "DELIVERED").length;

  if (authLoading || !user) return (
    <div className="min-h-screen bg-[#F6FAF7] flex flex-col items-center justify-center">
      <div className="bg-[#1E3A2F] p-3.5 rounded-2xl text-white shadow-xl animate-bounce mb-4">
        <HeartPulse size={32} />
      </div>
      <p className="text-[#1E3A2F] font-bold animate-pulse text-sm">Verifying Customer Authorization...</p>
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
                <button onClick={() => { resetAddressForm(); setShowAddressModal(true); }} className="text-xs text-[#1E3A2F] font-black uppercase tracking-wider hover:underline">+ Add New</button>
              </div>
              {userAddresses.length === 0 ? (
                <p className="text-xs text-slate-400 bg-[#F6FAF7] p-6 rounded-2xl border border-dashed border-[#D5E6DC] text-center">No addresses saved yet. Add a delivery address for fast checkout.</p>
              ) : (
                <div className="space-y-3">
                  {userAddresses.map(addr => (
                    <div key={addr.id} className="p-4 bg-[#F6FAF7] rounded-2xl border border-[#E2EFE7] flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <MapPin size={16} className="text-[#1E3A2F] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-[#1E3A2F] uppercase">{addr.label}</p>
                            {addr.isDefault && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">DEFAULT</span>
                            )}
                          </div>
                          {addr.fullName && <p className="text-xs font-bold text-slate-800 mt-0.5">{addr.fullName} • {addr.phone}</p>}
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{addr.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleEditAddress(addr)}
                          className="text-xs font-bold text-blue-600 hover:underline px-2 py-1"
                        >
                          Edit
                        </button>
                        {!addr.isDefault && (
                          <button
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-xs font-bold text-emerald-700 hover:underline px-2 py-1"
                          >
                            Set Default
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteAddress(addr.id)}
                          disabled={deletingAddressId === addr.id}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 shrink-0 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <MapPin className="text-[#1E3A2F]" size={20} />
                {editingAddress ? "Edit Address" : "New Delivery Address"}
              </h3>
              <button onClick={() => { setShowAddressModal(false); resetAddressForm(); }} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-4">
              {addressFeedback && (
                <div className={`p-3 rounded-xl text-sm font-medium ${addressFeedback.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {addressFeedback.msg}
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Label</label>
                <div className="flex gap-2">
                  {["Home", "Work", "Other"].map(l => (
                    <button key={l} onClick={() => setAddressForm(p => ({ ...p, label: l }))} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${addressForm.label === l ? "bg-[#E8F3ED] border-[#1E3A2F] text-[#1E3A2F]" : "bg-slate-50 border-slate-100 text-slate-500"}`}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Full Name <span className="text-rose-500">*</span></label>
                <input value={addressForm.fullName} onChange={e => setAddressForm(p => ({ ...p, fullName: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.fullName ? "border-rose-400" : "border-slate-200"}`} placeholder="Recipient full name" />
                {addressErrors.fullName && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.fullName}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Phone Number <span className="text-rose-500">*</span></label>
                <input value={addressForm.phone} onChange={e => setAddressForm(p => ({ ...p, phone: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.phone ? "border-rose-400" : "border-slate-200"}`} placeholder="e.g. +91 98200 11221 or 9820011221" maxLength={16} />
                {addressErrors.phone && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.phone}</p>}
              </div>

              {/* House / Flat */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">House / Flat / Building <span className="text-rose-500">*</span></label>
                <input value={addressForm.houseNumber} onChange={e => setAddressForm(p => ({ ...p, houseNumber: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.houseNumber ? "border-rose-400" : "border-slate-200"}`} placeholder="e.g., B-204, Sunshine Apartments" />
                {addressErrors.houseNumber && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.houseNumber}</p>}
              </div>

              {/* Street / Area */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Street / Area <span className="text-rose-500">*</span></label>
                <input value={addressForm.street} onChange={e => setAddressForm(p => ({ ...p, street: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.street ? "border-rose-400" : "border-slate-200"}`} placeholder="e.g., MG Road, Andheri West" />
                {addressErrors.street && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.street}</p>}
              </div>

              {/* Landmark (optional) */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Landmark <span className="text-slate-400">(Optional)</span></label>
                <input value={addressForm.landmark} onChange={e => setAddressForm(p => ({ ...p, landmark: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" placeholder="Near Station, Opposite Mall..." />
              </div>

              {/* City + State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">City <span className="text-rose-500">*</span></label>
                  <input value={addressForm.city} onChange={e => setAddressForm(p => ({ ...p, city: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.city ? "border-rose-400" : "border-slate-200"}`} placeholder="Mumbai" />
                  {addressErrors.city && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">State <span className="text-rose-500">*</span></label>
                  <input value={addressForm.state} onChange={e => setAddressForm(p => ({ ...p, state: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.state ? "border-rose-400" : "border-slate-200"}`} placeholder="Maharashtra" />
                  {addressErrors.state && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.state}</p>}
                </div>
              </div>

              {/* PIN Code */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">PIN Code <span className="text-rose-500">*</span></label>
                <input value={addressForm.pincode} onChange={e => setAddressForm(p => ({ ...p, pincode: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.pincode ? "border-rose-400" : "border-slate-200"}`} placeholder="6-digit PIN code" maxLength={6} />
                {addressErrors.pincode && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.pincode}</p>}
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input type="checkbox" checked={addressForm.isDefault} onChange={e => setAddressForm(p => ({ ...p, isDefault: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#1E3A2F] focus:ring-[#1E3A2F]" />
                <span className="text-xs font-bold text-slate-700">Set as default delivery address</span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={handleSaveAddress}
                disabled={addressSaving}
                className="w-full bg-[#1E3A2F] text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:bg-[#152a22] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {addressSaving ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : editingAddress ? "Update Address" : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      {isTrackingMode && trackingOrder && (
        <LiveTrackingModal
          order={trackingOrder}
          onClose={() => { setIsTrackingMode(false); setTrackingOrder(null); }}
        />
      )}
    </div>
  );
}
