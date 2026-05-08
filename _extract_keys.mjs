import fs from "fs";

const en = fs.readFileSync("src/lib/translations/en.ts", "utf-8");
const types = fs.readFileSync("src/lib/translations/types.ts", "utf-8");

// Find the dashboard section
const enStart = en.indexOf("  dashboard: {");
let depth = 0, i = enStart;
while (i < en.length) {
  if (en[i] === "{") depth++;
  if (en[i] === "}") { depth--; if (depth === 0) break; }
  i++;
}
const enSection = en.substring(enStart, i + 1);

// Extract all keys
const re = /(\w+):\s*(['"\[{`])/g;
const matches = [...enSection.matchAll(re)];
const keys = matches.map(m => m[1]).filter(k => k !== "dashboard");
const unique = [...new Set(keys)].sort();

console.log("Total:", unique.length);
console.log("All unique keys:");
unique.forEach(k => console.log("  " + k));
