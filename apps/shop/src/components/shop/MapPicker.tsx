import { LocateFixed } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "@velnox/shared/components/ui/button";

/**
 * GPS map picker (spec §17–18, §62).
 * - "ใช้ตำแหน่งปัจจุบัน" via the browser geolocation API
 * - click the map or drag the marker to set the coordinates
 * - the picked latitude/longitude are reported back through onChange
 */
interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018]; // Bangkok

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;transform:translate(-50%,-100%);">
      <svg viewBox="0 0 24 24" fill="#0f766e" stroke="white" stroke-width="1.5" width="34" height="34">
        <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z"/>
        <circle cx="12" cy="10" r="2.6" fill="white" stroke="none"/>
      </svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export function MapPicker({ latitude, longitude, onChange, height = "h-64" }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);

  const hasPos = latitude != null && longitude != null;

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial: [number, number] = hasPos ? [latitude!, longitude!] : DEFAULT_CENTER;
    const map = L.map(containerRef.current, {
      center: initial,
      zoom: hasPos ? 15 : 12,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(initial, { draggable: true, icon: pinIcon() }).addTo(map);
    mapRef.current = map;
    markerRef.current = marker;

    const sync = (latlng: L.LatLng) => onChangeRef.current(latlng.lat, latlng.lng);
    marker.on("dragend", () => sync(marker.getLatLng()));
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      sync(e.latlng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reflect external lat/lng changes on the marker
  useEffect(() => {
    if (latitude != null && longitude != null && mapRef.current && markerRef.current) {
      const latlng = L.latLng(latitude, longitude);
      markerRef.current.setLatLng(latlng);
      mapRef.current.panTo(latlng);
    }
  }, [latitude, longitude]);

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      alert("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง — กรุณาเลือกตำแหน่งบนแผนที่แทน");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onChange(lat, lng);
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert("ไม่สามารถดึงตำแหน่งปัจจุบันได้ — กรุณาเลือกตำแหน่งบนแผนที่แทน (ลากหมุดหรือคลิกแผนที่)");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`w-full overflow-hidden rounded-[12px] border border-slate-200 ${height} z-0`}
        aria-label="แผนที่เลือกตำแหน่งจัดส่ง"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-slate-200 text-slate-600"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          <LocateFixed className={`size-3.5 ${locating ? "animate-spin" : ""}`} />
          {locating ? "กำลังค้นหาตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
        </Button>
        {hasPos && (
          <p className="text-[11px] tabular-nums text-slate-400">
            พิกัด: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
