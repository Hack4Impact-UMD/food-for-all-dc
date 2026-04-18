import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

describe("DeliverySpreadsheet styles regression", () => {
  // Guards against reintroducing global html/body centering styles that can shift
  // page flow and hide or misplace route search/map sections.
  it("does not apply global html/body centering styles", () => {
    const cssPath = path.resolve(__dirname, "../../../pages/Delivery/DeliverySpreadsheet.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).not.toMatch(/(^|\n)\s*html\s*,\s*\n\s*body\s*\{/m);
  });
});
