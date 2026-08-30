import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Heart, Trash2, Send, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

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
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
            {post.content}
          </p>
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
  const likePost = useMutation(api.posts.like);
  const deletePost = useMutation(api.posts.remove);

  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await createPost({ content });
      setContent("");
    } catch (err) {
      console.error("Failed to create post:", err);
    } finally {
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
        <div className="rounded-2xl border border-border/60 bg-card p-4">
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
              <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
                <span className="text-xs text-muted-foreground">
                  {content.length}/2000
                </span>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!content.trim() || posting}
                  onClick={handlePost}
                >
                  {posting ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="mt-6 flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {posts === undefined ? (
              // Loading skeletons
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
