import { z } from "zod";

/** Tychi fund_id, investor_id, run_id, etc. are UUIDs. */
export const idSchema = z.string().uuid("Invalid id");

export const fundIdSchema = idSchema;
