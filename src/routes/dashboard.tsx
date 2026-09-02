import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import Dashboard from "@/pages/Dashboard";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tu feed en Asternal — Panel de la comunidad" },
      {
        name: "description",
        content:
          "Publica actualizaciones, sigue a otros desarrolladores y gestiona tu perfil desde tu panel de Asternal.",
      },
      { property: "og:title", content: "Tu feed en Asternal" },
      {
        property: "og:description",
        content: "Publica, comenta y sigue a la comunidad de Asternal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});