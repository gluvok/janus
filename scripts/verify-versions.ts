import { execSync } from "child_process";

console.log("Checking lockfile and typescript version alignment...");
try {
  execSync("pnpm type-check", { stdio: "inherit" });
  execSync("pnpm lint", { stdio: "inherit" });
  console.log("Version alignment check passed with 0 errors.");
} catch {
  console.error("Version conflict or type error detected!");
  process.exit(1);
}
