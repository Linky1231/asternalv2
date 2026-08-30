import { useState, useRef, useCallback } from "react";
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

function MediaGrid({ media }: { media: { url: string; type: "image" | "video" }[] }) {
  if (!media || media.length === 0) return null;

  const gridClass =
    media.length === 1
      ? "grid-cols-1"
      : media.length === 2
        ? "grid-cols-2"
        : "grid-cols-2";

  return (
    <div className={`mt-3 grid gap-2 ${gridClass}`}>
      {media.map((m, i) =>
        m.type === "video" ? (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-border/40 bg-muted"
          >
            <video
              src={m.url}
              controls
              preload="metadata"
              className="w-full object-cover"
              style={{ maxHeight: 320 }}
            />
          </div>
        ) : (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-border/40"
          >
            <img
              src={m.url}
              alt={`Media ${i + 1}`}
              className="w-full object-cover"
              style={{ maxHeight: 320 }}
              loading="lazy"
            />
          </div>
        ),
      )}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
}: {
  post: {
    _id: string;
    authorId: string;
    content: string;
    createdAt: number;
    likes: number;
    authorName: string;
    authorImage?: string;
    mediaUrls: { url: string; type: "image" | "video" }[];
  };
  currentUserId?: string;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border"
    >
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
          <MediaGrid media={post.mediaUrls} />
          <div className="mt-3 flex items-center gap-3">
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
      </div>
    </motion.div>
  );
}

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

      // Clean up local previews
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
                      className="group relative overflow-hidden rounded-xl border border-border/40"
                    >
                      {pm.type === "video" ? (
                        <video
                          src={pm.preview}
                          className="h-28 w-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={pm.preview}
                          alt={pm.file.name}
                          className="h-28 w-full object-cover"
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
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
