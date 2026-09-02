import { createFileRoute } from "@tanstack/react-router";
import AuthPage from "@/pages/Auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar en Asternal — Inicia sesión o crea tu cuenta" },
      {
        name: "description",
        content:
          "Accede a tu cuenta de Asternal o regístrate para empezar a publicar proyectos y conectar con la comunidad.",
      },
      { property: "og:title", content: "Entrar en Asternal" },
      {
        property: "og:description",
        content: "Inicia sesión o crea tu cuenta de Asternal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPage redirectAfterAuth="/dashboard" />,
});