import { describe, it, expect } from "vitest";
import { parseListParams, filterValue, buildQuery, paginate, PER_PAGE } from "@/lib/crm/query";

describe("parseListParams", () => {
  it("falls back to the default sort when the requested one isn't sortable", () => {
    const p = parseListParams({ sort: "notAllowed" }, { defaultSort: "createdAt", sortable: ["createdAt", "name"] });
    expect(p.sort).toBe("createdAt");
  });

  it("accepts a sortable column and dir=asc", () => {
    const p = parseListParams({ sort: "name", dir: "asc" }, { defaultSort: "createdAt", sortable: ["createdAt", "name"] });
    expect(p.sort).toBe("name");
    expect(p.dir).toBe("asc");
  });

  it("defaults dir to desc for anything other than exactly 'asc'", () => {
    const p = parseListParams({ dir: "DESC" }, { defaultSort: "createdAt", sortable: ["createdAt"] });
    expect(p.dir).toBe("desc");
  });

  it("clamps an invalid page number to 1", () => {
    expect(parseListParams({ page: "0" }, { defaultSort: "createdAt", sortable: [] }).page).toBe(1);
    expect(parseListParams({ page: "abc" }, { defaultSort: "createdAt", sortable: [] }).page).toBe(1);
    expect(parseListParams({ page: "-5" }, { defaultSort: "createdAt", sortable: [] }).page).toBe(1);
    expect(parseListParams({ page: "3" }, { defaultSort: "createdAt", sortable: [] }).page).toBe(3);
  });

  it("trims and caps the search term length", () => {
    const long = "a".repeat(200);
    const p = parseListParams({ q: `  ${long}  ` }, { defaultSort: "createdAt", sortable: [] });
    expect(p.q.length).toBe(120);
  });

  it("takes the first value when a param is an array", () => {
    const p = parseListParams({ q: ["first", "second"] }, { defaultSort: "createdAt", sortable: [] });
    expect(p.q).toBe("first");
  });
});

describe("filterValue", () => {
  it("returns a trimmed string or empty for a missing key", () => {
    expect(filterValue({ owner: "  u1  " }, "owner")).toBe("u1");
    expect(filterValue({}, "owner")).toBe("");
  });
});

describe("buildQuery", () => {
  it("carries forward existing params and applies overrides", () => {
    const qs = buildQuery({ status: "OPEN", q: "acme" }, { page: 2 });
    const params = new URLSearchParams(qs.replace(/^\?/, ""));
    expect(params.get("status")).toBe("OPEN");
    expect(params.get("q")).toBe("acme");
    expect(params.get("page")).toBe("2");
  });

  it("drops keys whose override is empty/undefined", () => {
    const qs = buildQuery({ page: "3" }, { page: undefined });
    expect(qs).toBe("");
  });

  it("returns an empty string when there is nothing to encode", () => {
    expect(buildQuery({}, {})).toBe("");
  });
});

describe("paginate", () => {
  it("computes skip/take and page count from a total", () => {
    const p = paginate(2, 45);
    expect(p.take).toBe(PER_PAGE);
    expect(p.skip).toBe(PER_PAGE);
    expect(p.pages).toBe(3);
    expect(p.hasPrev).toBe(true);
    expect(p.hasNext).toBe(true);
  });

  it("clamps the current page to the last available page", () => {
    const p = paginate(99, 5);
    expect(p.current).toBe(1);
    expect(p.pages).toBe(1);
    expect(p.hasNext).toBe(false);
  });

  it("handles zero results without dividing by zero", () => {
    const p = paginate(1, 0);
    expect(p.pages).toBe(1);
    expect(p.hasNext).toBe(false);
    expect(p.hasPrev).toBe(false);
  });
});
