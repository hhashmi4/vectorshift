"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { NetworkView, RouteRequestView, RouteResponseView, WebRoutingAlgorithm, WebTravelMode } from "@/lib/contracts.ts";
import { CITY_PRESETS, cityPreset, cityPresetAt, graphCoverageAt, graphCoverageForPreset, isAtCityPreset, type CityPreset, type GraphCoverage } from "@/lib/map-foundation.ts";
import { snapToEligibleEndpoint } from "@/lib/snapping.ts";
import { IconButton, StatusPill, ToolIcon } from "@/components/ui/primitives.tsx";

maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

const GRAPH_CENTER: [number, number] = [-79.3805, 43.6482];
const DEFAULT_BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const configuredBasemap = process.env.NEXT_PUBLIC_BASEMAP_STYLE_URL?.trim();
const BASEMAP_STYLE_URL = configuredBasemap?.toLowerCase() === "off" ? "" : configuredBasemap || DEFAULT_BASEMAP_STYLE_URL;
const BASEMAP_ATTRIBUTION = process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION?.trim() || "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors";
const TERRAIN_TILES_URL = process.env.NEXT_PUBLIC_TERRAIN_TILES_URL?.trim() ?? "";
const TERRAIN_ATTRIBUTION = process.env.NEXT_PUBLIC_TERRAIN_ATTRIBUTION?.trim() || "Terrain data © contributing providers; see Tilezen/Mapzen attribution details";
const TERRAIN_SOURCE_ID = "vectorshift-terrain-dem";
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [{ id: "vectorshift-background", type: "background", paint: { "background-color": "#0d141a" } }] };
const EMPTY_LINES: FeatureCollection<LineString> = { type: "FeatureCollection", features: [] };
const EMPTY_POINTS: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };
const CUSTOM_LAYERS = new Set(["network-hit", "network-casing", "network-lines", "route-casing", "route-line", "selection-points"]);
const CITY_NAVIGATION_EASE_ID = "vectorshift-city-navigation";

interface MapViewPosition {
  readonly longitude: number;
  readonly latitude: number;
  readonly bearing: number;
  readonly pitch: number;
}

interface LocationViewState {
  readonly activePreset: CityPreset["id"] | "custom";
  readonly selectedCoverage: GraphCoverage;
  readonly viewportCoverage: GraphCoverage;
  readonly viewPosition: MapViewPosition;
  readonly pendingNavigationGeneration: number | null;
}

interface CameraNavigation {
  readonly generation: number;
  readonly preset: CityPreset;
}

interface NavigationEventData {
  readonly vectorshiftNavigationGeneration?: number;
  readonly originalEvent?: unknown;
}

function source(map: MapLibreMap | null, name: string): GeoJSONSource | undefined {
  return map?.getSource(name) as GeoJSONSource | undefined;
}

function humanMode(mode: WebTravelMode): string {
  return mode.replace("_", " ");
}

