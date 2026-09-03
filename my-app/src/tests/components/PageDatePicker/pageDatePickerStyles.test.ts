import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

/**
 * react-datepicker tags its "preSelection" day with `--keyboard-selected`, and that
 * day follows the visible month: paging from March back to February moves it from
 * Mar 2 to Feb 2. Styling the class like the real selection made the same day number
 * look selected in every month -- and two days look selected at once, since the grid
 * also renders the selected day when it falls in a neighbouring month.
 */
describe("PageDatePicker day highlighting regression guards", () => {
  const cssPath = path.resolve(__dirname, "../../../components/PageDatePicker/pagedatepicker.css");
  const css = fs.readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  const rules = css.match(/[^{}]+\{[^{}]*\}/g) ?? [];
  const selectorsOf = (rule: string) =>
    rule
      .slice(0, rule.indexOf("{"))
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean);

  // Rules on the bare selector only, so `--selected` does not also pull in its
  // `:hover`, `:focus` and `.--today` variants.
  const rulesExactlyTargeting = (selector: string) =>
    rules.filter((rule) => selectorsOf(rule).includes(selector));

  // Rules mentioning the selector in any form, including combined selectors.
  const rulesMentioning = (selector: string) =>
    rules.filter((rule) => rule.slice(0, rule.indexOf("{")).includes(selector));

  const selectedFill = "background: var(--color-primary) !important";

  it("fills the selected day with the primary color", () => {
    const selectedRules = rulesExactlyTargeting(".react-datepicker__day--selected");
    expect(selectedRules.some((rule) => rule.includes(selectedFill))).toBe(true);
  });

  it("never gives the keyboard-navigation day the selected fill", () => {
    const keyboardRules = rulesMentioning(".react-datepicker__day--keyboard-selected");
    expect(keyboardRules.length).toBeGreaterThan(0);
    expect(keyboardRules.filter((rule) => rule.includes(selectedFill))).toEqual([]);
  });
});
