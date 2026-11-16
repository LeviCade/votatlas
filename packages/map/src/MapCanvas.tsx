import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { PaintedCounties } from "./choropleth";
import { boundsForCounties } from "./choropleth";

export interface MapCanvasProps {
  counties: PaintedCounties;
  selectedGeoId: string | null;
  /** Highlight a set of counties without replacing each county's leader color. */
  selectedGeoIds?: readonly string[];
  /** Only single-county navigation should automatically fit its boundaries. */
  focusSelected?: boolean;
  onSelect: (geoId: string) => void;
  onHover: (geoId: string | null) => void;
}

const SOURCE_ID = "county-geometry";
const FILL_LAYER = "county-fill";
const SELECTED_LAYER = "county-selected";
const HOVER_LAYER = "county-hover";

/** Browser-only diagnostic enabled by ?e2e=1, never used for vote calculations.
 * Reads the ACTUAL MapLibre source/layer after GeoJSON setData finishes. */
export interface MapE2EInspection {
  geoId: string;
  sourceFeatureCount: number;
  fill: string | null;
  winnerCandidateId: string | null;
  layerColorExpression: unknown;
  rendered: boolean;
  zoom: number;
  moving: boolean;
}
interface MapE2EWindow extends Window {
  __votatlasMapForE2E?: { inspectCounty: (geoId: string) => MapE2EInspection };
}

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

export function MapCanvas({ counties, selectedGeoId, selectedGeoIds, focusSelected = true, onSelect, onHover }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latestRef = useRef({ counties, selectedGeoId, selectedGeoIds, focusSelected, onSelect, onHover });
  latestRef.current = { counties, selectedGeoId, selectedGeoIds, focusSelected, onSelect, onHover };
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
            filter: ["in", ["get", "geoId"], ["literal",
              latestRef.current.selectedGeoIds ?? (latestRef.current.selectedGeoId ? [latestRef.current.selectedGeoId] : [])
            ]],
            paint: { "line-color": "#f9e4a2", "line-width": 3.5, "line-opacity": 0.96 },
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
          if (new URLSearchParams(window.location.search).get("e2e") === "1") {
            const diagnosticWindow = window as MapE2EWindow;
            diagnosticWindow.__votatlasMapForE2E = {
              inspectCounty: (geoId: string): MapE2EInspection => {
                const feature = map.querySourceFeatures(SOURCE_ID)
                  .find(f => f.properties?.geoId === geoId);
                const rendered = map.queryRenderedFeatures({ layers: [FILL_LAYER] })
                  .some(f => f.properties?.geoId === geoId);
                return {
                  geoId, sourceFeatureCount: map.querySourceFeatures(SOURCE_ID).length,
                  fill: (feature?.properties?.fill as string | undefined) ?? null,
                  winnerCandidateId: (feature?.properties?.winnerCandidateId as string | undefined) ?? null,
                  layerColorExpression: map.getPaintProperty(FILL_LAYER, "fill-color"),
                  rendered, zoom: map.getZoom(), moving: map.isMoving(),
                };
              },
            };
          }
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
      if (typeof window !== "undefined") delete (window as MapE2EWindow).__votatlasMapForE2E;
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
    const highlighted = selectedGeoIds ?? (selectedGeoId ? [selectedGeoId] : []);
    map.setFilter(SELECTED_LAYER, ["in", ["get", "geoId"], ["literal", highlighted]]);
  }, [selectedGeoId, selectedGeoIds, status]);

  // Focusing is deliberately independent of the highlighted set and vote updates.
  // Toggling a selection, adding counties, or changing candidate support never
  // overwrites a user's current map zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !focusSelected) return;
    const shape = latestRef.current.counties.features.find(feature => feature.properties.geoId === selectedGeoId);
    if (shape) {
      const bounds = boundsForCounties({ type: "FeatureCollection", features: [shape] });
      if (bounds) map.fitBounds(bounds, { padding: 70, duration: 350, maxZoom: 8 });
    }
  }, [selectedGeoId, focusSelected, status]);

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
