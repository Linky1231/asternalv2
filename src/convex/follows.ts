import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Toggle follow/unfollow a user. Returns true if now following. */
export const toggleFollow = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (currentUserId === null) throw new Error("No autenticado");
    if (currentUserId === args.userId)
      throw new Error("No puedes seguirte a ti mismo");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", currentUserId).eq("followingId", args.userId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    } else {
      await ctx.db.insert("follows", {
        followerId: currentUserId,
        followingId: args.userId,
      });
      return true;
    }
  },
});

/** Check if the current user follows a specific user. */
export const isFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return false;

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", currentUserId).eq("followingId", args.userId),
      )
      .first();

    return existing !== null;
  },
});

/** Get follow stats for a user. */
export const getFollowStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();

    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    return {
      followers: followers.length,
      following: following.length,
    };
  },
});
