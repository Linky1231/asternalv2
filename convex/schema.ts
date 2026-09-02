import { defineSchema } from "convex/server";

// Minimal schema — auth and data use Supabase.
// This exists only so `convex dev --once` succeeds in the build pipeline.
export default defineSchema({});
