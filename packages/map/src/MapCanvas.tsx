import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { PaintedCounties } from "./choropleth";
import { boundsForCounties } from "./choropleth";

export interface MapCanvasProps {
  counties: PaintedCounties;
  selectedGeoId: string | null;
  onSelect: (geoId: string) => void;
  onHover: (geoId: string | null) => void;
}

const SOURCE_ID = "county-geometry";
const FILL_LAYER = "county-fill";
const SELECTED_LAYER = "county-selected";
const HOVER_LAYER = "county-hover";

/** Standalone original map style: no remote tiles, keys, copied imagery or map data. */
const blankStyle = {
  version: 8 as const,
  sources: {},
  layers: [{
    id: "background",
    type: "background" as const,
    paint: { "background-color": "#0d2330" },
  }],
};

export function MapCanvas({ counties, selectedGeoId, onSelect, onHover }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latestRef = useRef({ counties, selectedGeoId, onSelect, onHover });
  latestRef.current = { counties, selectedGeoId, onSelect, onHover };
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let localMap: MapLibreMap | null = null;
    async function initialize() {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !containerRef.current) return;
        // MapLibre versions differ in support probes; constructor/error handlers provide fallback.
        const map = new maplibre.Map({
          container: containerRef.current,
          style: blankStyle,
          center: [-86.0, 35.7],
          zoom: 5.5,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
        });
        localMap = map;
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-left");
        map.on("load", () => {
          if (disposed) return;
          map.addSource(SOURCE_ID, {
            type: "geojson",
            data: latestRef.current.counties,
            promoteId: "geoId",
          });
          map.addLayer({
            id: FILL_LAYER,
            type: "fill",
            source: SOURCE_ID,
            paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.84 },
          });
          map.addLayer({
            id: "county-stroke",
            type: "line",
            source: SOURCE_ID,
            paint: { "line-color": "#c4d5e0", "line-width": 0.85, "line-opacity": 0.67 },
          });
          map.addLayer({
            id: HOVER_LAYER,
            type: "line",
            source: SOURCE_ID,
            filter: ["==", ["get", "geoId"], ""],
            paint: { "line-color": "#ffffff", "line-width": 2 },
          });
          map.addLayer({
            id: SELECTED_LAYER,
            type: "line",
            source: SOURCE_ID,
            filter: ["==", ["get", "geoId"], latestRef.current.selectedGeoId ?? ""],
            paint: { "line-color": "#ffffff", "line-width": 3.5 },
          });
          map.on("click", FILL_LAYER, (event) => {
            const id = event.features?.[0]?.properties?.geoId as string | undefined;
            if (id) latestRef.current.onSelect(id);
          });
          map.on("mousemove", FILL_LAYER, (event) => {
            const id = event.features?.[0]?.properties?.geoId as string | undefined;
            map.getCanvas().style.cursor = id ? "pointer" : "";
            map.setFilter(HOVER_LAYER, ["==", ["get", "geoId"], id ?? ""]);
            latestRef.current.onHover(id ?? null);
          });
          map.on("mouseleave", FILL_LAYER, () => {
            map.getCanvas().style.cursor = "";
            map.setFilter(HOVER_LAYER, ["==", ["get", "geoId"], ""]);
            latestRef.current.onHover(null);
          });
          const bounds = boundsForCounties(latestRef.current.counties);
          if (bounds) map.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 8 });
          if (timeout) clearTimeout(timeout);
          setStatus("ready");
        });
        map.on("error", (event) => {
          if (!map.loaded()) {
            if (timeout) clearTimeout(timeout);
            setError(event.error?.message || "The map renderer could not load.");
            setStatus("error");
          }
        });
        timeout = setTimeout(() => {
          if (!disposed && !map.loaded()) {
            setError("Map initialization timed out. The county list remains available.");
            setStatus("error");
          }
        }, 12000);
      } catch (cause) {
        if (!disposed) {
          if (timeout) clearTimeout(timeout);
          setError(cause instanceof Error ? cause.message : "Map rendering failed.");
          setStatus("error");
        }
      }
    }
    void initialize();
    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      mapRef.current = null;
      localMap?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(counties);
    // Live votes update colors, but must NOT interrupt the user's current map zoom.
  }, [counties, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    map.setFilter(SELECTED_LAYER, ["==", ["get", "geoId"], selectedGeoId ?? ""]);
    const shape = latestRef.current.counties.features.find(feature => feature.properties.geoId === selectedGeoId);
    if (shape) {
      const bounds = boundsForCounties({ type: "FeatureCollection", features: [shape] });
      if (bounds) map.fitBounds(bounds, { padding: 70, duration: 350, maxZoom: 8 });
    }
  }, [selectedGeoId, status]);

  return (
    <div className="map-host" data-testid="county-map-real" aria-label="Interactive geographic county map">
      <div className="map-canvas" ref={containerRef} aria-hidden="true" />
      {status === "loading" && <div className="map-overlay" role="status">Preparing interactive county map…</div>}
      {status === "error" && (
        <div className="map-overlay map-overlay-error" role="alert">
          <strong>Interactive map unavailable</strong>
          <span>{error}</span>
          <span>Select counties using the searchable list below.</span>
        </div>
      )}
    </div>
  );
}
