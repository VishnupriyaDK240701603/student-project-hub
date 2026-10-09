import { describe, it, expect } from "vitest";
import { parseCollegeEmail, validateSignIn } from "./parse-email";

describe("parseCollegeEmail", () => {
  // Valid student emails
  it("parses a valid student email (standard)", () => {
    const result = parseCollegeEmail("john.d.22.cse@rajlakshmi.edu.in");
    expect(result).toEqual({
      kind: "student",
      name: "john",
      initial: "d",
      year: 2022,
      department: "CSE",
      email: "john.d.22.cse@rajlakshmi.edu.in",
    });
  });

  it("parses a student email with uppercase letters (case-insensitive)", () => {
    const result = parseCollegeEmail("John.D.22.CSE@Rajlakshmi.Edu.In");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("student");
    expect(result!.name).toBe("john");
    expect(result!.department).toBe("CSE");
  });

  it("parses a student email with digits in name", () => {
    const result = parseCollegeEmail("john2.d.23.ece@rajlakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("john2");
    expect(result!.year).toBe(2023);
    expect(result!.department).toBe("ECE");
  });

  it("parses a student with year 00 (2000)", () => {
    const result = parseCollegeEmail("alice.b.00.mech@rajlakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2000);
  });

  it("parses a student with year 99 (2099)", () => {
    const result = parseCollegeEmail("bob.c.99.it@rajlakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2099);
  });

  // Valid staff emails
  it("parses a valid staff email (standard)", () => {
    const result = parseCollegeEmail("mentor.s.cse@rajlakshmi.edu.in");
    expect(result).toEqual({
      kind: "staff",
      name: "mentor",
      initial: "s",
      year: null,
      department: "CSE",
      email: "mentor.s.cse@rajlakshmi.edu.in",
    });
  });

  it("parses a staff email with digits in name segment", () => {
    const result = parseCollegeEmail("prof1.k.ece@rajlakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("staff");
    expect(result!.name).toBe("prof1");
  });

  it("parses a single-name staff email (e.g. staffname@rajalakshmi.edu.in)", () => {
    const result = parseCollegeEmail("staffname@rajalakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("staff");
    expect(result!.name).toBe("staffname");
    expect(result!.year).toBeNull();
  });

  // Invalid emails
  it("rejects a non-college domain (gmail.com)", () => {
    expect(parseCollegeEmail("john.d.22.cse@gmail.com")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseCollegeEmail("")).toBeNull();
  });

  it("rejects null-like input", () => {
    expect(parseCollegeEmail(undefined as unknown as string)).toBeNull();
    expect(parseCollegeEmail(null as unknown as string)).toBeNull();
  });

  it("rejects plus-addressing", () => {
    expect(parseCollegeEmail("john+tag.d.22.cse@rajlakshmi.edu.in")).toBeNull();
  });

  it("rejects email with too few segments (2 segments)", () => {
    expect(parseCollegeEmail("john.cse@rajlakshmi.edu.in")).toBeNull();
  });

  it("rejects email with too many segments (5 segments)", () => {
    expect(parseCollegeEmail("a.b.c.d.e@rajlakshmi.edu.in")).toBeNull();
  });

  it("rejects email with empty segment (consecutive dots)", () => {
    expect(parseCollegeEmail("john..22.cse@rajlakshmi.edu.in")).toBeNull();
  });

  it("rejects email with leading dot", () => {
    expect(parseCollegeEmail(".john.d.22.cse@rajlakshmi.edu.in")).toBeNull();
  });

  it("rejects email with special characters in segments", () => {
    expect(parseCollegeEmail("john!.d.22.cse@rajlakshmi.edu.in")).toBeNull();
    expect(parseCollegeEmail("john.d$.22.cse@rajlakshmi.edu.in")).toBeNull();
  });

  it("rejects staff email where dept segment is purely numeric", () => {
    expect(parseCollegeEmail("john.d.123@rajlakshmi.edu.in")).toBeNull();
  });

  it("parses student email with 4-digit year (2023)", () => {
    const result = parseCollegeEmail("john.d.2023.cse@rajalakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("student");
    expect(result!.year).toBe(2023);
    expect(result!.department).toBe("CSE");
  });

  it("parses student email with 3 segments and batch year (name.23.cse)", () => {
    const result = parseCollegeEmail("karthik.23.cse@rajalakshmi.edu.in");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("student");
    expect(result!.year).toBe(2023);
    expect(result!.department).toBe("CSE");
  });

  it("rejects student email where year is invalid single digit", () => {
    expect(parseCollegeEmail("john.d.2.cse@rajlakshmi.edu.in")).toBeNull();
  });
});

describe("validateSignIn", () => {
  it("allows a valid college email", () => {
    const result = validateSignIn("john.d.22.cse@rajlakshmi.edu.in");
    expect(result.allowed).toBe(true);
  });

  it("rejects a non-college email", () => {
    const result = validateSignIn("user@gmail.com");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("does not match");
    }
  });

  it("allows a demo email in non-production environment", () => {
    const result = validateSignIn(
      "demo.test.22.cse@rajlakshmi.edu.in",
      "local",
      ["demo.test.22.cse@rajlakshmi.edu.in"],
    );
    expect(result.allowed).toBe(true);
  });

  it("rejects demo email in production environment", () => {
    const result = validateSignIn(
      "invalid@gmail.com",
      "production",
      ["invalid@gmail.com"],
    );
    expect(result.allowed).toBe(false);
  });
});
