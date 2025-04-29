import { mysqlTable, varchar, int, text, timestamp } from "drizzle-orm/mysql-core";
import { v4 as uuidv4 } from "uuid";

export const researches = mysqlTable("researches", {
  id: varchar("id", { length: 128 }).notNull().primaryKey().$defaultFn(() => uuidv4()),
  query: varchar("query", { length: 255 }).notNull(),
  depth: varchar("depth", { length: 255 }).notNull(),
  breadth: varchar("breadth", { length: 255 }).notNull(),
  images: text("images"),
  status: int("status").notNull(),
  result: text("result"),
  interim_results: text("interim_results"),
  created_at: timestamp("created_at").defaultNow(),
});

export type Research = typeof researches.$inferSelect;
export type NewResearch = typeof researches.$inferInsert;
