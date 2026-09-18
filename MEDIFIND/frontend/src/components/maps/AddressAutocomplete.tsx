"use client";
import React, { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Search } from "lucide-react";

export interface AddressComponents {
  formattedAddress: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (addr: AddressComponents) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Search area, street, or landmark…",
  className = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A2F]",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || !inputRef.current) return;

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loader.load().then(() => {
      if (!inputRef.current) return;
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"],
        componentRestrictions: { country: "in" },
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;

        const formatted = place.formatted_address || place.name || "";
        onChange(formatted);

        if (onAddressSelect) {
          let street = "";
          let city = "";
          let state = "";
          let pincode = "";

          place.address_components?.forEach((comp) => {
            const types = comp.types;
            if (types.includes("route") || types.includes("sublocality")) {
              street = street ? `${street}, ${comp.long_name}` : comp.long_name;
            }
            if (types.includes("locality")) city = comp.long_name;
            if (types.includes("administrative_area_level_1")) state = comp.long_name;
            if (types.includes("postal_code")) pincode = comp.long_name;
          });

          onAddressSelect({
            formattedAddress: formatted,
            street,
            city,
            state,
            pincode,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    }).catch((err) => {
      console.warn("[AddressAutocomplete] Google Places load error:", err);
    });
  }, [onChange, onAddressSelect]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
