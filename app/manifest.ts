import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "לוח ביקור בישראל",
    short_name: "לוח ביקור",
    description: "לוח זמנים משפחתי לביקור בישראל עם אדמין, הצעות, שבוע אג׳נדה וחזרתיות.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e6",
    theme_color: "#f7f1e6",
    lang: "he",
    dir: "rtl",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
