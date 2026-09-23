// Konum yardımcıları. Konumlar ~1 km hassasiyete yuvarlanarak saklanır (gizlilik).

export const roundCoord = (v: number) => Math.round(v * 100) / 100;

// İki nokta arası kuş uçuşu mesafe (km, Haversine)
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Located = { latitude: number | null; longitude: number | null } | null | undefined;

// Gösterim için yuvarlanmış mesafe; konumu bilinmeyenler için null
export function roundedDistance(a: Located, b: Located): number | null {
  if (a?.latitude == null || a.longitude == null || b?.latitude == null || b.longitude == null) return null;
  return Math.max(1, Math.round(distanceKm(a.latitude, a.longitude, b.latitude, b.longitude)));
}
