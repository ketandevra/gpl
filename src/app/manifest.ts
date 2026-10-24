import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description:
      "Live scores, teams, players, and stats for Ghanchi Premier League.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#3e2723",
    theme_color: "#3e2723",
    lang: "en-IN",
    dir: "ltr",
    orientation: "any",
    categories: ["sports"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Matches",
        short_name: "Matches",
        url: "/matches",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Players",
        short_name: "Players",
        url: "/players",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Tournaments",
        short_name: "Tournaments",
        url: "/tournaments",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
