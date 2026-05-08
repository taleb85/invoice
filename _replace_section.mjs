import fs from "fs";

const typesPath = "src/lib/translations/types.ts";
const types = fs.readFileSync(typesPath, "utf-8");

// Paths for new content
const newFile = process.argv[2];  // file with the new section content

// Read the new section
const newSection = fs.readFileSync(newFile, "utf-8").trimEnd();

// Extract section name from the first line
const sectionName = newSection.match(/^  (\w+):/)[1];

// Find this section in types.ts
const startMatch = types.match(new RegExp("^  " + sectionName + ": \\{", "m"));
if (!startMatch) {
  console.error("Section '" + sectionName + "' not found in types.ts!");
  process.exit(1);
}

const start = startMatch.index;
let depth = 0;
let i = start;
while (i < types.length) {
  if (types[i] === "{") depth++;
  if (types[i] === "}") { depth--; if (depth === 0) break; }
  i++;
}
const oldSection = types.substring(start, i + 1);

console.log("Old section length:", oldSection.length);

// Check for the impostazioni section
const result = types.replace(oldSection, newSection);
fs.writeFileSync(typesPath, result, "utf-8");
console.log("Replaced " + sectionName + " section successfully!");
