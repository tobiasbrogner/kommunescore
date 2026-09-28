// Det punkt inde i en polygon, der ligger længst fra kanten ("pole of inaccessibility",
// samme metode som Mapbox' polylabel). Bruges til at placere kommunenavnet ét sted,
// midt i kommunen, også når formen er buet, så tyngdepunktet ville ligge udenfor.
//
// Længdegrader skaleres med cos(breddegrad), så afstande regnes i ens enheder begge
// veje. Præcisionen er i (skalerede) grader; 0,01 svarer til ca. 1 km.
const MAKS_PUNKTER_PR_RING = 400;

export function navnePunkt(polygon: GeoJSON.Position[][], praecision = 0.01): GeoJSON.Position {
  const ydre = polygon[0];
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ydre) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const skala = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  // Detaljerede kyster har tusindvis af punkter; til et navn er hvert n'te nok.
  const ringe = polygon.map((ring) => {
    const trin = Math.max(1, Math.floor(ring.length / MAKS_PUNKTER_PR_RING));
    return ring.filter((_, i) => i % trin === 0).map(([x, y]) => [x * skala, y]);
  });
  [minX, maxX] = [minX * skala, maxX * skala];

  const bredde = maxX - minX;
  const hoejde = maxY - minY;
  const cellestoerrelse = Math.min(bredde, hoejde);
  if (cellestoerrelse === 0) return [minX / skala, minY];

  type Celle = { x: number; y: number; h: number; d: number; max: number };
  const celle = (x: number, y: number, h: number): Celle => {
    const d = afstandTilKant(x, y, ringe);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  // Dæk polygonen med kvadratiske celler, og del kun de celler op, der stadig kan
  // indeholde et bedre punkt end det bedste hidtil.
  const koe: Celle[] = [];
  const h = cellestoerrelse / 2;
  for (let x = minX; x < maxX; x += cellestoerrelse) {
    for (let y = minY; y < maxY; y += cellestoerrelse) {
      koe.push(celle(x + h, y + h, h));
    }
  }

  let bedst = celle(minX + bredde / 2, minY + hoejde / 2, 0);
  while (koe.length) {
    let i = 0;
    for (let j = 1; j < koe.length; j++) if (koe[j].max > koe[i].max) i = j;
    const c = koe[i];
    koe[i] = koe[koe.length - 1];
    koe.pop();

    if (c.d > bedst.d) bedst = c;
    if (c.max - bedst.d <= praecision) continue;

    const nh = c.h / 2;
    koe.push(
      celle(c.x - nh, c.y - nh, nh),
      celle(c.x + nh, c.y - nh, nh),
      celle(c.x - nh, c.y + nh, nh),
      celle(c.x + nh, c.y + nh, nh),
    );
  }

  return [bedst.x / skala, bedst.y];
}

// Afstand fra punktet til nærmeste kant; negativ, hvis punktet ligger udenfor.
function afstandTilKant(px: number, py: number, ringe: number[][][]) {
  let inde = false;
  let minAfstand2 = Infinity;
  for (const ring of ringe) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inde = !inde;
      minAfstand2 = Math.min(minAfstand2, afstand2TilLinjestykke(px, py, ax, ay, bx, by));
    }
  }
  return (inde ? 1 : -1) * Math.sqrt(minAfstand2);
}

function afstand2TilLinjestykke(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  let [x, y] = [ax, ay];
  const [dx, dy] = [bx - ax, by - ay];
  if (dx !== 0 || dy !== 0) {
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = [bx, by];
    else if (t > 0) [x, y] = [ax + dx * t, ay + dy * t];
  }
  return (px - x) ** 2 + (py - y) ** 2;
}
