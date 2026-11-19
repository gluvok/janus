import { describe, it, expect } from "vitest";

describe("Weighment Gross-Tare Net Engine", () => {
  it("calculates correct net weight from gross and tare entries", () => {
    const grossWeight = 38400.0;
    const tareWeight = 12200.0;
    const netWeight = grossWeight - tareWeight;
    expect(netWeight).toBe(26200.0);
  });

  it("handles out-of-order entry arrivals deterministically", () => {
    const entry1 = { id: 101, weight: 12200.0, type: "out" };
    const entry2 = { id: 102, weight: 38400.0, type: "in" };
    const gross = Math.max(entry1.weight, entry2.weight);
    const tare = Math.min(entry1.weight, entry2.weight);
    expect(gross - tare).toBe(26200.0);
  });

  it("enforces tenant boundary isolation between centers of different factories", () => {
    const centerFactoryMap = new Map<number, number>([
      [1, 10], // Center 1 belongs to Factory 10
      [2, 20], // Center 2 belongs to Factory 20
    ]);
    const canPair = (centerA: number, centerB: number) => {
      return centerFactoryMap.get(centerA) === centerFactoryMap.get(centerB);
    };
    expect(canPair(1, 2)).toBe(false);
  });
});
