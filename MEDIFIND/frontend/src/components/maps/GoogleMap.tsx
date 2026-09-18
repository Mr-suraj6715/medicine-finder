"use client";
import React, { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { MapPin, AlertCircle, Compass } from "lucide-react";

export interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
  type?: "customer" | "pharmacy" | "rider" | "default";
  info?: string;
}

interface GoogleMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
  markers?: MapMarker[];
  className?: string;
  onMapClick?: (e: { lat: number; lng: number }) => void;
}

export default function GoogleMap({
  lat,
  lng,
  zoom = 14,
  title,
  markers = [],
  className = "w-full h-full min-h-[260px] rounded-2xl",
  onMapClick,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const isValidApiKey = apiKey && apiKey !== "YOUR_API_KEY_HERE" && apiKey.trim() !== "";

  useEffect(() => {
    if (!isValidApiKey) {
      setLoading(false);
      return;
    }

    setOptions({
      key: apiKey,
      v: "weekly",
    });

    importLibrary("maps")
      .then(() => {
        setGoogleMapsLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("[GoogleMap] Failed to load Google Maps SDK:", err);
        setError("Google Maps is currently unavailable. Using fallback view.");
        setLoading(false);
      });
  }, [apiKey, isValidApiKey]);

  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current || !isValidApiKey) return;

    try {
      const mapOptions: google.maps.MapOptions = {
        center: { lat, lng },
        zoom,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit",
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }],
          },
        ],
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);

      // Main pin / center marker
      new google.maps.Marker({
        position: { lat, lng },
        map,
        title: title || "Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#1E3A2F",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      // Additional markers
      markers.forEach((m) => {
        const color =
          m.type === "pharmacy"
            ? "#059669"
            : m.type === "rider"
            ? "#2563EB"
            : m.type === "customer"
            ? "#E11D48"
            : "#1E3A2F";

        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          title: m.title || "Marker",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2.5,
          },
        });

        if (m.info || m.title) {
          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 4px; font-family: sans-serif; font-size: 12px; font-weight: bold; color: #1E293B;">
              ${m.title || "Location"}
              ${m.info ? `<div style="font-weight: normal; font-size: 11px; color: #64748B;">${m.info}</div>` : ""}
            </div>`,
          });
          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        }
      });

      if (onMapClick) {
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        });
      }
    } catch (e: any) {
      console.warn("[GoogleMap] Error rendering map instance:", e);
      setError("Unable to render Google Map at this time.");
    }
  }, [googleMapsLoaded, lat, lng, zoom, title, markers, onMapClick, isValidApiKey]);

  // If Google Maps API key is not configured or in dev placeholder, show a sleek interactive preview card
  if (!isValidApiKey || error) {
    return (
      <div className={`relative overflow-hidden bg-[#F0F6F2] border border-[#D5E6DC] flex flex-col items-center justify-center p-6 text-center ${className}`}>
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#1E3A2F_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="relative z-10 flex flex-col items-center max-w-xs">
          <div className="w-12 h-12 bg-white rounded-2xl shadow-md border border-[#E2EFE7] flex items-center justify-center text-[#1E3A2F] mb-3">
            <Compass size={24} className="animate-spin-slow" />
          </div>
          <h4 className="text-sm font-bold text-[#1E3A2F] mb-1">
            {title || "MediFind Location View"}
          </h4>
          <p className="text-xs text-slate-500 font-medium mb-3">
            {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
          </p>
          {!isValidApiKey ? (
            <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium px-2.5 py-1 rounded-lg">
              Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code> to show live map
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-white/80 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-800 shadow-sm mt-2">
              <MapPin size={12} className="text-emerald-600" />
              Google Maps Ready
            </div>
          )}
          {error && (
            <p className="text-[10px] text-amber-700 mt-2 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-[#F0F6F2] flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1E3A2F]">
            <span className="w-4 h-4 border-2 border-[#1E3A2F]/30 border-t-[#1E3A2F] rounded-full animate-spin"></span>
            Loading Google Maps…
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full min-h-[260px]" />
    </div>
  );
}
