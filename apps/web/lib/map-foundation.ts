export type GraphCoverageStatus = "qualified" | "experimental" | "none";

export interface GraphCoverage {
  readonly status: GraphCoverageStatus;
  readonly label: string;
  readonly region: string;
  readonly message: string;
}

export interface CityPreset {
  readonly id: "world" | "toronto" | "welland" | "niagara-falls";
  readonly label: string;
  readonly center: readonly [longitude: number, latitude: number];
  readonly zoom: number;
}

export const CITY_PRESETS: readonly CityPreset[] = [
  { id: "world", label: "World", center: [0, 20], zoom: 1.5 },
  { id: "toronto", label: "Toronto", center: [-79.3805, 43.6482], zoom: 13.2 },
  { id: "welland", label: "Welland", center: [-79.2483, 42.9922], zoom: 12.8 },
  { id: "niagara-falls", label: "Niagara Falls", center: [-79.0849, 43.0896], zoom: 12.8 },
] as const;

const CITY_PRESET_MATCH_TOLERANCE_DEGREES = 0.005;

const TORONTO_REFERENCE_BOUNDS = {
  south: 43.6426,
  west: -79.3905,
  north: 43.6538,
  east: -79.3705,
} as const;

const NO_GRAPH: GraphCoverage = {
  status: "none",
  label: "No available graph",
  region: "Worldwide exploration",
  message: "Basemap exploration is available here, but VECTORSHIFT has no prepared routing or simulation graph for this view.",
};

function validateCoordinate(longitude: number, latitude: number): void {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new TypeError("Coverage coordinates must be finite WGS84 longitude and latitude values.");
  }
}

export function graphCoverageAt(longitude: number, latitude: number): GraphCoverage {
  validateCoordinate(longitude, latitude);

  if (
    longitude >= TORONTO_REFERENCE_BOUNDS.west
    && longitude <= TORONTO_REFERENCE_BOUNDS.east
    && latitude >= TORONTO_REFERENCE_BOUNDS.south
    && latitude <= TORONTO_REFERENCE_BOUNDS.north
  ) {
    return {
      status: "experimental",
      label: "Experimental graph",
      region: "Downtown Toronto reference",
      message: "A bounded validation graph is available. Publication blockers and route qualification diagnostics still apply.",
    };
  }

  return NO_GRAPH;
}

export function cityPreset(id: CityPreset["id"]): CityPreset {
  const preset = CITY_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new TypeError(`Unknown city preset: ${id}`);
  return preset;
}

export function graphCoverageForPreset(id: CityPreset["id"]): GraphCoverage {
  const preset = cityPreset(id);
  return graphCoverageAt(preset.center[0], preset.center[1]);
}

export function cityPresetAt(longitude: number, latitude: number): CityPreset | null {
  validateCoordinate(longitude, latitude);
  return CITY_PRESETS.find((preset) => (
    Math.abs(preset.center[0] - longitude) < CITY_PRESET_MATCH_TOLERANCE_DEGREES
    && Math.abs(preset.center[1] - latitude) < CITY_PRESET_MATCH_TOLERANCE_DEGREES
  )) ?? null;
}

export function isAtCityPreset(longitude: number, latitude: number, id: CityPreset["id"]): boolean {
  validateCoordinate(longitude, latitude);
  const preset = cityPreset(id);
  return Math.abs(preset.center[0] - longitude) < 0.0001 && Math.abs(preset.center[1] - latitude) < 0.0001;
}
