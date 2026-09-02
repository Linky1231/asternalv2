import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/pages/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asternal — Crea, publica y conecta con desarrolladores" },
      {
        name: "description",
        content:
          "Asternal Engine: crea proyectos, comparte tus avances y conecta con una comunidad de desarrolladores en una red social integrada.",
      },
      { property: "og:title", content: "Asternal — Crea, publica y conecta" },
      {
        property: "og:description",
        content:
          "Crea proyectos, comparte tus avances y conecta con desarrolladores en Asternal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});