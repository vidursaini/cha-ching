import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repositoryRoot,
  encoding: "utf8"
})
  .split("\0")
  .filter(Boolean);

const prohibited = [
  { label: "absolute developer home path", pattern: /\/Users\/[^/]+\//i },
  { label: "personal Gmail address", pattern: /[\w.+-]+@gmail\.com/i },
  { label: "developer signing identity", pattern: /Developer ID Application:/i },
  { label: "account-specific D1 database id", pattern: /"database_id"\s*:\s*"[0-9a-f-]{36}"/i },
  {
    label: "non-example hosted email domain",
    pattern: /"LICENSE_EMAIL_FROM"\s*:\s*"[^"]+@(?!example\.com)[^"]+"/i
  }
];

test("tracked public source excludes private operator details", () => {
  const violations = [];

  for (const file of trackedFiles) {
    if (file === "test/publicSourceHygiene.test.mjs") continue;

    let contents;
    try {
      contents = readFileSync(new URL(file, repositoryRoot), "utf8");
    } catch {
      continue;
    }

    for (const rule of prohibited) {
      if (rule.pattern.test(contents)) violations.push(`${file}: ${rule.label}`);
    }
  }

  assert.deepEqual(violations, []);
});
