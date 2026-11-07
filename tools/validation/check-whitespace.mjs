import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";

const root = process.cwd();
const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
});
const paths = [...new Set(listed.split("\0").filter(Boolean))].sort();
const failures = [];

for (const path of paths) {
  const bytes = await readFile(path);
  if (bytes.includes(0)) continue;
  const source = bytes.toString("utf8");
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    if (/[ \t]$/.test(lines[index] ?? "")) {
      failures.push(`${path}:${index + 1}: trailing whitespace`);
    }
  }

  if (source.includes("\r")) failures.push(`${path}: contains carriage returns; LF is required`);
  if (!source.endsWith("\n")) failures.push(`${path}: missing final newline`);
  else if (source.endsWith("\n\n")) failures.push(`${path}: extra blank line at EOF`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Whitespace check passed for ${paths.length} non-ignored files.`);
}
