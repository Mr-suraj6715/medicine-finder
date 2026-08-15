"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, Package, LogOut, Store, Bell, TrendingUp,
  Plus, CheckCircle, X, ChevronRight, Pill, Clock,
  ShoppingCart, BarChart3, Settings, AlertCircle, Users, Edit3, Activity,
  MapPin, Navigation, Save, Phone, ToggleLeft, ToggleRight, UserCheck, RefreshCw, Star
} from "lucide-react";

type AuthUser = { id: string; email: string; name: string; role: string };

const STATUS_OPTIONS = ["PENDING", "PROCESSING", "CONFIRMED", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "OUT_FOR_DELIVERY", "DELIVERED"];
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
};

export default function ShopDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<"orders" | "inventory" | "analytics" | "settings">("orders");
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
          name: inv.medicine.name,
          category: inv.medicine.category || "-",
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
    const stored = localStorage.getItem("medifind_user_shop_owner") || localStorage.getItem("medifind_user");
    if (!stored) { window.location.href = "/"; return; }
    try {
      const u = JSON.parse(stored);
      if (u.role !== "shop_owner") {
        if (u.role === "rider") window.location.href = "/dashboard/rider";
        else if (u.role === "user") window.location.href = "/dashboard/user";
        else window.location.href = "/";
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
    } catch { window.location.href = "/"; }
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

  const totalRevenue = inventory.reduce((a, m) => a + m.price * m.sold, 0);
  const pendingOrders = orders.filter(o => o.status === "PENDING").length;
  const totalItems = inventory.reduce((a, m) => a + m.stock, 0);
  const lowStock = inventory.filter(m => m.stock < 20).length;

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
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-sky-500 to-green-500 p-1.5 rounded-lg text-white"><HeartPulse size={18} /></div>
              <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-green-600">MediFind</span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5"><Store size={14} className="text-sky-500" /> Shop Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Availability status badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${settings.isAvailable ? "bg-green-50 border-green-200" : "bg-slate-100 border-slate-200"}`}>
              <span className={`w-2 h-2 rounded-full ${settings.isAvailable ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}></span>
              <span className={`font-bold text-xs ${settings.isAvailable ? "text-green-700" : "text-slate-500"}`}>{settings.isAvailable ? "Shop Open" : "Shop Closed"}</span>
            </div>
            {pendingOrders > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-sm">
                <Bell size={13} className="text-amber-500" />
                <span className="font-bold text-amber-700">{pendingOrders} new</span>
              </div>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors">
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Shop Dashboard 🏪</h1>
            <p className="text-slate-500 text-sm mt-0.5">{user.name} • {user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: TrendingUp, label: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, color: "text-green-500 bg-green-50" },
            { icon: ShoppingCart, label: "Pending Orders", value: pendingOrders, color: "text-amber-500 bg-amber-50" },
            { icon: Package, label: "Items in Stock", value: totalItems, color: "text-sky-500 bg-sky-50" },
            { icon: AlertCircle, label: "Low Stock Alert", value: lowStock, color: "text-rose-500 bg-rose-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icon size={18} /></div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 overflow-x-auto w-fit">
          {[
            { id: "orders", label: "Orders", icon: ShoppingCart },
            { id: "inventory", label: "Inventory", icon: Package },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
            { id: "settings", label: "Settings", icon: Settings },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${tab === t.id ? "bg-white shadow text-sky-600" : "text-slate-500 hover:text-slate-700"}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-slate-900">Incoming Orders</h2>
            </div>
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">#{order.id.slice(-6)}</code>
                      {order.isEmergency && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                          <Activity size={10} /> EMERGENCY
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900">{order.customer}</p>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5"><MapPin size={12} className="text-slate-400" /> {order.customerAddress}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={11} /> {order.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xl text-slate-900">₹{(order.total + (order.isEmergency ? order.surgeFee : 0)).toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                    {order.isEmergency && <p className="text-[10px] text-rose-500 font-bold mt-1">Surcharge: ₹{order.surgeFee}</p>}
                  </div>
                </div>

                {/* Rider assignment & cancellation banner */}
                <div className="mb-4 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                  {order.riderName ? (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-slate-700">
                        <UserCheck size={15} className="text-sky-600" />
                        <div>
                          <span className="font-bold text-slate-900">Assigned Rider: {order.riderName}</span>
                          {order.riderRating && <span className="text-amber-500 font-bold ml-2">⭐ {order.riderRating.toFixed(1)}</span>}
                          {order.riderPhone && <span className="text-slate-500 ml-2">({order.riderPhone})</span>}
                        </div>
                      </div>
                      {order.status !== "DELIVERED" && (
                        <button
                          onClick={() => setReassignModalOrder(order)}
                          className="text-[10px] font-black bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw size={10} /> Reassign Rider
                        </button>
                      )}
                    </div>
                  ) : order.cancelledRiderName ? (
                    <div className="flex justify-between items-center">
                      <div className="text-rose-600 font-medium">
                        ⚠️ Order cancelled by previous rider <strong>({order.cancelledRiderName})</strong>. Available for reassignment!
                      </div>
                      <button
                        onClick={() => setReassignModalOrder(order)}
                        className="text-[10px] font-black bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                      >
                        <UserCheck size={11} /> Assign Available Rider
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">No specific rider assigned yet (Available to all riders)</span>
                      {order.status !== "DELIVERED" && (
                        <button
                          onClick={() => setReassignModalOrder(order)}
                          className="text-[10px] font-black bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                        >
                          <UserCheck size={11} /> Directly Assign Rider
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-xl p-2.5 text-sm">
                      <div className="flex items-center gap-2"><Pill size={14} className="text-sky-500" /> <span className="font-medium text-slate-700">{item.name}</span></div>
                      <span className="text-slate-500">×{item.qty} — ₹{(item.price * item.qty).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  {order.status !== "DELIVERED" ? (
                    order.status === "PENDING" ? (
                      <button
                        onClick={() => updateOrderStatus(order.realId || order.id, "PROCESSING")}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs shadow-xl transition-all active:scale-95 ${order.isEmergency ? "bg-rose-600 text-white shadow-rose-200" : "bg-sky-600 text-white shadow-sky-200"}`}
                      >
                        <CheckCircle size={14} /> Accept & Prepare
                      </button>
                    ) : order.status === "PROCESSING" ? (
                      <button
                        onClick={() => updateOrderStatus(order.realId || order.id, "CONFIRMED")}
                        className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl font-black text-xs shadow-xl bg-amber-500 text-white transition-all active:scale-95"
                      >
                        <div className="flex items-center gap-2"><Package size={14} /> Mark as Packed</div>
                        <span className="text-[9px] opacity-80">(Triggers Rider Request)</span>
                      </button>
                    ) : null
                  ) : (
                    <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold"><CheckCircle size={13} /> Order completed</span>
                  )}

                  {order.status !== "DELIVERED" && order.status !== "PENDING" && order.status !== "PROCESSING" && (
                    <div className="flex items-center justify-between w-full group">
                      <div className="flex items-center gap-2 px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-sky-100 italic">
                        <Navigation size={12} className="animate-pulse" />
                        {order.status === "CONFIRMED" && "Awaiting Rider Acceptance"}
                        {order.status === "RIDER_ASSIGNED" && "Rider Heading to Pharmacy"}
                        {order.status === "RIDER_AT_PHARMACY" && "Rider at your Store"}
                        {order.status === "RIDER_PICKED_UP" && "Rider Picked Up Order"}
                        {order.status === "OUT_FOR_DELIVERY" && "Out for Delivery"}
                        {order.status === "REACHED_CUSTOMER" && "Rider Reached Customer"}
                      </div>
                      {(order.status === "REACHED_CUSTOMER" || order.status === "OUT_FOR_DELIVERY") && (
                        <button
                          onClick={() => updateOrderStatus(order.realId || order.id, "DELIVERED")}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs shadow-xl bg-green-600 text-white shadow-green-200 transition-all active:scale-95 ml-auto"
                        >
                          <CheckCircle size={14} /> Finalize Delivered
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
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-black text-slate-900">Medicine Inventory</h2>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                <Plus size={15} /> Add Medicine
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">Medicine</th>
                      <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">Category</th>
                      <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">Price</th>
                      <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">Stock</th>
                      <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">Sold</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventory.map(med => (
                      <tr key={med.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center shrink-0"><Pill size={14} className="text-sky-500" /></div>
                            <span className="font-bold text-slate-900">{med.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {editingStock === med.id ? (
                            <input type="text" value={editStock.category} onChange={e => setEditStock(p => ({ ...p, category: e.target.value }))}
                              className="w-24 border border-sky-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
                          ) : med.category}
                        </td>
                        <td className="px-5 py-3.5">
                          {editingStock === med.id ? (
                            <input type="number" value={editStock.price} onChange={e => setEditStock(p => ({ ...p, price: e.target.value }))}
                              className="w-20 border border-sky-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
                          ) : <span className="font-bold text-slate-800">₹{med.price}</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {editingStock === med.id ? (
                            <input type="number" value={editStock.stock} onChange={e => setEditStock(p => ({ ...p, stock: e.target.value }))}
                              className="w-20 border border-sky-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
                          ) : (
                            <span className={`font-bold ${med.stock < 20 ? "text-rose-600" : "text-slate-800"}`}>
                              {med.stock} {med.stock < 20 && <span className="text-[10px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full ml-1">Low</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-medium">{med.sold}</td>
                        <td className="px-5 py-3.5">
                          {editingStock === med.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveStock(med.id)} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold">Save</button>
                              <button onClick={() => setEditingStock(null)} className="bg-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-lg font-bold">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingStock(med.id); setEditStock({ price: med.price.toString(), stock: med.stock.toString(), category: med.category || "" }); }}
                              className="text-slate-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-sky-50 transition-colors">
                              <Edit3 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
            <h2 className="font-black text-slate-900 text-lg mb-4">Pharmacy Settings ⚙️</h2>
            {settingsSaved && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <CheckCircle size={15} /> Settings saved successfully!
              </div>
            )}
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pharmacy Name</label>
                <input type="text" value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location / Address</label>
                <input type="text" value={settings.location} onChange={e => setSettings(s => ({ ...s, location: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input type="text" value={settings.phone} onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Time</label>
                  <input type="text" value={settings.openingTime} onChange={e => setSettings(s => ({ ...s, openingTime: e.target.value }))}
                    placeholder="9:00 AM" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Closing Time</label>
                  <input type="text" value={settings.closingTime} onChange={e => setSettings(s => ({ ...s, closingTime: e.target.value }))}
                    placeholder="9:00 PM" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Shop Availability Status</label>
                <button type="button" onClick={() => setSettings(s => ({ ...s, isAvailable: !s.isAvailable }))}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all ${settings.isAvailable ? "bg-green-50 border-green-200 text-green-800" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                  {settings.isAvailable ? <ToggleRight size={28} className="text-green-600 shrink-0" /> : <ToggleLeft size={28} className="text-slate-400 shrink-0" />}
                  <div className="text-left">
                    <p className="font-bold text-sm">{settings.isAvailable ? "Pharmacy is OPEN" : "Pharmacy is CLOSED"}</p>
                    <p className="text-xs text-slate-500">{settings.isAvailable ? "Visible and taking orders on customer website" : "Hidden / marked closed on customer website"}</p>
                  </div>
                </button>
              </div>
              <button onClick={handleSaveSettings} disabled={settingsSaving}
                className="mt-4 w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                <Save size={16} /> {settingsSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REASSIGN RIDER MODAL */}
      {reassignModalOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Assign / Reassign Rider 🚴</h3>
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
                  <div key={r.id} className="p-3.5 rounded-2xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all flex justify-between items-center">
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
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      {reassigning ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setReassignModalOrder(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEDICINE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-slate-900 text-lg">Add New Medicine 💊</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddMedicine} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medicine Name</label>
                <input type="text" required value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Paracetamol 500mg" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                <input type="text" required value={newMed.category} onChange={e => setNewMed(p => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Analgesics" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price (₹)</label>
                  <input type="number" step="0.01" required value={newMed.price} onChange={e => setNewMed(p => ({ ...p, price: e.target.value }))}
                    placeholder="25.00" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock Qty</label>
                  <input type="number" required value={newMed.stock} onChange={e => setNewMed(p => ({ ...p, stock: e.target.value }))}
                    placeholder="50" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all">Add to Inventory</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="bg-slate-100 text-slate-600 font-bold px-4 py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
