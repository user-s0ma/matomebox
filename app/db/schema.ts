import { mysqlTable, varchar, int, text, timestamp } from "drizzle-orm/mysql-core";
import { v4 as uuidv4 } from "uuid";

export const researches = mysqlTable("researches", {
  id: varchar("id", { length: 128 }).notNull().primaryKey().$defaultFn(() => uuidv4()),
  query: varchar("query", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  thumbnail: text("thumbnail"),
  content: text("content"),
  category: varchar("category", { length: 255 }),
  depth: int("depth").notNull(),
  breadth: int("breadth").notNull(),
  status: int("status").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const researchProgress = mysqlTable("research_progress", {
  id: varchar("id", { length: 128 }).notNull().primaryKey().$defaultFn(() => uuidv4()),
  research_id: varchar("research_id", { length: 128 }).notNull().references(() => researches.id, { onDelete: "cascade" }),
  status_message: text("status_message").notNull(),
  progress_percentage: int("progress_percentage"),
  created_at: timestamp("created_at").defaultNow(),
});

export const researchImages = mysqlTable("research_images", {
  id: varchar("id", { length: 128 }).notNull().primaryKey().$defaultFn(() => uuidv4()),
  research_id: varchar("research_id", { length: 128 }).notNull().references(() => researches.id, { onDelete: "cascade" }),
  source_id: varchar("source_id", { length: 128 }).references(() => researchSources.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  alt: text("alt"),
  analysis: text("analysis"),
  created_at: timestamp("created_at").defaultNow(),
});

export const researchSources = mysqlTable("research_sources", {
  id: varchar("id", { length: 128 }).notNull().primaryKey().$defaultFn(() => uuidv4()),
  research_id: varchar("research_id", { length: 128 }).notNull().references(() => researches.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  title: text("title"),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});

export type Research = typeof researches.$inferSelect;
export type NewResearch = typeof researches.$inferInsert;

export type ResearchProgress = typeof researchProgress.$inferSelect;
export type NewResearchProgress = typeof researchProgress.$inferInsert;

export type ResearchImage = typeof researchImages.$inferSelect;
export type NewResearchImage = typeof researchImages.$inferInsert;

export type ResearchSource = typeof researchSources.$inferSelect;
export type NewResearchSource = typeof researchSources.$inferInsert;
