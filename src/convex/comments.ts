import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("asc")
      .collect();

    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);

        let likedByMe = false;
        if (userId) {
          const existing = await ctx.db
            .query("commentLikes")
            .withIndex("by_user_comment", (q) =>
              q.eq("userId", userId).eq("commentId", comment._id),
            )
            .first();
          likedByMe = existing !== null;
        }

        return {
          ...comment,
          authorName: author?.name ?? "Anónimo",
          authorImage: author?.image,
          likedByMe,
        };
      }),
    );

    return commentsWithAuthors;
  },
});

export const create = mutation({
  args: {
    postId: v.id("posts"),
    content: v.string(),
    parentCommentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    if (args.content.trim().length === 0) {
      throw new Error("El comentario no puede estar vacío");
    }

    if (args.content.length > 1000) {
      throw new Error("El comentario es demasiado largo (máximo 1000 caracteres)");
    }

    // Verify parent comment exists if replying
    if (args.parentCommentId) {
      const parent = await ctx.db.get(args.parentCommentId);
      if (!parent || parent.postId !== args.postId) {
        throw new Error("Comentario padre no encontrado");
      }
    }

    await ctx.db.insert("comments", {
      postId: args.postId,
      authorId: userId,
      content: args.content.trim(),
      createdAt: Date.now(),
      likes: 0,
      parentCommentId: args.parentCommentId,
    });
  },
});

export const toggleLike = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comentario no encontrado");

    const existing = await ctx.db
      .query("commentLikes")
      .withIndex("by_user_comment", (q) =>
        q.eq("userId", userId).eq("commentId", args.commentId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.commentId, { likes: Math.max(0, comment.likes - 1) });
      return false;
    } else {
      await ctx.db.insert("commentLikes", { userId, commentId: args.commentId });
      await ctx.db.patch(args.commentId, { likes: comment.likes + 1 });
      return true;
    }
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comentario no encontrado");
    if (comment.authorId !== userId) throw new Error("No autorizado");

    // Delete all likes for this comment
    const likesList = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();
    for (const like of likesList) {
      await ctx.db.delete(like._id);
    }

    // Delete all replies to this comment (recursive)
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentCommentId", args.commentId))
      .collect();
    for (const reply of replies) {
      // Delete likes for each reply
      const replyLikes = await ctx.db
        .query("commentLikes")
        .withIndex("by_comment", (q) => q.eq("commentId", reply._id))
        .collect();
      for (const like of replyLikes) {
        await ctx.db.delete(like._id);
      }
      await ctx.db.delete(reply._id);
    }

    await ctx.db.delete(args.commentId);
  },
});
