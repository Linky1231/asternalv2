import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .take(50);

    const postsWithAuthors = await Promise.all(
      posts.map(async (post) => {
        const author = await ctx.db.get(post.authorId);

        const mediaUrls = post.media
          ? await Promise.all(
              post.media.map(async (m) => ({
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

        return {
          ...post,
          authorName: author?.name ?? "Anónimo",
          authorImage: author?.image,
          mediaUrls,
          likedByMe,
          mentions: post.mentions ?? [],
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
      content: args.content.trim(),
      createdAt: Date.now(),
      likes: 0,
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

    // Delete associated media from storage
    if (post.media) {
      for (const m of post.media) {
        await ctx.storage.delete(m.storageId);
      }
    }

    await ctx.db.delete(args.postId);
  },
});
