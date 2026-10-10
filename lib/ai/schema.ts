import { z } from "zod";
export const investigationSchema = z.object({ sections: z.array(z.object({ category: z.enum(["Verified facts", "Possible explanations", "Unknowns", "Suggested investigation steps"]), claims: z.array(z.object({ text: z.string().min(1).max(1500), sourceIds: z.array(z.string().max(60)).max(12) })).min(1).max(5) })).min(1).max(4) });
export type Investigation = z.infer<typeof investigationSchema>;
