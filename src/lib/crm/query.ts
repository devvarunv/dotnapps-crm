export type SearchParams = Record<string, string | string[] | undefined>;

export const PER_PAGE = 20;

export type ListParams = {
  q: string;
  page: number;
  sort: string;
  dir: "asc" | "desc";
  raw: SearchParams;
};

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function parseListParams(
  raw: SearchParams,
  opts: { defaultSort: string; sortable: string[] },
): ListParams {
  const pageNum = parseInt(one(raw.page), 10);
  const sort = opts.sortable.includes(one(raw.sort))
    ? one(raw.sort)
    : opts.defaultSort;
  const dir = one(raw.dir) === "asc" ? "asc" : "desc";
  return {
    q: one(raw.q).trim().slice(0, 120),
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    sort,
    dir,
    raw,
  };
}

export function filterValue(raw: SearchParams, key: string): string {
  return one(raw[key]).trim();
}

/** Build a querystring, overriding some keys and dropping empties. */
export function buildQuery(
  raw: SearchParams,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (k in overrides) continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) params.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "" || v === null) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function paginate(page: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, pages);
  return {
    skip: (current - 1) * PER_PAGE,
    take: PER_PAGE,
    current,
    pages,
    total,
    hasPrev: current > 1,
    hasNext: current < pages,
  };
}
