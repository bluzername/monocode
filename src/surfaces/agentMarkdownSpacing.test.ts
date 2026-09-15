import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * https://github.com/hardbeat920/monocode/issues/218 — a reply with several
 * "\n\n"-separated sections rendered as one dense block. Streamdown's own
 * heading, blockquote and hr components each carry a margin class (mt-6/
 * mb-2, my-4, my-6 — see node_modules/streamdown/dist/index.js), but its
 * default paragraph component is a plain `<p>` with no spacing class at
 * all, so a "\n\n" break landed as a real new <p> with no visible gap.
 *
 * There's no jsdom/component-render test in this repo (vitest.config.ts
 * only picks up src/**\/*.test.ts, and CONTRIBUTING calls out pure-function
 * protocol tests as the norm), so this checks the shipped rule directly
 * against the stylesheet source rather than a rendered DOM.
 */

const CSS_PATH = fileURLToPath(new URL("../index.css", import.meta.url));

function readCss(): string {
  return readFileSync(CSS_PATH, "utf8");
}

describe("agent-markdown paragraph spacing", () => {
  it("gives every paragraph a visible gap below it", () => {
    const css = readCss();
    const rule = css.match(/\.agent-markdown p\s*\{([^}]*)\}/);
    expect(rule, "expected a `.agent-markdown p { ... }` rule in index.css").toBeTruthy();
    const body = rule![1];
    const margin = body.match(/margin(?:-bottom)?\s*:\s*([^;]+);/);
    expect(margin, "expected a margin-bottom declaration on .agent-markdown p").toBeTruthy();
    expect(margin![1].trim()).not.toBe("0");
  });

  it("does not leave a trailing gap after the last paragraph in a block", () => {
    const css = readCss();
    const rule = css.match(/\.agent-markdown p:last-child\s*\{([^}]*)\}/);
    expect(
      rule,
      "expected a `.agent-markdown p:last-child { ... }` rule zeroing the trailing margin",
    ).toBeTruthy();
    expect(rule![1]).toMatch(/margin-bottom\s*:\s*0\s*;/);
  });
});
