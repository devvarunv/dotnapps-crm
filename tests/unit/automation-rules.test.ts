import { describe, it, expect } from "vitest";
import {
  defaultConfigFor,
  ruleConfigSchema,
  RULE_TRIGGERS,
  TRIGGER_ACTIONS,
} from "@/lib/automation/rules";

describe("automation rule config", () => {
  it("every trigger has a non-empty default config and at least one action", () => {
    for (const trigger of RULE_TRIGGERS) {
      const config = defaultConfigFor(trigger);
      expect(config).toBeTypeOf("object");
      expect(TRIGGER_ACTIONS[trigger].length).toBeGreaterThan(0);
    }
  });

  it("LEAD_CREATED_NO_FOLLOWUP defaults to a one-day delay", () => {
    expect(defaultConfigFor("LEAD_CREATED_NO_FOLLOWUP").delayMinutes).toBe(1440);
  });

  it("ruleConfigSchema coerces string form fields to numbers", () => {
    const parsed = ruleConfigSchema.safeParse({ delayMinutes: "120", withinDays: "7" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.delayMinutes).toBe(120);
      expect(parsed.data.withinDays).toBe(7);
    }
  });

  it("ruleConfigSchema rejects an out-of-range value", () => {
    const parsed = ruleConfigSchema.safeParse({ withinDays: 9999 });
    expect(parsed.success).toBe(false);
  });

  it("ruleConfigSchema allows an empty config (all fields optional)", () => {
    expect(ruleConfigSchema.safeParse({}).success).toBe(true);
  });
});
