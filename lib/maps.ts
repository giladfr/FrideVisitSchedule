export function buildGoogleMapsSearchUrl(location: string) {
  const query = location.trim();

  if (!query) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildWazeSearchUrl(location: string) {
  const query = location.trim();

  if (!query) {
    return "";
  }

  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}
