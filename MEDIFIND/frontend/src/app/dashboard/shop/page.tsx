"use client";
import { useState, useEffect, useCallback } from "react";
import {
  HeartPulse, Package, LogOut, Store, Bell, TrendingUp,
  Plus, CheckCircle, X, ChevronRight, Pill, Clock,
  ShoppingCart, BarChart3, Settings, AlertCircle, Users, Edit3, Activity,
  MapPin, Navigation
} from "lucide-react";

type AuthUser = { id: string; email: string; name: string; role: string };

const STATUS_OPTIONS = ["PENDING", "PROCESSING", "CONFIRMED", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "OUT_FOR_DELIVERY", "DELIVERED"];
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  CONFIRMED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  RIDER_ASSIGNED: "bg-sky-100 text-sky-700 border-sky-200",
  RIDER_AT_PHARMACY: "bg-cyan-100 text-cyan-700 border-cyan-200",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700 border-purple-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
};

// Demo inventory for shop owner
const DEMO_INVENTORY = [
  { id: "1", name: "Paracetamol 500mg", category: "Analgesics", price: 15, stock: 100, sold: 45 },
  { id: "2", name: "Amoxicillin 250mg", category: "Antibiotics", price: 85, stock: 30, sold: 18 },
  { id: "3", name: "Vitamin C 1000mg", category: "Supplements", price: 42, stock: 60, sold: 32 },
  { id: "4", name: "Dolo 650", category: "Analgesics", price: 28, stock: 75, sold: 55 },
  { id: "5", name: "Cetirizine 10mg", category: "Antihistamines", price: 22, stock: 50, sold: 20 },
  { id: "6", name: "ORS Powder", category: "Oral Rehydration", price: 18, stock: 200, sold: 80 },
];

const DEMO_ORDERS = [
  { id: "ORD-001", customer: "Rahul Sharma", items: [{ name: "Paracetamol 500mg", qty: 2, price: 15 }], total: 30, status: "PENDING", time: "2 mins ago" },
  { id: "ORD-002", customer: "Priya Mehta", items: [{ name: "Vitamin C 1000mg", qty: 3, price: 42 }], total: 126, status: "PROCESSING", time: "15 mins ago" },
  { id: "ORD-003", customer: "Amit Patel", items: [{ name: "Dolo 650", qty: 1, price: 28 }, { name: "Amoxicillin 250mg", qty: 1, price: 85 }], total: 113, status: "SHIPPED", time: "1 hr ago" },
  { id: "ORD-004", customer: "Sneha Gupta", items: [{ name: "ORS Powder", qty: 5, price: 18 }], total: 90, status: "DELIVERED", time: "3 hrs ago" },
];

