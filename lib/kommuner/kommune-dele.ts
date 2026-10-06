import { polygonArealKm2 } from "@/lib/kommuner/areal";
import { navnePunkt } from "@/lib/kommuner/navne-punkt";

// Hver landdel (fastland og øer) af hver kommune som sin egen polygon med arealet i km².
export function opdelIKommuneDele(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const dele: GeoJSON.Feature[] = [];
  data.features.forEach((feature) => {
    const kode = feature.properties?.kode as string;
    const geometri = feature.geometry;
    const polygoner =
      geometri.type === "Polygon"
        ? [geometri.coordinates]
        : geometri.type === "MultiPolygon"
          ? geometri.coordinates
          : [];
    polygoner.forEach((polygon) => {
      dele.push({
        type: "Feature",
        properties: { kode, areal: polygonArealKm2(polygon[0]) },
        geometry: { type: "Polygon", coordinates: polygon },
      });
    });
  });
  return { type: "FeatureCollection", features: dele };
}

// Ét punkt pr. kommune midt i dens største landdel, så navnet står én gang (på
// fastlandet) og ikke på hver ø. Et punkt og ikke selve polygonen: MapLibre deler
// GeoJSON op i fliser og sætter ellers et navn i hver flise, når man zoomer ind.
// Beregningen tager et par hundrede ms, så den laves på forhånd af
// scripts/byg-kortgraenser.ts (public/data/kommune-navne.geojson) og ikke i browseren.
export function kommuneNavnePunkter(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const stoerste = new Map<string, GeoJSON.Feature>();
  for (const del of opdelIKommuneDele(data).features) {
    const kode = del.properties?.kode as string;
    const nuvaerende = stoerste.get(kode);
    if (!nuvaerende || del.properties!.areal > nuvaerende.properties!.areal) {
      stoerste.set(kode, del);
    }
  }
  const navnPrKode = new Map(
    data.features.map((f) => [f.properties?.kode as string, f.properties?.navn as string]),
  );
  return {
    type: "FeatureCollection",
    features: [...stoerste.values()].map((del) => ({
      type: "Feature",
      properties: { kode: del.properties?.kode, navn: navnPrKode.get(del.properties?.kode as string) },
      geometry: {
        type: "Point",
        coordinates: navnePunkt((del.geometry as GeoJSON.Polygon).coordinates),
      },
    })),
  };
}
