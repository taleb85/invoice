import fs from "fs";

const en = fs.readFileSync("src/lib/translations/en.ts", "utf-8");
const types = fs.readFileSync("src/lib/translations/types.ts", "utf-8");

// Known false positives (values inside strings that look like keys)
const FALSE_POSITIVES = new Set([
  "Inbox", "Reminders", "Today", "analysed", "as", "detected", "drafts",
  "filter", "last", "mailbox", "processed", "result", "text"
]);

// Find dashboard section in en.ts
const enStart = en.indexOf("  dashboard: {");
let depth = 0, i = enStart;
while (i < en.length) {
  if (en[i] === "{") depth++;
  if (en[i] === "}") { depth--; if (depth === 0) break; }
  i++;
}
const enSection = en.substring(enStart, i + 1);

// Extract all en.ts keys
const re = /(\w+):\s*(['"\[{`])/g;
const enMatches = [...enSection.matchAll(re)];
const enKeys = new Set(enMatches.map(m => m[1]).filter(k => k !== "dashboard" && !FALSE_POSITIVES.has(k)));

// Find dashboard section in types.ts
const typeStart = types.indexOf("  dashboard: {");
depth = 0; i = typeStart;
while (i < types.length) {
  if (types[i] === "{") depth++;
  if (types[i] === "}") { depth--; if (depth === 0) break; }
  i++;
}
const typeSection = types.substring(typeStart, i + 1);

// Extract all types.ts keys
const typeMatches = [...typeSection.matchAll(/^    (\w+):/gm)];
const typeKeys = new Set(typeMatches.map(m => m[1]).filter(k => k !== "dashboard"));

// Merge: all enKeys + any typeKeys not in enKeys
const merged = new Set([...enKeys, ...typeKeys]);

// Generate the replacement section
const sortedKeys = [...merged].sort();
const lines = ["  dashboard: {"];
for (const key of sortedKeys) {
  lines.push("    " + key + ": string");
}
lines.push("  }");

console.log(lines.join("\n"));
