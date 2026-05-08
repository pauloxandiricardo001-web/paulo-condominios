import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paulo Condomínios",
    short_name: "Paulo Cond.",
    description: "Sistema de gestão financeira de condomínios",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#2563eb",
    orientation: "portrait",
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
    ],
  };
}