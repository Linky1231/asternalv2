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

    // Include role directly in the user object to avoid a separate getRole query
    return {
      ...user,
      role: (user as any)?.role ?? null,
    };
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
 * @deprecated Use currentUser.role instead
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

/**
 * Get a user's profile with follow stats and posts in a single call.
 * Avoids separate queries for user info, follow stats, and posts.
 */
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rawUser = await ctx.db.get(args.userId as any);
    if (!rawUser) return null;
    const user = rawUser as any; // users table document

    // Resolve avatar URL
    let avatarUrl: string | undefined;
    if (user.image) {
      avatarUrl = (await ctx.storage.getUrl(user.image)) ?? undefined;
    }

    // Follow stats in one pass
    const followerRecords = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", user._id))
      .collect();
    const followingRecords = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", user._id))
      .collect();

    // Current user's follow status
    const currentUserId = await getAuthUserId(ctx);
    let isFollowing = false;
    if (currentUserId && currentUserId !== user._id) {
      const pair = await ctx.db
        .query("follows")
        .withIndex("by_pair", (q) =>
          q.eq("followerId", currentUserId).eq("followingId", user._id),
        )
        .first();
      isFollowing = pair !== null;
    }

    // User's posts
    const allPosts = await ctx.db
      .query("posts")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const userPosts = allPosts
      .filter((p) => p.authorId === args.userId)
      .slice(0, 30);

    const postsWithData = await Promise.all(
      userPosts.map(async (post) => {
        const mediaUrls = post.media
          ? await Promise.all(
              post.media.map(async (m: any) => ({
                url: (await ctx.storage.getUrl(m.storageId)) ?? "",
                type: m.type,
                mime: m.mime ?? undefined,
              })),
            )
          : [];
        const documentUrls = (post as any).documents
          ? await Promise.all(
              (post as any).documents.map(async (d: any) => ({
                url: (await ctx.storage.getUrl(d.storageId)) ?? "",
                name: d.name,
                size: d.size,
                mime: d.mime ?? undefined,
              })),
            )
          : [];
        let likedByMe = false;
        let favoritedByMe = false;
        if (currentUserId) {
          const like = await ctx.db
            .query("likes")
            .withIndex("by_user_post", (q) =>
              q.eq("userId", currentUserId).eq("postId", post._id),
            )
            .first();
          likedByMe = !!like;
          const fav = await ctx.db
            .query("favorites")
            .withIndex("by_user_post", (q) =>
              q.eq("userId", currentUserId).eq("postId", post._id),
            )
            .first();
          favoritedByMe = !!fav;
        }
        return {
          _id: post._id,
          authorId: post.authorId,
          title: post.title,
          content: post.content,
          createdAt: post.createdAt,
          likes: post.likes,
          favorites: post.favorites,
          shares: post.shares,
          mediaUrls,
          documentUrls,
          authorName: user.name ?? "Anónimo",
          authorImageUrl: avatarUrl,
          likedByMe,
          favoritedByMe,
          mentions: (post as any).mentions ?? [],
          hashtags: (post as any).hashtags ?? [],
        };
      }),
    );

    return {
      _id: user._id,
      name: user.name ?? "Anónimo",
      email: user.email,
      image: user.image,
      avatarUrl,
      bio: user.bio ?? "",
      title: user.title ?? "",
      followers: followerRecords.length,
      following: followingRecords.length,
      isFollowing,
      posts: postsWithData,
    };
  },
});

// ── Username / Password Auth ───────────────────────────────────────

/** Simple SHA-256 hash using Web Crypto (available in Convex runtime). */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Register a new user with username and password.
 * Returns the created user (without passwordHash).
 */
export const register = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    if (username.length < 3) {
      throw new Error("El nombre de usuario debe tener al menos 3 caracteres");
    }
    if (username.length > 20) {
      throw new Error("El nombre de usuario no puede tener más de 20 caracteres");
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      throw new Error("El nombre de usuario solo puede contener letras minúsculas, números y guiones bajos");
    }
    if (args.password.length < 4) {
      throw new Error("La contraseña debe tener al menos 4 caracteres");
    }

    // Check if username is already taken
    const existing = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", username))
      .first();
    if (existing) {
      throw new Error("Este nombre de usuario ya está en uso");
    }

    const passwordHash = await hashPassword(args.password);
    const displayName = args.name?.trim() || username;

    const userId = await ctx.db.insert("users", {
      name: displayName,
      username,
      passwordHash,
      email: undefined,
      role: "user",
    });

    return {
      _id: userId,
      name: displayName,
      username,
    };
  },
});

/**
 * Login with username and password.
 * Returns user data on success, throws on failure.
 */
export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();

    const user = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", username))
      .first();

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const userAny = user as any;
    if (!userAny.passwordHash) {
      throw new Error("Esta cuenta no tiene contraseña configurada");
    }

    const passwordHash = await hashPassword(args.password);
    if (passwordHash !== userAny.passwordHash) {
      throw new Error("Contraseña incorrecta");
    }

    // Resolve avatar URL
    let avatarUrl: string | undefined;
    if (user.image) {
      avatarUrl = (await ctx.storage.getUrl(user.image)) ?? undefined;
    }

    return {
      _id: user._id,
      name: user.name ?? "Anónimo",
      username: userAny.username,
      email: user.email,
      image: user.image,
      avatarUrl,
      role: userAny.role ?? "user",
    };
  },
});
