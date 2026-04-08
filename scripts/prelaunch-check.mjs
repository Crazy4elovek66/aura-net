import { spawn } from "node:child_process";

const checks = [
  { label: "lint", args: ["run", "lint"] },
  { label: "typecheck", args: ["run", "typecheck"] },
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
  console.log("Manual smoke flows still recommended:");
  console.log("- Telegram auth -> setup/profile");
  console.log("- vote + discover + leaderboard");
  console.log("- daily reward + spend actions");
  console.log("- /admin moderation actions + notification drain");
} catch (error) {
  console.error(`\nPrelaunch technical checks failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
