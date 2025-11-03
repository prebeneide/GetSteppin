/**
 * Polyline Encoder for Mapbox Static Images API
 * Encodes coordinates into a polyline string (more compact than semicolon-separated)
 * Based on Google's polyline encoding algorithm
 */

export function encodePolyline(coordinates: Array<{ lat: number; lng: number }>): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    // Encode latitude
    const latDiff = Math.round((coord.lat - prevLat) * 1e5);
    encoded += encodeSignedNumber(latDiff);
    prevLat = coord.lat;

    // Encode longitude
    const lngDiff = Math.round((coord.lng - prevLng) * 1e5);
    encoded += encodeSignedNumber(lngDiff);
    prevLng = coord.lng;
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) {
    sgnNum = ~(sgnNum);
  }
  return encodeNumber(sgnNum);
}

function encodeNumber(num: number): string {
  let encoded = '';
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  encoded += String.fromCharCode(num + 63);
  return encoded;
}

