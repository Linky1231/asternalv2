import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Minimal schema — auth and data use Supabase.
  // This exists only so `convex dev --once` succeeds in the build pipeline.
  _deployment_meta: defineTable({
    key: v.string(),
    value: v.string(),
  }),
});
