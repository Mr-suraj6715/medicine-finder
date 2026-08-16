"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, Package, LogOut, Store, Bell, TrendingUp,
  Plus, CheckCircle, X, ChevronRight, Pill, Clock,
  ShoppingCart, BarChart3, Settings, AlertCircle, Users, Edit3, Activity,
  MapPin, Navigation, Save, Phone, ToggleLeft, ToggleRight, UserCheck, RefreshCw, Star
} from "lucide-react";

type AuthUser = { id: string; email: string; name: string; role: string };

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
};

export default function ShopDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<"orders" | "inventory" | "ai-mappings" | "analytics" | "settings">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [reassignModalOrder, setReassignModalOrder] = useState<any | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", category: "", price: "", stock: "" });
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editStock, setEditStock] = useState({ price: "", stock: "", category: "" });

  // Settings state
  const [settings, setSettings] = useState({
    name: "",
    location: "",
    phone: "",
    openingTime: "9:00 AM",
    closingTime: "9:00 PM",
    isAvailable: true,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchShopData = useCallback(async (userId: string) => {
    try {
      const resInv = await fetch(`/api/shop/inventory?pharmacyId=${userId}`);
      const dataInv = await resInv.json();
      if (dataInv.inventory) {
        setInventory(dataInv.inventory.map((inv: any) => ({
          id: inv.medicineId,
          realId: inv.id,
          name: inv.medicine?.name || "Medicine",
          category: inv.medicine?.category || "-",
          price: inv.price,
          stock: inv.stock,
          sold: inv.sold || 0,
        })));
      }

      const resOrd = await fetch(`/api/shop/orders?pharmacyId=${userId}`);
      const dataOrd = await resOrd.json();
      if (dataOrd.orders) {
        setOrders(dataOrd.orders);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchRiders = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/reassign');
      const data = await res.json();
      if (data.riders) setRiders(data.riders);
    } catch (e) { console.error(e); }
  }, []);

  const fetchSettings = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/shop/settings?pharmacyId=${userId}`);
      const data = await res.json();
      if (data.pharmacy) {
        setSettings({
          name: data.pharmacy.name || "",
          location: data.pharmacy.location || "",
          phone: data.pharmacy.phone || "",
          openingTime: data.pharmacy.openingTime || "9:00 AM",
          closingTime: data.pharmacy.closingTime || "9:00 PM",
          isAvailable: data.pharmacy.isAvailable ?? true,
        });
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("medifind_user_shop_owner");
    const fallback = localStorage.getItem("medifind_user");
    let u: AuthUser | null = null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.role === "shop_owner") u = parsed;
      } catch {}
    }
    if (!u && fallback) {
      try {
        const parsed = JSON.parse(fallback);
        if (parsed.role === "shop_owner") u = parsed;
      } catch {}
    }

    if (!u) {
      window.location.href = "/";
      return;
    }

    setUser(u);
    fetchShopData(u.id);
    fetchSettings(u.id);
    fetchRiders();
    
    const interval = setInterval(() => {
      fetchShopData(u.id);
      fetchRiders();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchShopData, fetchSettings, fetchRiders]);

  const handleLogout = () => {
    localStorage.removeItem("medifind_user");
    localStorage.removeItem("medifind_role");
    localStorage.removeItem("medifind_active_role");
    localStorage.removeItem("medifind_user_user");
    localStorage.removeItem("medifind_user_shop_owner");
    localStorage.removeItem("medifind_user_rider");
    window.location.href = "/";
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      setOrders(prev => prev.map(o => (o.realId === orderId || o.id === orderId) ? { ...o, status } : o));
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      if (!res.ok) throw new Error("API failed");
      if (user) fetchShopData(user.id);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleReassignRider = async (orderId: string, riderId: string) => {
    setReassigning(true);
    try {
      const res = await fetch('/api/shop/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, riderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReassignModalOrder(null);
        if (user) fetchShopData(user.id);
      } else {
        alert(data.error || "Failed to assign rider");
      }
    } catch (e) {
      console.error(e);
      alert("Network error reassigning rider");
    } finally {
      setReassigning(false);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch('/api/shop/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_medicine',
          pharmacyId: user.id,
          medicineName: newMed.name,
          category: newMed.category,
          price: parseFloat(newMed.price),
          stock: parseInt(newMed.stock),
        }),
      });
      if (res.ok) {
        fetchShopData(user.id);
        setNewMed({ name: "", category: "", price: "", stock: "" });
        setShowAddModal(false);
      }
    } catch {}
  };

  const handleSaveStock = async (id: string) => {
    if (!user) return;
    const med = inventory.find(m => m.id === id);
    if (!med) return;
    const finalPrice = editStock.price ? parseFloat(editStock.price) : med.price;
    const finalStock = editStock.stock ? parseInt(editStock.stock) : med.stock;
    const finalCategory = editStock.category || med.category;
    try {
      await fetch('/api/shop/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_stock',
          pharmacyId: user.id,
          medicineId: id,
          price: finalPrice,
          stock: finalStock,
          category: finalCategory,
        }),
      });
      fetchShopData(user.id);
      setEditingStock(null);
    } catch {}
  };

  const handleRemoveMedicine = async (medicineId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to remove this product from inventory?")) return;
    try {
      const res = await fetch('/api/shop/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_medicine',
          pharmacyId: user.id,
          medicineId,
        }),
      });
      if (res.ok) {
        fetchShopData(user.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAvailability = async (medicineId: string, currentStock: number) => {
    if (!user) return;
    const newStock = currentStock > 0 ? 0 : 50;
    try {
      await fetch('/api/shop/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_stock',
          pharmacyId: user.id,
          medicineId,
          stock: newStock,
        }),
      });
      fetchShopData(user.id);
    } catch (e) {
      console.error(e);
    }
  };


  const handleSaveSettings = async () => {
    if (!user) return;
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/shop/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyId: user.id, ...settings }),
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch {} finally {
      setSettingsSaving(false);
    }
  };

  const totalRevenue = inventory.reduce((a, m) => a + (m.price || 0) * (m.sold || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "PENDING").length;
  const totalItems = inventory.reduce((a, m) => a + (m.stock || 0), 0);
  const lowStock = inventory.filter(m => m.stock < 20).length;

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
            <span className="text-xs font-black uppercase tracking-wider text-[#2D4A3E] bg-[#E8F3ED] px-3 py-1 rounded-full hidden sm:inline">Pharmacy Merchant</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Availability status badge */}
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${settings.isAvailable ? "bg-[#E8F3ED] border-[#CDE3D5] text-[#1E3A2F]" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
              <span className={`w-2 h-2 rounded-full ${settings.isAvailable ? "bg-emerald-600 animate-pulse" : "bg-rose-500"}`}></span>
              <span>{settings.isAvailable ? "Store Open" : "Store Closed"}</span>
            </div>

            {pendingOrders > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-800">
                <Bell size={13} className="text-amber-600 animate-bounce" />
                <span>{pendingOrders} Pending</span>
              </div>
            )}

            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-600 text-xs font-bold px-3 py-2 rounded-full hover:bg-rose-50 transition-colors">
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-serif tracking-tight text-slate-900 mb-2">
            Pharmacy Portal 🏪 <span className="text-[#1E3A2F] font-sans font-black">{settings.name || user.name}</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm">Manage incoming customer orders, inventory stock, and delivery dispatches.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: TrendingUp, label: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, color: "text-[#1E3A2F] bg-[#E8F3ED]" },
            { icon: ShoppingCart, label: "Pending Orders", value: pendingOrders, color: "text-amber-800 bg-amber-50" },
            { icon: Package, label: "Items in Stock", value: totalItems, color: "text-teal-800 bg-teal-50" },
            { icon: AlertCircle, label: "Low Stock Alert", value: lowStock, color: "text-rose-600 bg-rose-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-[24px] p-6 border border-[#E2EFE7] shadow-sm">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icon size={18} /></div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-[#EBF4EE] p-1.5 rounded-full mb-8 w-fit border border-[#D5E6DC] overflow-x-auto">
          {[
            { id: "orders", label: "Orders", icon: ShoppingCart },
            { id: "inventory", label: "Inventory", icon: Package },
            { id: "ai-mappings", label: "AI Mappings", icon: Activity },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
            { id: "settings", label: "Store Settings", icon: Settings },
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${tab === t.id ? "bg-[#1E3A2F] text-white shadow-md" : "text-slate-600 hover:text-slate-900"}`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-serif font-bold text-slate-900">Incoming Customer Orders</h2>
            </div>
            {orders.length === 0 ? (
              <div className="bg-white rounded-[32px] border border-[#E2EFE7] p-16 text-center shadow-sm">
                <ShoppingCart size={44} className="mx-auto mb-4 text-slate-300" />
                <h3 className="font-bold text-slate-700 text-lg mb-2">No orders pending</h3>
                <p className="text-sm text-slate-400">Incoming customer orders will appear here in real-time.</p>
              </div>
            ) : orders.map(order => (
              <div key={order.id} className="bg-white rounded-[28px] border border-[#E2EFE7] shadow-sm p-6">
                <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs bg-[#F0F6F2] text-[#1E3A2F] px-2.5 py-1 rounded-full font-mono font-bold">#{order.id.slice(-6)}</code>
                      {order.isEmergency && (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                          <Activity size={10} /> EMERGENCY
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-base">{order.customer || "Customer"}</p>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5"><MapPin size={12} className="text-slate-400" /> {order.customerAddress || "Local Delivery"}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={11} /> {order.time || "Recent"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xl text-[#1E3A2F]">₹{(order.total + (order.isEmergency ? order.surgeFee : 0)).toLocaleString()}</p>
                    <p className="text-xs text-slate-400 font-medium">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}</p>
                    {order.isEmergency && <p className="text-[10px] text-rose-500 font-bold mt-1">Surcharge: ₹{order.surgeFee}</p>}
                  </div>
                </div>

                {/* Rider assignment & cancellation banner */}
                <div className="mb-4 bg-[#F6FAF7] rounded-2xl p-4 border border-[#E2EFE7] text-xs">
                  {order.riderName ? (
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <UserCheck size={16} className="text-[#1E3A2F]" />
                        <div>
                          <span className="font-bold text-slate-900">Assigned Rider: {order.riderName}</span>
                          {order.riderRating && <span className="text-amber-500 font-bold ml-2">⭐ {order.riderRating.toFixed(1)}</span>}
                          {order.riderPhone && <span className="text-slate-500 ml-2">({order.riderPhone})</span>}
                        </div>
                      </div>
                      {order.status !== "DELIVERED" && (
                        <button
                          onClick={() => setReassignModalOrder(order)}
                          className="text-[10px] font-black bg-[#E8F3ED] hover:bg-[#D5E6DC] text-[#1E3A2F] px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors uppercase tracking-wider"
                        >
                          <RefreshCw size={11} /> Reassign Rider
                        </button>
                      )}
                    </div>
                  ) : order.cancelledRiderName ? (
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="text-rose-600 font-medium">
                        ⚠️ Order was released by previous rider <strong>({order.cancelledRiderName})</strong>.
                      </div>
                      <button
                        onClick={() => setReassignModalOrder(order)}
                        className="text-[10px] font-black bg-[#1E3A2F] hover:bg-[#152a22] text-white px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm uppercase tracking-wider"
                      >
                        <UserCheck size={11} /> Reassign Rider
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-slate-500 font-medium">Available to all active nearby riders</span>
                      {order.status !== "DELIVERED" && (
                        <button
                          onClick={() => setReassignModalOrder(order)}
                          className="text-[10px] font-black bg-[#1E3A2F] hover:bg-[#152a22] text-white px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm uppercase tracking-wider"
                        >
                          <UserCheck size={11} /> Directly Assign Rider
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#F6FAF7] border border-[#E2EFE7] rounded-xl p-3 text-sm">
                      <div className="flex items-center gap-2"><Pill size={15} className="text-[#1E3A2F]" /> <span className="font-bold text-slate-800">{item.name}</span></div>
                      <span className="text-slate-500 font-bold text-xs">×{item.qty} — ₹{(item.price * item.qty).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  {order.status !== "DELIVERED" ? (
                    order.status === "PENDING" ? (
                      <button
                        onClick={() => updateOrderStatus(order.realId || order.id, "PROCESSING")}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 ${order.isEmergency ? "bg-rose-600 text-white" : "bg-[#1E3A2F] hover:bg-[#152a22] text-white"}`}
                      >
                        <CheckCircle size={14} /> Accept & Prepare
                      </button>
                    ) : order.status === "PROCESSING" ? (
                      <button
                        onClick={() => updateOrderStatus(order.realId || order.id, "CONFIRMED")}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-md bg-amber-600 hover:bg-amber-700 text-white transition-all active:scale-95"
                      >
                        <Package size={14} /> Mark as Packed (Request Rider)
                      </button>
                    ) : null
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-[#E8F3ED] px-3 py-1 rounded-full"><CheckCircle size={13} /> Order completed</span>
                  )}

                  {order.status !== "DELIVERED" && order.status !== "PENDING" && order.status !== "PROCESSING" && (
                    <div className="flex items-center justify-between w-full group">
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#E8F3ED] text-[#1E3A2F] rounded-full text-[10px] font-black uppercase tracking-widest border border-[#D5E6DC]">
                        <Navigation size={12} className="animate-pulse" />
                        {order.status === "CONFIRMED" && "Awaiting Rider Acceptance"}
                        {order.status === "RIDER_ASSIGNED" && "Rider Heading to Store"}
                        {order.status === "RIDER_AT_PHARMACY" && "Rider at your Store"}
                        {order.status === "RIDER_PICKED_UP" && "Rider Picked Up Order"}
                        {order.status === "OUT_FOR_DELIVERY" && "Out for Delivery"}
                        {order.status === "REACHED_CUSTOMER" && "Rider Reached Customer"}
                      </div>
                      {(order.status === "REACHED_CUSTOMER" || order.status === "OUT_FOR_DELIVERY") && (
                        <button
                          onClick={() => updateOrderStatus(order.realId || order.id, "DELIVERED")}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-md bg-emerald-700 hover:bg-emerald-800 text-white transition-all active:scale-95 ml-auto"
                        >
                          <CheckCircle size={14} /> Finalize Delivery
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* INVENTORY TAB */}
        {tab === "inventory" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif font-bold text-slate-900">Medicine Catalog & Stock</h2>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#152a22] text-white px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-md">
                <Plus size={15} /> Add Medicine
              </button>
            </div>
            <div className="bg-white rounded-[28px] border border-[#E2EFE7] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2EFE7] bg-[#F6FAF7]">
                      <th className="text-left px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-wider">Medicine</th>
                      <th className="text-left px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-wider">Category</th>
                      <th className="text-left px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-wider">Price</th>
                      <th className="text-left px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-wider">Stock</th>
                      <th className="text-left px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-wider">Availability</th>
                      <th className="text-left px-6 py-4 font-black text-slate-400 text-xs uppercase tracking-wider">Sold</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2EFE7]">
                    {inventory.map(med => (
                      <tr key={med.id} className="hover:bg-[#F6FAF7] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#E8F3ED] rounded-xl flex items-center justify-center text-[#1E3A2F] shrink-0"><Pill size={16} /></div>
                            <span className="font-bold text-slate-900">{med.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          {editingStock === med.id ? (
                            <input type="text" value={editStock.category} onChange={e => setEditStock(p => ({ ...p, category: e.target.value }))}
                              className="w-24 border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A2F]" />
                          ) : med.category}
                        </td>
                        <td className="px-6 py-4">
                          {editingStock === med.id ? (
                            <input type="number" value={editStock.price} onChange={e => setEditStock(p => ({ ...p, price: e.target.value }))}
                              className="w-20 border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A2F]" />
                          ) : <span className="font-black text-[#1E3A2F]">₹{med.price}</span>}
                        </td>
                        <td className="px-6 py-4">
                          {editingStock === med.id ? (
                            <input type="number" value={editStock.stock} onChange={e => setEditStock(p => ({ ...p, stock: e.target.value }))}
                              className="w-20 border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A2F]" />
                          ) : (
                            <span className={`font-bold ${med.stock < 20 ? "text-rose-600" : "text-slate-800"}`}>
                              {med.stock} {med.stock < 20 && med.stock > 0 && <span className="text-[10px] bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full ml-1 font-black">Low</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleAvailability(med.id, med.stock)}
                            className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider transition-all ${med.stock > 0 ? "bg-[#E8F3ED] text-[#1E3A2F] border border-[#CDE3D5]" : "bg-rose-50 text-rose-600 border border-rose-200"}`}
                          >
                            {med.stock > 0 ? "Available" : "Out of Stock"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium">{med.sold}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {editingStock === med.id ? (
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveStock(med.id)} className="bg-[#1E3A2F] text-white text-xs px-3 py-1.5 rounded-lg font-bold">Save</button>
                                <button onClick={() => setEditingStock(null)} className="bg-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-lg font-bold">Cancel</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => { setEditingStock(med.id); setEditStock({ price: med.price.toString(), stock: med.stock.toString(), category: med.category || "" }); }}
                                  className="text-slate-400 hover:text-[#1E3A2F] p-1.5 rounded-lg hover:bg-[#E8F3ED] transition-colors">
                                  <Edit3 size={15} />
                                </button>
                                <button onClick={() => handleRemoveMedicine(med.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors">
                                  <X size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AI MAPPINGS TAB */}
        {tab === "ai-mappings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-1">AI Recommendation Mapping Review</h2>
              <p className="text-slate-500 text-xs md:text-sm font-medium">Verify how your current stock matches the AI Consultant categories. Only OTC non-prescription items with positive stock are mapped.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Mild Fever / Viral Symptoms", categories: ["Antipyretics", "Analgesics"], description: "Mapped to Antipyretics and Analgesics for temperature control and muscle aches." },
                { label: "Mild Headache / Pain", categories: ["Analgesics"], description: "Mapped to Analgesics for pain relief." },
                { label: "Common Cold & Flu", categories: ["Respiratory", "Analgesics", "Antipyretics"], description: "Multi-symptom mapping for cold/flu relief." },
                { label: "Cough (Dry or Productive)", categories: ["Respiratory"], description: "Mapped to Respiratory/Cough category." },
                { label: "Sore Throat / Irritation", categories: ["Respiratory", "Analgesics"], description: "Throat lozenges and oral antiseptics." },
                { label: "Nasal Congestion", categories: ["Respiratory"], description: "Decongestants and antihistamines." },
                { label: "Acidity / Heartburn / Indigestion", categories: ["Gastrointestinal"], description: "Mapped to Gastrointestinal antacids and digestive enzymes." },
                { label: "Seasonal Allergies", categories: ["Respiratory"], description: "Mapped to antihistamines under Respiratory." },
                { label: "Diarrhea", categories: ["Gastrointestinal"], description: "Oral rehydration salts and digestives." },
                { label: "Skin Rash & Irritation", categories: ["Dermatology"], description: "Soothing creams and dermatology products." },
              ].map((mapItem, idx) => {
                // Find local pharmacy items in stock that match these categories
                const matchingMeds = inventory.filter(med => 
                  mapItem.categories.some(cat => med.category?.toLowerCase() === cat.toLowerCase()) &&
                  med.stock > 0
                );

                return (
                  <div key={idx} className="bg-white rounded-3xl border border-[#E2EFE7] p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                          <Activity size={16} className="text-[#1E3A2F]" /> {mapItem.label}
                        </h3>
                        <div className="flex gap-1.5 flex-wrap">
                          {mapItem.categories.map(c => (
                            <span key={c} className="bg-[#E8F3ED] text-[#1E3A2F] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">{c}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-slate-505 text-xs mb-4 leading-relaxed font-medium">{mapItem.description}</p>
                      
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matched Active Stock ({matchingMeds.length})</p>
                        {matchingMeds.length === 0 ? (
                          <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl text-[11px] text-rose-600 font-medium italic">
                            ⚠️ No available products match this category in your inventory. Customer AI check won't suggest your store for this symptom.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {matchingMeds.map(m => {
                              // Prescription warnings
                              const isRx = m.name.toLowerCase().includes("amoxicillin") || m.name.toLowerCase().includes("prednisone") || m.name.toLowerCase().includes("insulin");
                              return (
                                <div key={m.id} className="flex justify-between items-center bg-[#F6FAF7] border border-[#E2EFE7] rounded-xl p-2.5 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800">{m.name}</span>
                                    {isRx && <span className="bg-rose-50 text-rose-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Rx Only</span>}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-black text-[#1E3A2F] mr-2">₹{m.price}</span>
                                    <span className="text-slate-500 font-bold">{m.stock} left</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[32px] border border-[#E2EFE7] p-8 shadow-sm">
              <h3 className="font-serif font-bold text-xl text-slate-900 mb-4">Revenue Breakdown</h3>
              <p className="text-3xl font-black text-[#1E3A2F] mb-4">₹{totalRevenue.toLocaleString()}</p>
              <p className="text-slate-500 text-sm leading-relaxed">Generated across {inventory.reduce((a, b) => a + (b.sold || 0), 0)} unit deliveries through MediFind network.</p>
            </div>
            <div className="bg-white rounded-[32px] border border-[#E2EFE7] p-8 shadow-sm">
              <h3 className="font-serif font-bold text-xl text-slate-900 mb-4">Top Dispensed Items</h3>
              <div className="space-y-3">
                {inventory.slice(0, 4).map(m => (
                  <div key={m.id} className="flex justify-between items-center py-2 border-b border-[#E2EFE7] text-sm">
                    <span className="font-bold text-slate-800">{m.name}</span>
                    <span className="font-black text-[#1E3A2F]">{m.sold} units</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="bg-white rounded-[32px] border border-[#E2EFE7] shadow-sm p-8 max-w-2xl">
            <h2 className="font-serif font-bold text-slate-900 text-2xl mb-2">Pharmacy Settings ⚙️</h2>
            <p className="text-slate-500 text-sm mb-6">Manage your shop availability, working hours, and contact information.</p>
            
            {settingsSaved && (
              <div className="mb-6 bg-[#E8F3ED] border border-[#CDE3D5] text-[#1E3A2F] text-xs font-bold p-4 rounded-2xl flex items-center gap-2">
                <CheckCircle size={16} /> Settings saved and synced with customer search!
              </div>
            )}
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Pharmacy Name</label>
                <input type="text" value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
                  className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Location / Address</label>
                <input type="text" value={settings.location} onChange={e => setSettings(s => ({ ...s, location: e.target.value }))}
                  className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Phone Number</label>
                <input type="text" value={settings.phone} onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))}
                  className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Opening Time</label>
                  <input type="text" value={settings.openingTime} onChange={e => setSettings(s => ({ ...s, openingTime: e.target.value }))}
                    placeholder="9:00 AM" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Closing Time</label>
                  <input type="text" value={settings.closingTime} onChange={e => setSettings(s => ({ ...s, closingTime: e.target.value }))}
                    placeholder="9:00 PM" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
                </div>
              </div>
              <div className="pt-3">
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Shop Availability Status</label>
                <button type="button" onClick={() => setSettings(s => ({ ...s, isAvailable: !s.isAvailable }))}
                  className={`flex items-center gap-4 w-full p-4 rounded-2xl border transition-all ${settings.isAvailable ? "bg-[#E8F3ED] border-[#CDE3D5] text-[#1E3A2F]" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                  {settings.isAvailable ? <ToggleRight size={32} className="text-emerald-700 shrink-0" /> : <ToggleLeft size={32} className="text-slate-400 shrink-0" />}
                  <div className="text-left">
                    <p className="font-black text-sm">{settings.isAvailable ? "Pharmacy is OPEN for Online Orders" : "Pharmacy is CLOSED"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{settings.isAvailable ? "Open and accepting orders on customer website" : "Marked closed on customer search map"}</p>
                  </div>
                </button>
              </div>
              <button onClick={handleSaveSettings} disabled={settingsSaving}
                className="mt-6 w-full bg-[#1E3A2F] hover:bg-[#152a22] text-white font-bold py-3.5 rounded-full text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95">
                <Save size={16} /> {settingsSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REASSIGN RIDER MODAL */}
      {reassignModalOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-serif font-bold text-slate-900 text-xl">Assign / Reassign Rider 🚴</h3>
                <p className="text-xs text-slate-500 font-medium">Order #{reassignModalOrder.id.slice(-6)} • {reassignModalOrder.customer}</p>
              </div>
              <button onClick={() => setReassignModalOrder(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto my-4 pr-1">
              {riders.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">No riders registered in database.</p>
              ) : (
                riders.map(r => (
                  <div key={r.id} className="p-4 rounded-2xl border border-[#E2EFE7] hover:bg-[#F6FAF7] transition-all flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{r.name || r.email}</span>
                        <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star size={10} fill="currentColor" /> {r.riderRating?.toFixed(1) || "5.0"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Vehicle: {r.vehicleType || "Motorcycle"} • Delivered: {r.completedDeliveries || 0}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReassignRider(reassignModalOrder.realId || reassignModalOrder.id, r.id)}
                      disabled={reassigning}
                      className="bg-[#1E3A2F] hover:bg-[#152a22] text-white text-xs font-bold px-5 py-2 rounded-full shadow-sm transition-all active:scale-95 disabled:opacity-50 uppercase tracking-wider"
                    >
                      {reassigning ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button onClick={() => setReassignModalOrder(null)} className="px-6 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEDICINE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif font-bold text-slate-900 text-xl">Add New Medicine 💊</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddMedicine} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Medicine Name</label>
                <input type="text" required value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Paracetamol 500mg" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Category</label>
                <input type="text" required value={newMed.category} onChange={e => setNewMed(p => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Analgesics" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Price (₹)</label>
                  <input type="number" step="0.01" required value={newMed.price} onChange={e => setNewMed(p => ({ ...p, price: e.target.value }))}
                    placeholder="25.00" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Stock Qty</label>
                  <input type="number" required value={newMed.stock} onChange={e => setNewMed(p => ({ ...p, stock: e.target.value }))}
                    placeholder="50" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-[#1E3A2F] hover:bg-[#152a22] text-white font-bold py-3.5 rounded-full text-xs uppercase tracking-wider shadow-lg transition-all">Add to Stock</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="bg-slate-100 text-slate-600 font-bold px-6 py-3.5 rounded-full text-xs uppercase tracking-wider">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
