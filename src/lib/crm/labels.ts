import type { LeadSource, LeadStatus, AddressKind } from "@prisma/client";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  GOOGLE: "Google",
  REFERRAL: "Referral",
  COLD_CALL: "Cold call",
  EMAIL: "Email",
  MANUAL: "Manual",
  OTHER: "Other",
};

export const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

export const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];

/** Open = still workable. Used for dashboard/pipeline-style counts. */
export const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
];

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

export const LEAD_STATUS_TONES: Record<LeadStatus, Tone> = {
  NEW: "neutral",
  CONTACTED: "brand",
  QUALIFIED: "brand",
  PROPOSAL: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "danger",
  UNQUALIFIED: "danger",
};

export const ADDRESS_KIND_LABELS: Record<AddressKind, string> = {
  BILLING: "Billing",
  SHIPPING: "Shipping",
  OTHER: "Other",
};

export const ADDRESS_KINDS = Object.keys(ADDRESS_KIND_LABELS) as AddressKind[];

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

export const DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: "VIP", color: "#7c3aed" },
  { name: "Hot Lead", color: "#dc2626" },
  { name: "Startup", color: "#0891b2" },
  { name: "Enterprise", color: "#1d4ed8" },
  { name: "Referral", color: "#16a34a" },
  { name: "High Value", color: "#d97706" },
  { name: "Follow Up", color: "#db2777" },
];
