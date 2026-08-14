import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
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

// Business goal categories for the owner dashboard
export const goalCategoryValidator = v.union(
  v.literal("revenue"),
  v.literal("orders"),
  v.literal("customers"),
  v.literal("other"),
);
export type GoalCategory = Infer<typeof goalCategoryValidator>;

// Goal tracking periods
export const goalPeriodValidator = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly"),
);
export type GoalPeriod = Infer<typeof goalPeriodValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // business goals / targets for the owner goals dashboard
    goals: defineTable({
      userId: v.id("users"),
      title: v.string(),
      description: v.optional(v.string()),
      category: goalCategoryValidator,
      unit: v.string(),
      targetValue: v.number(),
      currentValue: v.number(),
      period: goalPeriodValidator,
      dueDate: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
