import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Royal Medica IT Tracker",
    short_name: "IT Tracker",
    description: "Enterprise IT Project, Support SLA, Asset QR & Preventive Maintenance Command Center",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#3B74B8",
    orientation: "any",
    icons: [
      {
        src: "/brand/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/brand/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
    ],
  };
}
