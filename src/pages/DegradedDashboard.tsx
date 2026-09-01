import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDegradedMode } from "@/components/ConvexGraceful";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Home, User, LogOut, WifiOff, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Degraded Dashboard — rendered when Convex is unavailable.
 * Shows the app shell (navbar, bottom nav) with a clear degraded-mode banner
 * and empty state for all sections. No Convex hooks are used.
 */
export default function DegradedDashboard() {
  const { user, signOut } = useAuth();
  const { isDegraded } = useDegradedMode();
  const [activeTab, setActiveTab] = useState<"feed" | "profile">("feed");

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Navbar ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img
              src="/assets/67385.png"
              alt="Asternal"
              className="h-7 w-7 rounded-lg object-contain"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Asternal
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* ── Degraded Mode Banner ────────────────────────────── */}
      {isDegraded && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="border-b border-amber-200/60 bg-amber-50/80 px-4 py-3"
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <WifiOff className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Modo vista previa
              </p>
              <p className="text-xs text-amber-600/80">
                La sincronización con el servidor no está disponible. Los datos
                mostrados son de ejemplo.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {activeTab === "feed" ? (
          /* ── Feed (empty state) ──────────────────────── */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Composer placeholder */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-border/30">
                  <AvatarImage src={user?.image} alt={user?.name} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
                  ¿Qué estás pensando?
                </div>
              </div>
            </div>

            {/* Empty state */}
            <div className="mt-6 flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                <AlertTriangle className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground/80">
                Sin conexión al servidor
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Las publicaciones no están disponibles en modo vista previa.
                Conéctate a internet para ver el contenido.
              </p>
            </div>
          </motion.div>
        ) : (
          /* ── Profile (empty state) ───────────────────── */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="rounded-2xl border border-border/40 bg-card p-6 text-center"
          >
            <Avatar className="mx-auto h-20 w-20 border-2 border-border/30">
              <AvatarImage src={user?.image} alt={user?.name} />
              <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="mt-3 text-base font-bold text-foreground">
              {user?.name || "Usuario"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              El perfil no está disponible en modo vista previa.
            </p>
          </motion.div>
        )}
      </main>

      {/* ── Bottom Navigation ───────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl">
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
              activeTab === "feed"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="h-5 w-5" />
            Inicio
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
              activeTab === "profile"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-5 w-5" />
            Perfil
          </button>
        </div>
      </nav>
    </div>
  );
}
