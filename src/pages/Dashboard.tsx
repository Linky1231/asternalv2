import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sparkles,
  Heart,
  Trash2,
  Send,
  LogOut,
  ImagePlus,
  X,
  Film,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/gif,image/webp";
const ACCEPTED_VIDEO = "video/mp4,video/webm,video/quicktime";
const ACCEPTED_ALL = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`;
const MAX_FILES = 10;
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

interface PendingMedia {
  id: string;
  file: File;
  type: "image" | "video";
  preview: string;
}

interface UploadedMedia {
  storageId: string;
  type: "image" | "video";
  url: string;
}

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Lightbox ───────────────────────────────────────────────────────────── */

interface LightboxItem {
  url: string;
  type: "image" | "video";
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

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) setIndex((i) => i + 1);
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
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {hasNav && (
        <div className="absolute top-4 left-1/2 z-[110] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {index + 1} / {items.length}
        </div>
      )}

      {/* Prev */}
      {hasNav && index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i - 1);
          }}
          className="absolute left-3 top-1/2 z-[110] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Previous"
        >
          ‹
        </button>
      )}

      {/* Next */}
      {hasNav && index < items.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i + 1);
          }}
          className="absolute right-3 top-1/2 z-[110] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Next"
        >
          ›
        </button>
      )}

      {/* Media */}
      <div
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain"
          />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt="Full size"
            className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
      </div>
    </motion.div>
  );
}

/* ─── Media Grid (feed) ──────────────────────────────────────────────────── */

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
        /* Single media: natural aspect, contained */
        <SingleMedia item={media[0]} index={0} onOpenLightbox={onOpenLightbox} />
      ) : (
        /* Multiple: 2-col grid, each cell contained */
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
      <button
        type="button"
        onClick={() => onOpenLightbox(index)}
        className="group relative block w-full cursor-pointer bg-muted"
      >
        <video
          src={item.url}
          preload="metadata"
          muted
          className="mx-auto block max-h-80 w-full object-contain"
        />
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <Play className="ml-0.5 h-5 w-5" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenLightbox(index)}
      className="block w-full cursor-pointer bg-muted"
    >
      <img
        src={item.url}
        alt={`Image ${index + 1}`}
        loading="lazy"
        className="mx-auto block max-h-80 w-full object-contain"
      />
    </button>
  );
}

/* ─── PostCard ───────────────────────────────────────────────────────────── */

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
  onOpenLightbox,
}: {
  post: {
    _id: string;
    authorId: string;
    content: string;
    createdAt: number;
    likes: number;
    authorName: string;
    authorImage?: string;
    mediaUrls: LightboxItem[];
  };
  currentUserId?: string;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
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
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
                {post.content}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Media — sits below the text area, flush to card edges */}
      {post.mediaUrls.length > 0 && (
        <MediaGrid
          media={post.mediaUrls}
          onOpenLightbox={(i) => onOpenLightbox(post.mediaUrls, i)}
        />
      )}

      <div className="px-5 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onLike(post._id)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <Heart className="h-3.5 w-3.5" />
            {post.likes > 0 && <span>{post.likes}</span>}
          </button>
          {currentUserId === post.authorId && (
            <button
              type="button"
              onClick={() => onDelete(post._id)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const posts = useQuery(api.posts.list);
  const createPost = useMutation(api.posts.create);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const likePost = useMutation(api.posts.like);
  const deletePost = useMutation(api.posts.remove);

  const [content, setContent] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_FILES - pendingMedia.length;
      const toAdd = arr.slice(0, remaining);

      const newItems: PendingMedia[] = toAdd
        .filter((file) => {
          const isVideo = file.type.startsWith("video/");
          const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
          if (file.size > maxMb * 1024 * 1024) {
            console.warn(`File ${file.name} exceeds ${maxMb}MB limit, skipping`);
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

  const handlePost = async () => {
    if ((!content.trim() && pendingMedia.length === 0) || posting) return;
    setPosting(true);
    setUploading(true);
    try {
      let uploaded: UploadedMedia[] = [];
      if (pendingMedia.length > 0) {
        uploaded = await Promise.all(
          pendingMedia.map(async (pm) => {
            const url = await generateUploadUrl();
            const result = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": pm.file.type },
              body: pm.file,
            });
            const json = await result.json();
            return {
              storageId: json.storageId as string,
              type: pm.type,
              url: URL.createObjectURL(pm.file),
            };
          }),
        );
      }

      await createPost({
        content: content.trim(),
        media:
          uploaded.length > 0
            ? uploaded.map(({ storageId, type }) => ({ storageId, type }))
            : undefined,
      });

      pendingMedia.forEach((pm) => URL.revokeObjectURL(pm.preview));
      setPendingMedia([]);
      setContent("");
    } catch (err) {
      console.error("Failed to create post:", err);
    } finally {
      setUploading(false);
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await likePost({ postId: postId as any });
    } catch (err) {
      console.error("Failed to like:", err);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deletePost({ postId: postId as any });
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const openLightbox = (items: LightboxItem[], index: number) =>
    setLightbox({ items, index });

  const isPostable = content.trim() || pendingMedia.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">Asternal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name ?? "Player"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Feed */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Composer */}
        <div
          className="rounded-2xl border border-border/60 bg-card p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0 border border-border/50">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {user?.name ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Textarea
                placeholder="What's on your mind, player?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                className="resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={2000}
              />

              {/* Pending media previews */}
              {pendingMedia.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
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
                        )}{" "}
                        {pm.file.name.length > 16
                          ? pm.file.name.slice(0, 14) + "…"
                          : pm.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Toolbar */}
              <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
                <div className="flex items-center gap-1">
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
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    title="Add image or video"
                    disabled={pendingMedia.length >= MAX_FILES}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {pendingMedia.length > 0
                      ? `${pendingMedia.length}/${MAX_FILES}`
                      : ""}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!isPostable || posting}
                  onClick={handlePost}
                >
                  {posting || uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Uploading…" : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="mt-6 flex flex-col gap-4">
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
                <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No posts yet. Be the first to share something!
                </p>
              </motion.div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  currentUserId={user?._id}
                  onLike={handleLike}
                  onDelete={handleDelete}
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
    </div>
  );
}
