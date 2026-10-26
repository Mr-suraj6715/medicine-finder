"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MapPin, Phone, Clock, Pill, Truck, ShieldCheck, ArrowRight, X, User, Store,
  HeartPulse, Award, Navigation
} from "lucide-react";
import { getStoredUser, clearAuthSession, getDashboardUrl } from "@/lib/auth";
import { useState } from "react";
import { MediFindLogo, MediFindWordmark, MediFindTagline } from "@/components/brand/MediFindLogo";
import { Button } from "@/components/ui/Button";

export function Footer() {
  const [isOpen, setIsOpen] = useState(false);

  const FOOTER_LINKS = [
    { label: "Find Medicines", href: "/#search" },
    { label: "Pharmacies", href: "/#pharmacies" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "About", href: "/#about" },
  ];

  const CUSTOMER_LINKS = [
    { label: "My Orders", href: "/dashboard/user" },
    { label: "Delivery Addresses", href: "/dashboard/user#addresses" },
    { label: "Track Delivery", href: "/" },
  ];

  const SHOP_LINKS = [
    { label: "Pharmacy Dashboard", href: "/dashboard/shop" },
    { label: "Manage Inventory", href: "/dashboard/shop#inventory" },
    { label: "Operating Hours", href: "/dashboard/shop#settings" },
  ];

  const RIDER_LINKS = [
    { label: "Active Deliveries", href: "/dashboard/rider" },
    { label: "Available Tasks", href: "/dashboard/rider#available" },
    { label: "My Earnings", href: "/dashboard/rider#earnings" },
  ];

  return (
    <footer className="border-t border-[#E2EBE6] bg-[#075B46]">
      <div className="px-4 sm:px-6 lg:px-8 py-12">
        {/* Top: brand + tagline */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-[#0E7A5C]/40 pb-8">
          <div className="flex flex-col items-start md:items-center text-center md:text-left gap-3">
            <Link href="/" className="flex items-center gap-2">
              <MediFindLogo size={28} className="text-white" />
              <MediFindWordmark className="text-xl text-white" />
            </Link>
            <MediFindTagline className="text-[#078B5A]/80 text-sm" />
          </div>
          <div className="hidden md:flex items-center gap-8">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Grid of link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="text-white font-bold text-sm mb-6 uppercase tracking-wider">For Customers</h3>
            <ul className="space-y-3">
              {CUSTOMER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-300 hover:text-[#7FD4B3] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm mb-6 uppercase tracking-wider">For Pharmacies</h3>
            <ul className="space-y-3">
              {SHOP_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-300 hover:text-[#7FD4B3] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm mb-6 uppercase tracking-wider">For Riders</h3>
            <ul className="space-y-3">
              {RIDER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-300 hover:text-[#7FD4B3] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm mb-6 uppercase tracking-wider">Company</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-300 hover:text-[#7FD4B3] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-[#0E7A5C]/30 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p className="text-slate-400">
            &copy; {new Date().getFullYear()} MediFind. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
