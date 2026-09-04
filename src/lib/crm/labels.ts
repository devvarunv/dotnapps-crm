import type {
  LeadSource,
  LeadStatus,
  AddressKind,
  DealStatus,
  TaskStatus,
  TaskPriority,
  ActivityType,
  StageKind,
  QuotationStatus,
  InvoiceStatus,
  PaymentMethod,
} from "@prisma/client";

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

/* --------------------------------------------------------------- Sales ----- */

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
};

type Tone2 = "neutral" | "brand" | "success" | "warning" | "danger";

export const DEAL_STATUS_TONES: Record<DealStatus, Tone2> = {
  OPEN: "brand",
  WON: "success",
  LOST: "danger",
};

export const STAGE_KIND_LABELS: Record<StageKind, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
};

export const STAGE_KINDS = Object.keys(STAGE_KIND_LABELS) as StageKind[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

export const TASK_STATUS_TONES: Record<TaskStatus, Tone2> = {
  TODO: "neutral",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TASK_PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];

export const TASK_PRIORITY_TONES: Record<TaskPriority, Tone2> = {
  LOW: "neutral",
  MEDIUM: "neutral",
  HIGH: "warning",
  URGENT: "danger",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  FOLLOW_UP: "Follow-up",
  DEMO: "Demo",
  NOTE: "Note",
  TASK: "Task",
};

/** Types a user can log by hand (TASK activities are system-generated). */
export const LOGGABLE_ACTIVITY_TYPES: ActivityType[] = [
  "NOTE",
  "CALL",
  "MEETING",
  "EMAIL",
  "WHATSAPP",
  "FOLLOW_UP",
  "DEMO",
];

/* ------------------------------------------------------ Revenue links ----- */

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
};

export const QUOTATION_STATUSES = Object.keys(QUOTATION_STATUS_LABELS) as QuotationStatus[];

export const QUOTATION_STATUS_TONES: Record<QuotationStatus, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SENT: "brand",
  ACCEPTED: "success",
  DECLINED: "danger",
  EXPIRED: "warning",
  CONVERTED: "success",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIAL: "Part-paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

export const INVOICE_STATUSES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];

export const INVOICE_STATUS_TONES: Record<InvoiceStatus, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SENT: "brand",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
  VOID: "neutral",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  UPI: "UPI",
  OTHER: "Other",
};

export const DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: "VIP", color: "#7c3aed" },
  { name: "Hot Lead", color: "#dc2626" },
  { name: "Startup", color: "#0891b2" },
  { name: "Enterprise", color: "#1d4ed8" },
  { name: "Referral", color: "#16a34a" },
  { name: "High Value", color: "#d97706" },
  { name: "Follow Up", color: "#db2777" },
];
