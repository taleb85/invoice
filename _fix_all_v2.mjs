import fs from "fs";

const en = fs.readFileSync("src/lib/translations/en.ts", "utf-8");
let types = fs.readFileSync("src/lib/translations/types.ts", "utf-8");

// Known false positives (values inside strings that look like keys)
const FALSE_POSITIVES = new Set([
  "Inbox", "Reminders", "Today", "analysed", "as", "detected", "drafts",
  "filter", "last", "mailbox", "processed", "result", "text",
  "Attention", "clicks", "increase", "decrease", "Done", "DoneTitle",
  "Read", "Statement", "DB", "Selected", "automatically", "rows",
  "code", "errors", "and", "deleting", "products",
  "location", "to", "Active", "Received", "Bills", "Bolle", "Sent",
  "Failed", "scheduled", "schedule", "cancel", "alert",
  "date", "total"
]);

// Find a section by name in content and return { start, end, content }
function findSection(content, sectionName) {
  const re = new RegExp("^  " + sectionName + ": \\{", "m");
  const match = content.match(re);
  if (!match) return null;
  
  const start = match.index;
  let depth = 0;
  let i = start;
  while (i < content.length) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") {
      if (depth === 0) break;
      depth--;
    }
    i++;
  }
  return {
    start,
    end: i + 1,
    content: content.substring(start, i + 1)
  };
}

// Extract keys from en.ts section (values are quoted strings)
function extractEnKeys(sectionContent, sectionName) {
  const re = /(\w+):\s*(['"\[{`])/g;
  const matches = [...sectionContent.matchAll(re)];
  const keys = matches.map(m => m[1]).filter(k => k !== sectionName && !FALSE_POSITIVES.has(k));
  return new Set(keys);
}

// Extract keys from types.ts section (values are type annotations like string, number, etc.)
function extractTypeKeys(sectionContent, sectionName) {
  const re = /^    (\w+):/gm;
  const matches = [...sectionContent.matchAll(re)];
  const keys = matches.map(m => m[1]);
  return new Set(keys);
}

// Get all sections from en.ts
const enSectionMatches = [...en.matchAll(/^  (\w+): \{/gm)];
const enSections = {};
for (const m of enSectionMatches) {
  const name = m[1];
  const info = findSection(en, name);
  if (info) {
    const keys = extractEnKeys(info.content, name);
    enSections[name] = { ...info, keys };
  }
}

let modifiedCount = 0;

// Process each section found in types.ts — only ADD missing keys
for (const [sectionName, enInfo] of Object.entries(enSections)) {
  const typeInfo = findSection(types, sectionName);
  if (!typeInfo) {
    console.log("SECTION MISSING from types.ts, will add later:", sectionName, `(${enInfo.keys.size} keys)`);
    continue;
  }
  
  const typeKeys = extractTypeKeys(typeInfo.content, sectionName);
  
  const missingFromType = [...enInfo.keys].filter(k => !typeKeys.has(k));
  if (missingFromType.length === 0) {
    console.log(`✓ ${sectionName}: already complete (${typeKeys.size} keys)`);
    continue;
  }
  
  // Merge: keep all existing typeKeys + add missing enKeys
  const mergedKeys = new Set([...typeKeys, ...enInfo.keys]);
  const sortedKeys = [...mergedKeys].sort();
  
  // Generate new section content
  const lines = [`  ${sectionName}: {`];
  for (const key of sortedKeys) {
    lines.push(`    ${key}: string`);
  }
  lines.push("  }");
  const newSection = lines.join("\n");
  
  // Replace in types
  types = types.substring(0, typeInfo.start) + newSection + types.substring(typeInfo.end);
  
  console.log(`✓ ${sectionName}: ${typeKeys.size} → ${mergedKeys.size} keys (+${missingFromType.length})`);
  modifiedCount++;
}

// Now add sections that exist in en.ts but NOT in types.ts
const typeSectionMatches = [...types.matchAll(/^  (\w+): \{/gm)];
const typeSectionNames = new Set(typeSectionMatches.map(m => m[1]));

for (const [sectionName, enInfo] of Object.entries(enSections)) {
  if (typeSectionNames.has(sectionName)) continue;
  
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
  
  console.log(`+ ${sectionName}: added (${sortedKeys.length} keys)`);
  modifiedCount++;
}

console.log(`\nTotal modifications: ${modifiedCount}`);

// Write result
fs.writeFileSync("src/lib/translations/types.ts", types, "utf-8");
console.log("✅ types.ts updated!");
