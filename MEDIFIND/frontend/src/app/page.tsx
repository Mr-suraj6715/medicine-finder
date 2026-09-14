"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const AutoFitBounds = dynamic(() => import("react-leaflet").then(m => {
  const { useMap } = m;
  function Bounds({ p1, p2 }: { p1?: [number, number]; p2?: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      if (p1 && p2 && p1[0] && p1[1] && p2[0] && p2[1]) {
        try {
          const bounds: any = [
            [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1])],
            [Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])],
          ];
          map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
        } catch (err) {
          console.log("fitBounds error", err);
        }
      }
    }, [p1, p2, map]);
    return null;
  }
  return Bounds;
}), { ssr: false });

let L: any;
if (typeof window !== "undefined") L = require("leaflet");

// ─── Pharmacy data with coordinates ───────────────────────────────
const NEARBY_PHARMACIES = [
  { name: "Apollo Pharmacy",    dist: "0.8 km", open: "Open till 10 PM", price: 15,    badge: "Cheapest", lat: 19.0760, lng: 72.8777 },
  { name: "HealthPlus Medicos", dist: "1.2 km", open: "24/7 Open",       price: 18.50, badge: null,        lat: 19.1136, lng: 72.8697 },
  { name: "City Pharma",        dist: "0.3 km", open: "Closes in 1 hr",  price: 20,    badge: null,        lat: 19.0454, lng: 72.8415 },
  { name: "MediStore",          dist: "1.5 km", open: "Open till 9 PM",  price: 22,    badge: null,        lat: 19.0822, lng: 72.8840 },
  { name: "MedLife Pharmacy",   dist: "2.1 km", open: "24/7 Open",       price: 19,    badge: null,        lat: 19.0178, lng: 72.8478 },
  { name: "GenericMeds Hub",    dist: "3.5 km", open: "Open till 11 PM", price: 16,    badge: null,        lat: 19.2183, lng: 72.9781 },
];

function calculateDistanceKm(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.max(0.2, Math.round(dist * 10) / 10);
}

const PRESET_DELIVERY_AREAS = [
  { label: "Andheri West (Mumbai)", lat: 19.1136, lng: 72.8697 },
  { label: "Bandra West (Mumbai)", lat: 19.0596, lng: 72.8295 },
  { label: "Dadar Central (Mumbai)", lat: 19.0178, lng: 72.8478 },
  { label: "Borivali West (Mumbai)", lat: 19.2307, lng: 72.8567 },
  { label: "Malad West (Mumbai)", lat: 19.1874, lng: 72.8484 },
  { label: "Thane West (Mumbai)", lat: 19.2183, lng: 72.9781 },
  { label: "Colaba (South Mumbai)", lat: 18.9067, lng: 72.8147 },
];

import {
  Search, MapPin, HeartPulse, Menu, Star, Map as MapIcon,
  Navigation, Pill, ChevronRight, ShieldCheck, Globe,
  ShoppingCart, Minus, Plus, Gift, Brain, Sparkles, X,
  Activity, History, Stethoscope, User, Store, Eye, EyeOff,
  Package, TrendingUp, Clock, CheckCircle, LogOut, ChevronDown, Check, ArrowRight, Truck, Award, KeyRound
} from "lucide-react";
import { saveAuthSession, clearAuthSession, getDashboardUrl, getAuthHeaders, getStoredUser, type AuthUser } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────
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
  inventoryId?: string;
  stock?: number;
  open?: string;
  isAvailable?: boolean;
};

