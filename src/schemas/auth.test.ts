import { describe, expect, it } from "vitest";
import {
  MARKET_CODES,
  MARKET_CURRENCIES,
  createOrgSchema,
  emailField,
  passwordField,
  resetSchema,
  setPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./auth";

describe("emailField", () => {
  it("trims and lowercases", () => {
    expect(emailField.parse("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it("rejects invalid emails", () => {
    expect(() => emailField.parse("not-an-email")).toThrow();
  });
});

describe("passwordField", () => {
  it("requires 8..72 chars", () => {
    expect(() => passwordField.parse("short")).toThrow();
    expect(passwordField.parse("longenough")).toBe("longenough");
    expect(() => passwordField.parse("a".repeat(73))).toThrow();
  });
});

describe("signInSchema / signUpSchema", () => {
  it("validates sign in", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "password1" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
  });
  it("requires full name on sign up", () => {
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "password1", fullName: "A" }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "password1", fullName: "Ab" }).success).toBe(true);
  });
});

describe("resetSchema / setPasswordSchema", () => {
  it("reset requires email", () => {
    expect(resetSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("set password requires valid password", () => {
    expect(setPasswordSchema.safeParse({ password: "password1" }).success).toBe(true);
    expect(setPasswordSchema.safeParse({ password: "short" }).success).toBe(false);
  });
});

describe("createOrgSchema", () => {
  const valid = { name: "Demo Org", slug: "demo-org", countryCode: "QA", baseCurrency: "QAR", locale: "en" };
  it("accepts a valid org", () => {
    expect(createOrgSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects bad slug", () => {
    expect(createOrgSchema.safeParse({ ...valid, slug: "Bad Slug" }).success).toBe(false);
    expect(createOrgSchema.safeParse({ ...valid, slug: "-leading" }).success).toBe(false);
  });
  it("rejects unknown market code / currency", () => {
    expect(createOrgSchema.safeParse({ ...valid, countryCode: "XX" }).success).toBe(false);
    expect(createOrgSchema.safeParse({ ...valid, baseCurrency: "XXX" }).success).toBe(false);
    expect(createOrgSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });
  it("MARKET_CODES and MARKET_CURRENCIES are aligned in length", () => {
    expect(MARKET_CODES.length).toBe(MARKET_CURRENCIES.length);
  });
});