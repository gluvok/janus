import { describe, expect, it } from "vitest";
import { isValidIndianPlate } from "./helpers";

describe("isValidIndianPlate", () => {
  it("accepts Bharat-series plates (YYBHNNNNXX)", () => {
    expect(isValidIndianPlate("22BH1234AA")).toBe(true);
    expect(isValidIndianPlate("22 BH 1234 A")).toBe(true);
  });

  it("rejects junk and Bharat-series lookalikes", () => {
    expect(isValidIndianPlate("ZZ99XX0000")).toBe(false);
    expect(isValidIndianPlate("22BH1234IO")).toBe(false); // I and O are not used
    expect(isValidIndianPlate("22BH123AA")).toBe(false); // needs 4 digits
  });
});
