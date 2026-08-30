import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    sortBy: v.optional(
      v.union(
        v.literal("forYou"),
        v.literal("following"),
        v.literal("popular"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const sortBy = args.sortBy ?? "forYou";

    let posts;

    if (sortBy === "following" && userId) {
      // Get IDs of users the current user follows
      const followRecords = await ctx.db
        .query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", userId))
        .collect();
      const followedIds = followRecords.map((f) => f.followingId);

      if (followedIds.length === 0) {
        return [];
      }

      // Fetch posts from followed users, sorted by recency
      const allPosts = [] as any[];
      for (const authorId of followedIds) {
        const authorPosts = await ctx.db
          .query("posts")
          .withIndex("by_created")
          .order("desc")
          .collect();
        for (const p of authorPosts) {
          if (p.authorId === authorId) allPosts.push(p);
        }
      }
      allPosts.sort((a, b) => b.createdAt - a.createdAt);
      posts = allPosts.slice(0, 50);
    } else if (sortBy === "popular") {
      // Fetch all recent posts and score them
      const allPosts = await ctx.db
        .query("posts")
        .withIndex("by_created")
        .order("desc")
        .take(200);

      // Score and sort by popularity
      const scored = allPosts.map((p) => ({
        ...p,
        score: p.likes * 2 + (p.shares ?? 0) * 4 + (p.favorites ?? 0) * 3,
      }));
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.createdAt - a.createdAt;
      });
      posts = scored.slice(0, 50);
    } else {
      // "forYou" — score-based with recency boost, slight randomization
      const allPosts = await ctx.db
        .query("posts")
        .withIndex("by_created")
        .order("desc")
        .take(200);

      const now = Date.now();
      const scored = allPosts.map((p) => {
        const baseScore =
          p.likes * 2 + (p.shares ?? 0) * 4 + (p.favorites ?? 0) * 3;
        // Recency boost: posts < 24h old get a multiplier
        const ageHours = (now - p.createdAt) / (1000 * 60 * 60);
        const recencyBoost = ageHours < 24 ? 1.5 : ageHours < 72 ? 1.2 : 1.0;
        // Small random factor for variety
        const jitter = 0.8 + Math.random() * 0.4;
        return {
          ...p,
          score: baseScore * recencyBoost * jitter,
        };
      });
      scored.sort((a, b) => b.score - a.score);
      posts = scored.slice(0, 50);
    }

    const postsWithAuthors = await Promise.all(
      posts.map(async (post) => {
        const author = await ctx.db.get(post.authorId) as {
          name?: string;
          image?: string;
        } | null;

        const mediaUrls = post.media
          ? await Promise.all(
              post.media.map(async (m: { storageId: string; type: "image" | "video"; mime?: string }) => ({
                url: (await ctx.storage.getUrl(m.storageId)) ?? "",
                type: m.type,
                mime: m.mime ?? undefined,
              })),
            )
          : [];

        // Check if current user liked this post
        let likedByMe = false;
        if (userId) {
          const existing = await ctx.db
            .query("likes")
            .withIndex("by_user_post", (q) =>
              q.eq("userId", userId).eq("postId", post._id),
            )
            .first();
          likedByMe = existing !== null;
        }

        let favoritedByMe = false;
        if (userId) {
          const existing = await ctx.db
            .query("favorites")
            .withIndex("by_user_post", (q) =>
              q.eq("userId", userId).eq("postId", post._id),
            )
            .first();
          favoritedByMe = existing !== null;
        }

        return {
          ...post,
          authorName: author?.name ?? "Anónimo",
          authorImage: author?.image,
          mediaUrls,
          likedByMe,
          favoritedByMe: favoritedByMe,
          mentions: post.mentions ?? [],
          title: post.title ?? undefined,
          favorites: post.favorites,
        };
      }),
    );

    return postsWithAuthors;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    content: v.string(),
    media: v.optional(
      v.array(
        v.object({
          storageId: v.string(),
          type: v.union(v.literal("image"), v.literal("video")),
          mime: v.optional(v.string()),
        }),
      ),
    ),
    mentions: v.optional(
      v.array(v.object({ userId: v.string(), name: v.string() })),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    if (
      args.content.trim().length === 0 &&
      (!args.media || args.media.length === 0)
    ) {
      throw new Error("La publicación no puede estar vacía");
    }

    if (args.content.length > 2000) {
      throw new Error("El contenido es demasiado largo (máximo 2000 caracteres)");
    }

    if (args.media && args.media.length > 10) {
      throw new Error("Máximo 10 archivos multimedia por publicación");
    }

    await ctx.db.insert("posts", {
      authorId: userId,
      title: args.title?.trim() || undefined,
      content: args.content.trim(),
      createdAt: Date.now(),
      likes: 0,
      favorites: 0,
      shares: 0,
      media: args.media && args.media.length > 0 ? args.media : undefined,
      mentions: args.mentions && args.mentions.length > 0 ? args.mentions : undefined,
    });
  },
});

export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Publicación no encontrada");

    // Check if already liked
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", userId).eq("postId", args.postId),
      )
      .first();

    if (existing) {
      // Unlike: remove like record and decrement count
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.postId, { likes: Math.max(0, post.likes - 1) });
      return false;
    } else {
      // Like: create record and increment count
      await ctx.db.insert("likes", { userId, postId: args.postId });
      await ctx.db.patch(args.postId, { likes: post.likes + 1 });
      return true;
    }
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Publicación no encontrada");
    if (post.authorId !== userId) throw new Error("No autorizado");

    // Delete all likes for this post
    const likesList = await ctx.db
      .query("likes")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    for (const like of likesList) {
      await ctx.db.delete(like._id);
    }

    // Delete all favorites for this post
    const favsList = await ctx.db
      .query("favorites")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    for (const fav of favsList) {
      await ctx.db.delete(fav._id);
    }

    // Delete associated media from storage
    if (post.media) {
      for (const m of post.media) {
        await ctx.storage.delete(m.storageId);
      }
    }

    await ctx.db.delete(args.postId);
  },
});

export const toggleFavorite = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Publicación no encontrada");

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", userId).eq("postId", args.postId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.postId, { favorites: Math.max(0, post.favorites - 1) });
      return false;
    } else {
      await ctx.db.insert("favorites", { userId, postId: args.postId });
      await ctx.db.patch(args.postId, { favorites: post.favorites + 1 });
      return true;
    }
  },
});
