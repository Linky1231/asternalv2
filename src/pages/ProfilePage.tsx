import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Check, LogOut, User, Pencil } from "lucide-react";
import { motion } from "framer-motion";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ProfilePageProps {
  onBack: () => void;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, signOut } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const currentUser = useQuery(api.users.currentUser);
  const avatarUrl = useQuery(
    api.users.getAvatarUrl,
    currentUser?.image ? { storageId: currentUser.image } : "skip",
  );

  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState((currentUser as any)?.bio ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savedBio, setSavedBio] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === (user?.name ?? "") || savingName) return;
    setSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (err) {
      console.error("Error al actualizar nombre:", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveBio = async () => {
    const currentBio = (currentUser as any)?.bio ?? "";
    if (bio === currentBio || savingBio) return;
    setSavingBio(true);
    try {
      await updateProfile({ bio: bio.trim() || undefined });
      setSavedBio(true);
      setTimeout(() => setSavedBio(false), 2000);
    } catch (err) {
      console.error("Error al actualizar bio:", err);
    } finally {
      setSavingBio(false);
    }
  };

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || uploadingAvatar) return;

      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) return;

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
  };

  // Stagger animation config
  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] as const },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Profile header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">Mi perfil</span>
      </div>

      {/* Avatar section */}
      <motion.div {...stagger(0)} className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-border/50">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={user?.name ?? ""} />
              )}
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

          <div className="text-center">
            <p className="text-lg font-bold text-card-foreground">
              {user?.name ?? "Sin nombre"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Edit name */}
      <motion.div {...stagger(1)} className="mt-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-card-foreground">Nombre</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Se mostrará en tus publicaciones y comentarios.
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
            disabled={!name.trim() || name.trim() === (user?.name ?? "") || savingName}
            onClick={handleSaveName}
          >
            {savingName ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : savedName ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {savedName ? "Guardado" : "Guardar"}
          </Button>
        </div>
      </motion.div>

      {/* Edit bio */}
      <motion.div {...stagger(2)} className="mt-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-card-foreground">Descripción</h3>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cuéntale a la comunidad quién eres (máximo 200 caracteres).
        </p>
        <div className="mt-4">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Escribe algo sobre ti…"
            className="w-full resize-none rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm text-card-foreground outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {bio.length}/200
            </span>
            <Button
              size="sm"
              className="gap-1.5 px-4"
              disabled={bio === ((currentUser as any)?.bio ?? "") || savingBio}
              onClick={handleSaveBio}
            >
              {savingBio ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : savedBio ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {savedBio ? "Guardado" : "Guardar"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Sign out */}
      <motion.div {...stagger(3)} className="mt-4">
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </motion.div>
    </motion.div>
  );
}
