import fs from "fs";

const en = fs.readFileSync("src/lib/translations/en.ts", "utf-8");
let types = fs.readFileSync("src/lib/translations/types.ts", "utf-8");

// Known false positives (values inside strings that look like keys)
const FALSE_POSITIVES = new Set([
  "Inbox", "Reminders", "Today", "analysed", "as", "detected", "drafts",
  "filter", "last", "mailbox", "processed", "result", "text",
  "Attention", "clicks", "increase", "decrease", "Done", "DoneTitle",
  "Read", "Statement", "DB", "Selected", "automatically", "rows",
  "date", "total", "code", "errors", "and", "deleting", "products",
  "location", "to", "Active", "Received", "Bills", "Bolle", "Sent",
  "Failed", "scheduled", "schedule", "cancel", "alert"
]);

// Find a section by name in content and return { start, end, content, keys }
function findSection(content, sectionName) {
  const re = new RegExp("^  " + sectionName + ": \\{", "m");
  const match = content.match(re);
  if (!match) return null;
  
  const start = match.index;
  let depth = 0;
  let i = start + match[0].indexOf("{") + 1;
  while (i < content.length) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") {
      if (depth === 0) break;
      depth--;
    }
    i++;
  }
  const end = i + 1;
  return {
    start,
    end,
    content: content.substring(start, end)
  };
}

// Extract real keys from a section - matches both inline and multiline
function extractKeys(sectionContent, sectionName) {
  const re = /(\w+):\s*(['"\[{`])/g;
  const matches = [...sectionContent.matchAll(re)];
  const keys = matches.map(m => m[1]).filter(k => k !== sectionName && !FALSE_POSITIVES.has(k));
  return new Set(keys);
}

// Get all sections from en.ts
const enSectionMatches = [...en.matchAll(/^  (\w+): \{/gm)];
const enSections = {};
for (const m of enSectionMatches) {
  const name = m[1];
  if (name === "months") continue;  // months is inside statements, not a top-level section
  const info = findSection(en, name);
  if (info) {
    const keys = extractKeys(info.content, name);
    enSections[name] = { ...info, keys };
  }
}

// Process each section found in types.ts
let modifiedCount = 0;
for (const [sectionName, enInfo] of Object.entries(enSections)) {
  const typeInfo = findSection(types, sectionName);
  if (!typeInfo) {
    console.log("Section NOT in types.ts:", sectionName, `(${enInfo.keys.size} keys)`);
    continue;  // We'll add these manually
  }
  
  const typeKeys = extractKeys(typeInfo.content, sectionName);
  
  // Check if any new keys need to be added
  const missingFromType = [...enInfo.keys].filter(k => !typeKeys.has(k));
  if (missingFromType.length === 0) continue;  // Already up to date
  
  // Merge keys
  const merged = new Set([...enInfo.keys, ...typeKeys]);
  const sortedKeys = [...merged].sort();
  
  // Generate new content
  const lines = [`  ${sectionName}: {`];
  for (const key of sortedKeys) {
    lines.push(`    ${key}: string`);
  }
  lines.push("  }");
  const newSection = lines.join("\n");
  
  // Replace in types
  types = types.substring(0, typeInfo.start) + newSection + types.substring(typeInfo.end);
  
  console.log(`Fixed: ${sectionName} (${typeKeys.size} → ${merged.size} keys, +${missingFromType.length})`);
  modifiedCount++;
}

// Now add sections that exist in en.ts but NOT in types.ts
const typeSectionMatches = [...types.matchAll(/^  (\w+): \{/gm)];
const typeSectionNames = new Set(typeSectionMatches.map(m => m[1]));

for (const [sectionName, enInfo] of Object.entries(enSections)) {
  if (typeSectionNames.has(sectionName)) continue;
  if (sectionName === "months") continue;
  
  const sortedKeys = [...enInfo.keys].sort();
  const lines = [`  ${sectionName}: {`];
  for (const key of sortedKeys) {
    lines.push(`    ${key}: string`);
  }
  lines.push("  },");
  const newSection = lines.join("\n");
  
  // Add before the closing '}' of the Translations interface
  const closeBrace = types.lastIndexOf("}");
  types = types.substring(0, closeBrace) + newSection + "\n" + types.substring(closeBrace);
  
  console.log(`Added missing section: ${sectionName} (${sortedKeys.length} keys)`);
  modifiedCount++;
}

console.log(`\nTotal modifications: ${modifiedCount}`);

// Write result
fs.writeFileSync("src/lib/translations/types.ts", types, "utf-8");
console.log("✅ types.ts updated!");
