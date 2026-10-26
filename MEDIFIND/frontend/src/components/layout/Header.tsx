"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu, X, LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  getStoredUser, clearAuthSession, getAuthToken,
  type AuthUser
} from "@/lib/auth";
import { MediFindLogo, MediFindWordmark } from "@/components/brand/MediFindLogo";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#search", label: "Find Medicines" },
  { href: "/#pharmacies", label: "Pharmacies" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#about", label: "About" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    setAuthLoading(false);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    router.push("/");
    setIsOpen(false);
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  if (authLoading) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#E2EBE6] bg-white/95 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <MediFindLogo size={26} />
            <MediFindWordmark className="text-lg sm:text-xl" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${isActive(link.href) ? "text-[#078B5A]" : "text-slate-600 hover:text-[#078B5A]"}`}
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <div className="flex items-center gap-3">
                <Link href="/?auth=login&role=user" className="text-sm font-medium text-slate-600 hover:text-[#078B5A] transition-colors">
                  Log in
                </Link>
                <Link href="/?auth=signup&role=user" className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-xs uppercase tracking-wider px-3 py-1.5 bg-[#F0F8F4] hover:bg-[#DCEBDF] text-[#14243A] shadow-sm transition-all duration-200">Sign up</Link>
              </div>
            )}
            {user && (
              <div className="flex items-center gap-2 ml-2">
                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </nav>

          <button className="md:hidden text-slate-600 hover:text-[#078B5A]" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
            <Link href="/" className="flex items-center gap-2">
              <MediFindLogo size={24} />
              <MediFindWordmark className="text-xl text-white" />
            </Link>
            <button className="text-white" onClick={() => setIsOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 px-6 py-8 space-y-4 overflow-y-auto">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">
                {link.label}
              </Link>
            ))}
            {!user && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <Link href="/?auth=login&role=user" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5">Log in</Link>
                <Link href="/?auth=signup&role=user" onClick={() => setIsOpen(false)} className="block w-full px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#078B5A] hover:bg-[#075B46] text-center transition-colors">Sign up</Link>
              </div>
            )}
            {user && (
              <div className="pt-4 border-t border-white/10">
                <button onClick={handleLogout} className="block w-full px-4 py-3 rounded-xl text-sm font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left">Sign out</button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function HeaderMinimal() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
  }, []);
  
  const handleLogout = () => {
    clearAuthSession();
    router.push("/");
  };
  
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2EBE6] bg-white">
      <Link href="/" className="flex items-center gap-2">
        <MediFindLogo size={24} />
        <MediFindWordmark className="text-lg" />
      </Link>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-xs font-medium text-slate-500 hidden sm:block">{user.name}</span>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
              <LogOut size={14} /> Sign out
            </button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => router.push("/?auth=login&role=user")}>Sign in</Button>
        )}
      </div>
    </div>
  );
}
