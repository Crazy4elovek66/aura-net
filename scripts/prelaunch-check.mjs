import { spawn } from "node:child_process";

const checks = [
  { label: "lint", args: ["run", "lint"] },
  { label: "typecheck", args: ["run", "typecheck"] },
  { label: "smoke", args: ["run", "test:smoke"] },
  { label: "build", args: ["run", "build"] },
];

function runCheck(check) {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npm";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...check.args] : check.args;

    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${check.label} failed with exit code ${code}`));
    });
  });
}

try {
  for (const check of checks) {
    console.log(`\n== ${check.label} ==`);
    await runCheck(check);
  }

  console.log("\nPrelaunch technical checks passed.");
  console.log("Verified automatically:");
  console.log("- critical auth parsing and safe redirect/referral normalization");
  console.log("- vote and daily reward response contracts / error mapping");
  console.log("- runtime job payload guards for notifications/referrals");
  console.log("- schema regression guards for referral activation and notification enqueue");
  console.log("- moderation/public API route source contract markers");
  console.log("Manual smoke flows still recommended via `npm run qa:smoke:manual`.");
} catch (error) {
  console.error(`\nPrelaunch technical checks failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
