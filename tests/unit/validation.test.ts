import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema } from "@/lib/validation";
import { leadSchema } from "@/lib/crm/validation";

describe("signupSchema", () => {
  it("accepts a valid signup", () => {
    const r = signupSchema.safeParse({
      name: "Ada Lovelace",
      email: "Ada@Example.com",
      password: "correct-horse-battery",
      confirmPassword: "correct-horse-battery",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("ada@example.com"); // lowercased
  });

  it("rejects mismatched passwords", () => {
    const r = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "correct-horse-battery",
      confirmPassword: "different-password",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a short password", () => {
    const r = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const r = signupSchema.safeParse({
      name: "Ada",
      email: "not-an-email",
      password: "correct-horse-battery",
      confirmPassword: "correct-horse-battery",
    });
    expect(r.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a non-empty password but doesn't enforce length", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("leadSchema", () => {
  it("requires a name and a valid enum source/status", () => {
    const r = leadSchema.safeParse({ name: "Jo", source: "WEBSITE", status: "NEW" });
    expect(r.success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(leadSchema.safeParse({ name: "J", source: "WEBSITE", status: "NEW" }).success).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(
      leadSchema.safeParse({ name: "Jo", source: "CARRIER_PIGEON", status: "NEW" }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric estimated value", () => {
    const r = leadSchema.safeParse({
      name: "Jo",
      source: "WEBSITE",
      status: "NEW",
      estimatedValue: "lots",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a numeric estimated value with thousands separators", () => {
    const r = leadSchema.safeParse({
      name: "Jo",
      source: "WEBSITE",
      status: "NEW",
      estimatedValue: "12,500",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.estimatedValue).toBe("12500");
  });
});
