/**
 * Votatlas independent Census 2020 geometry transformer.
 * Source: U.S. Census Bureau TIGER2020PL / STATE / 47 / tl_2020_47_county20.
 * This implementation deliberately does not depend on third-party map code.
 */
export const GEOMETRY_TOLERANCE_DEGREES = 0.00015;
const LONGITUDE_SCALE = Math.cos(36 * Math.PI / 180);
const LIMITS = Object.freeze({ west: -90.5, south: 34.8, east: -81.4, north: 36.9 });
const square = n => n * n;
function insist(test, message) { if (!test) throw new Error('Tennessee county geometry: ' + message); }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** Iterative Ramer-Douglas-Peucker; process closed rings as two open chains. */
function simplifyOpen(points) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  keep[0] = 1; keep[points.length - 1] = 1;
  while (stack.length) {
    const [start, end] = stack.pop();
    const a = points[start], b = points[end];
    const x1 = a[0] * LONGITUDE_SCALE, y1 = a[1];
    const x2 = b[0] * LONGITUDE_SCALE, y2 = b[1];
    const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    let best = -1, at = -1;
    for (let i = start + 1; i < end; i++) {
      const x = points[i][0] * LONGITUDE_SCALE, y = points[i][1];
      const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0;
      const distance = square(x - x1 - t * dx) + square(y - y1 - t * dy);
      if (distance > best) { best = distance; at = i; }
    }
    if (best > square(GEOMETRY_TOLERANCE_DEGREES)) {
      keep[at] = 1;
      stack.push([start, at], [at, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
function simplifyRing(source) {
  insist(Array.isArray(source) && source.length >= 4, 'source ring too short');
  const first = source[0], last = source[source.length - 1];
  insist(first[0] === last[0] && first[1] === last[1], 'source ring must be closed');
  const points = source.slice(0, -1).map(point => {
    insist(Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]), 'bad source coordinate');
    return [+point[0].toFixed(6), +point[1].toFixed(6)];
  });
  let pivot = 1, furthest = -1;
  const anchor = points[0];
  for (let i = 1; i < points.length; i++) {
    const distance = square((points[i][0] - anchor[0]) * LONGITUDE_SCALE) + square(points[i][1] - anchor[1]);
    if (distance > furthest) { furthest = distance; pivot = i; }
  }
  let reduced = simplifyOpen(points.slice(0, pivot + 1)).slice(0, -1)
    .concat(simplifyOpen(points.slice(pivot).concat([points[0]])));
  if (reduced.length < 3) reduced = points;
  return reduced.concat([reduced[0]]);
}

/** Strictly transform 2020 Census source fields to E1's map adapter feature schema. */
export function createRealTennesseeGeometry(source, references) {
  insist(isRecord(source) && source.type === 'FeatureCollection' && Array.isArray(source.features), 'expected source FeatureCollection');
  insist(source.crs?.properties?.name === 'urn:ogc:def:crs:EPSG::4269', 'source must be 2020 Census NAD83 (EPSG:4269)');
  insist(Array.isArray(references) && references.length === 95, 'requires 95 authoritative county references');
  const names = new Map(references.map(ref => [ref.geoId, ref.name]));
  insist(names.size === 95, 'duplicate reference GEOIDs');
  insist(source.features.length === 95, 'source must have exactly 95 counties');
  const features = source.features.map(feature => {
    const sourceProperties = feature.properties;
    const geoId = sourceProperties?.GEOID20;
    insist(sourceProperties?.STATEFP20 === '47' && names.has(geoId), 'unexpected source county: ' + geoId);
    const geometry = feature.geometry;
    insist(geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon', 'unsupported source geometry: ' + geoId);
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const transformed = polygons.map(polygon => {
      insist(Array.isArray(polygon) && polygon.length > 0, 'empty polygon: ' + geoId);
      return polygon.map(simplifyRing);
    });
    return { type: 'Feature', id: geoId, properties: { geoId, name: names.get(geoId) },
      geometry: { type: geometry.type, coordinates: geometry.type === 'Polygon' ? transformed[0] : transformed } };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const result = { type: 'FeatureCollection', features };
  validateTennesseeGeometry(result, references);
  return result;
}

/** Validate real WGS84-compatible geographic coordinates and lossless county-to-vote joins. */
export function validateTennesseeGeometry(input, references) {
  insist(isRecord(input) && input.type === 'FeatureCollection' && Array.isArray(input.features), 'expected FeatureCollection');
  insist(Array.isArray(references) && references.length === 95, 'expected 95 county reference rows');
  insist(input.features.length === 95, 'exactly 95 county shapes required');
  const names = new Map(references.map(ref => [ref.geoId, ref.name]));
  insist(names.size === 95, 'duplicate county reference GEOIDs');
  const seen = new Set();
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  let vertices = 0, multipolygons = 0, holes = 0;
  for (let i = 0; i < input.features.length; i++) {
    const feature = input.features[i];
    insist(isRecord(feature) && feature.type === 'Feature' && isRecord(feature.properties), 'invalid Feature at ' + i);
    const id = feature.properties.geoId;
    insist(typeof id === 'string' && /^47\d{3}$/.test(id) && id === feature.id, 'GEOID id mismatch: ' + id);
    insist(names.has(id) && feature.properties.name === names.get(id), 'unrecognized county name/GEOID: ' + id);
    insist(!seen.has(id), 'duplicate county GEOID ' + id);
    insist(i === 0 || input.features[i - 1].id < id, 'features must be sorted by GEOID');
    seen.add(id);
    const geometry = feature.geometry;
    insist(isRecord(geometry) && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'), 'invalid Polygon/MultiPolygon: ' + id);
    if (geometry.type === 'MultiPolygon') multipolygons++;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    insist(Array.isArray(polygons) && polygons.length > 0, 'empty polygon: ' + id);
    for (const polygon of polygons) {
      insist(Array.isArray(polygon) && polygon.length > 0, 'empty polygon rings: ' + id);
      holes += polygon.length - 1;
      for (const ring of polygon) {
        insist(Array.isArray(ring) && ring.length >= 4, 'short ring: ' + id);
        const first = ring[0], last = ring[ring.length - 1];
        insist(Array.isArray(first) && Array.isArray(last) && first[0] === last[0] && first[1] === last[1], 'unclosed ring: ' + id);
        const unique = new Set();
        let signedDoubleArea = 0;
        for (let j = 0; j < ring.length; j++) {
          const point = ring[j];
          insist(Array.isArray(point) && point.length === 2, 'invalid coordinate pair: ' + id);
          const [lon, lat] = point;
          insist(Number.isFinite(lon) && Number.isFinite(lat), 'non-finite coordinate: ' + id);
          insist(lon >= LIMITS.west && lon <= LIMITS.east && lat >= LIMITS.south && lat <= LIMITS.north, 'coordinate outside Tennessee bbox: ' + id);
          bbox[0] = Math.min(bbox[0], lon); bbox[1] = Math.min(bbox[1], lat);
          bbox[2] = Math.max(bbox[2], lon); bbox[3] = Math.max(bbox[3], lat);
          unique.add(lon + ',' + lat);
          vertices++;
          if (j < ring.length - 1) signedDoubleArea += lon * ring[j + 1][1] - ring[j + 1][0] * lat;
        }
        insist(unique.size >= 3 && Math.abs(signedDoubleArea) > 1e-11, 'degenerate zero-area ring: ' + id);
      }
    }
  }
  insist(seen.size === names.size && references.every(ref => seen.has(ref.geoId)), 'missing county or extra GEOID');
  return { count: seen.size, bbox, vertices, multipolygons, holes };
}