interface UserAddress {
  id: string;
  label: string;
  fullName: string | null;
  phone: string | null;
  houseNumber: string | null;
  street: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

// ─── LeafletMap Sub-Component ─────────────────────────────────────
function LeafletMap({
  lat = 19.0760, lng = 72.8777, zoom = 13, title = "Your Location",
  focusLocation,
  pharmacies = [],
  onSelectPharmacy,
  userLocation,
  customerLocation,
  shopLocation,
  showRoute = false
}: {
  lat?: number; lng?: number; zoom?: number; title?: string;
  focusLocation?: { lat: number; lng: number } | null;
  pharmacies?: PharmacyMarker[];
  onSelectPharmacy?: (p: any) => void;
  userLocation?: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number; title?: string } | null;
  shopLocation?: { lat: number; lng: number; name?: string; address?: string; price?: number } | null;
  showRoute?: boolean;
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

  const mapCenterLat = customerLocation?.lat || userLocation?.lat || lat;
  const mapCenterLng = customerLocation?.lng || userLocation?.lng || lng;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-inner border border-slate-200">
      <MapContainer center={[mapCenterLat, mapCenterLng]} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
        />
        
        {/* Customer / User Marker */}
        <Marker position={[mapCenterLat, mapCenterLng]} icon={userIcon}>
          <Popup>
            <div className="font-bold text-emerald-800">{customerLocation?.title || title}</div>
            <div className="text-[10px] text-slate-400">Delivery Location</div>
          </Popup>
        </Marker>

        {/* Selected Shop Marker for Order Route */}
        {shopLocation && (
          <Marker position={[shopLocation.lat, shopLocation.lng]} icon={pharmacyIcon}>
            <Popup>
              <div className="p-1">
                <div className="text-sm font-black text-slate-900">{shopLocation.name || "Medical Shop"}</div>
                {shopLocation.address && <div className="text-[10px] text-slate-500 mt-0.5">{shopLocation.address}</div>}
                {shopLocation.price !== undefined && (
                  <div className="text-[11px] font-black text-emerald-700 mt-1">
                    ₹{shopLocation.price.toFixed(2)}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Multiple Pharmacy Markers */}
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

        {/* Direct Route Polyline connecting Customer & Shop */}
        {showRoute && customerLocation && shopLocation && (
          <Polyline 
            positions={[[customerLocation.lat, customerLocation.lng], [shopLocation.lat, shopLocation.lng]]}
            pathOptions={{ color: '#1E3A2F', weight: 4, opacity: 0.85, dashArray: '8, 8' }} 
          />
        )}

        {/* Focus location polyline */}
        {!showRoute && focusLocation && (
          <Polyline 
            positions={[[userLocation?.lat || lat, userLocation?.lng || lng], [focusLocation.lat, focusLocation.lng]]}
            pathOptions={{ color: '#2D4A3E', weight: 4, opacity: 0.7, dashArray: '10, 10' }} 
          />
        )}

        {/* Auto fit bounds when route active */}
        {showRoute && customerLocation && shopLocation ? (
          <AutoFitBounds p1={[customerLocation.lat, customerLocation.lng]} p2={[shopLocation.lat, shopLocation.lng]} />
        ) : focusLocation ? (
          <UseMapEvents lat={focusLocation.lat} lng={focusLocation.lng} zoom={16} />
        ) : (
          <UseMapEvents lat={mapCenterLat} lng={mapCenterLng} zoom={zoom} />
        )}
      </MapContainer>
    </div>
  );
}

// ─── OrderRouteMapModal Component ─────────────────────────────────
function OrderRouteMapModal({
  isOpen,
  onClose,
  medicine,
  pharmacy,
  availablePharmacies = [],
  onSelectPharmacy,
  customerCoords,
  distanceKm,
  estimatedTimeMins,
  userAddresses = [],
  selectedAddressId,
  onSelectAddressId,
  selectedPresetArea,
  onSelectPresetArea,
  geoDenied,
  quantity,
  onQuantityChange,
  onProceedToOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  medicine: any;
  pharmacy: any;
  availablePharmacies?: any[];
  onSelectPharmacy: (p: any) => void;
  customerCoords: { lat: number; lng: number; label: string };
  distanceKm: number;
  estimatedTimeMins: number;
  userAddresses?: UserAddress[];
  selectedAddressId: string;
  onSelectAddressId: (id: string) => void;
  selectedPresetArea: string;
  onSelectPresetArea: (area: string) => void;
  geoDenied: boolean;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onProceedToOrder: (pharmacy: any, qty: number) => void;
}) {
  if (!isOpen || !pharmacy) return null;

  const shopLat = pharmacy.latitude || pharmacy.lat || 19.0760;
  const shopLng = pharmacy.longitude || pharmacy.lng || 72.8777;
  const unitPrice = pharmacy.price || 0;
  const totalPrice = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-[#1E3A2F] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-300">
              <Store size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">{pharmacy.name}</h2>
                <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Store Route & Distance
                </span>
              </div>
              <p className="text-xs text-emerald-100/70 mt-0.5">
                {medicine?.name ? `Ordering: ${medicine.name}` : "Medical Shop Order Route"} • {pharmacy.location || "Mumbai, MH"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Prominent Distance & Route Notice (Requirement 4 & 7) */}
        <div className="bg-[#EBF5EF] border-b border-[#D2E9DA] px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1E3A2F] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Navigation size={15} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black text-[#1E3A2F]">
                This medical shop is approximately {distanceKm.toFixed(1)} km away from your location.
              </p>
              <p className="text-[11px] text-slate-600 font-medium">
                Estimated travel/delivery distance: {distanceKm.toFixed(1)} km (~{estimatedTimeMins} mins rider transit)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <span className="text-[11px] font-black text-emerald-800 bg-white px-3 py-1 rounded-xl border border-[#C2E2CC] shadow-sm">
              Live Route Preview
            </span>
          </div>
        </div>

        {/* Body: 2 Columns on Desktop, Stacked on Mobile */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Col: Shop Selector, Delivery Location Selector, Order details */}
          <div className="lg:col-span-5 space-y-5">
            {/* If multiple shops available, allow switching (Requirement 9 & 10) */}
            {availablePharmacies.length > 1 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Compare Other Available Medical Shops ({availablePharmacies.length})
                </p>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {availablePharmacies.map((p: any) => {
                    const isSelected = p.name === pharmacy.name;
                    return (
                      <button
                        key={p.name}
                        onClick={() => onSelectPharmacy(p)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-[#1E3A2F] bg-[#F2F8F4] font-bold shadow-sm"
                            : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.dist || `${(p.distValue || 1.5).toFixed(1)} km`} away</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-black text-[#1E3A2F]">₹{p.price?.toFixed(2)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery Location Controls (Requirement 6 & 9) */}
            <div className="bg-[#F8FAF9] p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={12} className="text-[#1E3A2F]" /> Your Delivery Location
                </span>
                {geoDenied && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                    GPS Denied
                  </span>
                )}
              </div>

              {/* Address Selector Options */}
              <div className="space-y-2">
                {userAddresses.length > 0 && (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Select Saved Address</label>
                    <select
                      value={selectedAddressId}
                      onChange={(e) => onSelectAddressId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-[#1E3A2F]"
                    >
                      <option value="">-- Use GPS / Selected Area --</option>
                      {userAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.label}: {addr.address}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {userAddresses.length > 0 ? "Or Choose Neighborhood / Area" : "Select Your Area / Delivery Location"}
                  </label>
                  <select
                    value={selectedPresetArea}
                    onChange={(e) => onSelectPresetArea(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-[#1E3A2F]"
                  >
                    <option value="">-- Current Location (GPS) --</option>
                    {PRESET_DELIVERY_AREAS.map((area) => (
                      <option key={area.label} value={area.label}>
                        {area.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-100 flex items-start gap-1.5 leading-snug">
                <span className="text-[#1E3A2F] font-bold">Selected:</span> {customerCoords.label}
              </p>
            </div>

            {/* Quantity and Pricing */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">Quantity</span>
                <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                  <button
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="font-bold text-sm w-5 text-center">{quantity}</span>
                  <button
                    onClick={() => onQuantityChange(quantity + 1)}
                    className="w-6 h-6 flex items-center justify-center text-[#1E3A2F] rounded hover:bg-emerald-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-200">
                <span>Price per unit</span>
                <span className="font-semibold text-slate-800">₹{unitPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-black pt-1 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-[#1E3A2F] text-base">₹{totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Col: Interactive Route Map */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <MapIcon size={14} className="text-[#1E3A2F]" /> Live Route & Medical Shop Location
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Shop: [{shopLat.toFixed(4)}, {shopLng.toFixed(4)}]
              </span>
            </div>

            <div className="h-[280px] sm:h-[340px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
              <LeafletMap
                lat={customerCoords.lat}
                lng={customerCoords.lng}
                zoom={13}
                title={customerCoords.label}
                customerLocation={{ lat: customerCoords.lat, lng: customerCoords.lng, title: customerCoords.label }}
                shopLocation={{
                  lat: shopLat,
                  lng: shopLng,
                  name: pharmacy.name,
                  address: pharmacy.location,
                  price: pharmacy.price,
                }}
                showRoute={true}
              />
            </div>

            {/* Map legend */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                <span>Your Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>{pharmacy.name}</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Clock size={11} className="text-[#1E3A2F]" /> ~{estimatedTimeMins} mins
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Ordering from <span className="font-bold text-slate-800">{pharmacy.name}</span> ({distanceKm.toFixed(1)} km away)
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onProceedToOrder(pharmacy, quantity)}
              className="flex-1 sm:flex-initial bg-[#1E3A2F] hover:bg-[#152a22] text-white px-7 py-3 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <ShoppingCart size={15} /> Continue to Order — ₹{totalPrice.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatApiError(detail: any, fallback: string = "Request failed"): string {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (item && item.msg) {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
          const cleanMsg = item.msg.replace(/^Value error,\s*/i, "");
          return field && field !== "body"
            ? `${field.charAt(0).toUpperCase() + field.slice(1)}: ${cleanMsg}`
            : cleanMsg;
        }
        return JSON.stringify(item);
      })
      .join(". ");
  }
  if (typeof detail === "object") {
    return detail.message || detail.msg || detail.error || JSON.stringify(detail);
  }
  return String(detail);
}

// ─── Login Modal ──────────────────────────────────────────────────
function LoginModal({
  onClose,
  onSuccess,
  onSwitch,
  initialRole = "user",
  initialEmail = "",
}: {
  onClose: () => void;
  onSuccess: (u: AuthUser, token?: string) => void;
  onSwitch: (r: "user" | "shop_owner" | "rider") => void;
  initialRole?: "user" | "shop_owner" | "rider";
  initialEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<"user" | "shop_owner" | "rider">(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

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
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.detail || data.error, "Login failed"));
      saveAuthSession(data.user, data.token);
      onSuccess(data.user, data.token);
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
            <button key={r} type="button" onClick={() => setRole(r)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${role === r ? "border-[#1E3A2F] bg-[#E8F3ED] text-[#1E3A2F]" : "border-slate-100 text-slate-400"}`}>
              {r.replace("_", " ")}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm font-medium">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" required />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-xs font-bold text-[#1E3A2F] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] bg-slate-50" required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <span className="text-slate-500">Don't have an account? </span>
          <button type="button" onClick={() => onSwitch(role)} className="text-[#1E3A2F] font-semibold hover:underline">Sign up</button>
        </div>
      </div>
    </div>
  );
}




// ─── Signup Modal ─────────────────────────────────────────────────
function SignupModal({ 
  onClose, 
  onSuccess, 
  onSwitch, 
  initialRole = "user" 
}: { 
  onClose: () => void; 
  onSuccess: (u: AuthUser, token?: string) => void; 
  onSwitch: (r: "user" | "shop_owner" | "rider") => void; 
  initialRole?: "user" | "shop_owner" | "rider" 
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", location: "", role: initialRole });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (initialRole) set("role", initialRole);
  }, [initialRole]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.detail || data.error, "Signup failed"));
      saveAuthSession(data.user, data.token);
      onSuccess(data.user, data.token);
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
        <div className="mt-4 text-center text-sm">
          <span className="text-slate-500">Already have an account? </span>
          <button type="button" onClick={() => onSwitch(form.role as any)} className="text-[#1E3A2F] font-semibold hover:underline">Sign in</button>
        </div>
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
  // Removed legacy showForgotPassword state; handled via new page flow
  const [authModalRole, setAuthModalRole] = useState<"user" | "shop_owner" | "rider">("user");
  const [authModalEmail, setAuthModalEmail] = useState("");
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
  const [selectedPresetArea, setSelectedPresetArea] = useState<string>("");
  const [geoDenied, setGeoDenied] = useState<boolean>(false);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState<boolean>(false);
  const [routeModalPharmacy, setRouteModalPharmacy] = useState<any>(null);
  const [routeModalMedicine, setRouteModalMedicine] = useState<any>(null);
  const [routeModalQuantity, setRouteModalQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "CASH_ON_DELIVERY">("CASH_ON_DELIVERY");
  const [userAddresses, setUserAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [addressForm, setAddressForm] = useState({ label: "Home", fullName: "", phone: "", houseNumber: "", street: "", landmark: "", city: "", state: "", pincode: "", isDefault: false });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressFeedback, setAddressFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [visibleMedicineCount, setVisibleMedicineCount] = useState(3);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Geolocation watch
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoDenied(false);
        },
        (err) => {
          console.log("Geo error:", err);
          setGeoDenied(true);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setGeoDenied(true);
    }
  }, []);

  const getCustomerCoords = useCallback((): { lat: number; lng: number; label: string } => {
    if (selectedAddressId) {
      const addr = userAddresses.find(a => a.id === selectedAddressId);
      if (addr) {
        return {
          lat: addr.latitude || (userLocation?.lat || 19.0760),
          lng: addr.longitude || (userLocation?.lng || 72.8777),
          label: `${addr.label}: ${addr.address}`
        };
      }
    }
    if (selectedPresetArea) {
      const preset = PRESET_DELIVERY_AREAS.find(a => a.label === selectedPresetArea);
      if (preset) return { lat: preset.lat, lng: preset.lng, label: preset.label };
    }
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng, label: "Current GPS Location" };
    }
    return { lat: 19.0760, lng: 72.8777, label: "Default Location (Mumbai, MH)" };
  }, [selectedAddressId, userAddresses, selectedPresetArea, userLocation]);

  const customerCoords = getCustomerCoords();

  // Fetch addresses
  const fetchAddresses = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/user/address?userId=${uid}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.addresses) {
        setUserAddresses(data.addresses);
        // Prefer the default address; fallback to first
        const def = data.addresses.find((a: UserAddress) => a.isDefault);
        if (def) setSelectedAddressId(def.id);
        else if (data.addresses.length > 0) setSelectedAddressId(data.addresses[0].id);
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

  const addressModalScrollRef = useRef<HTMLDivElement>(null);

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
    const cleanPhone = addressForm.phone.replace(/[\s\-\(\)\+]/g, "");
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = "Enter a valid 10-digit Indian mobile number (e.g. 9820011221)";
    }
    if (!addressForm.houseNumber.trim()) {
      errs.houseNumber = "House / Flat / Building is required";
    }
    if (!addressForm.street.trim() || addressForm.street.trim().length < 2) {
      errs.street = "Street / Area is required (min 2 characters)";
    }
    if (!addressForm.city.trim() || addressForm.city.trim().length < 2) {
      errs.city = "City is required";
    }
    if (!addressForm.state.trim() || addressForm.state.trim().length < 2) {
      errs.state = "State is required";
    }
    const cleanPin = addressForm.pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      errs.pincode = "Enter a valid 6-digit Indian PIN code (e.g. 400001)";
    }
    setAddressErrors(errs);
    if (Object.keys(errs).length > 0) {
      setAddressFeedback({ type: "error", msg: "Please fill all required fields highlighted in red." });
      if (addressModalScrollRef.current) {
        addressModalScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
      return false;
    }
    return true;
  };

  const handleSaveAddress = async () => {
    if (!user) {
      setAddressFeedback({ type: "error", msg: "Please sign in to save delivery addresses." });
      return;
    }
    if (!validateAddressForm()) return;
    setAddressSaving(true);
    setAddressFeedback(null);
    try {
      const isEditing = !!editingAddress;
      const url = isEditing ? `/api/user/address?id=${editingAddress!.id}` : "/api/user/address";
      const method = isEditing ? "PUT" : "POST";
      const cleanPhone = addressForm.phone.replace(/[\s\-\(\)\+]/g, "");
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
        latitude: userLocation?.lat || null,
        longitude: userLocation?.lng || null
      };
      if (!isEditing) payload.userId = user.id;
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(". ") : "Failed to save address";
        setAddressFeedback({ type: "error", msg: errMsg });
        if (addressModalScrollRef.current) addressModalScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setAddressFeedback({ type: "success", msg: isEditing ? "Address updated successfully!" : "Address saved successfully!" });
      if (data.address) {
        setSelectedAddressId(data.address.id);
      }
      await fetchAddresses(user.id);
      setTimeout(() => { setShowAddressModal(false); resetAddressForm(); }, 800);
    } catch (err) {
      setAddressFeedback({ type: "error", msg: "Unable to save address. Please try again." });
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/address?id=${addrId}`, { method: "DELETE", headers: getAuthHeaders() });
      if (res.ok) {
        fetchAddresses(user.id);
        if (selectedAddressId === addrId) setSelectedAddressId("");
      }
    } catch (err) { console.error(err); }
    setShowDeleteConfirm(null);
  };

  const handleEditAddress = (addr: UserAddress) => {
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
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ isDefault: true })
      });
      fetchAddresses(user.id);
    } catch (err) { console.error(err); }
  };
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authParam = params.get("auth");
      const roleParam = params.get("role") as "user" | "shop_owner" | "rider" | null;
      if (roleParam && ["user", "shop_owner", "rider"].includes(roleParam)) {
        setAuthModalRole(roleParam);
      }
      if (authParam === "login") {
        setShowLogin(true);
        setShowSignup(false);
      } else if (authParam === "signup") {
        setShowSignup(true);
        setShowLogin(false);
      }
    }

    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      if (storedUser.role === "shop_owner") {
        window.location.replace("/dashboard/shop");
        return;
      } else if (storedUser.role === "rider") {
        window.location.replace("/dashboard/rider");
        return;
      }
    }
    setIsAuthChecking(false);
  }, []);

  const handleAuthSuccess = (u: AuthUser, token?: string) => {
    setUser(u);
    setShowLogin(false);
    setShowSignup(false);
    saveAuthSession(u, token);
    const target = getDashboardUrl(u.role);
    window.location.replace(target);
  };

  const handleLogout = () => {
    clearAuthSession();
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
      const res = await fetch(`/api/loyalty?email=${user.email}`, { headers: getAuthHeaders() });
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
        method: "POST", headers: getAuthHeaders(),
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
          const res = await fetch(`/api/orders?email=${user.email}`, { headers: getAuthHeaders() });
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
        const shopLat = (inv.pharmacy.latitude && inv.pharmacy.latitude !== 0) ? inv.pharmacy.latitude : (predefined ? predefined.lat : 19.0760);
        const shopLng = (inv.pharmacy.longitude && inv.pharmacy.longitude !== 0) ? inv.pharmacy.longitude : (predefined ? predefined.lng : 72.8777);
        const distance = calculateDistanceKm(customerCoords.lat, customerCoords.lng, shopLat, shopLng);
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
          location: inv.pharmacy.location || (predefined ? "Mumbai, MH" : "Nearby"),
          dist: `${distance.toFixed(1)} km`,
          distValue: distance,
          timeValue: Math.max(10, Math.round(distance * 8 + 6)),
          time: `${Math.max(10, Math.round(distance * 8 + 6))} min`,
          open: predefined ? predefined.open : openLabel,
          isAvailable,
          badge: predefined ? predefined.badge : (isAvailable ? null : "Closed"),
          lat: shopLat,
          lng: shopLng,
          latitude: shopLat,
          longitude: shopLng,
          price: inv.price,
          inventoryId: inv.id,
          stock: inv.stock || 50,
        });
      }
      return map;
    }, new Map<string, any>()).values()
  ).sort((a: any, b: any) => a.distValue - b.distValue);

  const nearbyPharmacies = (displayPharmacies.length > 0 ? displayPharmacies : NEARBY_PHARMACIES.map(p => {
    const dist = calculateDistanceKm(customerCoords.lat, customerCoords.lng, p.lat, p.lng);
    const estTime = Math.max(10, Math.round(dist * 8 + 6));
    return {
      ...p,
      rating: "4.5",
      reviews: "(120+)",
      location: "Mumbai, MH",
      distValue: dist,
      dist: `${dist.toFixed(1)} km`,
      time: `${estTime} min`,
      timeValue: estTime
    };
  })) as PharmacyMarker[];

  const cartPharmacy = cart[0]?.inventory?.pharmacy || bestOption?.pharmacy;
  const cartPharmacyLat = cartPharmacy?.latitude || cartPharmacy?.lat || 19.0760;
  const cartPharmacyLng = cartPharmacy?.longitude || cartPharmacy?.lng || 72.8777;
  const cartPharmacyDistance = calculateDistanceKm(customerCoords.lat, customerCoords.lng, cartPharmacyLat, cartPharmacyLng);

  const modalShopLat = routeModalPharmacy?.latitude || routeModalPharmacy?.lat || 19.0760;
  const modalShopLng = routeModalPharmacy?.longitude || routeModalPharmacy?.lng || 72.8777;
  const modalDistanceKm = calculateDistanceKm(customerCoords.lat, customerCoords.lng, modalShopLat, modalShopLng);
  const modalEstimatedMins = Math.max(10, Math.round(modalDistanceKm * 8 + 6));

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

      {showLogin && (
        <LoginModal 
          initialRole={authModalRole}
          initialEmail={authModalEmail}
          onClose={() => setShowLogin(false)} 
          onSuccess={handleAuthSuccess}
          onSwitch={(r) => { 
            setAuthModalRole(r);
            setShowLogin(false); 
            setShowSignup(true); 
          }} 
        />
      )}
      
      {showSignup && (
        <SignupModal 
          initialRole={authModalRole}
          onClose={() => setShowSignup(false)} 
          onSuccess={handleAuthSuccess} 
          onSwitch={(r) => { 
            setAuthModalRole(r);
            setShowSignup(false); 
            setShowLogin(true); 
          }} 
        />
      )}

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
              <a href="#pharmacies" className="hover:text-[#1E3A2F] transition-colors">Compare Pharmacies</a>
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
                <div className="flex items-center gap-2 sm:gap-3">
                  <button 
                    onClick={() => { setAuthModalRole("user"); setShowLogin(true); }} 
                    className="border border-[#1E3A2F] text-[#1E3A2F] hover:bg-[#1E3A2F] hover:text-white px-4 sm:px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Account
                  </button>
                  <button 
                    onClick={() => { setAuthModalRole("shop_owner"); setShowLogin(true); }} 
                    className="hidden sm:flex items-center gap-1.5 bg-[#1E3A2F] text-white hover:bg-[#152a22] px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                  >
                    <Store size={13} /> Pharmacy Partner
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        setRouteModalPharmacy(bestOption.pharmacy);
                        setRouteModalMedicine(selectedMedicine);
                        setRouteModalQuantity(quantity);
                        setIsRouteModalOpen(true);
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-[#1E3A2F] py-3.5 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <MapIcon size={16} /> View Route & Map
                    </button>
                    <button onClick={() => addToCart(bestOption, selectedMedicine, quantity)}
                      className="w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white py-3.5 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg">
                      <ShoppingCart size={16} /> Add to Cart
                    </button>
                  </div>
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

          {/* ── ALL AVAILABLE MEDICAL SHOPS COMPARISON (Requirements 2, 7, 8, 10) ── */}
          {selectedMedicine && displayPharmacies.length > 0 && (
            <div id="pharmacies" className="bg-white rounded-[32px] p-6 sm:p-8 shadow-xl border border-slate-100 space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 bg-[#E8F3ED] text-[#1E3A2F] px-3.5 py-1 rounded-full text-xs font-bold mb-2">
                    <Store size={13} /> AVAILABLE IN {displayPharmacies.length} MEDICAL SHOPS
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    Available Medical Shops for {selectedMedicine.name}
                  </h3>
                  <p className="text-slate-500 text-sm">
                    Compare distance, live pricing, and delivery times to select the best medical shop for your order.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-[#F6FAF7] px-4 py-2 rounded-2xl border border-slate-100 shrink-0">
                  <MapPin size={15} className="text-[#1E3A2F]" />
                  <span className="text-xs font-bold text-slate-700">
                    Your location: <span className="text-[#1E3A2F]">{customerCoords.label}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayPharmacies.map((p: any, idx: number) => {
                  const isBestPrice = idx === 0 || p.price === Math.min(...displayPharmacies.map((x: any) => x.price));
                  const isNearest = p.distValue === Math.min(...displayPharmacies.map((x: any) => x.distValue || 999));
                  const estTime = p.time || `${Math.max(10, Math.round((p.distValue || 1.5) * 8 + 6))} min`;

                  return (
                    <div
                      key={`${p.name}-${idx}`}
                      className={`rounded-2xl p-5 border-2 transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
                        isBestPrice ? "border-emerald-300 bg-[#F9FCFA]" : "border-slate-100 bg-white hover:border-[#1E3A2F]/20"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-11 h-11 rounded-xl bg-[#E8F3ED] text-[#1E3A2F] flex items-center justify-center font-black text-lg shrink-0">
                              {p.name[0]}
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 text-sm">{p.name}</h4>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                <MapPin size={10} /> {p.location || "Mumbai, MH"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isBestPrice && (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                Best Price
                              </span>
                            )}
                            {isNearest && (
                              <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                Nearest
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Distance and timing badges */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-[11px] font-black text-[#1E3A2F] bg-[#E8F3ED] px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <Navigation size={11} /> {p.dist} away
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <Clock size={11} /> ~{estTime}
                          </span>
                        </div>

                        {/* Price and status */}
                        <div className="flex justify-between items-center py-3 border-y border-slate-100 mb-4">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Unit Price</span>
                            <span className="text-2xl font-black text-[#1E3A2F]">₹{p.price.toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.isAvailable === false ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>
                              {p.open || "Open Now"}
                            </span>
                            <div className="flex items-center gap-1 mt-1 justify-end text-[11px] text-amber-500 font-bold">
                              <Star size={11} fill="currentColor" /> {p.rating || "4.5"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => {
                            setRouteModalPharmacy(p);
                            setRouteModalMedicine(selectedMedicine);
                            setRouteModalQuantity(quantity);
                            setIsRouteModalOpen(true);
                          }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <MapIcon size={13} className="text-[#1E3A2F]" /> View Route
                        </button>
                        <button
                          onClick={() => {
                            const inv = inventory.find((i: any) => i.pharmacy?.name === p.name) || {
                              id: p.inventoryId || `temp-${p.name}`,
                              price: p.price,
                              stock: p.stock || 50,
                              pharmacy: p
                            };
                            addToCart(inv, selectedMedicine, quantity);
                          }}
                          className="bg-[#1E3A2F] hover:bg-[#152a22] text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ShoppingCart size={13} /> Order Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                                        const mockMed = { id: p.medicineId, name: p.name, description: p.generalUse, category: p.category };
                                        setSelectedMedicine(mockMed);
                                        fetchInventory(p.medicineId);
                                        setRouteModalMedicine(mockMed);
                                        if (nearbyPharmacies.length > 0) setRouteModalPharmacy(nearbyPharmacies[0]);
                                        setIsRouteModalOpen(true);
                                      }}
                                      className="bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-black px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider flex items-center gap-0.5"
                                    >
                                      View Route & Order <ArrowRight size={10} />
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
        </div>

        {/* ── VERIFIED NEIGHBORHOOD PHARMACIES (Clean, Contextual, No Permanent Map) ── */}
        {!selectedMedicine && (
          <div id="pharmacies" className="bg-white rounded-[32px] p-6 sm:p-10 shadow-lg border border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-[10px] font-black tracking-widest text-[#1E3A2F] uppercase bg-[#E8F3ED] px-3 py-1 rounded-full inline-block mb-2">
                  Partner Pharmacies
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Verified Neighborhood Pharmacies</h3>
                <p className="text-slate-500 text-sm">Real-time inventory and delivery from registered medical stores in your area</p>
              </div>
              <div className="flex items-center gap-2 bg-[#F6FAF7] px-4 py-2 rounded-2xl border border-slate-100">
                <MapPin size={14} className="text-[#1E3A2F]" />
                <span className="text-xs font-bold text-slate-700">{customerCoords.label}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {nearbyPharmacies.map((p, i) => (
                <div key={`${p.name}-${i}`} className="bg-slate-50 hover:bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-[#1E3A2F]/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#E8F3ED] flex items-center justify-center text-[#1E3A2F] font-black text-xl group-hover:bg-[#1E3A2F] group-hover:text-white transition-colors">
                        {p.name[0]}
                      </div>
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                        {p.open || "Open Now"}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 text-base mb-1">{p.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                      <MapPin size={12} className="text-slate-400" /> {p.location || "Mumbai, Maharashtra"}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-bold mb-4">
                      <span className="text-[#1E3A2F] bg-[#E8F3ED] px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Navigation size={11} /> {p.dist} away
                      </span>
                      <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Star size={11} fill="currentColor" /> {p.rating || "4.5"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setRouteModalPharmacy(p);
                      setRouteModalMedicine(null);
                      setRouteModalQuantity(1);
                      setIsRouteModalOpen(true);
                    }}
                    className="w-full bg-white group-hover:bg-[#1E3A2F] border border-slate-200 group-hover:border-[#1E3A2F] text-slate-700 group-hover:text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <MapIcon size={13} /> View Route & Location
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── CART SIDEBAR ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col">
            {/* Fixed Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><ShoppingCart size={18} className="text-[#1E3A2F]" /> Your Cart ({cart.length})</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>

            {/* Scrollable body — cart items + all config sections */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-3">
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

              {cart.length > 0 && (
                <div className="space-y-4 pt-1">
                  {/* Emergency Mode */}
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

                  {/* Fulfilling Medical Shop & Route Preview */}
                  <div className="bg-[#F0F7F3] p-3.5 rounded-2xl border border-[#D0E7D8] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#1E3A2F] flex items-center gap-1.5">
                        <Store size={13} /> Fulfilling Medical Shop
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-[#C5E1CE]">
                        {cartPharmacyDistance.toFixed(1)} km away
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {cartPharmacy?.name || "Verified Medical Shop"}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                      <MapPin size={10} /> {cartPharmacy?.location || "Mumbai, Maharashtra"}
                    </p>
                    <p className="text-[11px] text-[#1E3A2F] font-semibold bg-white/80 p-2 rounded-xl border border-[#D5EAE0] leading-snug">
                      📍 This medical shop is approximately {cartPharmacyDistance.toFixed(1)} km away from your location.
                    </p>
                    <button
                      onClick={() => {
                        if (cartPharmacy) {
                          setRouteModalPharmacy(cartPharmacy);
                          setRouteModalMedicine(cart[0]?.medicine || selectedMedicine);
                          setRouteModalQuantity(cart[0]?.quantity || 1);
                          setIsRouteModalOpen(true);
                        }
                      }}
                      className="w-full bg-white hover:bg-[#E2F0E7] border border-[#BBDCC6] text-[#1E3A2F] py-2.5 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <MapIcon size={13} /> View Route on Map
                    </button>
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Delivery Address</p>
                      <button onClick={() => { resetAddressForm(); setShowAddressModal(true); }} className="text-[10px] text-[#1E3A2F] font-bold hover:underline">+ Add New</button>
                    </div>
                    {userAddresses.length === 0 ? (
                      <div className="text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">No addresses saved. Please add a delivery address to continue.</div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={selectedAddressId}
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A2F] font-medium"
                        >
                          {userAddresses.map(addr => (
                            <option key={addr.id} value={addr.id}>{addr.isDefault ? '★ ' : ''}{addr.label}: {addr.fullName ? `${addr.fullName}, ` : ''}{addr.address}</option>
                          ))}
                        </select>
                        {/* Show selected address details */}
                        {(() => {
                          const sel = userAddresses.find(a => a.id === selectedAddressId);
                          if (!sel) return null;
                          return (
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10px] space-y-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-slate-800 text-xs">{sel.fullName || 'N/A'}{sel.isDefault && <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-black">DEFAULT</span>}</p>
                                  <p className="text-slate-500">{sel.phone || ''}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => handleEditAddress(sel)} className="text-[9px] text-blue-600 hover:underline font-bold">Edit</button>
                                  {!sel.isDefault && <button onClick={() => handleSetDefault(sel.id)} className="text-[9px] text-emerald-600 hover:underline font-bold">Set Default</button>}
                                </div>
                              </div>
                              <p className="text-slate-600 leading-snug">{sel.address}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
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

                  {/* Order Summary */}
                  <div className="text-sm space-y-1.5 pt-2 border-t border-slate-100 pb-2">
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
                </div>
              )}
            </div>

            {/* Sticky Checkout Footer — always visible, never scrolls away */}
            {cart.length > 0 && (
              <div className="shrink-0 p-4 border-t border-slate-100 bg-white">
                {!user && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl text-center mb-3">Please <button onClick={() => { setIsCartOpen(false); setShowLogin(true); }} className="underline font-bold">sign in</button> to checkout</p>}
                <button
                  onClick={user ? handlePlaceOrder : () => { setIsCartOpen(false); setShowLogin(true); }}
                  disabled={isOrdering}
                  className={`w-full ${isEmergencyMode ? "bg-rose-500 hover:bg-rose-600" : "bg-[#1E3A2F] hover:bg-[#152a22]"} text-white py-3.5 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shadow-lg disabled:opacity-60`}
                >
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
            <a href="/?auth=login&role=shop_owner" onClick={(e) => { e.preventDefault(); setAuthModalRole("shop_owner"); setShowLogin(true); }} className="hover:text-white transition-colors">Pharmacy Partners</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>

      {/* ── ADDRESS MODAL ── */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 shrink-0 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><MapPin className="text-[#1E3A2F]" size={20} /> {editingAddress ? 'Edit Address' : 'New Delivery Address'}</h3>
              <button onClick={() => { setShowAddressModal(false); resetAddressForm(); }} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>

            {/* Scrollable Form Body */}
            <div ref={addressModalScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-4">
              {/* Feedback banner */}
              {addressFeedback && (
                <div className={`p-3 rounded-xl text-sm font-medium ${addressFeedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
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
                <input value={addressForm.fullName} onChange={e => setAddressForm(p => ({ ...p, fullName: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.fullName ? 'border-rose-400' : 'border-slate-200'}`} placeholder="Recipient full name" />
                {addressErrors.fullName && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.fullName}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Phone Number <span className="text-rose-500">*</span></label>
                <input value={addressForm.phone} onChange={e => setAddressForm(p => ({ ...p, phone: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.phone ? 'border-rose-400' : 'border-slate-200'}`} placeholder="10-digit mobile number" maxLength={10} />
                {addressErrors.phone && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.phone}</p>}
              </div>

              {/* House / Flat */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">House / Flat / Building <span className="text-rose-500">*</span></label>
                <input value={addressForm.houseNumber} onChange={e => setAddressForm(p => ({ ...p, houseNumber: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.houseNumber ? 'border-rose-400' : 'border-slate-200'}`} placeholder="e.g., B-204, Sunshine Apartments" />
                {addressErrors.houseNumber && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.houseNumber}</p>}
              </div>

              {/* Street / Area */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Street / Area <span className="text-rose-500">*</span></label>
                <input value={addressForm.street} onChange={e => setAddressForm(p => ({ ...p, street: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.street ? 'border-rose-400' : 'border-slate-200'}`} placeholder="e.g., MG Road, Andheri West" />
                {addressErrors.street && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.street}</p>}
              </div>

              {/* Landmark (optional) */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Landmark <span className="text-slate-300">(Optional)</span></label>
                <input value={addressForm.landmark} onChange={e => setAddressForm(p => ({ ...p, landmark: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" placeholder="Near Station, Opposite Mall..." />
              </div>

              {/* City + State row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">City <span className="text-rose-500">*</span></label>
                  <input value={addressForm.city} onChange={e => setAddressForm(p => ({ ...p, city: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.city ? 'border-rose-400' : 'border-slate-200'}`} placeholder="Mumbai" />
                  {addressErrors.city && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.city}</p>}
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">State <span className="text-rose-500">*</span></label>
                  <input value={addressForm.state} onChange={e => setAddressForm(p => ({ ...p, state: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.state ? 'border-rose-400' : 'border-slate-200'}`} placeholder="Maharashtra" />
                  {addressErrors.state && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.state}</p>}
                </div>
              </div>

              {/* PIN Code */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">PIN Code <span className="text-rose-500">*</span></label>
                <input value={addressForm.pincode} onChange={e => setAddressForm(p => ({ ...p, pincode: e.target.value }))} className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F] ${addressErrors.pincode ? 'border-rose-400' : 'border-slate-200'}`} placeholder="6-digit PIN code" maxLength={6} />
                {addressErrors.pincode && <p className="text-[10px] text-rose-500 mt-1 font-medium">{addressErrors.pincode}</p>}
              </div>

              {/* Set as Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input type="checkbox" checked={addressForm.isDefault} onChange={e => setAddressForm(p => ({ ...p, isDefault: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#1E3A2F] focus:ring-[#1E3A2F]" />
                <span className="text-xs font-bold text-slate-700">Set as default delivery address</span>
              </label>

              {/* Delete button (only when editing) */}
              {editingAddress && (
                <button
                  onClick={() => setShowDeleteConfirm(editingAddress.id)}
                  className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors"
                >
                  Delete This Address
                </button>
              )}
            </div>

            {/* Sticky footer with Save button */}
            <div className="p-6 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={handleSaveAddress}
                disabled={addressSaving}
                className="w-full bg-[#1E3A2F] text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:bg-[#152a22] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {addressSaving ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : editingAddress ? 'Update Address' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ADDRESS CONFIRM ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3"><X size={22} className="text-rose-500" /></div>
            <h4 className="font-bold text-slate-900 mb-1">Delete Address?</h4>
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone. Historical orders will keep their delivery address.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50">Cancel</button>
              <button onClick={() => { handleDeleteAddress(showDeleteConfirm); setShowAddressModal(false); resetAddressForm(); }} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTEXTUAL ORDER ROUTE MAP MODAL (Requirements 3, 4, 5, 6, 7, 8, 9, 10, 11) ── */}
      <OrderRouteMapModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        medicine={routeModalMedicine || selectedMedicine}
        pharmacy={routeModalPharmacy || bestOption?.pharmacy}
        availablePharmacies={displayPharmacies}
        onSelectPharmacy={(p) => setRouteModalPharmacy(p)}
        customerCoords={customerCoords}
        distanceKm={modalDistanceKm}
        estimatedTimeMins={modalEstimatedMins}
        userAddresses={userAddresses}
        selectedAddressId={selectedAddressId}
        onSelectAddressId={(id) => setSelectedAddressId(id)}
        selectedPresetArea={selectedPresetArea}
        onSelectPresetArea={(area) => setSelectedPresetArea(area)}
        geoDenied={geoDenied}
        quantity={routeModalQuantity}
        onQuantityChange={(q) => setRouteModalQuantity(q)}
        onProceedToOrder={(pharmacy, qty) => {
          const inv = inventory.find((i: any) => i.pharmacy?.name === pharmacy.name) || {
            id: pharmacy.inventoryId || `temp-${pharmacy.name}`,
            price: pharmacy.price,
            stock: pharmacy.stock || 50,
            pharmacy: pharmacy
          };
          addToCart(inv, routeModalMedicine || selectedMedicine, qty);
          setIsRouteModalOpen(false);
          setIsCartOpen(true);
        }}
      />
    </div>
  );
}
