export function buildGoogleMapsSearchUrl(location: string) {
  const query = location.trim();

  if (!query) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
