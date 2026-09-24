"use client";
import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  HeartPulse, Package, LogOut, Store, Bell, TrendingUp,
  Plus, CheckCircle, X, ChevronRight, Pill, Clock,
  ShoppingCart, BarChart3, Settings, AlertCircle, Users, Edit3, Activity,
  MapPin, Navigation, Save, Phone, ToggleLeft, ToggleRight, UserCheck, RefreshCw, Star,
  Upload, Download, FileSpreadsheet, Check, ArrowRight, ArrowLeft, Trash2,
  HelpCircle, Info, Filter, Layers, CheckSquare, Sparkles, FileText, AlertTriangle
} from "lucide-react";
import { getStoredUser, clearAuthSession, getDashboardUrl, getAuthHeaders } from "@/lib/auth";

type AuthUser = { id: string; email: string; name: string; role: string };

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-800 border-blue-200",
  CONFIRMED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  PENDING_RIDER_ACCEPT: "bg-amber-50 text-amber-700 border-amber-200",
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
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "inventory" | "ai-mappings" | "analytics" | "settings">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [reassignModalOrder, setReassignModalOrder] = useState<any | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [assigningRiderId, setAssigningRiderId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", category: "", price: "", stock: "" });
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editStock, setEditStock] = useState({ price: "", stock: "", category: "" });

  // Multi-Step Medicine Inventory Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    name: "",
    genericName: "",
    category: "",
    batchNumber: "",
    stock: "",
    mrp: "",
    price: "",
    purchasePrice: "",
    expiryDate: "",
    manufacturer: "",
    supplier: "",
    stockLocation: "",
    description: "",
  });
  const [parsedRecords, setParsedRecords] = useState<Array<{
    id: string;
    name: string;
    genericName: string;
    category: string;
    batchNumber: string;
    stock: number;
    mrp: number | null;
    price: number;
    purchasePrice: number | null;
    expiryDate: string;
    manufacturer: string;
    supplier: string;
    stockLocation: string;
    description: string;
    status: "valid" | "update" | "error" | "duplicate";
    errors: string[];
    warnings: string[];
  }>>([]);
  const [filterTab, setFilterTab] = useState<"all" | "valid" | "update" | "error" | "duplicate">("all");
  const [conflictStrategy, setConflictStrategy] = useState<"update_add" | "replace" | "skip">("update_add");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    added: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);


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
      const resInv = await fetch(`/api/shop/inventory?pharmacyId=${userId}`, { headers: getAuthHeaders() });
      const dataInv = await resInv.json();
      if (dataInv.inventory) {
        setInventory(dataInv.inventory.map((inv: any) => ({
          id: inv.medicineId,
          realId: inv.id,
          name: inv.medicine?.name || "Medicine",
          genericName: inv.medicine?.genericName || "",
          category: inv.medicine?.category || "-",
          manufacturer: inv.medicine?.manufacturer || "",
          batchNumber: inv.batchNumber || "",
          mrp: inv.mrp || inv.price,
          purchasePrice: inv.purchasePrice,
          expiryDate: inv.expiryDate || "",
          supplier: inv.supplier || "",
          stockLocation: inv.stockLocation || "",
          price: inv.price,
          stock: inv.stock,
          sold: inv.sold || 0,
        })));
      }

      const resOrd = await fetch(`/api/shop/orders?pharmacyId=${userId}`, { headers: getAuthHeaders() });
      const dataOrd = await resOrd.json();
      if (dataOrd.orders) {
        setOrders(dataOrd.orders);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchRiders = useCallback(async () => {
    try {
      const res = await fetch('/api/shop/reassign', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.riders) setRiders(data.riders);
    } catch (e) { console.error(e); }
  }, []);

  const fetchSettings = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/shop/settings?pharmacyId=${userId}`, { headers: getAuthHeaders() });
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
    const u = getStoredUser();

    if (!u) {
      window.location.replace("/?auth=login&role=shop_owner");
      return;
    }

    if (u.role !== "shop_owner") {
      window.location.replace(getDashboardUrl(u.role));
      return;
    }

    setUser(u as any);
    setAuthLoading(false);
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
    clearAuthSession();
    window.location.replace("/?auth=login&role=shop_owner");
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      setOrders(prev => prev.map(o => (o.realId === orderId || o.id === orderId) ? { ...o, status } : o));
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId, status }),
      });
      if (!res.ok) throw new Error("API failed");
      if (user) fetchShopData(user.id);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleReassignRider = async (orderId: string, riderId: string) => {
    setAssigningRiderId(riderId);
    setReassigning(true);
    try {
      const res = await fetch('/api/shop/reassign', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId, riderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReassignModalOrder(null);
        if (user) fetchShopData(user.id);
        fetchRiders();
      } else {
        alert(data.detail || data.error || data.message || "Failed to assign rider");
      }
    } catch (e) {
      console.error(e);
      alert("Network error reassigning rider");
    } finally {
      setAssigningRiderId(null);
      setReassigning(false);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await fetch('/api/shop/inventory', {
        method: 'POST',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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

  // ── Column Definitions for Inventory Import ────────────────────────────
  const COLUMN_DEFINITIONS = [
    { key: "name", label: "Medicine Name", required: true, description: "Brand / trade name (e.g. Paracetamol 650mg)", patterns: [/medicine\s*name/i, /^medicine$/i, /^name$/i, /^brand$/i, /^item\s*name$/i, /^product/i, /^drug/i] },
    { key: "genericName", label: "Generic Name / Salt", required: false, description: "Active chemical molecule (e.g. Paracetamol)", patterns: [/generic/i, /salt/i, /composition/i, /molecule/i, /formula/i] },
    { key: "category", label: "Category", required: false, description: "Therapeutic category (e.g. Analgesics, Antibiotics)", patterns: [/category/i, /^class$/i, /^type$/i, /group/i] },
    { key: "batchNumber", label: "Batch Number", required: false, description: "Manufacturing lot / batch no. (e.g. BTH-8821)", patterns: [/batch/i, /lot/i, /bth/i] },
    { key: "stock", label: "Quantity / Stock", required: true, description: "Current units / boxes in hand", patterns: [/quantity/i, /^qty$/i, /^stock$/i, /units/i, /count/i, /pieces/i] },
    { key: "mrp", label: "MRP (₹)", required: false, description: "Maximum Retail Price printed on strip", patterns: [/mrp/i, /maximum\s*retail/i] },
    { key: "price", label: "Selling Price / Rate (₹)", required: true, description: "Your selling rate to customers", patterns: [/selling\s*price/i, /^rate$/i, /^price$/i, /sale\s*price/i] },
    { key: "purchasePrice", label: "Purchase Price (₹)", required: false, description: "Wholesale cost paid to distributor", patterns: [/purchase/i, /cost/i, /buy\s*price/i, /^cp$/i] },
    { key: "expiryDate", label: "Expiry Date", required: false, description: "Expiry date (YYYY-MM-DD or MM/YY)", patterns: [/expir/i, /^exp$/i, /shelf\s*life/i, /validity/i] },
    { key: "manufacturer", label: "Manufacturer", required: false, description: "Pharma manufacturing company (e.g. Cipla, Sun Pharma)", patterns: [/manufacturer/i, /mfg/i, /^company$/i, /^make$/i, /producer/i] },
    { key: "supplier", label: "Supplier / Distributor", required: false, description: "Distributor / vendor who supplied goods", patterns: [/supplier/i, /vendor/i, /distributor/i, /dealer/i] },
    { key: "stockLocation", label: "Stock Location", required: false, description: "Physical rack / shelf / bin inside shop", patterns: [/location/i, /^rack$/i, /^shelf$/i, /bin/i, /aisle/i, /storage/i] },
    { key: "description", label: "Description / Notes", required: false, description: "Indications, dosage form or store notes", patterns: [/desc/i, /detail/i, /indication/i, /note/i] },
  ];

  const SAMPLE_MEDICINE_DATA = [
    {
      "Medicine Name": "Paracetamol 650mg",
      "Generic Name": "Paracetamol",
      "Category": "Analgesics",
      "Batch Number": "BTH-8821",
      "Quantity": 150,
      "MRP": 35.00,
      "Purchase Price": 24.50,
      "Selling Price": 32.00,
      "Expiry Date": "2027-12-31",
      "Manufacturer": "Micro Labs",
      "Supplier": "Apex Pharma",
      "Stock Location": "Shelf A-12",
      "Description": "Fast relief for fever and body ache"
    },
    {
      "Medicine Name": "Amoxicillin 500mg",
      "Generic Name": "Amoxicillin Trihydrate",
      "Category": "Antibiotics",
      "Batch Number": "AMX-4402",
      "Quantity": 60,
      "MRP": 95.00,
      "Purchase Price": 68.00,
      "Selling Price": 85.00,
      "Expiry Date": "2026-10-31",
      "Manufacturer": "Alkem Labs",
      "Supplier": "MediDistributors",
      "Stock Location": "Rack B-04",
      "Description": "Broad-spectrum antibacterial capsule"
    },
    {
      "Medicine Name": "Cetirizine 10mg",
      "Generic Name": "Cetirizine Dihydrochloride",
      "Category": "Antiallergic",
      "Batch Number": "CTZ-1099",
      "Quantity": 120,
      "MRP": 28.00,
      "Purchase Price": 18.00,
      "Selling Price": 24.00,
      "Expiry Date": "2028-03-31",
      "Manufacturer": "Dr. Reddy's",
      "Supplier": "Sunrise Agencies",
      "Stock Location": "Shelf A-03",
      "Description": "Antihistamine for seasonal cold and sneezing"
    },
    {
      "Medicine Name": "Pantoprazole 40mg",
      "Generic Name": "Pantoprazole Sodium",
      "Category": "Gastrointestinal",
      "Batch Number": "PNT-9931",
      "Quantity": 80,
      "MRP": 75.00,
      "Purchase Price": 52.00,
      "Selling Price": 68.00,
      "Expiry Date": "2027-08-31",
      "Manufacturer": "Sun Pharma",
      "Supplier": "Apex Pharma",
      "Stock Location": "Shelf C-02",
      "Description": "Proton pump inhibitor for acidity and heartburn"
    },
    {
      "Medicine Name": "Metformin 500mg",
      "Generic Name": "Metformin Hydrochloride",
      "Category": "Antidiabetics",
      "Batch Number": "MET-7120",
      "Quantity": 200,
      "MRP": 45.00,
      "Purchase Price": 29.00,
      "Selling Price": 38.00,
      "Expiry Date": "2028-01-31",
      "Manufacturer": "USV Private Ltd",
      "Supplier": "Global Healthcare",
      "Stock Location": "Rack B-09",
      "Description": "Oral blood glucose regulation for type 2 diabetes"
    },
    {
      "Medicine Name": "Azithromycin 500mg",
      "Generic Name": "Azithromycin",
      "Category": "Antibiotics",
      "Batch Number": "AZI-3301",
      "Quantity": 45,
      "MRP": 135.00,
      "Purchase Price": 96.00,
      "Selling Price": 120.00,
      "Expiry Date": "2026-11-30",
      "Manufacturer": "Cipla",
      "Supplier": "Sunrise Agencies",
      "Stock Location": "Rack B-05",
      "Description": "Macrolide antibiotic strip for respiratory infections"
    },
    {
      "Medicine Name": "Vitamin C 500mg Chewable",
      "Generic Name": "Ascorbic Acid",
      "Category": "Supplements",
      "Batch Number": "VTC-6012",
      "Quantity": 100,
      "MRP": 48.00,
      "Purchase Price": 31.50,
      "Selling Price": 42.00,
      "Expiry Date": "2027-05-31",
      "Manufacturer": "Abbott",
      "Supplier": "MediDistributors",
      "Stock Location": "Counter Display",
      "Description": "Daily immunity booster chewable orange tablets"
    },
    {
      "Medicine Name": "Ibuprofen 400mg",
      "Generic Name": "Ibuprofen",
      "Category": "Analgesics",
      "Batch Number": "IBU-2210",
      "Quantity": 90,
      "MRP": 42.00,
      "Purchase Price": 28.00,
      "Selling Price": 38.00,
      "Expiry Date": "2027-09-30",
      "Manufacturer": "Cipla",
      "Supplier": "Apex Pharma",
      "Stock Location": "Shelf A-14",
      "Description": "Non-steroidal anti-inflammatory analgesic"
    }
  ];

  const downloadSampleExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_MEDICINE_DATA);
      const colWidths = Object.keys(SAMPLE_MEDICINE_DATA[0]).map(key => ({ wch: Math.max(key.length, 16) }));
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Medicines");
      XLSX.writeFile(wb, "medifind_sample_inventory.xlsx");
    } catch (e) {
      console.error(e);
      alert("Failed to generate Excel template");
    }
  };

  const downloadSampleCSV = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(SAMPLE_MEDICINE_DATA);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "medifind_sample_inventory.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate CSV template");
    }
  };

  const handleExportCSV = () => {
    if (!inventory || inventory.length === 0) {
      alert("No inventory to export.");
      return;
    }
    const headers = "Medicine Name,Generic Name,Category,Batch Number,Quantity,MRP,Selling Price,Purchase Price,Expiry Date,Manufacturer,Supplier,Stock Location,Sold\n";
    const rows = inventory.map(item => [
      `"${(item.name || "").replace(/"/g, '""')}"`,
      `"${(item.genericName || "").replace(/"/g, '""')}"`,
      `"${(item.category || "").replace(/"/g, '""')}"`,
      `"${(item.batchNumber || "").replace(/"/g, '""')}"`,
      item.stock || 0,
      item.mrp || item.price || 0,
      item.price || 0,
      item.purchasePrice || 0,
      `"${item.expiryDate || ""}"`,
      `"${(item.manufacturer || "").replace(/"/g, '""')}"`,
      `"${(item.supplier || "").replace(/"/g, '""')}"`,
      `"${(item.stockLocation || "").replace(/"/g, '""')}"`,
      item.sold || 0
    ].join(",")).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_${settings.name ? settings.name.replace(/\s+/g, '_') : "medstore"}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const autoDetectColumns = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    COLUMN_DEFINITIONS.forEach(def => {
      const match = headers.find(h => {
        if (usedHeaders.has(h)) return false;
        return def.patterns.some(p => p.test(h.trim()));
      });
      if (match) {
        mapping[def.key] = match;
        usedHeaders.add(match);
      } else {
        mapping[def.key] = "";
      }
    });

    if (!mapping.name && headers.length > 0) mapping.name = headers[0];
    if (!mapping.stock) {
      const fallbackStock = headers.find(h => /qty|stock|count|unit/i.test(h) && !usedHeaders.has(h));
      if (fallbackStock) mapping.stock = fallbackStock;
    }
    if (!mapping.price) {
      const fallbackPrice = headers.find(h => /price|rate|mrp|cost/i.test(h) && !usedHeaders.has(h));
      if (fallbackPrice) mapping.price = fallbackPrice;
    }

    return mapping;
  };

  const handleSpreadsheetFile = (file: File) => {
    setImportFile(file);
    setImportError(null);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer || buffer.byteLength === 0) {
          setImportError("Uploaded file is empty.");
          return;
        }
        const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setImportError("The uploaded file does not contain any sheets.");
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!sheetData || sheetData.length < 2) {
          setImportError("Spreadsheet must contain a header row and at least one medicine row.");
          return;
        }

        const headers = sheetData[0].map(h => String(h ?? "").trim()).filter(Boolean);
        if (headers.length === 0) {
          setImportError("Could not detect any column headers in row 1.");
          return;
        }

        const dataRows = sheetData.slice(1).filter(row => row.some(cell => String(cell ?? "").trim() !== ""));
        if (dataRows.length === 0) {
          setImportError("No data rows found below the header row.");
          return;
        }

        setRawHeaders(headers);
        setRawRows(dataRows);

        const detected = autoDetectColumns(headers);
        setColumnMapping(detected);
        setImportStep(2);
      } catch (err: any) {
        console.error(err);
        setImportError(err.message || "Failed to read Excel / CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateAndValidateRecords = (mapping: Record<string, string>, rows: any[][]) => {
    const records: typeof parsedRecords = [];
    const seenMedicineKeys = new Set<string>();

    rows.forEach((row, i) => {
      const getVal = (fieldKey: string) => {
        const colName = mapping[fieldKey];
        if (!colName) return "";
        const idx = rawHeaders.indexOf(colName);
        return idx !== -1 ? String(row[idx] ?? "").trim() : "";
      };

      const name = getVal("name");
      const genericName = getVal("genericName");
      const category = getVal("category") || "General";
      const batchNumber = getVal("batchNumber");
      const rawStock = getVal("stock");
      const rawPrice = getVal("price");
      const rawMrp = getVal("mrp");
      const rawPurchase = getVal("purchasePrice");
      const expiryDate = getVal("expiryDate");
      const manufacturer = getVal("manufacturer");
      const supplier = getVal("supplier");
      const stockLocation = getVal("stockLocation");
      const description = getVal("description");

      const stockNum = parseInt(rawStock, 10);
      const priceNum = parseFloat(rawPrice);
      const mrpNum = rawMrp ? parseFloat(rawMrp) : null;
      const purchaseNum = rawPurchase ? parseFloat(rawPurchase) : null;

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validation
      if (!name) {
        errors.push("Medicine Name is required");
      }
      if (rawStock === "" || isNaN(stockNum) || stockNum < 0) {
        errors.push("Quantity must be 0 or a positive number");
      }
      if (rawPrice === "" || isNaN(priceNum) || priceNum < 0) {
        errors.push("Selling Price must be a valid positive number");
      }
      if (mrpNum !== null && !isNaN(mrpNum) && mrpNum < priceNum) {
        warnings.push("MRP is lower than selling price");
      }

      // Expiry check
      if (expiryDate) {
        const parsedExp = new Date(expiryDate);
        if (!isNaN(parsedExp.getTime()) && parsedExp < new Date()) {
          warnings.push(`Medicine expired on ${expiryDate}`);
        }
      }

      // Distinguish true duplicates: same medicine name AND same batch number (or same name if no batch)
      const dedupeKey = `${name.toLowerCase()}:::${batchNumber ? batchNumber.toLowerCase() : "__no_batch__"}`;
      const isSubsequentDuplicate = seenMedicineKeys.has(dedupeKey);
      if (name) seenMedicineKeys.add(dedupeKey);

      const existsInInventory = name && inventory.some(item => (item.name || "").trim().toLowerCase() === name.toLowerCase());

      // Status determination
      let status: "valid" | "update" | "error" | "duplicate" = "valid";

      if (errors.length > 0) {
        status = "error";
      } else if (isSubsequentDuplicate) {
        status = "duplicate";
        warnings.push("Duplicate entry in file with identical name and batch");
      } else if (existsInInventory) {
        status = "update";
        warnings.push("Already in shop stock; existing inventory will be updated");
      }

      records.push({
        id: `rec-${i}`,
        name,
        genericName,
        category,
        batchNumber,
        stock: isNaN(stockNum) ? 0 : stockNum,
        mrp: mrpNum !== null && !isNaN(mrpNum) ? mrpNum : null,
        price: isNaN(priceNum) ? 0 : priceNum,
        purchasePrice: purchaseNum !== null && !isNaN(purchaseNum) ? purchaseNum : null,
        expiryDate,
        manufacturer,
        supplier,
        stockLocation,
        description,
        status,
        errors,
        warnings,
      });
    });

    setParsedRecords(records);
  };

  const handleStartEditing = (record: any) => {
    setEditingRowId(record.id);
    setEditFormData({
      name: record.name,
      genericName: record.genericName,
      category: record.category,
      batchNumber: record.batchNumber,
      stock: record.stock,
      price: record.price,
      mrp: record.mrp || "",
      expiryDate: record.expiryDate,
      stockLocation: record.stockLocation,
    });
  };

  const handleSaveInlineEdit = (id: string) => {
    setParsedRecords(prev => prev.map(rec => {
      if (rec.id !== id) return rec;

      const name = String(editFormData.name || "").trim();
      const stockNum = parseInt(String(editFormData.stock), 10);
      const priceNum = parseFloat(String(editFormData.price));
      const mrpNum = editFormData.mrp ? parseFloat(String(editFormData.mrp)) : null;

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!name) errors.push("Medicine Name is required");
      if (isNaN(stockNum) || stockNum < 0) errors.push("Quantity must be >= 0");
      if (isNaN(priceNum) || priceNum < 0) errors.push("Price must be >= 0");

      const existsInInventory = name && inventory.some(item => (item.name || "").trim().toLowerCase() === name.toLowerCase());

      let status: "valid" | "update" | "error" | "duplicate" = "valid";
      if (errors.length > 0) status = "error";
      else if (existsInInventory) {
        status = "update";
        warnings.push("Already in shop stock; existing inventory will be updated");
      }

      return {
        ...rec,
        name,
        genericName: editFormData.genericName || "",
        category: editFormData.category || "General",
        batchNumber: editFormData.batchNumber || "",
        stock: isNaN(stockNum) ? 0 : stockNum,
        price: isNaN(priceNum) ? 0 : priceNum,
        mrp: mrpNum !== null && !isNaN(mrpNum) ? mrpNum : null,
        expiryDate: editFormData.expiryDate || "",
        stockLocation: editFormData.stockLocation || "",
        status,
        errors,
        warnings
      };
    }));
    setEditingRowId(null);
  };

  const handleDeleteRecord = (id: string) => {
    setParsedRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleExecuteImport = async () => {
    if (!user) return;
    const validItems = parsedRecords.filter(r => r.status === "valid" || r.status === "update");
    if (validItems.length === 0) {
      alert("No valid records to import. Please correct errors or check your column mapping.");
      return;
    }

    setImportLoading(true);
    setImportError(null);

    try {
      const token = localStorage.getItem("medifind_token");
      const payload = {
        pharmacyId: user.id,
        conflictStrategy,
        items: validItems.map(item => ({
          name: item.name,
          genericName: item.genericName || undefined,
          category: item.category || "General",
          batchNumber: item.batchNumber || undefined,
          stock: item.stock,
          mrp: item.mrp !== null ? item.mrp : undefined,
          price: item.price,
          purchasePrice: item.purchasePrice !== null ? item.purchasePrice : undefined,
          expiryDate: item.expiryDate || undefined,
          manufacturer: item.manufacturer || undefined,
          supplier: item.supplier || undefined,
          stockLocation: item.stockLocation || undefined,
          description: item.description || undefined,
        }))
      };

      const res = await fetch("/api/shop/inventory/bulk-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Bulk import failed.");
      }

      setImportSummary({
        total: data.totalProcessed || validItems.length,
        added: data.added || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        failed: data.failed || 0,
        errors: data.errors || []
      });

      setImportStep(4);
      fetchShopData(user.id);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Failed to process bulk import.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/shop/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
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

  if (authLoading || !user) return (
    <div className="min-h-screen bg-[#F6FAF7] flex flex-col items-center justify-center">
      <div className="bg-[#1E3A2F] p-3.5 rounded-2xl text-white shadow-xl animate-bounce mb-4">
        <HeartPulse size={32} />
      </div>
      <p className="text-[#1E3A2F] font-bold animate-pulse text-sm">Verifying Shop Owner Authorization...</p>
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
                    {order.customerPhone && <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5"><Phone size={11} className="text-slate-400" /> {order.customerPhone}</p>}
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
                  {order.status === "PENDING_RIDER_ACCEPT" ? (
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                        <span className="font-bold text-amber-800">Awaiting rider acceptance</span>
                        {order.riderName && <span className="text-slate-500 ml-1">→ {order.riderName}</span>}
                      </div>
                      <button
                        onClick={() => setReassignModalOrder(order)}
                        className="text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors uppercase tracking-wider"
                      >
                        <RefreshCw size={11} /> Reassign
                      </button>
                    </div>
                  ) : order.riderName && order.status !== "PENDING_RIDER_ACCEPT" ? (
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <UserCheck size={16} className="text-[#1E3A2F]" />
                        <div>
                          <span className="font-bold text-slate-900">Rider: {order.riderName}</span>
                          {order.riderRating && <span className="text-amber-500 font-bold ml-2">⭐ {order.riderRating.toFixed(1)}</span>}
                          {order.riderPhone && <span className="text-slate-500 ml-2 flex items-center gap-1 inline-flex"><Phone size={10}/> {order.riderPhone}</span>}
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
                        ⚠️ Rider <strong>{order.cancelledRiderName}</strong> rejected/released this order.
                      </div>
                      <button
                        onClick={() => setReassignModalOrder(order)}
                        className="text-[10px] font-black bg-[#1E3A2F] hover:bg-[#152a22] text-white px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm uppercase tracking-wider"
                      >
                        <UserCheck size={11} /> Assign Another Rider
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-slate-500 font-medium">No rider assigned yet</span>
                      {order.status !== "DELIVERED" && (
                        <button
                          onClick={() => setReassignModalOrder(order)}
                          className="text-[10px] font-black bg-[#1E3A2F] hover:bg-[#152a22] text-white px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm uppercase tracking-wider"
                        >
                          <UserCheck size={11} /> Assign Rider
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
                        {order.status === "CONFIRMED" && "Packed — Open for Riders"}
                        {order.status === "PENDING_RIDER_ACCEPT" && "Awaiting Rider Acceptance"}
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-slate-900">Medicine Catalog & Stock</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Manage stock individually or bulk-upload thousands of medicines with CSV.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                  title="Download your entire inventory as CSV"
                >
                  <Download size={14} className="text-slate-500" /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(true);
                    setImportStep(1);
                    setImportFile(null);
                    setRawHeaders([]);
                    setRawRows([]);
                    setParsedRecords([]);
                    setImportSummary(null);
                    setImportError(null);
                  }}
                  className="flex items-center gap-2 bg-[#1E3A2F] hover:bg-[#152a22] text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <FileSpreadsheet size={15} className="text-emerald-300" /> Import Inventory
                  <span className="text-[10px] bg-emerald-700/80 text-emerald-200 px-2 py-0.5 rounded-full font-bold">Excel / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                >
                  <Plus size={15} /> Add Single
                </button>
              </div>
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
                            <input type="number" step="0.01" min="0" value={editStock.price} onChange={e => setEditStock(p => ({ ...p, price: e.target.value }))}
                              className="w-20 border border-emerald-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1E3A2F]" />
                          ) : <span className="font-black text-[#1E3A2F]">₹{med.price}</span>}
                        </td>
                        <td className="px-6 py-4">
                          {editingStock === med.id ? (
                            <input type="number" min="0" value={editStock.stock} onChange={e => setEditStock(p => ({ ...p, stock: e.target.value }))}
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
                  <div key={r.id} className={`p-4 rounded-2xl border transition-all flex justify-between items-center ${r.isBusy ? "border-slate-200 bg-slate-50 opacity-70" : "border-[#E2EFE7] hover:bg-[#F6FAF7]"}`}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{r.name || r.email}</span>
                        <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Star size={10} fill="currentColor" /> {r.riderRating?.toFixed(1) || "5.0"}
                        </span>
                        {r.isAvailable ? (
                          <span className="text-[10px] font-black bg-[#E8F3ED] text-[#1E3A2F] px-2 py-0.5 rounded-full">✓ Available</span>
                        ) : (
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">⏳ Busy</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {r.vehicleType || "Motorcycle"} • {r.completedDeliveries || 0} deliveries{r.phone ? ` • ${r.phone}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReassignRider(reassignModalOrder.realId || reassignModalOrder.id, r.id)}
                      disabled={!!assigningRiderId || r.isBusy}
                      title={r.isBusy ? "Rider is currently busy with another delivery" : "Assign this rider"}
                      className={`text-xs font-bold px-5 py-2 rounded-full shadow-sm transition-all active:scale-95 uppercase tracking-wider ${
                        r.isBusy ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#1E3A2F] hover:bg-[#152a22] text-white disabled:opacity-50"
                      }`}
                    >
                      {assigningRiderId === r.id ? "Assigning..." : r.isBusy ? "Busy" : "Assign"}
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
                  <input type="number" step="0.01" min="0" required value={newMed.price} onChange={e => setNewMed(p => ({ ...p, price: e.target.value }))}
                    placeholder="25.00" className="w-full bg-[#F6FAF7] border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">Stock Qty</label>
                  <input type="number" min="0" required value={newMed.stock} onChange={e => setNewMed(p => ({ ...p, stock: e.target.value }))}
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

      {/* IMPORT INVENTORY MULTI-STEP WIZARD MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-4xl w-full shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#E8F3ED] rounded-2xl flex items-center justify-center text-[#1E3A2F] shrink-0">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-xl flex items-center gap-2">
                    Import Medicine Inventory
                    <span className="text-xs font-sans font-bold bg-[#E8F3ED] text-[#1E3A2F] px-2.5 py-0.5 rounded-full">Excel (.xlsx/.xls) & CSV</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Quickly import stock, pricing, batches, and locations directly into your pharmacy catalog.</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Stepper Wizard Indicator */}
            <div className="grid grid-cols-4 gap-2 py-3 border-b border-slate-100 my-2 text-xs font-bold">
              {[
                { step: 1, title: "1. Upload File" },
                { step: 2, title: "2. Map Columns" },
                { step: 3, title: "3. Preview & Validate" },
                { step: 4, title: "4. Summary" },
              ].map(s => (
                <div
                  key={s.step}
                  className={`py-2 px-3 rounded-xl text-center transition-all ${
                    importStep === s.step
                      ? "bg-[#1E3A2F] text-white shadow-sm"
                      : importStep > s.step
                      ? "bg-[#E8F3ED] text-[#1E3A2F]"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <span className="truncate block">{s.title}</span>
                </div>
              ))}
            </div>

            {/* Modal Body: Wizard Steps */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4 py-2">
              {/* STEP 1: UPLOAD FILE & DOWNLOAD TEMPLATES */}
              {importStep === 1 && (
                <div className="space-y-5">
                  {/* Sample Template Download Cards */}
                  <div className="bg-gradient-to-r from-[#F6FAF7] to-[#EDF6F0] p-5 rounded-2xl border border-[#D7ECE0]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-emerald-700" />
                          <h4 className="font-bold text-slate-900 text-sm">Download Pre-Formatted Medicine Template</h4>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                          Recommended format with all standard fields: Medicine Name, Generic Name, Category, Batch Number, Quantity, MRP, Purchase Price, Selling Price, Expiry Date, Manufacturer, Supplier, and Stock Location.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={downloadSampleExcel}
                          className="flex items-center gap-1.5 text-xs font-black bg-[#1E3A2F] hover:bg-[#152a22] text-white px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 uppercase tracking-wider"
                        >
                          <Download size={13} /> Excel (.xlsx)
                        </button>
                        <button
                          type="button"
                          onClick={downloadSampleCSV}
                          className="flex items-center gap-1.5 text-xs font-black bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 uppercase tracking-wider"
                        >
                          <Download size={13} /> CSV (.csv)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Drag-and-drop Upload Area */}
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase mb-2">Upload Your Medicine Spreadsheet</label>
                    <div className="relative border-2 border-dashed border-[#C2E0CE] hover:border-[#1E3A2F] rounded-3xl p-8 text-center bg-[#FBFDFB] transition-all cursor-pointer group">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleSpreadsheetFile(e.target.files[0]);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center gap-3 pointer-events-none">
                        <div className="w-14 h-14 rounded-2xl bg-[#E8F3ED] text-[#1E3A2F] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                          <Upload size={26} />
                        </div>
                        {importFile ? (
                          <div>
                            <p className="text-sm font-black text-slate-900">{importFile.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{(importFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-bold text-slate-800">Drag & drop your Excel or CSV file here, or click to browse</p>
                            <p className="text-xs text-slate-400 mt-1">Supports files exported from Excel, Marg ERP, Vyapar, Tally, or Google Sheets</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {importError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: COLUMN MAPPING */}
              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-[#F6FAF7] border border-[#E2EFE7] p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Spreadsheet Headers Detected: <span className="font-black text-[#1E3A2F]">{rawHeaders.length} columns</span> in file <span className="font-mono bg-white px-2 py-0.5 rounded border text-[11px]">{importFile?.name}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">We automatically mapped matching columns. Verify or change any mapping below.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImportStep(1)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <ArrowLeft size={13} /> Change File
                    </button>
                  </div>

                  {/* Mapping Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {COLUMN_DEFINITIONS.map(col => {
                      const currentVal = columnMapping[col.key] || "";
                      const isMapped = Boolean(currentVal);
                      return (
                        <div key={col.key} className={`p-3.5 rounded-2xl border transition-all ${isMapped ? "bg-white border-[#CDE3D5]" : col.required ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              {col.label}
                              {col.required ? <span className="text-rose-500 text-sm leading-none">*</span> : <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>}
                            </label>
                            {isMapped ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check size={10} /> Mapped
                              </span>
                            ) : col.required ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle size={10} /> Required
                              </span>
                            ) : null}
                          </div>
                          <select
                            value={currentVal}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, [col.key]: e.target.value }))}
                            className="w-full bg-[#F6FAF7] border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]"
                          >
                            <option value="">— Do not map / empty —</option>
                            {rawHeaders.map((h, i) => (
                              <option key={i} value={h}>Column: {h}</option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-400 mt-1 truncate">{col.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  {(!columnMapping.name || !columnMapping.stock || !columnMapping.price) && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>Please map all required columns: Medicine Name, Quantity / Stock, and Selling Price.</span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: DATA PREVIEW, VALIDATION & INLINE EDITING */}
              {importStep === 3 && (
                <div className="space-y-4">
                  {/* Status Badges Filter Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F6FAF7] p-3 rounded-2xl border border-[#E2EFE7]">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setFilterTab("all")}
                        className={`px-3 py-1.5 rounded-full transition-all ${filterTab === "all" ? "bg-[#1E3A2F] text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                      >
                        All Records ({parsedRecords.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab("valid")}
                        className={`px-3 py-1.5 rounded-full transition-all ${filterTab === "valid" ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-emerald-700 hover:bg-emerald-50"}`}
                      >
                        New / Valid ({parsedRecords.filter(r => r.status === "valid").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab("update")}
                        className={`px-3 py-1.5 rounded-full transition-all ${filterTab === "update" ? "bg-blue-700 text-white shadow-sm" : "bg-white text-blue-700 hover:bg-blue-50"}`}
                      >
                        Updates Existing ({parsedRecords.filter(r => r.status === "update").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab("error")}
                        className={`px-3 py-1.5 rounded-full transition-all ${filterTab === "error" ? "bg-rose-700 text-white shadow-sm" : "bg-white text-rose-700 hover:bg-rose-50"}`}
                      >
                        Errors to Fix ({parsedRecords.filter(r => r.status === "error").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab("duplicate")}
                        className={`px-3 py-1.5 rounded-full transition-all ${filterTab === "duplicate" ? "bg-amber-700 text-white shadow-sm" : "bg-white text-amber-700 hover:bg-amber-50"}`}
                      >
                        Duplicates in File ({parsedRecords.filter(r => r.status === "duplicate").length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Existing Stock Strategy:</span>
                      <select
                        value={conflictStrategy}
                        onChange={(e: any) => setConflictStrategy(e.target.value)}
                        className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-1 font-bold text-[#1E3A2F] focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]"
                      >
                        <option value="update_add">Add to existing stock (recommended)</option>
                        <option value="replace">Replace existing stock</option>
                        <option value="skip">Skip existing medicines</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Medicine Name</th>
                          <th className="px-3 py-2.5">Generic / Salt</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5">Batch</th>
                          <th className="px-3 py-2.5">Quantity</th>
                          <th className="px-3 py-2.5">Selling Price</th>
                          <th className="px-3 py-2.5">MRP</th>
                          <th className="px-3 py-2.5">Expiry</th>
                          <th className="px-3 py-2.5">Location</th>
                          <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {parsedRecords
                          .filter(r => filterTab === "all" ? true : r.status === filterTab)
                          .map((rec) => {
                            const isEditing = editingRowId === rec.id;
                            return (
                              <tr key={rec.id} className={`hover:bg-slate-50/80 transition-colors ${rec.status === "error" ? "bg-rose-50/30" : rec.status === "duplicate" ? "bg-amber-50/20" : ""}`}>
                                <td className="px-3 py-2">
                                  {rec.status === "valid" && (
                                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full">Valid</span>
                                  )}
                                  {rec.status === "update" && (
                                    <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded-full">Will Update</span>
                                  )}
                                  {rec.status === "error" && (
                                    <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5" title={rec.errors.join(", ")}>
                                      <AlertCircle size={10} /> Error
                                    </span>
                                  )}
                                  {rec.status === "duplicate" && (
                                    <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full" title={rec.warnings.join(", ")}>Duplicate</span>
                                  )}
                                </td>

                                {isEditing ? (
                                  <>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, name: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-28 font-bold focus:ring-1 focus:ring-[#1E3A2F]"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={editFormData.genericName}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, genericName: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-24"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={editFormData.category}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, category: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-20"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={editFormData.batchNumber}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, batchNumber: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-20 font-mono"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={editFormData.stock}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, stock: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-16"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.price}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, price: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-16 font-bold text-[#1E3A2F]"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.mrp}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, mrp: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-16"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={editFormData.expiryDate}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, expiryDate: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-20"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        value={editFormData.stockLocation}
                                        onChange={e => setEditFormData((p: any) => ({ ...p, stockLocation: e.target.value }))}
                                        className="border border-slate-300 rounded px-1.5 py-1 text-xs w-16"
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-right whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveInlineEdit(rec.id)}
                                        className="bg-[#1E3A2F] text-white px-2.5 py-1 rounded-md text-[11px] font-bold mr-1"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingRowId(null)}
                                        className="bg-slate-200 text-slate-700 px-2 py-1 rounded-md text-[11px]"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 font-bold text-slate-900">
                                      {rec.name || <span className="text-rose-500 italic">Empty Name</span>}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">{rec.genericName || "—"}</td>
                                    <td className="px-3 py-2 text-slate-500">{rec.category || "General"}</td>
                                    <td className="px-3 py-2 font-mono text-slate-600">{rec.batchNumber || "—"}</td>
                                    <td className="px-3 py-2 font-bold text-slate-800">{rec.stock} units</td>
                                    <td className="px-3 py-2 font-black text-[#1E3A2F]">₹{rec.price.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-slate-500">{rec.mrp ? `₹${rec.mrp.toFixed(2)}` : "—"}</td>
                                    <td className="px-3 py-2 text-slate-600">{rec.expiryDate || "—"}</td>
                                    <td className="px-3 py-2 text-slate-600">{rec.stockLocation || "—"}</td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditing(rec)}
                                        className="p-1 text-slate-400 hover:text-[#1E3A2F] hover:bg-[#E8F3ED] rounded transition-colors mr-1"
                                        title="Edit this record inline"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRecord(rec.id)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                        title="Remove record from import list"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {parsedRecords.some(r => r.status === "error") && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>Some rows have errors. Click the <strong>Edit</strong> icon on any row to fix them, or proceed to import only the valid rows.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setParsedRecords(prev => prev.filter(r => r.status !== "error"))}
                        className="bg-rose-200 hover:bg-rose-300 text-rose-900 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 transition-all"
                      >
                        Remove Invalid Rows
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: SUMMARY REPORT */}
              {importStep === 4 && importSummary && (
                <div className="space-y-5 py-4">
                  <div className="bg-[#E8F3ED] border border-[#CDE3D5] rounded-3xl p-6 text-center">
                    <div className="w-16 h-16 bg-[#1E3A2F] text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                      <Check size={32} />
                    </div>
                    <h4 className="text-2xl font-serif font-bold text-slate-900">Inventory Import Complete!</h4>
                    <p className="text-xs text-slate-600 mt-1">Your pharmacy stock catalog has been successfully updated in the database.</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Processed</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{importSummary.total}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Newly Added</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1">{importSummary.added}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Updated Existing</p>
                        <p className="text-2xl font-black text-blue-700 mt-1">{importSummary.updated}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Skipped / Failed</p>
                        <p className="text-2xl font-black text-amber-700 mt-1">{importSummary.skipped + importSummary.failed}</p>
                      </div>
                    </div>
                  </div>

                  {importSummary.errors && importSummary.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs">
                      <p className="font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Row Notes & Skipped Items:
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-700 font-medium">
                        {importSummary.errors.slice(0, 5).map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
              <div>
                {importStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setImportStep(1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <ArrowLeft size={13} /> Back to File
                  </button>
                )}
                {importStep === 3 && (
                  <button
                    type="button"
                    onClick={() => setImportStep(2)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <ArrowLeft size={13} /> Back to Mapping
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {importStep === 4 ? (
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="bg-[#1E3A2F] hover:bg-[#152a22] text-white px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-95"
                  >
                    Done & View Inventory
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 uppercase tracking-wider"
                    >
                      Cancel
                    </button>

                    {importStep === 2 && (
                      <button
                        type="button"
                        disabled={!columnMapping.name || !columnMapping.stock || !columnMapping.price}
                        onClick={() => {
                          generateAndValidateRecords(columnMapping, rawRows);
                          setImportStep(3);
                        }}
                        className="bg-[#1E3A2F] hover:bg-[#152a22] text-white px-7 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                      >
                        Continue to Preview <ArrowRight size={13} />
                      </button>
                    )}

                    {importStep === 3 && (
                      <button
                        type="button"
                        disabled={importLoading || parsedRecords.filter(r => r.status === "valid" || r.status === "update").length === 0}
                        onClick={handleExecuteImport}
                        className="bg-[#1E3A2F] hover:bg-[#152a22] text-white px-7 py-2.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
                      >
                        {importLoading ? (
                          <>Processing Import...</>
                        ) : (
                          <>
                            <CheckCircle size={15} />
                            Import {parsedRecords.filter(r => r.status === "valid" || r.status === "update").length} Valid Medicines
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