export function RoutingWorkspace() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const networkRef = useRef<NetworkView | null>(null);
  const endpointsRef = useRef<NetworkView["endpoints"]>([]);
  const inputRef = useRef({ start: "", destination: "", mode: "motor_vehicle" as WebTravelMode, algorithm: "astar" as WebRoutingAlgorithm });
  const routeFeatureRef = useRef<Feature<LineString> | null>(null);
  const selectionRole = useRef<"start" | "destination">("start");
  const routeController = useRef<AbortController | null>(null);
  const routeGeneration = useRef(0);
  const networkGeneration = useRef(0);
  const cameraNavigationGeneration = useRef(0);
  const activeCameraNavigation = useRef<CameraNavigation | null>(null);
  const mountedRef = useRef(false);
  const resumeCameraNavigationRef = useRef<() => void>(() => undefined);
  const pendingModeRoute = useRef(false);
  const basemapFallbackApplied = useRef(false);
  const buildingLayers = useRef<string[]>([]);
  const terrainEnabledRef = useRef(false);
  const buildingsVisibleRef = useRef(true);
  const basemapEnabledRef = useRef(Boolean(BASEMAP_STYLE_URL));
  const hoveredFeature = useRef<string | number | null>(null);
  const installLayersRef = useRef<() => void>(() => undefined);
  const mapClickRef = useRef<(event: MapMouseEvent) => void>(() => undefined);
  const executeRouteRef = useRef<(request: RouteRequestView) => Promise<void>>(async () => undefined);

  const [network, setNetwork] = useState<NetworkView | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [mode, setMode] = useState<WebTravelMode>("motor_vehicle");
  const [algorithm, setAlgorithm] = useState<WebRoutingAlgorithm>("astar");
  const [start, setStart] = useState("");
  const [destination, setDestination] = useState("");
  const [route, setRoute] = useState<RouteResponseView | null>(null);
  const [networkState, setNetworkState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading the versioned road graph…");
  const [routing, setRouting] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [networkVisible, setNetworkVisible] = useState(true);
  const [routeVisible, setRouteVisible] = useState(true);
  const [basemapEnabled, setBasemapEnabled] = useState(Boolean(BASEMAP_STYLE_URL));
  const [basemapState, setBasemapState] = useState<"loading" | "available" | "fallback">(BASEMAP_STYLE_URL ? "loading" : "fallback");
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [terrainState, setTerrainState] = useState<"unavailable" | "off" | "enabled" | "error">(TERRAIN_TILES_URL ? "off" : "unavailable");
  const [buildingsVisible, setBuildingsVisible] = useState(true);
  const [buildingsAvailable, setBuildingsAvailable] = useState(false);
  const [overlayGeneration, setOverlayGeneration] = useState(0);
  const [locationView, setLocationView] = useState<LocationViewState>(() => {
    const initialCoverage = graphCoverageForPreset("toronto");
    return {
      activePreset: "toronto",
      selectedCoverage: initialCoverage,
      viewportCoverage: initialCoverage,
      viewPosition: { longitude: GRAPH_CENTER[0], latitude: GRAPH_CENTER[1], bearing: 0, pitch: 0 },
      pendingNavigationGeneration: null,
    };
  });
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const { activePreset, selectedCoverage: coverage, viewportCoverage, viewPosition } = locationView;
  inputRef.current = { start, destination, mode, algorithm };
  terrainEnabledRef.current = terrainEnabled;
  buildingsVisibleRef.current = buildingsVisible;
  basemapEnabledRef.current = basemapEnabled;

  const updateSelection = useCallback((nextStart: string, nextDestination: string) => {
    const byId = new Map(endpointsRef.current.map((endpoint) => [endpoint.id, endpoint] as const));
    const features: Feature<Point>[] = [{ id: nextStart, role: "start" }, { id: nextDestination, role: "destination" }].flatMap((entry) => {
      const endpoint = byId.get(entry.id);
      return endpoint ? [{ type: "Feature", properties: { role: entry.role }, geometry: { type: "Point", coordinates: [endpoint.longitude, endpoint.latitude] } }] : [];
    });
    source(mapRef.current, "selection")?.setData({ type: "FeatureCollection", features });
  }, []);

  const abortRoute = useCallback(() => {
    routeController.current?.abort();
    routeController.current = null;
    routeGeneration.current += 1;
    setRouting(false);
  }, []);

  const clearRoute = useCallback(() => {
    abortRoute();
    setRoute(null);
    routeFeatureRef.current = null;
    source(mapRef.current, "route")?.setData(EMPTY_LINES);
  }, [abortRoute]);

  const fitRoute = useCallback(() => {
    const feature = routeFeatureRef.current;
    if (!feature?.geometry.coordinates.length) return;
    const bounds = feature.geometry.coordinates.reduce((box, coordinate) => box.extend([coordinate[0], coordinate[1]]), new maplibregl.LngLatBounds());
    if (!bounds.isEmpty()) mapRef.current?.fitBounds(bounds, { padding: 72, duration: 0, maxZoom: 17 });
  }, []);

  const installLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentStyle = map.getStyle();
    if (!currentStyle) return;
    const styleLayers = currentStyle.layers ?? [];
    buildingLayers.current = styleLayers
      .filter((layer) => layer.type === "fill-extrusion" && !CUSTOM_LAYERS.has(layer.id) && (layer.id.toLowerCase().includes("building") || layer["source-layer"] === "building"))
      .map((layer) => layer.id);
    setBuildingsAvailable(buildingLayers.current.length > 0);
    for (const id of buildingLayers.current) map.setLayoutProperty(id, "visibility", buildingsVisibleRef.current ? "visible" : "none");

    if (terrainEnabledRef.current && TERRAIN_TILES_URL) {
      try {
        if (!map.getSource(TERRAIN_SOURCE_ID)) {
          map.addSource(TERRAIN_SOURCE_ID, {
            type: "raster-dem",
            tiles: [TERRAIN_TILES_URL],
            tileSize: 256,
            maxzoom: 15,
            encoding: "terrarium",
            attribution: TERRAIN_ATTRIBUTION,
          });
        }
        map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1 });
        setTerrainState("enabled");
      } catch {
        terrainEnabledRef.current = false;
        setTerrainEnabled(false);
        setTerrainState("error");
      }
    }

    if (!map.getSource("network")) {
      map.addSource("network", { type: "geojson", data: networkRef.current?.network ?? EMPTY_LINES, generateId: true });
      map.addLayer({ id: "network-hit", type: "line", source: "network", paint: { "line-color": "#fff", "line-width": 12, "line-opacity": 0.01 } });
      map.addLayer({ id: "network-casing", type: "line", source: "network", paint: { "line-color": "#071016", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.2, 16, 4.8], "line-opacity": 0.78 } });
      map.addLayer({ id: "network-lines", type: "line", source: "network", paint: { "line-color": ["case", ["boolean", ["feature-state", "hover"], false], "#d2f0ff", "#3182a2"], "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.9, 16, 2.2], "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.92] } });
      map.addSource("route", { type: "geojson", data: routeFeatureRef.current ? { type: "FeatureCollection", features: [routeFeatureRef.current] } : EMPTY_LINES });
      map.addLayer({ id: "route-casing", type: "line", source: "route", paint: { "line-color": "#061017", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 7, 16, 11], "line-opacity": 0.96 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#00b9ff", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 4, 16, 7] } });
      map.addSource("selection", { type: "geojson", data: EMPTY_POINTS });
      map.addLayer({ id: "selection-points", type: "circle", source: "selection", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 6, 16, 9], "circle-color": ["match", ["get", "role"], "start", "#35d98a", "#ffb42f"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    }
    source(map, "network")?.setData(networkRef.current?.network ?? EMPTY_LINES);
    source(map, "route")?.setData(routeFeatureRef.current ? { type: "FeatureCollection", features: [routeFeatureRef.current] } : EMPTY_LINES);
    updateSelection(inputRef.current.start, inputRef.current.destination);
    for (const id of ["network-hit", "network-casing", "network-lines"]) map.setLayoutProperty(id, "visibility", networkVisible ? "visible" : "none");
    for (const id of ["route-casing", "route-line"]) map.setLayoutProperty(id, "visibility", routeVisible ? "visible" : "none");
    setOverlayGeneration((value) => value + 1);
  }, [networkVisible, routeVisible, updateSelection]);
  installLayersRef.current = installLayers;

  resumeCameraNavigationRef.current = () => {
    const map = mapRef.current;
    const navigation = activeCameraNavigation.current;
    if (!map || !navigation || !mountedRef.current) return;
    const camera = { center: [...navigation.preset.center] as [number, number], zoom: navigation.preset.zoom, pitch: 0, bearing: 0 };
    const eventData: NavigationEventData = { vectorshiftNavigationGeneration: navigation.generation };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo(camera, eventData);
      return;
    }
    map.easeTo({ ...camera, duration: 850, essential: false, easeId: CITY_NAVIGATION_EASE_ID }, eventData);
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mountedRef.current = true;
    const map = new maplibregl.Map({ container: mapContainer.current, style: BASEMAP_STYLE_URL || EMPTY_STYLE, center: GRAPH_CENTER, zoom: 14.1, attributionControl: false, maxPitch: 75 });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Road graph © OpenStreetMap contributors" }));
    map.getCanvas().setAttribute("aria-label", "Worldwide interactive map with separately qualified VECTORSHIFT graph coverage. Use the city control and route inspector for keyboard-accessible workflows.");
    map.on("style.load", () => {
      if (!mountedRef.current) return;
      hoveredFeature.current = null;
      setBasemapState(basemapEnabledRef.current && BASEMAP_STYLE_URL && !basemapFallbackApplied.current ? "available" : "fallback");
      installLayersRef.current();
      resumeCameraNavigationRef.current();
    });
    map.on("load", () => { if (mountedRef.current) installLayersRef.current(); });
    map.on("error", (event) => {
      if (!mountedRef.current) return;
      const sourceId = "sourceId" in event && typeof event.sourceId === "string" ? event.sourceId : null;
      if (sourceId === TERRAIN_SOURCE_ID) {
        terrainEnabledRef.current = false;
        setTerrainEnabled(false);
        setTerrainState("error");
        map.setTerrain(null);
        return;
      }
      if (!BASEMAP_STYLE_URL || !basemapEnabledRef.current || basemapFallbackApplied.current || map.isStyleLoaded()) return;
      basemapFallbackApplied.current = true;
      basemapEnabledRef.current = false;
      setBasemapEnabled(false);
      setBasemapState("fallback");
      setOverlayGeneration(0);
      if (terrainEnabledRef.current) {
        terrainEnabledRef.current = false;
        setTerrainEnabled(false);
        setTerrainState(TERRAIN_TILES_URL ? "off" : "unavailable");
      }
      map.setStyle(EMPTY_STYLE, { diff: false });
    });
    const synchronizeViewport = (event: NavigationEventData, settled: boolean) => {
      if (!mountedRef.current) return;
      const center = map.getCenter();
      const viewPosition = { longitude: center.lng, latitude: center.lat, bearing: map.getBearing(), pitch: map.getPitch() };
      const viewportCoverage = graphCoverageAt(center.lng, center.lat);
      const eventGeneration = event.vectorshiftNavigationGeneration;
      if (eventGeneration !== undefined) {
        const navigation = activeCameraNavigation.current;
        if (!navigation || navigation.generation !== eventGeneration) return;
        const reachedTarget = isAtCityPreset(center.lng, center.lat, navigation.preset.id);
        if (settled && reachedTarget) activeCameraNavigation.current = null;
        setLocationView((current) => current.pendingNavigationGeneration === eventGeneration ? {
          ...current,
          viewportCoverage,
          viewPosition,
          pendingNavigationGeneration: settled && reachedTarget ? null : eventGeneration,
        } : current);
        if (settled && !reachedTarget) {
          queueMicrotask(() => {
            if (mountedRef.current && activeCameraNavigation.current?.generation === eventGeneration && !map.isMoving()) {
              resumeCameraNavigationRef.current();
            }
          });
        }
        return;
      }

      if (activeCameraNavigation.current && event.originalEvent === undefined) return;

      if (activeCameraNavigation.current) cameraNavigationGeneration.current += 1;
      activeCameraNavigation.current = null;
      const matchingPreset = cityPresetAt(center.lng, center.lat);
      setLocationView({
        activePreset: matchingPreset?.id ?? "custom",
        selectedCoverage: viewportCoverage,
        viewportCoverage,
        viewPosition,
        pendingNavigationGeneration: null,
      });
    };
    map.on("move", (event) => synchronizeViewport(event as NavigationEventData, false));
    map.on("moveend", (event) => synchronizeViewport(event as NavigationEventData, true));
    map.on("click", (event) => mapClickRef.current(event));
    map.on("mousemove", (event) => {
      if (!map.getLayer("network-hit")) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: ["network-hit"] })[0];
      const next = feature?.id ?? null;
      if (next === hoveredFeature.current) return;
      if (hoveredFeature.current !== null) map.setFeatureState({ source: "network", id: hoveredFeature.current }, { hover: false });
      hoveredFeature.current = next;
      if (next !== null) map.setFeatureState({ source: "network", id: next }, { hover: true });
      const edgeId = typeof feature?.properties?.id === "string" ? feature.properties.id : null;
      setHoveredEdge(edgeId);
      map.getCanvas().style.cursor = edgeId ? "pointer" : "crosshair";
    });
    map.on("mouseout", () => { setHoveredEdge(null); map.getCanvas().style.cursor = "crosshair"; });
    setMapInitialized(true);
    resumeCameraNavigationRef.current();
    return () => {
      mountedRef.current = false;
      cameraNavigationGeneration.current += 1;
      activeCameraNavigation.current = null;
      routeController.current?.abort();
      map.stop();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const executeRoute = useCallback(async (request: RouteRequestView) => {
    if (!request.start_node_id || !request.destination_node_id) { setMessage("Select both a start and destination node."); return; }
    routeController.current?.abort();
    const controller = new AbortController();
    routeController.current = controller;
    const generation = ++routeGeneration.current;
    setRouting(true);
    setRoute(null);
    routeFeatureRef.current = null;
    source(mapRef.current, "route")?.setData(EMPTY_LINES);
    setMessage(`Computing ${request.algorithm === "astar" ? "A*" : "Dijkstra"} over directed graph edges…`);
    try {
      const response = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: controller.signal });
      const value = await response.json() as RouteResponseView;
      if (generation !== routeGeneration.current) return;
      if (!response.ok && value.status !== "unsupported") throw new Error(value.status === "error" ? value.message : "Routing request failed.");
      setRoute(value);
      if (value.status === "found") {
        routeFeatureRef.current = value.geometry as Feature<LineString>;
        source(mapRef.current, "route")?.setData({ type: "FeatureCollection", features: [value.geometry] });
        fitRoute();
        setMessage(value.boundary.status === "supported" ? "Route computed from ordered graph edges." : value.boundary.message);
      } else setMessage(value.message);
    } catch (error) {
      if (controller.signal.aborted || generation !== routeGeneration.current) return;
      const value: RouteResponseView = { status: "error", message: error instanceof Error ? error.message : "Routing request failed." };
      setRoute(value); setMessage(value.message);
    } finally {
      if (generation === routeGeneration.current) { routeController.current = null; setRouting(false); }
    }
  }, [fitRoute]);
  executeRouteRef.current = executeRoute;

  mapClickRef.current = (event) => {
    const clickedCoverage = graphCoverageAt(event.lngLat.lng, event.lngLat.lat);
    if (clickedCoverage.status === "none") {
      setMessage("Map exploration is available here, but no prepared VECTORSHIFT graph can accept routing endpoints in this region.");
      return;
    }
    const snapped = snapToEligibleEndpoint(endpointsRef.current, event.lngLat.lng, event.lngLat.lat);
    if (!snapped) { setMessage("No routing-eligible node is within 150 metres of that point."); return; }
    clearRoute();
    if (selectionRole.current === "start") {
      setStart(snapped.endpoint.id); updateSelection(snapped.endpoint.id, inputRef.current.destination); selectionRole.current = "destination";
      setMessage(`Start snapped ${snapped.distance_m.toFixed(1)} m to an eligible node. Select a destination.`);
    } else {
      setDestination(snapped.endpoint.id); updateSelection(inputRef.current.start, snapped.endpoint.id); selectionRole.current = "start";
      setMessage(`Destination snapped ${snapped.distance_m.toFixed(1)} m to an eligible node. Review and compute the route.`);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++networkGeneration.current;
    setNetworkState("loading"); setMessage(`Loading ${humanMode(mode)} eligibility…`);
    fetch(`/api/network?mode=${mode}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const value = await response.json() as NetworkView | { message?: string }; if (!response.ok || !("status" in value) || value.status !== "ready") throw new Error("message" in value ? value.message : "Road graph unavailable."); return value; })
      .then((value) => {
        if (generation !== networkGeneration.current) return;
        setNetwork(value); networkRef.current = value; endpointsRef.current = value.endpoints; setNetworkState("ready");
        setMessage(`${value.endpoints.length.toLocaleString()} core-area nodes are selectable for ${humanMode(mode)}.`); installLayersRef.current();
        if (pendingModeRoute.current && inputRef.current.start && inputRef.current.destination) {
          pendingModeRoute.current = false;
          void executeRouteRef.current({ start_node_id: inputRef.current.start, destination_node_id: inputRef.current.destination, mode, algorithm: inputRef.current.algorithm });
        }
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && generation === networkGeneration.current) { setNetworkState("error"); setMessage(error instanceof Error ? error.message : "Road graph unavailable."); } });
    return () => controller.abort();
  }, [mode]);

  useEffect(() => { const map = mapRef.current; if (map?.isStyleLoaded()) for (const id of ["network-hit", "network-casing", "network-lines"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", networkVisible ? "visible" : "none"); }, [networkVisible]);
  useEffect(() => { const map = mapRef.current; if (map?.isStyleLoaded()) for (const id of ["route-casing", "route-line"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", routeVisible ? "visible" : "none"); }, [routeVisible]);

  const changeBasemap = (enabled: boolean) => {
    const map = mapRef.current;
    if (!map || (enabled && !BASEMAP_STYLE_URL)) return;
    basemapEnabledRef.current = enabled;
    basemapFallbackApplied.current = false;
    setBasemapEnabled(enabled);
    setBasemapState(enabled ? "loading" : "fallback");
    setBuildingsAvailable(false);
    setOverlayGeneration(0);
    if (!enabled && terrainEnabledRef.current) {
      terrainEnabledRef.current = false;
      setTerrainEnabled(false);
      setTerrainState(TERRAIN_TILES_URL ? "off" : "unavailable");
    }
    map.setStyle(enabled ? BASEMAP_STYLE_URL : EMPTY_STYLE, { diff: false });
  };

  const changeTerrain = (enabled: boolean) => {
    const map = mapRef.current;
    if (!map || !TERRAIN_TILES_URL) return;
    terrainEnabledRef.current = enabled;
    setTerrainEnabled(enabled);
    if (enabled) {
      setTerrainState("off");
      if (map.getStyle()) installLayersRef.current();
      return;
    }
    map.setTerrain(null);
    if (map.getSource(TERRAIN_SOURCE_ID)) map.removeSource(TERRAIN_SOURCE_ID);
    setTerrainState("off");
  };

  const changeBuildings = (visible: boolean) => {
    buildingsVisibleRef.current = visible;
    setBuildingsVisible(visible);
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    for (const id of buildingLayers.current) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  };

  const navigateTo = (id: CityPreset["id"]) => {
    const preset = cityPreset(id);
    const generation = ++cameraNavigationGeneration.current;
    activeCameraNavigation.current = { generation, preset };
    setLocationView((current) => ({
      ...current,
      activePreset: id,
      selectedCoverage: graphCoverageForPreset(id),
      pendingNavigationGeneration: generation,
    }));
    if (mapRef.current) resumeCameraNavigationRef.current();
  };

  const togglePerspective = () => {
    const map = mapRef.current;
    if (!map) return;
    const enabled = map.getPitch() < 10;
    const camera = { pitch: enabled ? 55 : 0, bearing: enabled ? -18 : 0 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.jumpTo(camera);
    else map.easeTo({ ...camera, duration: 600, essential: false });
  };

  const useSuggested = () => {
    const pair = network?.suggested_pair; if (!pair) return;
    clearRoute(); setStart(pair.start_node_id); setDestination(pair.destination_node_id); selectionRole.current = "start"; updateSelection(pair.start_node_id, pair.destination_node_id);
    setMessage("Loaded a deterministic pair from the largest eligible strongly connected component.");
  };
  const clearSelections = () => { clearRoute(); setStart(""); setDestination(""); selectionRole.current = "start"; updateSelection("", ""); setMessage("Selections cleared. Choose a start node on the map or in the inspector."); };
  const swapSelections = () => {
    if (!start || !destination) return;
    const shouldRoute = route !== null || routing; const nextStart = destination; const nextDestination = start;
    clearRoute(); setStart(nextStart); setDestination(nextDestination); updateSelection(nextStart, nextDestination); setMessage("Start and destination swapped.");
    if (shouldRoute) void executeRoute({ start_node_id: nextStart, destination_node_id: nextDestination, mode, algorithm });
  };
  const changeMode = (next: WebTravelMode) => { pendingModeRoute.current = route !== null || routing; clearRoute(); setMode(next); };
  const changeAlgorithm = (next: WebRoutingAlgorithm) => { const shouldRoute = route !== null || routing; clearRoute(); setAlgorithm(next); if (shouldRoute && start && destination) void executeRoute({ start_node_id: start, destination_node_id: destination, mode, algorithm: next }); };
  const statusClass = networkState === "error" || route?.status === "error" || route?.status === "unsupported" ? "error" : route?.status === "found" && route.boundary.status === "boundary_sensitive" ? "warning" : "ready";

  return (
    <main className={`workspace ${inspectorOpen ? "" : "inspector-closed"}`}>
      <header className="topbar">
        <div className="identity"><span className="identity-glyph" aria-hidden="true">VS</span><span className="brand-mark">VECTORSHIFT</span></div>
        <div className="workspace-crumb"><span>Worldwide map</span><span className="crumb-separator">/</span><strong>Routing lab</strong></div>
        <div className="city-control"><label htmlFor="city-preset">Go to</label><select id="city-preset" value={activePreset} disabled={!mapInitialized} aria-busy={!mapInitialized} onChange={(event) => { if (event.target.value !== "custom") navigateTo(event.target.value as CityPreset["id"]); }}><option value="custom" disabled>Custom view</option>{CITY_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></div>
        <div className="top-meta"><StatusPill tone={coverage.status === "qualified" ? "positive" : coverage.status === "experimental" ? "warning" : "neutral"}><span data-testid="graph-coverage-status" aria-label={`${activePreset === "custom" ? "Viewport centre" : "Selected location"} coverage: ${coverage.label}`}>{coverage.label}</span></StatusPill><span className="dataset-chip mono" title={network?.graph.graph_sha256}>{network?.graph.dataset_version ?? "graph loading"}</span><IconButton label="Fit computed route" onClick={fitRoute} disabled={route?.status !== "found"}><ToolIcon name="fit" /></IconButton><IconButton label={inspectorOpen ? "Close route inspector" : "Open route inspector"} onClick={() => setInspectorOpen((value) => !value)}><ToolIcon name="panel" /></IconButton></div>
      </header>

      <nav className="rail" aria-label="Workspace sections">
        <button className="rail-button" type="button" onClick={() => mapRef.current?.getCanvas().focus()}><ToolIcon name="explore" /><span>Explore</span></button>
        <button className="rail-button active" type="button" aria-current="page" onClick={() => setInspectorOpen(true)}><ToolIcon name="route" /><span>Routing</span></button>
        <button className="rail-button" type="button" onClick={() => setLayersOpen((value) => !value)}><ToolIcon name="network" /><span>Network</span></button>
        <div className="rail-spacer" /><button className="rail-button unavailable" type="button" disabled title="Scenario engineering begins in Phase 2"><ToolIcon name="scenario" /><span>Scenario</span></button>
      </nav>

      <section className="map-region" aria-label="Road graph map">
        <div ref={mapContainer} className="map" data-testid="routing-map" data-map-ready={networkState === "ready"} data-overlays-ready={overlayGeneration > 0} data-terrain-state={terrainState} data-selected-coverage={coverage.status} data-viewport-coverage={viewportCoverage.status} data-active-preset={activePreset} data-navigation-state={locationView.pendingNavigationGeneration === null ? "settled" : "moving"} data-center-longitude={viewPosition.longitude.toFixed(4)} data-center-latitude={viewPosition.latitude.toFixed(4)} data-pitch={viewPosition.pitch.toFixed(1)} data-bearing={viewPosition.bearing.toFixed(1)} />
        <div className="map-context"><span className="map-kicker">{Math.abs(viewPosition.latitude).toFixed(4)}° {viewPosition.latitude >= 0 ? "N" : "S"} · {Math.abs(viewPosition.longitude).toFixed(4)}° {viewPosition.longitude >= 0 ? "E" : "W"}</span><strong>{viewportCoverage.region}</strong><span>Viewport coverage · {viewportCoverage.label}</span></div>
        <div className={`coverage-notice coverage-${coverage.status}`} role="status" aria-live="polite" data-testid="coverage-detail"><strong>{coverage.label}</strong><span><span data-testid="coverage-scope">{activePreset === "custom" ? "Viewport centre" : "Selected location"}</span> · {coverage.message}</span></div>
        <button type="button" className="layers-trigger" aria-expanded={layersOpen} onClick={() => setLayersOpen((value) => !value)}><ToolIcon name="layers" /> Layers</button>
        {layersOpen && <div className="layer-menu" aria-label="Map layer visibility"><div className="layer-menu-heading"><strong>Map layers</strong><span>Context ≠ topology</span></div>
          <label><input type="checkbox" checked={basemapEnabled} disabled={!BASEMAP_STYLE_URL} onChange={(event) => changeBasemap(event.target.checked)} /><span>Worldwide vector basemap<small data-testid="basemap-status">{basemapState === "available" ? "Vector context loaded" : basemapState === "loading" ? "Connecting…" : "Graph-only fallback"}</small></span></label>
          <label><input type="checkbox" checked={terrainEnabled} disabled={!TERRAIN_TILES_URL} onChange={(event) => changeTerrain(event.target.checked)} /><span>3D terrain<small data-testid="terrain-status">{terrainState === "enabled" ? "DEM enabled" : terrainState === "off" ? "Rights-reviewed source configured" : terrainState === "error" ? "DEM unavailable" : "Configure a licensed DEM"}</small></span></label>
          <label><input type="checkbox" checked={buildingsAvailable && buildingsVisible} disabled={!buildingsAvailable} onChange={(event) => changeBuildings(event.target.checked)} /><span>3D buildings<small data-testid="buildings-status">{buildingsAvailable ? "Provider height data only" : "No compatible extrusion layer"}</small></span></label>
          <label><input type="checkbox" checked={networkVisible} onChange={(event) => setNetworkVisible(event.target.checked)} /><span>Routing topology<small>Authoritative graph</small></span></label>
          <label><input type="checkbox" checked={routeVisible} onChange={(event) => setRouteVisible(event.target.checked)} /><span>Computed route<small>Ordered edge geometry</small></span></label>
          <button type="button" className="layer-action" onClick={togglePerspective}>{viewPosition.pitch >= 10 ? "Reset overhead camera" : "Pitch and rotate camera"}</button></div>}
        <div className="map-legend" aria-label="Map legend"><div><span className="line-key network" />Directed road graph</div><div><span className="line-key route" />Computed route</div><div><span className="point-key start" />Start</div><div><span className="point-key destination" />Destination</div></div>
        {hoveredEdge && <div className="hover-readout"><span>Graph edge</span><code>{hoveredEdge}</code></div>}
      </section>

      <aside className="inspector" aria-label="Route inspector" aria-hidden={!inspectorOpen}>
        <div className="inspector-handle" aria-hidden="true" />
        <div className="inspector-header"><div><p className="eyebrow">Reference routing</p><h1>Inspect a legal graph path</h1></div><IconButton label="Close route inspector" className="inspector-close" onClick={() => setInspectorOpen(false)}><ToolIcon name="panel" /></IconButton><p className="muted">Real topology and ordered edge geometry. Proximity does not itself prove legal access.</p></div>
        <section className="panel" aria-labelledby="route-inputs"><div className="section-heading"><h2 id="route-inputs">Route setup</h2><span>01</span></div>
          <div className="control-grid"><div className="field"><label htmlFor="mode">Travel mode</label><select id="mode" className="control" value={mode} onChange={(event) => changeMode(event.target.value as WebTravelMode)}><option value="motor_vehicle">Motor vehicle</option><option value="bicycle">Bicycle</option><option value="pedestrian">Pedestrian</option></select></div><div className="field"><label htmlFor="algorithm">Algorithm</label><select id="algorithm" className="control" value={algorithm} onChange={(event) => changeAlgorithm(event.target.value as WebRoutingAlgorithm)}><option value="astar">A*</option><option value="dijkstra">Dijkstra</option></select></div></div>
          <div className="endpoint-field"><span className="endpoint-letter start">A</span><div className="field"><label htmlFor="start-node">Start node</label><input id="start-node" className="control mono" value={start} onChange={(event) => { clearRoute(); setStart(event.target.value); updateSelection(event.target.value, destination); }} placeholder="Select map or enter node:osm:…" /></div></div>
          <div className="endpoint-connector" /><div className="endpoint-field"><span className="endpoint-letter destination">B</span><div className="field"><label htmlFor="destination-node">Destination node</label><input id="destination-node" className="control mono" value={destination} onChange={(event) => { clearRoute(); setDestination(event.target.value); updateSelection(start, event.target.value); }} placeholder="Select map or enter node:osm:…" /></div></div>
          <div className="endpoint-actions"><button type="button" className="text-button" onClick={swapSelections} disabled={!start || !destination}><ToolIcon name="swap" /> Swap</button><button type="button" className="text-button" onClick={clearSelections} disabled={!start && !destination}><ToolIcon name="clear" /> Clear</button></div>
          <div className="button-row"><button type="button" className="button" onClick={useSuggested} disabled={!network?.suggested_pair}>Reference pair</button><button type="button" className="button primary" onClick={() => void executeRoute({ start_node_id: start, destination_node_id: destination, mode, algorithm })} disabled={routing || networkState !== "ready" || !start || !destination}>{routing ? <><span className="spinner" />Computing</> : "Compute route"}</button></div>
        </section>
        <section className="panel" aria-labelledby="route-status"><div className="section-heading"><h2 id="route-status">Routing state</h2><span>02</span></div><div className={`status ${statusClass}`} role="status" aria-live="polite" data-testid="route-status"><span className="status-symbol" aria-hidden="true" />{message}</div>{route?.status === "unsupported" && <div className="diagnostic danger" data-testid="unsupported-detail"><strong>Legal semantics unresolved</strong><span>Affected OSM relations: {route.relation_ids.join(", ") || "not identified"}</span><span>{route.categories.join(", ")}</span></div>}</section>
        {route?.status === "found" && <section className="panel result-panel" aria-labelledby="route-evidence" data-testid="route-result"><div className="section-heading"><h2 id="route-evidence">Route evidence</h2><span>03</span></div>
          <div className="result-hero"><div><span>Distance</span><strong data-testid="route-distance">{(route.distance_mm / 1_000_000).toFixed(2)}<small> km</small></strong></div><div><span>Synthetic cost</span><strong data-testid="route-cost">{(route.cost_ms / 1000).toFixed(1)}<small> s</small></strong></div></div>
          <dl className="metrics"><div className="metric"><dt>Algorithm</dt><dd>{route.algorithm === "astar" ? "A*" : "Dijkstra"}</dd></div><div className="metric"><dt>Route edges</dt><dd>{route.edge_path.length}</dd></div><div className="metric"><dt>Expanded</dt><dd>{route.diagnostics.states_expanded.toLocaleString()}</dd></div><div className="metric"><dt>Local compute</dt><dd>{route.diagnostics.server_compute_ms.toFixed(2)} ms</dd></div></dl>
          <div className={`qualification ${route.boundary.status === "supported" ? "supported" : "caution"}`}><span>{route.boundary.status === "supported" ? "✓" : "!"}</span><div><strong>{route.boundary.status === "supported" ? "Core-area route" : "Boundary-sensitive route"}</strong><p>{route.boundary.message}</p></div></div>
          <details className="evidence-details"><summary>Provenance and ordered edge path</summary><dl className="metadata-list"><div><dt>Graph</dt><dd className="mono">{route.dataset_version}</dd></div><div><dt>Integrity</dt><dd className="mono">{route.graph_sha256.slice(0, 16)}…</dd></div><div><dt>U-turn policy</dt><dd>Source rules only</dd></div></dl><ol className="path-list">{route.edge_path.map((edge, index) => <li key={`${edge}-${index}`}>{edge}</li>)}</ol></details>
        </section>}
        <section className="panel graph-summary"><details><summary>Graph metadata</summary>{network && <dl className="metadata-list"><div><dt>Nodes</dt><dd>{network.graph.node_count.toLocaleString()}</dd></div><div><dt>Directed edges</dt><dd>{network.graph.edge_count.toLocaleString()}</dd></div><div><dt>Turn rules</dt><dd>{network.graph.turn_rule_count.toLocaleString()}</dd></div><div><dt>Selectable core nodes</dt><dd>{network.endpoints.length.toLocaleString()}</dd></div><div><dt>SHA-256</dt><dd className="mono">{network.graph.graph_sha256}</dd></div></dl>}</details></section>
      </aside>

      <footer className="footer"><span className="disclosure"><strong>Synthetic free-flow cost</strong> Not observed traffic, navigation advice, or a prediction.</span><span className="footer-attribution">{network?.attribution ?? "Road graph © OpenStreetMap contributors"} · {basemapState === "available" ? BASEMAP_ATTRIBUTION : "graph-only fallback"}{terrainEnabled ? " · Terrain attribution in map credits" : ""}</span></footer>
    </main>
  );
}
