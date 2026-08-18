import { useLanguage } from "@/lib/i18n";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, LocateFixed, Map as MapIcon, Search, Satellite } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
/**
 * GPS map picker — FIXED CENTER-PIN UX.
 *
 * The pin NEVER moves: it is an HTML overlay glued to the center of the map
 * container. The customer picks a location by DRAGGING THE MAP until the
 * target sits under the pin, then pressing “ยืนยันตำแหน่งนี้”.
 *
 * - Selected coordinates always come from `map.getCenter()` on `moveend`.
 * - Tapping/clicking the map does NOT select anything (no click handler).
 * - There is no draggable Leaflet marker (no Leaflet marker at all) — the
 *   pin cannot be dragged because it is not a map object.
 * - Satellite (Esri World Imagery) is the default view; standard map is an
 *   optional toggle. Esri tiles verified reachable (HTTP 200).
 * - `invalidateSize()` runs after mount because the map lives inside a
 *   dialog — without it Leaflet can measure a 0×0 container and render
 *   empty/grey tiles (tile requests never fire on a 0-sized map).
 * - Current location / search only move the MAP (the pin stays centered);
 *   both leave locationConfirmed=false until the customer confirms.
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
const DEFAULT_ZOOM = 12;
const SEARCH_ZOOM = 15;
const SATELLITE_TILES =
	"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STANDARD_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
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
	const satelliteLayerRef = useRef<L.TileLayer | null>(null);
	const standardLayerRef = useRef<L.TileLayer | null>(null);
	const onChangeRef = useRef(onChange);
	// True while a programmatic pan (initial load / locate / search) is in
	// flight — its `moveend` must NOT count as a user pick.
	const suppressMoveRef = useRef(false);
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
	// Programmatic move: pan the map (the pin is fixed at the center),
	// suppress the resulting `moveend`, then report the new center explicitly.
	const setPosition = useCallback((lat: number, lng: number, zoom?: number) => {
		const map = mapRef.current;
		if (!map) return;
		suppressMoveRef.current = true;
		map.setView([lat, lng], zoom ?? map.getZoom());
		onChangeRef.current(lat, lng);
	}, []);
	// init map once — satellite view by default
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return;
		const map = L.map(containerRef.current, {
			center: DEFAULT_CENTER,
			zoom: DEFAULT_ZOOM,
			scrollWheelZoom: false,
		});
		const satellite = L.tileLayer(SATELLITE_TILES, {
			attribution:
				"Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
			maxZoom: 19,
		}).addTo(map);
		const standard = L.tileLayer(STANDARD_TILES, {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 19,
		});
		satelliteLayerRef.current = satellite;
		standardLayerRef.current = standard;
		// The selected location is the map center under the fixed pin — read on
		// `moveend`, never from clicks or a draggable marker.
		map.on("moveend", () => {
			if (suppressMoveRef.current) {
				suppressMoveRef.current = false;
				return;
			}
			const center = map.getCenter();
			onChangeRef.current(center.lat, center.lng);
		});
		mapRef.current = map;
		// The map renders inside a dialog: re-measure after mount so tiles fill
		// the container (prevents grey/blank tiles on a 0×0 measured map).
		const raf = requestAnimationFrame(() => {
			requestAnimationFrame(() => map.invalidateSize());
		});
		const timer = window.setTimeout(() => map.invalidateSize(), 250);
		return () => {
			window.clearTimeout(timer);
			cancelAnimationFrame(raf);
			map.remove();
			mapRef.current = null;
			satelliteLayerRef.current = null;
			standardLayerRef.current = null;
		};
	}, []);
	// External coordinate changes (e.g. editing an existing address): pan the
	// map so the point sits under the pin. This is programmatic → suppressed,
	// and the parent already holds these coordinates, so no onChange fires.
	useEffect(() => {
		if (!mapRef.current) return;
		if (latitude != null && longitude != null) {
			suppressMoveRef.current = true;
			mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
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
	// new-address flow: request current location once as the STARTING position
	// only — GPS is never auto-confirmed (spec: current location ≠ confirmed).
	useEffect(() => {
		if (!autoLocate || hasPos) return;
		let alive = true;
		const timer = window.setTimeout(() => {
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
			window.clearTimeout(timer);
		};
	}, [autoLocate, hasPos, setPosition, t]);
	// place search (Nominatim — free, no key; fails silently if unavailable)
	useEffect(() => {
		const term = query.trim();
		let alive = true;
		const timer = window.setTimeout(async () => {
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
			window.clearTimeout(timer);
		};
	}, [query]);
	const pickPlace = (place: PlaceResult) => {
		setPosition(Number(place.lat), Number(place.lon), SEARCH_ZOOM);
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
				{/* Fixed center pin — HTML overlay glued to the middle of the map.
						pointer-events-none so map dragging works everywhere. */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-1/2 top-1/2 z-[450] -translate-x-1/2 -translate-y-full"
				>
					<svg
						viewBox="0 0 24 24"
						fill="#0f766e"
						stroke="white"
						strokeWidth="1.5"
						width="38"
						height="38"
						style={{ filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.35))" }}
					>
						<path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" />
						<circle cx="12" cy="10" r="2.6" fill="white" stroke="none" />
					</svg>
				</div>
				{/* Exact center point (the coordinate under the pin tip) */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-1/2 top-1/2 z-[450] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0f766e] shadow"
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
