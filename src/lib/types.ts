import { z } from "zod";

// Prisma's MongoDB connector has no enum support — validate with zod at write boundaries.
export const Severity = z.enum(["blocker", "major", "minor"]);
export const StandardStatus = z.enum(["draft", "approved", "deprecated"]);
export const PatternStatus = z.enum(["proposed", "approved-as-standard", "rejected", "merged"]);
export const JobType = z.enum(["mine-patterns", "grade"]);
export const JobStatus = z.enum(["queued", "running", "done", "failed"]);
export const ConversationStatus = z.enum(["ingested", "analyzed", "graded"]);
export const Stack = z.enum([
  "all", "typescript", "javascript", "react", "nextjs", "react-native",
  "node", "python", "go", "flutter", "swift", "kotlin",
]);

export type Severity = z.infer<typeof Severity>;
export type StandardStatus = z.infer<typeof StandardStatus>;
export type PatternStatus = z.infer<typeof PatternStatus>;
export type JobType = z.infer<typeof JobType>;
export type JobStatus = z.infer<typeof JobStatus>;
export type ConversationStatus = z.infer<typeof ConversationStatus>;
export type Stack = z.infer<typeof Stack>;
