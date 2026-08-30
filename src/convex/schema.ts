import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    posts: defineTable({
      authorId: v.id("users"),
      title: v.optional(v.string()),
      content: v.string(),
      createdAt: v.number(),
      likes: v.number(),
      favorites: v.number(),
      shares: v.number(),
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
        v.array(
          v.object({
            userId: v.string(),
            name: v.string(),
          }),
        ),
      ),
    }).index("by_created", ["createdAt"]),

    likes: defineTable({
      userId: v.id("users"),
      postId: v.id("posts"),
    })
      .index("by_post", ["postId"])
      .index("by_user_post", ["userId", "postId"]),

    comments: defineTable({
      postId: v.id("posts"),
      authorId: v.id("users"),
      content: v.string(),
      createdAt: v.number(),
      likes: v.number(),
      parentCommentId: v.optional(v.id("comments")),
    })
      .index("by_post", ["postId"])
      .index("by_parent", ["parentCommentId"]),

    favorites: defineTable({
      userId: v.id("users"),
      postId: v.id("posts"),
    })
      .index("by_post", ["postId"])
      .index("by_user_post", ["userId", "postId"]),

    commentLikes: defineTable({
      userId: v.id("users"),
      commentId: v.id("comments"),
    })
      .index("by_comment", ["commentId"])
      .index("by_user_comment", ["userId", "commentId"]),

    follows: defineTable({
      followerId: v.id("users"),
      followingId: v.id("users"),
    })
      .index("by_follower", ["followerId"])
      .index("by_following", ["followingId"])
      .index("by_pair", ["followerId", "followingId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
