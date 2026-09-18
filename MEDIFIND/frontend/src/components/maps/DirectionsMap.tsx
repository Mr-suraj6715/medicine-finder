"use client";
import React, { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { Navigation, Clock, MapPin, Compass } from "lucide-react";

interface Point {
  lat: number;
  lng: number;
  title?: string;
  type?: "pharmacy" | "customer" | "rider";
}

interface DirectionsMapProps {
  origin: Point;
  destination: Point;
  className?: string;
  onRouteCalculated?: (result: { distanceKm: number; durationMinutes: number }) => void;
}

export default function DirectionsMap({
  origin,
  destination,
  className = "w-full h-full min-h-[300px] rounded-2xl",
  onRouteCalculated,
}: DirectionsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const isValidApiKey = apiKey && apiKey !== "YOUR_API_KEY_HERE" && apiKey.trim() !== "";

  // Calculate straight-line fallback distance for dev/offline display
  const dLat = (destination.lat - origin.lat) * (Math.PI / 180);
  const dLon = (destination.lng - origin.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin.lat * (Math.PI / 180)) *
      Math.cos(destination.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const fallbackKm = Math.max(0.5, +(6371 * c).toFixed(1));
  const fallbackMins = Math.max(8, Math.round(fallbackKm * 6 + 5));

  useEffect(() => {
    if (!isValidApiKey) {
      setLoading(false);
      setRouteInfo({
        distance: `${fallbackKm} km`,
        duration: `${fallbackMins} mins`,
      });
      if (onRouteCalculated) {
        onRouteCalculated({ distanceKm: fallbackKm, durationMinutes: fallbackMins });
      }
      return;
    }

    setOptions({
      key: apiKey,
      v: "weekly",
    });

    importLibrary("routes")
      .then(() => {
        setGoogleMapsLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("[DirectionsMap] Google Routes library load error:", err);
        setError("Routes service unavailable");
        setLoading(false);
      });
  }, [apiKey, isValidApiKey, fallbackKm, fallbackMins, onRouteCalculated]);

  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current || !isValidApiKey) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: {
          lat: (origin.lat + destination.lat) / 2,
          lng: (origin.lng + destination.lng) / 2,
        },
        zoom: 13,
        disableDefaultUI: false,
        fullscreenControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      });

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#1E3A2F",
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });

      directionsService.route(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            if (leg) {
              const distText = leg.distance?.text || `${fallbackKm} km`;
              const durText = leg.duration?.text || `${fallbackMins} mins`;
              setRouteInfo({ distance: distText, duration: durText });

              if (onRouteCalculated && leg.distance?.value && leg.duration?.value) {
                onRouteCalculated({
                  distanceKm: +(leg.distance.value / 1000).toFixed(1),
                  durationMinutes: Math.round(leg.duration.value / 60),
                });
              }
            }
          } else {
            console.warn("[DirectionsMap] Directions request failed:", status);
            setError("Could not calculate road route. Showing straight line.");
          }
        }
      );
    } catch (e) {
      console.warn("[DirectionsMap] Map initialization error:", e);
    }
  }, [googleMapsLoaded, origin.lat, origin.lng, destination.lat, destination.lng, isValidApiKey, fallbackKm, fallbackMins, onRouteCalculated]);

  if (!isValidApiKey || error) {
    return (
      <div className={`relative overflow-hidden bg-[#F0F6F2] border border-[#D5E6DC] flex flex-col justify-between p-6 ${className}`}>
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#1E3A2F_1px,transparent_1px)] [background-size:16px_16px]"></div>

        {/* Top Info Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-white/90 backdrop-blur-sm p-3 rounded-2xl border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-800">
              {origin.title || "Origin"} &rarr; {destination.title || "Destination"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-[#1E3A2F]">
            <span className="flex items-center gap-1 bg-[#E8F3ED] px-2.5 py-1 rounded-lg">
              <Navigation size={12} /> {routeInfo?.distance || `${fallbackKm} km`}
            </span>
            <span className="flex items-center gap-1 bg-[#E8F3ED] px-2.5 py-1 rounded-lg">
              <Clock size={12} /> ~{routeInfo?.duration || `${fallbackMins} mins`}
            </span>
          </div>
        </div>

        {/* Center Visual Representation */}
        <div className="relative z-10 my-8 flex items-center justify-center gap-6">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-lg">
              <MapPin size={20} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-1">{origin.title || "Start"}</span>
          </div>

          <div className="flex-1 max-w-[140px] border-t-2 border-dashed border-[#1E3A2F]/40 relative flex items-center justify-center">
            <Navigation size={14} className="text-[#1E3A2F] rotate-90" />
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg">
              <MapPin size={20} />
            </div>
            <span className="text-[11px] font-bold text-slate-700 mt-1">{destination.title || "End"}</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-center">
          <p className="text-[11px] text-slate-500">
            Live Google Routes API mapping ready for production deployment
          </p>
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
            Calculating Google Road Route…
          </div>
        </div>
      )}

      {routeInfo && (
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-slate-100 shadow-md flex items-center gap-3 text-xs font-bold text-[#1E3A2F]">
          <span className="flex items-center gap-1">
            <Navigation size={13} className="text-emerald-600" /> {routeInfo.distance}
          </span>
          <span className="border-l border-slate-200 pl-2 flex items-center gap-1">
            <Clock size={13} className="text-emerald-600" /> {routeInfo.duration}
          </span>
        </div>
      )}

      <div ref={mapRef} className="w-full h-full min-h-[300px]" />
    </div>
  );
}
