function normalizeImageUrl(sourceUrl: string, candidate: string) {
  try {
    return new URL(candidate, sourceUrl).toString();
  } catch {
    return "";
  }
}

function extractMetaImage(html: string, sourceUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return normalizeImageUrl(sourceUrl, match[1]);
    }
  }

  return "";
}

export async function fetchPlaceImagePreview(placeUrl: string) {
  const normalizedUrl = placeUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FrideVisitScheduleBot/1.0)",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return "";
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) {
      return response.url;
    }

    const html = await response.text();
    return extractMetaImage(html, response.url);
  } catch {
    return "";
  }
}
