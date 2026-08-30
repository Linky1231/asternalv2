import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
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
              })),
            )
          : [];
        return {
          ...post,
          authorName: author?.name ?? "Anonymous",
          authorImage: author?.image,
          mediaUrls,
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
    if (userId === null) throw new Error("Not authenticated");
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
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    if (args.content.trim().length === 0 && (!args.media || args.media.length === 0)) {
      throw new Error("Post content cannot be empty");
    }

    if (args.content.length > 2000) {
      throw new Error("Post is too long (max 2000 characters)");
    }

    if (args.media && args.media.length > 10) {
      throw new Error("Maximum 10 media files per post");
    }

    await ctx.db.insert("posts", {
      authorId: userId,
      content: args.content.trim(),
      createdAt: Date.now(),
      likes: 0,
      media: args.media && args.media.length > 0 ? args.media : undefined,
    });
  },
});

export const like = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    await ctx.db.patch(args.postId, { likes: post.likes + 1 });
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.authorId !== userId) throw new Error("Not authorized");

    // Delete associated media from storage
    if (post.media) {
      for (const m of post.media) {
        await ctx.storage.delete(m.storageId);
      }
    }

    await ctx.db.delete(args.postId);
  },
});
