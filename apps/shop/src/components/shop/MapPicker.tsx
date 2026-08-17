import { useLanguage } from "@/lib/i18n";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, LocateFixed, Map as MapIcon, Search, Satellite } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * GPS map picker (spec §33–54).
 *
 * - Satellite imagery is the default view (Esri World Imagery — no API key),
 *   with a standard-map toggle.
 * - For a NEW address the browser's current location is requested once on
 *   mount as the STARTING position only — the customer must press
 *   “ยืนยันตำแหน่งนี้” (confirm) before the coordinates count as chosen.
 * - Dragging the pin, tapping the map or picking a search result updates the
 *   coordinates and clears the confirmed state (parent re-validates).
 * - All geolocation failures degrade gracefully: the customer can still pick
 *   a location on the map themselves.
 */
interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  /** Fires whenever the picked position changes (parent sets confirmed=false). */
  onChange: (lat: number, lng: number) => void;
  confirmed: boolean;
  /** Marks the current coordinates as the confirmed location. */
  onConfirm: () => void;
  /** Auto-request the browser's current location on mount (new addresses). */
  autoLocate?: boolean;
  height?: string;
}

interface PlaceResult {
  lat: string;
  lon: string;
  display_name: string;
}

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018]; // Bangkok
const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STANDARD_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

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

