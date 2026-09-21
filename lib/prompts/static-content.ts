import fs from "node:fs";
import path from "node:path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

export function getCoachingPhilosophy(): string {
  return read("content/coaching-philosophy/coaching-philosophy.md");
}

export function getTrainingTargetsReference(): string {
  return read("content/training-targets/training-targets-reference.md");
}
