import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Search users by name for @mentions.
 */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const searchTerm = args.query.trim().toLowerCase();
    if (searchTerm.length === 0) {
      // Return recent users (up to 20) when no search term
      const allUsers = await ctx.db.query("users").collect();
      return allUsers
        .filter((u) => u._id !== userId && u.name)
        .slice(0, 20)
        .map((u) => ({
          _id: u._id,
          name: u.name!,
          image: u.image,
        }));
    }

    const allUsers = await ctx.db.query("users").collect();
    return allUsers
      .filter(
        (u) =>
          u._id !== userId &&
          u.name &&
          u.name.toLowerCase().includes(searchTerm),
      )
      .slice(0, 20)
      .map((u) => ({
        _id: u._id,
        name: u.name!,
        image: u.image,
      }));
  },
});

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};
