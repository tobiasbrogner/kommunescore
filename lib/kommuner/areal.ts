// Areal af en polygonring i km² (lon/lat), beregnet med en lokal flad projektion.
// Præcist nok på dansk breddegrad (under ca. 1 % fejl) til både kortet og rapporten.
export function polygonArealKm2(ring: GeoJSON.Position[]) {
  const lat0 = (ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length) * (Math.PI / 180);
  const kmPrGradLon = 111.32 * Math.cos(lat0);
  const kmPrGradLat = 110.57;
  let areal = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    areal += x1 * kmPrGradLon * (y2 * kmPrGradLat) - x2 * kmPrGradLon * (y1 * kmPrGradLat);
  }
  return Math.abs(areal) / 2;
}

// Samlet landareal for en kommune: alle dele (fastland og øer), minus eventuelle huller.
export function geometriArealKm2(geometri: GeoJSON.Geometry) {
  const polygoner =
    geometri.type === "Polygon"
      ? [geometri.coordinates]
      : geometri.type === "MultiPolygon"
        ? geometri.coordinates
        : [];
  return polygoner.reduce(
    (sum, [ydre, ...huller]) =>
      sum + polygonArealKm2(ydre) - huller.reduce((h, ring) => h + polygonArealKm2(ring), 0),
    0,
  );
}