export default function ShopDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<"orders" | "inventory" | "analytics" | "settings">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", category: "", price: "", stock: "" });
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editStock, setEditStock] = useState({ price: "", stock: "", category: "" });

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

  useEffect(() => {
    const stored = localStorage.getItem("medifind_user_shop_owner") || localStorage.getItem("medifind_user");
    if (!stored) { window.location.href = "/"; return; }
    try {
      const u = JSON.parse(stored);
      // Strictly verify role for this dashboard
      if (u.role !== "shop_owner") {
        if (u.role === "rider") window.location.href = "/dashboard/rider";
        else if (u.role === "user") window.location.href = "/dashboard/user";
        else window.location.href = "/";
        return;
      }

      setUser(u);
      fetchShopData(u.id);
      
      const interval = setInterval(() => fetchShopData(u.id), 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    } catch { window.location.href = "/"; }
  }, [fetchShopData]);

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
    } catch (err) {
      console.error("Failed to update status:", err);
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

  const handleSaveStock = async (id: string, realId?: string) => {
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
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-2 rounded-xl text-sm font-medium text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Shop is Open
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
              <div className="flex gap-2">
                {["ALL", "PENDING", "PROCESSING", "SHIPPED"].map(f => (
                  <button key={f} className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors">{f}</button>
                ))}
              </div>
            </div>
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">{order.id}</code>
                      {order.isEmergency && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                          <Activity size={10} /> EMERGENCY
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900">{order.customer}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} /> {order.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xl text-slate-900">₹{(order.total + (order.isEmergency ? order.surgeFee : 0)).toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                    {order.isEmergency && <p className="text-[10px] text-rose-500 font-bold mt-1">Surcharge: ₹{order.surgeFee}</p>}
                  </div>
                </div>
                <div className="space-y-1.5 mb-4">
                  {order.items.map((item, idx) => (
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
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs shadow-xl transition-all active:scale-95 ${
                          order.isEmergency ? "bg-rose-600 text-white shadow-rose-200" : "bg-sky-600 text-white shadow-sky-200"
                        }`}
                      >
                        <CheckCircle size={14} /> Accept & Prepare
                      </button>
                    ) : order.status === "PROCESSING" ? (
                      <button 
                        onClick={() => updateOrderStatus(order.realId || order.id, "CONFIRMED")}
                        className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl font-black text-xs shadow-xl bg-amber-500 text-white transition-all active:scale-95"
                      >
                        <div className="flex items-center gap-2">
                          <Package size={14} /> Mark as Packed
                        </div>
                        <span className="text-[9px] opacity-80">(Triggers Rider Request)</span>
                      </button>
                    ) : null
                  ) : (
                    <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold"><CheckCircle size={13} /> Order completed</span>
                  )}

                  {/* Supplemental actions — e.g. Finalize for Rider reached */}
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
                          ) : (
                            med.category
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {editingStock === med.id ? (
                            <input type="number" value={editStock.price} onChange={e => setEditStock(p => ({ ...p, price: e.target.value }))}
                              className="w-20 border border-sky-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
                          ) : (
                            <span className="font-bold text-slate-800">₹{med.price}</span>
                          )}
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

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="space-y-5">
            <h2 className="font-black text-slate-900">Sales Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2"><TrendingUp size={16} className="text-green-500" /> Revenue Breakdown</h3>
                <div className="space-y-3">
                  {inventory.map(m => (
                    <div key={m.id}>
                      <div className="flex justify-between text-xs font-medium mb-1"><span className="text-slate-700 truncate">{m.name}</span><span className="text-slate-500 shrink-0 ml-2">₹{(m.price * m.sold).toLocaleString()}</span></div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-green-400 rounded-full" style={{ width: `${Math.min((m.price * m.sold) / totalRevenue * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2"><BarChart3 size={16} className="text-sky-500" /> Order Summary</h3>
                <div className="space-y-3">
                  {STATUS_OPTIONS.map(s => {
                    const count = orders.filter(o => o.status === s).length;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s]} w-28 text-center`}>{s}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-400 rounded-full" style={{ width: `${(count / orders.length) * 100}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-700 w-4">{count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Total Orders</span><span className="font-black text-slate-900">{orders.length}</span></div>
                  <div className="flex justify-between text-sm mt-1"><span className="text-slate-500">Total Revenue</span><span className="font-black text-green-600">₹{totalRevenue.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2"><Package size={16} className="text-amber-500" /> Top Selling Products</h3>
                <div className="space-y-3">
                  {[...inventory].sort((a, b) => b.sold - a.sold).slice(0, 5).map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-400 w-4">#{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-700 truncate">{m.name}</p>
                        <p className="text-[11px] text-slate-400">{m.sold} units sold</p>
                      </div>
                      <span className="text-xs font-black text-green-600">₹{(m.price * m.sold).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-rose-500" /> Low Stock Alerts</h3>
                {inventory.filter(m => m.stock < 20).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle size={28} className="mx-auto mb-2 text-green-400" />
                    <p className="text-sm font-medium">All items well stocked!</p>
                  </div>
                ) : inventory.filter(m => m.stock < 20).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100 mb-2">
                    <div><p className="text-xs font-bold text-rose-800">{m.name}</p><p className="text-[11px] text-rose-500">{m.stock} units remaining</p></div>
                    <button onClick={() => { setTab("inventory"); setEditingStock(m.id); setEditStock({ price: m.price.toString(), stock: m.stock.toString(), category: m.category || "" }); }}
                      className="text-xs font-bold text-rose-600 hover:underline">Update</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="max-w-lg space-y-4">
            <h2 className="font-black text-slate-900">Shop Settings</h2>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 text-sm">Shop Information</h3>
              <div className="space-y-3">
                {[{ label: "Shop Name", placeholder: "MediStore Mumbai", val: user.name }, { label: "Owner", placeholder: "Full name", val: user.name }, { label: "Email", placeholder: "shop@example.com", val: user.email }, { label: "Phone", placeholder: "+91 00000 00000", val: "" }, { label: "Address", placeholder: "123, MG Road, Mumbai", val: "" }].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{f.label}</label>
                    <input defaultValue={f.val} placeholder={f.placeholder} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50" />
                  </div>
                ))}
                <button className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all mt-2">Save Changes</button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 text-sm">Shop Availability</h3>
              <div className="space-y-3">
                {[{ day: "Monday–Friday", time: "9:00 AM – 9:00 PM", open: true }, { day: "Saturday", time: "9:00 AM – 7:00 PM", open: true }, { day: "Sunday", time: "Closed", open: false }].map(d => (
                  <div key={d.day} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">{d.day}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${d.open ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>{d.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-7 relative animate-in fade-in zoom-in-95">
            <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"><X size={18} /></button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center"><Plus size={18} className="text-sky-600" /></div>
              <h2 className="font-black text-slate-900">Add New Medicine</h2>
            </div>
            <form onSubmit={handleAddMedicine} className="space-y-4">
              {[{ label: "Medicine Name", key: "name", placeholder: "e.g. Paracetamol 500mg" }, { label: "Category", key: "category", placeholder: "e.g. Analgesics" }, { label: "Price (₹)", key: "price", placeholder: "0.00", type: "number" }, { label: "Initial Stock", key: "stock", placeholder: "0", type: "number" }].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    placeholder={f.placeholder}
                    value={(newMed as any)[f.key]}
                    onChange={e => setNewMed(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                    required
                  />
                </div>
              ))}
              <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-bold text-sm transition-all">Add to Inventory</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
