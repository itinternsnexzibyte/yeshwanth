import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  BOOTSTRAP_TOKEN: z.string().min(24),
  FRONTEND_URL: z.string().url().default("http://localhost:5174"),
  PORT: z.coerce.number().default(4001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  COMPANY_CODE: z.string().default("NBS"),
  ENGINEER_CODE: z.string().default("QT"),
  COMPANY_NAME: z.string().default("NEXZIBYTE SOLUTIONS PVT LTD"),
  COMPANY_ADDRESS: z.string().default("Hyderabad, Telangana, India"),
  COMPANY_EMAIL: z.string().email(),
  COMPANY_PHONE: z.string(),
  COMPANY_WEBSITE: z.string(),
  COMPANY_GSTIN: z.string().optional().default(""),
  COMPANY_LOGO_PATH: z.string().default("assets/nexzibyte-logo.png"),
  COMPANY_PROFILE_CARD_PATH: z.string().default("assets/company-profile-card.png"),
  COMPANY_BROCHURE_PATH: z.string().default("assets/company-brochure.png"),
  QUOTATION_SIGNATURE_PATH: z.string().default("assets/signatures/authorised-signature.png"),
  SIGNATORY_NAME: z.string().default("Tejaswini Gangula"),
  SIGNATORY_DESIGNATION: z.string().default("Technical Director & Operations"),
  INTEGRATION_API_KEY: z.string().min(24)
});

export const config = schema.parse(process.env);
