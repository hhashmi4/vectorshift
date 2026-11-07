import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".next", "dist", "build"]);
const markdown = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extname(entry.name) === ".md") markdown.push(path);
  }
}

function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

await walk(root);
const failures = [];
const absoluteMachinePath = /(?:\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\\Users\\[^\\]+)/;

for (const file of markdown) {
  const source = await readFile(file, "utf8");
  const headings = new Set(
    source
      .split("\n")
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => slug(line.replace(/^#{1,6}\s+/, ""))),
  );

  if (absoluteMachinePath.test(source)) {
    failures.push(`${relative(root, file)}: contains a machine-specific absolute path`);
  }

  const links = source.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (!raw || /^(https?:|mailto:)/.test(raw)) continue;
    if (raw.startsWith("#")) {
      if (!headings.has(raw.slice(1))) {
        failures.push(`${relative(root, file)}: missing local anchor ${raw}`);
      }
      continue;
    }
    const [target] = raw.split("#", 1);
    try {
      await readFile(resolve(dirname(file), decodeURIComponent(target)));
    } catch {
      failures.push(`${relative(root, file)}: broken link ${raw}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed for ${markdown.length} Markdown files.`);
}
