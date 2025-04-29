import { drizzle } from "drizzle-orm/tidb-serverless";
import { connect } from "@tidbcloud/serverless";
import * as schema from "@/db/schema";

export function getDrizzleClient() {
  const client = connect({ url: process.env.DATABASE_URL });
  return drizzle(client, { schema });
}