export function MapPicker({
  latitude,
  longitude,
  onChange,
  confirmed,
  onConfirm,
  autoLocate = false,
  height = "h-64",
}: MapPickerProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const standardLayerRef = useRef<L.TileLayer | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [layer, setLayer] = useState<"satellite" | "standard">("satellite");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const hasPos = latitude != null && longitude != null;

  const setPosition = useCallback(
    (lat: number, lng: number) => {
      onChangeRef.current(lat, lng);
      if (mapRef.current && markerRef.current) {
        const latlng = L.latLng(lat, lng);
        markerRef.current.setLatLng(latlng);
        mapRef.current.panTo(latlng);
      }
    },
    [],
  );

  // init map once — satellite view by default
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      scrollWheelZoom: false,
    });
    const satellite = L.tileLayer(SATELLITE_TILES, {
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19,
    }).addTo(map);
    const standard = L.tileLayer(STANDARD_TILES, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });
    satelliteLayerRef.current = satellite;
    standardLayerRef.current = standard;

    const marker = L.marker(DEFAULT_CENTER, { draggable: true, icon: pinIcon() });
    markerRef.current = marker;

    const sync = (latlng: L.LatLng) => onChangeRef.current(latlng.lat, latlng.lng);
    marker.on("dragend", () => sync(marker.getLatLng()));
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      sync(e.latlng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      satelliteLayerRef.current = null;
      standardLayerRef.current = null;
    };
  }, []);

  // show/hide + move the marker whenever coordinates change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (latitude != null && longitude != null) {
      const latlng = L.latLng(latitude, longitude);
      markerRef.current.setLatLng(latlng);
      mapRef.current.panTo(latlng);
      if (!mapRef.current.hasLayer(markerRef.current)) markerRef.current.addTo(mapRef.current);
    } else if (mapRef.current.hasLayer(markerRef.current)) {
      markerRef.current.remove();
    }
  }, [latitude, longitude]);

  // layer toggle
  useEffect(() => {
    if (!mapRef.current || !satelliteLayerRef.current || !standardLayerRef.current) return;
    if (layer === "satellite") {
      if (!mapRef.current.hasLayer(satelliteLayerRef.current)) satelliteLayerRef.current.addTo(mapRef.current);
      if (mapRef.current.hasLayer(standardLayerRef.current)) standardLayerRef.current.remove();
    } else {
      if (!mapRef.current.hasLayer(standardLayerRef.current)) standardLayerRef.current.addTo(mapRef.current);
      if (mapRef.current.hasLayer(satelliteLayerRef.current)) satelliteLayerRef.current.remove();
    }
  }, [layer]);

  const locateCurrent = useCallback(() => {
    setLocateError(null);
    if (!("geolocation" in navigator)) {
      setLocateError(t("mapPicker.unsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError(t("mapPicker.denied"));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [setPosition, t]);

  // new-address flow: request current location once as the starting point.
  // Runs in a macrotask so no state is set synchronously within the effect.
  useEffect(() => {
    if (!autoLocate || hasPos) return;
    let alive = true;
    const timer = setTimeout(() => {
      if (!("geolocation" in navigator)) {
        if (alive) setLocateError(t("mapPicker.unsupported"));
        return;
      }
      if (alive) setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!alive) return;
          setPosition(pos.coords.latitude, pos.coords.longitude);
          setLocating(false);
        },
        () => {
          if (!alive) return;
          setLocating(false);
          setLocateError(t("mapPicker.denied"));
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [autoLocate, hasPos, setPosition, t]);

  // place search (Nominatim — free, no key; fails silently if unavailable)
  useEffect(() => {
    const term = query.trim();
    let alive = true;
    const timer = setTimeout(async () => {
      if (term.length < 3) {
        if (alive) setResults([]);
        if (alive) setSearchOpen(false);
        return;
      }
      if (alive) setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(term)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as PlaceResult[];
        if (!alive) return;
        setResults(data);
        setSearchOpen(true);
      } catch {
        if (!alive) return;
        setResults([]);
        setSearchOpen(false);
      } finally {
        if (alive) setSearching(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const pickPlace = (place: PlaceResult) => {
    setPosition(Number(place.lat), Number(place.lon));
    setResults([]);
    setSearchOpen(false);
    setQuery(place.display_name.split(",")[0] ?? "");
  };

  return (
    <div className="space-y-2">
      {/* Map */}
      <div className="relative">
        <div
          ref={containerRef}
          className={`relative z-0 w-full overflow-hidden rounded-[12px] border border-slate-200 ${height}`}
          aria-label={t("mapPicker.ariaMap")}
        />

        {/* Layer toggle */}
        <div className="absolute right-2 top-2 z-[500] flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs shadow-sm">
          <button
            type="button"
            onClick={() => setLayer("satellite")}
            className={`flex items-center gap-1 px-2.5 py-1.5 font-medium transition-colors ${
              layer === "satellite" ? "bg-[#ECFDF5] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50"
            }`}
            aria-pressed={layer === "satellite"}
          >
            <Satellite className="size-3.5" />
            {t("mapPicker.satellite")}
          </button>
          <button
            type="button"
            onClick={() => setLayer("standard")}
            className={`flex items-center gap-1 px-2.5 py-1.5 font-medium transition-colors ${
              layer === "standard" ? "bg-[#ECFDF5] text-[#0f766e]" : "text-slate-500 hover:bg-slate-50"
            }`}
            aria-pressed={layer === "standard"}
          >
            <MapIcon className="size-3.5" />
            {t("mapPicker.map")}
          </button>
        </div>

        {/* Locating overlay */}
        {locating && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-[12px] bg-white/70 backdrop-blur-[1px]">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <LocateFixed className="size-4 animate-spin text-[#10B981]" />
              {t("mapPicker.locating")}
            </p>
          </div>
        )}
      </div>

      {/* Place search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setSearchOpen(true)}
          placeholder={t("mapPicker.searchPlaceholder")}
          className="h-10 rounded-[10px] border-slate-200 pl-9 pr-3 text-sm"
          aria-label={t("mapPicker.searchPlaceholder")}
        />
        {searching && (
          <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            {t("common.loading")}
          </p>
        )}
        {searchOpen && results.length > 0 && (
          <ul className="absolute z-[600] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {results.map((r) => (
              <li key={r.lat + r.lon}>
                <button
                  type="button"
                  onClick={() => pickPlace(r)}
                  className="w-full px-3 py-2.5 text-left text-xs leading-5 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchOpen && results.length === 0 && !searching && query.trim().length >= 3 && (
          <p className="absolute z-[600] mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-400 shadow-lg">
            {t("mapPicker.noResults")}
          </p>
        )}
      </div>

      {/* Actions + status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-slate-200 text-slate-600"
            onClick={locateCurrent}
            disabled={locating}
          >
            <LocateFixed className={`size-3.5 ${locating ? "animate-spin" : ""}`} />
            {t("mapPicker.useCurrent")}
          </Button>
          {hasPos && !confirmed && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[#10B981] text-white hover:bg-emerald-700"
              onClick={onConfirm}
            >
              <Check className="size-3.5" />
              {t("mapPicker.confirm")}
            </Button>
          )}
        </div>
        <p
          className={`flex items-center gap-1 text-[11px] font-medium ${
            confirmed ? "text-emerald-700" : "text-slate-400"
          }`}
        >
          {confirmed ? (
            <>
              <Check className="size-3.5" />
              {t("mapPicker.confirmed")}
            </>
          ) : (
            t("mapPicker.notConfirmed")
          )}
        </p>
      </div>

      {/* Inline geolocation errors — never a blocking alert */}
      {locateError && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
          <LocateFixed className="mt-0.5 size-3.5 shrink-0" />
          {locateError}
        </p>
      )}

      {hasPos && !confirmed && (
        <p className="text-[11px] text-slate-400">{t("mapPicker.dragHint")}</p>
      )}
    </div>
  );
}
