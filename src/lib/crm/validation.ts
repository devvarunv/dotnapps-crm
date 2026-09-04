import { z } from "zod";
import { LEAD_SOURCES, LEAD_STATUSES, ADDRESS_KINDS } from "./labels";

const trimmed = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email");

const leadSourceEnum = z.enum(LEAD_SOURCES as [string, ...string[]]);
const leadStatusEnum = z.enum(LEAD_STATUSES as [string, ...string[]]);
const addressKindEnum = z.enum(ADDRESS_KINDS as [string, ...string[]]);

const money = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[,\s]/g, "") : undefined))
  .refine((v) => v === undefined || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount");

const dateOnly = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), "Invalid date");

export const leadSchema = z.object({
  name: trimmed(160).min(2, "Enter a name"),
  companyName: optional(160),
  email: optionalEmail,
  phone: optional(60),
  whatsapp: optional(60),
  website: optional(200),
  source: leadSourceEnum,
  industry: optional(120),
  location: optional(160),
  ownerId: optional(40),
  status: leadStatusEnum,
  estimatedValue: money,
  nextFollowUpAt: dateOnly,
  notesText: optional(4000),
});

export const contactSchema = z.object({
  name: trimmed(160).min(2, "Enter a name"),
  title: optional(120),
  email: optionalEmail,
  phone: optional(60),
  whatsapp: optional(60),
  companyId: optional(40),
  source: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine(
      (v) => v === undefined || (LEAD_SOURCES as string[]).includes(v),
      "Invalid source",
    ),
  ownerId: optional(40),
  notesText: optional(4000),
});

export const companySchema = z.object({
  name: trimmed(160).min(2, "Enter a name"),
  website: optional(200),
  industry: optional(120),
  size: optional(20),
  gstin: optional(40),
  ownerId: optional(40),
  notesText: optional(4000),
});

export const addressSchema = z.object({
  companyId: z.string().min(1),
  kind: addressKindEnum,
  line1: optional(200),
  line2: optional(200),
  city: optional(120),
  state: optional(120),
  postalCode: optional(40),
  country: optional(120),
});

export const noteSchema = z.object({
  body: trimmed(4000).min(1, "Write something first"),
  leadId: optional(40),
  contactId: optional(40),
  companyId: optional(40),
});

export const tagSchema = z.object({
  name: trimmed(40).min(1, "Enter a tag name"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2563eb")
    .default("#64748b"),
});

export const idsSchema = z.object({
  ids: z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().min(1)).min(1, "Select at least one row").max(500)),
});

export const bulkAssignSchema = idsSchema.extend({
  ownerId: z.string().trim(), // "" clears owner
});

export const bulkStatusSchema = idsSchema.extend({
  status: leadStatusEnum,
});

export const bulkTagSchema = idsSchema.extend({
  tagId: z.string().min(1),
  op: z.enum(["add", "remove"]),
});

export const convertLeadSchema = z.object({
  leadId: z.string().min(1),
  createCompany: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  companyId: optional(40),
  createContact: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  contactId: optional(40),
});
