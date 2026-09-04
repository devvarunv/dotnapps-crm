import { describe, it, expect } from "vitest";
import { slugify, initials, cn } from "@/lib/utils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Inc.")).toBe("acme-inc");
  });
  it("strips leading/trailing separators and collapses repeats", () => {
    expect(slugify("  ---Weird!!  Name???---  ")).toBe("weird-name");
  });
  it("truncates to 48 characters", () => {
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(48);
  });
});

describe("initials", () => {
  it("takes the first letter of up to two words", () => {
    expect(initials("Olivia Owner")).toBe("OO");
    expect(initials("Cher")).toBe("C");
    expect(initials("Ada Lovelace Byron")).toBe("AL");
  });
  it("ignores extra whitespace", () => {
    expect(initials("  Marcus   Manager  ")).toBe("MM");
  });
});

describe("cn", () => {
  it("merges tailwind classes, letting the later one win on conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});
