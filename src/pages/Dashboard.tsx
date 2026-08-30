import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Heart,
  Trash2,
  Send,
  LogOut,
  ImagePlus,
  X,
  Film,
  Play,
  AlertTriangle,
  Palette,
  Type,
} from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ──────────────────────────────────────────────────────
const ACCEPTED_IMAGE =
  "image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml";
const ACCEPTED_VIDEO =
  "video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/x-flv,video/3gpp,video/mpeg,video/ogg,video/*";
const ACCEPTED_ALL = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`;
const MAX_FILES = 10;
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

const TEXT_COLORS = [
  { label: "Predeterminado", value: "" },
  { label: "Negro", value: "#1a1a1a" },
  { label: "Gris oscuro", value: "#555555" },
  { label: "Gris", value: "#888888" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Naranja", value: "#ea580c" },
  { label: "Amarillo", value: "#ca8a04" },
  { label: "Verde", value: "#16a34a" },
  { label: "Azul", value: "#2563eb" },
  { label: "Morado", value: "#9333ea" },
  { label: "Rosa", value: "#db2777" },
  { label: "Celeste", value: "#0891b2" },
];

const FONT_SIZES = [
  { label: "XS", value: "12px" },
  { label: "S", value: "14px" },
  { label: "M", value: "16px" },
  { label: "L", value: "20px" },
  { label: "XL", value: "26px" },
];

// ── Interfaces ─────────────────────────────────────────────────────
interface PendingMedia {
  id: string;
  file: File;
  type: "image" | "video";
  preview: string;
}

interface UploadedMedia {
  storageId: string;
  type: "image" | "video";
  mime?: string;
}

interface LightboxItem {
  url: string;
  type: "image" | "video";
  mime?: string;
}

// ── Utilities ──────────────────────────────────────────────────────
function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Strip non-allowed HTML, keeping only <span style="color;font-size"> and <br>. */
function sanitizePostHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node instanceof HTMLElement) {
      if (node.tagName === "BR") return;
      if (node.tagName === "SPAN") {
        const color = node.style.color;
        const fontSize = node.style.fontSize;
        node.removeAttribute("class");
        node.removeAttribute("id");
        node.removeAttribute("style");
        if (color) node.style.color = color;
        if (fontSize) node.style.fontSize = fontSize;
        Array.from(node.childNodes).forEach(walk);
        return;
      }
      const text = node.textContent || "";
      const t = document.createTextNode(text);
      node.parentNode?.replaceChild(t, node);
      return;
    }
  };
  Array.from(tmp.childNodes).forEach(walk);
  return tmp.innerHTML;
}

// ── Video blob URL hook ────────────────────────────────────────────
const videoBlobCache = new Map<string, string>();

function useVideoObjectUrl(url: string, mime: string) {
  const [objectUrl, setObjectUrl] = useState<string | null>(
    () => videoBlobCache.get(url) ?? null,
  );

  useEffect(() => {
    if (!url) return;
    if (videoBlobCache.has(url)) {
      setObjectUrl(videoBlobCache.get(url)!);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const typedBlob = new Blob([blob], { type: mime || "video/mp4" });
        const objUrl = URL.createObjectURL(typedBlob);
        videoBlobCache.set(url, objUrl);
        setObjectUrl(objUrl);
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          console.error("Error cargando vídeo:", err);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, mime]);

  return objectUrl;
}

// ── Selection formatting helper ────────────────────────────────────
function applyStyleToSelection(style: Record<string, string>) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const fragment = range.extractContents();
  const span = document.createElement("span");
  Object.assign(span.style, style);
  span.appendChild(fragment);
  range.insertNode(span);
  sel.removeAllRanges();
}

// ── Lightbox ───────────────────────────────────────────────────────
function LightboxVideo({
  url,
  mime,
}: {
  url: string;
  mime?: string;
}) {
  const objUrl = useVideoObjectUrl(url, mime || "video/mp4");
  if (!objUrl) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-black/50">
        <span className="text-sm text-white/60">Cargando vídeo…</span>
      </div>
    );
  }
  return (
    <video
      key={objUrl}
      src={objUrl}
      controls
      autoPlay
      playsInline
      className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain"
    />
  );
}

function Lightbox({
  items,
  initialIndex,
  onClose,
}: {
  items: LightboxItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const current = items[index];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1)
        setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, items.length, onClose]);

  const hasNav = items.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      {hasNav && (
        <div className="absolute top-4 left-1/2 z-[110] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {index + 1} / {items.length}
        </div>
      )}
      {hasNav && index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i - 1);
          }}
          className="absolute left-3 top-1/2 z-[110] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Anterior"
        >
          ‹
        </button>
      )}
      {hasNav && index < items.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i + 1);
          }}
          className="absolute right-3 top-1/2 z-[110] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Siguiente"
        >
          ›
        </button>
      )}
      <div
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === "video" ? (
          <LightboxVideo url={current.url} mime={current.mime} />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt="Tamaño completo"
            className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
      </div>
    </motion.div>
  );
}

// ── Delete confirmation ────────────────────────────────────────────
function DeleteConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Eliminar publicación</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ¿Estás seguro de que quieres eliminar esta publicación? Esta
                  acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirm}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Feed video thumbnail ───────────────────────────────────────────
function FeedVideo({
  item,
  onClick,
}: {
  item: LightboxItem;
  onClick: () => void;
}) {
  const [videoError, setVideoError] = useState(false);
  const objUrl = useVideoObjectUrl(item.url, item.mime || "video/mp4");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="group relative block w-full cursor-pointer bg-muted outline-none"
    >
      {!videoError && objUrl ? (
        <video
          preload="metadata"
          muted
          playsInline
          className="mx-auto block max-h-80 w-full object-contain"
          onError={() => setVideoError(true)}
          src={objUrl}
        />
      ) : !objUrl ? (
        <div className="flex h-28 w-full items-center justify-center bg-muted">
          <span className="text-xs text-muted-foreground">Cargando…</span>
        </div>
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-muted">
          <Film className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <Play className="ml-0.5 h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ── Single media item ──────────────────────────────────────────────
function SingleMedia({
  item,
  index,
  onOpenLightbox,
}: {
  item: LightboxItem;
  index: number;
  onOpenLightbox: (i: number) => void;
}) {
  if (item.type === "video") {
    return (
      <FeedVideo item={item} onClick={() => onOpenLightbox(index)} />
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenLightbox(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenLightbox(index);
      }}
      className="block w-full cursor-pointer bg-muted outline-none"
    >
      <img
        src={item.url}
        alt={`Imagen ${index + 1}`}
        loading="lazy"
        className="mx-auto block max-h-80 w-full object-contain"
      />
    </div>
  );
}

// ── Media grid ─────────────────────────────────────────────────────
function MediaGrid({
  media,
  onOpenLightbox,
}: {
  media: LightboxItem[];
  onOpenLightbox: (index: number) => void;
}) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/40">
      {media.length === 1 ? (
        <SingleMedia
          item={media[0]}
          index={0}
          onOpenLightbox={onOpenLightbox}
        />
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border/30">
          {media.map((m, i) => (
            <SingleMedia
              key={i}
              item={m}
              index={i}
              onOpenLightbox={onOpenLightbox}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Format Toolbar ─────────────────────────────────────────────────
function FormatToolbar() {
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    if (!showColors && !showSizes) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node))
        setShowColors(false);
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node))
        setShowSizes(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColors, showSizes]);

  return (
    <div className="flex items-center gap-1.5 pt-3">
      {/* Color picker */}
      <div className="relative" ref={colorRef}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 px-2.5 text-muted-foreground hover:text-primary"
          onClick={() => {
            setShowSizes(false);
            setShowColors((v) => !v);
          }}
          title="Color del texto"
        >
          <Palette className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs whitespace-nowrap">Color</span>
        </Button>
        <AnimatePresence>
        {showColors && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-xl border border-border/60 bg-card p-3 shadow-xl">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Color del texto
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value || "default"}
                  type="button"
                  title={c.label}
                  className="group relative h-7 w-7 rounded-full border border-border/60 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value || "var(--card-foreground)",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (c.value) {
                      applyStyleToSelection({ color: c.value });
                    } else {
                      // "Default" – remove inline color
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                        const range = sel.getRangeAt(0);
                        const fragment = range.extractContents();
                        // Unwrap any nested spans' color
                        const walk = (node: Node) => {
                          if (node instanceof HTMLElement && node.tagName === "SPAN") {
                            node.style.removeProperty("color");
                            if (
                              !node.getAttribute("style") ||
                              node.getAttribute("style") === ""
                            ) {
                              const parent = node.parentNode;
                              while (node.firstChild) {
                                parent?.insertBefore(node.firstChild, node);
                              }
                              parent?.removeChild(node);
                            } else {
                              Array.from(node.childNodes).forEach(walk);
                            }
                          }
                        };
                        Array.from(fragment.childNodes).forEach(walk);
                        range.insertNode(fragment);
                        sel.removeAllRanges();
                      }
                    }
                    setShowColors(false);
                  }}
                >
                  <span className="absolute inset-0 rounded-full ring-2 ring-transparent ring-offset-1 ring-offset-card transition-colors group-hover:ring-primary/40" />
                </button>
              ))}
            </div>
            {/* Custom color input */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                onChange={(e) => {
                  applyStyleToSelection({ color: e.target.value });
                  setShowColors(false);
                }}
              />
              <span className="text-[10px] text-muted-foreground">
                Color personalizado
              </span>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Font size picker */}
      <div className="relative" ref={sizeRef}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 px-2.5 text-muted-foreground hover:text-primary"
          onClick={() => {
            setShowColors(false);
            setShowSizes((v) => !v);
          }}
          title="Tamaño del texto"
        >
          <Type className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs whitespace-nowrap">Tamaño</span>
        </Button>
        <AnimatePresence>
        {showSizes && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-full left-0 z-50 mb-2 rounded-xl border border-border/60 bg-card p-2 shadow-xl">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Tamaño del texto
            </p>
            <div className="flex gap-1">
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyStyleToSelection({ fontSize: s.value });
                    setShowSizes(false);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Post Card ──────────────────────────────────────────────────────
function PostCard({
  post,
  currentUserId,
  onToggleLike,
  onRequestDelete,
  onOpenLightbox,
}: {
  post: {
    _id: string;
    authorId: string;
    content: string;
    createdAt: number;
    likes: number;
    likedByMe: boolean;
    authorName: string;
    mediaUrls: LightboxItem[];
  };
  currentUserId?: string;
  onToggleLike: (postId: string) => void;
  onRequestDelete: (postId: string) => void;
  onOpenLightbox: (media: LightboxItem[], index: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-border"
    >
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <Avatar className="h-10 w-10 shrink-0 border border-border/50">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(post.authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{post.authorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatTime(post.createdAt)}
              </span>
            </div>
            {post.content && (
              <div
                className="post-content mt-2 text-sm leading-relaxed text-card-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizePostHtml(post.content),
                }}
              />
            )}
          </div>
        </div>
      </div>
      {post.mediaUrls.length > 0 && (
        <MediaGrid
          media={post.mediaUrls}
          onOpenLightbox={(i) => onOpenLightbox(post.mediaUrls, i)}
        />
      )}
      <div className="px-5 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 1.3 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            onClick={() => onToggleLike(post._id)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              post.likedByMe
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            <motion.div
              animate={post.likedByMe ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Heart
                className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-primary" : ""}`}
              />
            </motion.div>
            {post.likes > 0 && <span>{post.likes}</span>}
          </motion.button>
          {currentUserId === post.authorId && (
            <button
              type="button"
              onClick={() => onRequestDelete(post._id)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const posts = useQuery(api.posts.list);
  const createPost = useMutation(api.posts.create);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const toggleLikeMutation = useMutation(api.posts.toggleLike);
  const deletePost = useMutation(api.posts.remove);

  const [content, setContent] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── File handling ──────────────────────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_FILES - pendingMedia.length;
      const newItems: PendingMedia[] = arr
        .slice(0, remaining)
        .filter((file) => {
          const isVideo = file.type.startsWith("video/");
          const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
          if (file.size > maxMb * 1024 * 1024) {
            console.warn(`El archivo ${file.name} supera ${maxMb}MB`);
            return false;
          }
          return true;
        })
        .map((file) => {
          const isVideo = file.type.startsWith("video/");
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            type: (isVideo ? "video" : "image") as "image" | "video",
            preview: URL.createObjectURL(file),
          };
        });
      setPendingMedia((prev) => [...prev, ...newItems]);
    },
    [pendingMedia.length],
  );

  const removePending = useCallback((id: string) => {
    setPendingMedia((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  // ── Editor handlers ────────────────────────────────────────────
  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  }, []);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Shift+Enter = newline, Enter = newline in contentEditable (default)
      // Sync after key
      requestAnimationFrame(() => handleEditorInput());
    },
    [handleEditorInput],
  );

  const handleEditorPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      requestAnimationFrame(() => handleEditorInput());
    },
    [handleEditorInput],
  );

  // ── Post ───────────────────────────────────────────────────────
  const handlePost = async () => {
    // Get the latest HTML from the editor
    const html = editorRef.current?.innerHTML ?? content;
    const textOnly = editorRef.current?.textContent?.trim() ?? "";
    if ((!textOnly && pendingMedia.length === 0) || posting) return;

    setPosting(true);
    setUploading(true);
    try {
      const uploaded: UploadedMedia[] = [];
      const maxRetries = 2;
      for (const pm of pendingMedia) {
        let lastError = "";
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const url = await generateUploadUrl();
            const result = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": pm.file.type || "application/octet-stream",
              },
              body: pm.file,
            });
            if (!result.ok) {
              lastError = `HTTP ${result.status}`;
              console.error(
                `Error al subir ${pm.file.name} (intento ${attempt + 1}): ${lastError}`,
              );
              if (attempt < maxRetries) continue;
              break;
            }
            const json = await result.json();
            if (json.storageId) {
              uploaded.push({
                storageId: json.storageId,
                type: pm.type,
                mime: pm.file.type || undefined,
              });
              break;
            } else {
              lastError = "Respuesta sin storageId";
              if (attempt < maxRetries) continue;
            }
          } catch (fetchErr) {
            lastError =
              fetchErr instanceof Error ? fetchErr.message : "Error de red";
            console.error(
              `Error de red al subir ${pm.file.name} (intento ${attempt + 1}):`,
              lastError,
            );
            if (attempt < maxRetries) continue;
          }
        }
      }

      // Send HTML content (or empty string if no text)
      const contentToSend = textOnly ? html.trim() : "";
      await createPost({
        content: contentToSend,
        media:
          uploaded.length > 0 ? (uploaded as any) : undefined,
      });

      pendingMedia.forEach((pm) => URL.revokeObjectURL(pm.preview));
      setPendingMedia([]);
      setContent("");
      if (editorRef.current) editorRef.current.innerHTML = "";
    } catch (err) {
      console.error("Error al crear la publicación:", err);
    } finally {
      setUploading(false);
      setPosting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      await toggleLikeMutation({ postId: postId as any });
    } catch (err) {
      console.error("Error al dar me gusta:", err);
    }
  };
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePost({ postId: deleteTarget as any });
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
    setDeleteTarget(null);
  };
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  const openLightbox = (items: LightboxItem[], index: number) =>
    setLightbox({ items, index });

  const hasText =
    editorRef.current?.textContent?.trim().length ?? content.trim().length > 0;
  const isPostable = hasText || pendingMedia.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src="/assets/67385.png" alt="Asternal" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-lg font-extrabold tracking-tight text-primary">Asternal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name ?? "Jugador"}
            </span>
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
        </div>
      </motion.nav>

      {/* ── Main ─────────────────────────────────────────────── */}        <main className="mx-auto max-w-2xl px-4 py-10">
        {/* Composer */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className="rounded-2xl border border-border/60 bg-card p-5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-start gap-4">
            <Avatar className="h-10 w-10 shrink-0 border border-border/50">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {user?.name ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {/* Rich text editor */}
              <div
                ref={editorRef}
                contentEditable
                data-placeholder="¿Qué tienes en mente, jugador?"
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onPaste={handleEditorPaste}
                className="min-h-[64px] w-full bg-transparent text-[15px] leading-relaxed text-card-foreground outline-none"
                style={{ wordBreak: "break-word" }}
              />

              {/* Media previews */}
              {pendingMedia.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {pendingMedia.map((pm) => (
                    <div
                      key={pm.id}
                      className="group relative overflow-hidden rounded-xl border border-border/40 bg-muted"
                    >
                      {pm.type === "video" ? (
                        <video
                          src={pm.preview}
                          className="h-28 w-full object-contain"
                          muted
                        />
                      ) : (
                        <img
                          src={pm.preview}
                          alt={pm.file.name}
                          className="h-28 w-full object-contain"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removePending(pm.id)}
                        className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        {pm.type === "video" ? (
                          <Film className="inline h-3 w-3" />
                        ) : (
                          <ImagePlus className="inline h-3 w-3" />
                        )}
                        {` `}
                        {pm.file.name.length > 16
                          ? pm.file.name.slice(0, 14) + "…"
                          : pm.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Separator */}
              <div className="mt-5 border-t border-border/40" />

              {/* Actions row */}
              <div className="mt-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_ALL}
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    title="Añadir imagen o vídeo"
                    disabled={pendingMedia.length >= MAX_FILES}
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-xs">Adjuntar</span>
                  </Button>
                  {pendingMedia.length > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {pendingMedia.length}/{MAX_FILES}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 px-5"
                  disabled={!isPostable || posting}
                  onClick={handlePost}
                >
                  {posting || uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Subiendo…" : "Publicar"}
                </Button>
              </div>

              {/* Separator */}
              <div className="mt-4 border-t border-border/40" />

              {/* Formatting toolbar */}
              <FormatToolbar />
            </div>
          </div>
        </motion.div>

        {/* Feed */}
        <div className="mt-8 flex flex-col gap-5">
          <AnimatePresence mode="popLayout">
            {posts === undefined ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="animate-pulse rounded-2xl border border-border/60 bg-card p-5"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-3">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded bg-muted" />
                        <div className="h-3 w-3/4 rounded bg-muted" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : posts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-dashed border-border/60 py-16 text-center"
              >
                <img src="/assets/67385.png" alt="Asternal" className="mx-auto h-8 w-8 rounded-lg object-contain opacity-40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay publicaciones todavía. ¡Sé el primero en compartir
                  algo!
                </p>
              </motion.div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  currentUserId={user?._id}
                  onToggleLike={handleToggleLike}
                  onRequestDelete={setDeleteTarget}
                  onOpenLightbox={openLightbox}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            items={lightbox.items}
            initialIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete dialog */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
