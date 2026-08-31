import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { roleValidator } from "./schema";

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

/**
 * Get the URL for a user's avatar image from storage.
 */
export const getAvatarUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Update the current user's profile (name and/or image).
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    bio: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");

    const updates: Record<string, string> = {};
    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (trimmed.length === 0) throw new Error("El nombre no puede estar vacío");
      if (trimmed.length > 40) throw new Error("El nombre es demasiado largo");
      updates.name = trimmed;
    }
    if (args.image !== undefined) {
      updates.image = args.image;
    }
    if (args.bio !== undefined) {
      updates.bio = args.bio.slice(0, 200);
    }
    if (args.title !== undefined) {
      updates.title = args.title.slice(0, 60);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }
  },
});

/**
 * Generate an upload URL for profile pictures.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("No autenticado");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Bootstrap the first admin. Can only be called once —
 * after an admin exists, this mutation does nothing.
 * Promotes the user with the given email to admin.
 */
export const bootstrapAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Check if any admin already exists
    const allUsers = await ctx.db.query("users").collect();
    const existingAdmin = allUsers.find((u) => (u as any).role === "admin");
    if (existingAdmin) {
      throw new Error("Ya existe un administrador. Usa setRole para promover usuarios.");
    }

    const emailLower = args.email.toLowerCase();

    // 1. Check users.email
    let user = allUsers.find((u) => u.email?.toLowerCase() === emailLower);

    // 2. Check authAccounts.providerAccountId (email-otp stores email here)
    if (!user) {
      const authAccounts = await ctx.db.query("authAccounts" as any).collect() as any[];
      const matchingAccount = authAccounts.find(
        (a: any) => a.providerAccountId?.toLowerCase() === emailLower,
      );
      if (matchingAccount) {
        user = allUsers.find((u) => u._id === matchingAccount.userId);
      }
    }

    // 3. Search by name
    if (!user) {
      const emailPart = emailLower.split("@")[0];
      user = allUsers.find((u) => u.name?.toLowerCase().includes(emailPart));
    }

    if (!user) {
      throw new Error(`No se encontró ningún usuario con el email: ${args.email}`);
    }

    await ctx.db.patch(user._id, { role: "admin" } as any);
    return { success: true, userId: user._id, name: user.name };
  },
});

/**
 * Set a user's role. Only callable by admins.
 */
export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (currentUserId === null) throw new Error("No autenticado");
    const currentUser = await ctx.db.get(currentUserId);
    if ((currentUser as any)?.role !== "admin") {
      throw new Error("Solo los administradores pueden cambiar roles");
    }
    await ctx.db.patch(args.userId, { role: args.role } as any);
    return { success: true };
  },
});

/**
 * Delete any post (admin only).
 */
export const deletePostAsAdmin = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (currentUserId === null) throw new Error("No autenticado");
    const currentUser = await ctx.db.get(currentUserId);
    if ((currentUser as any)?.role !== "admin") {
      throw new Error("Solo los administradores pueden eliminar publicaciones de otros usuarios");
    }

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Publicación no encontrada");

    // Delete likes
    const likesList = await ctx.db.query("likes").withIndex("by_post", (q) => q.eq("postId", args.postId)).collect();
    for (const like of likesList) await ctx.db.delete(like._id);

    // Delete favorites
    const favsList = await ctx.db.query("favorites").withIndex("by_post", (q) => q.eq("postId", args.postId)).collect();
    for (const fav of favsList) await ctx.db.delete(fav._id);

    // Delete comments
    const commentsList = await ctx.db.query("comments").withIndex("by_post", (q) => q.eq("postId", args.postId)).collect();
    for (const comment of commentsList) await ctx.db.delete(comment._id);

    // Delete media from storage
    if (post.media) {
      for (const m of post.media) await ctx.storage.delete(m.storageId);
    }

    // Delete documents from storage
    if ((post as any).documents) {
      for (const d of (post as any).documents) await ctx.storage.delete(d.storageId);
    }

    await ctx.db.delete(args.postId);
    return { success: true };
  },
});

/**
 * Temporary: reset a user's role to user. Admin only.
 */

/**
 * Temporary: list all auth accounts to find emails.
 */


/**
 * Get the current user's role.
 */
export const getRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return (user as any)?.role ?? null;
  },
});
