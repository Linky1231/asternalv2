import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Check, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === (user?.name ?? "") || saving) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error al actualizar perfil:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || uploadingAvatar) return;

      // Validate file
      if (!file.type.startsWith("image/")) {
        console.warn("Solo se permiten imágenes");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        console.warn("La imagen no puede superar 5MB");
        return;
      }

      setUploadingAvatar(true);
      try {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error(`HTTP ${result.status}`);
        const json = await result.json();
        if (json.storageId) {
          await updateProfile({ image: json.storageId });
        }
      } catch (err) {
        console.error("Error al subir avatar:", err);
      } finally {
        setUploadingAvatar(false);
        e.target.value = "";
      }
    },
    [uploadingAvatar, generateUploadUrl, updateProfile],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">Mi perfil</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSignOut}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {/* Avatar section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8"
        >
          <div className="flex flex-col items-center gap-5">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border/50">
                <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                  {user?.name ? getInitials(user.name) : <User className="h-10 w-10" />}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            {/* User info */}
            <div className="text-center">
              <p className="text-lg font-bold text-card-foreground">
                {user?.name ?? "Sin nombre"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {user?.email ?? "Sin email"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Edit name section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
        >
          <h3 className="text-sm font-semibold text-card-foreground">
            Nombre de usuario
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Este nombre se mostrará en tus publicaciones y comentarios.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Tu nombre"
              className="flex-1 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm text-card-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <Button
              size="sm"
              className="gap-1.5 px-4"
              disabled={!name.trim() || name.trim() === (user?.name ?? "") || saving}
              onClick={handleSaveName}
            >
              {saving ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {saved ? "Guardado" : "Guardar"}
            </Button>
          </div>
        </motion.div>

        {/* Stats section (placeholder for future) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
        >
          <h3 className="text-sm font-semibold text-card-foreground">
            Tu actividad
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-primary">—</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Publicaciones</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary">—</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary">—</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Siguiendo</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
