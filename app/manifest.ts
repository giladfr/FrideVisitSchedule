import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ביקור פרידאים בישראל - קיץ 2026",
    short_name: "ביקור פרידאים",
    description: "לוח הזמנים של ביקור פרידאים בישראל בקיץ 2026.",
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
