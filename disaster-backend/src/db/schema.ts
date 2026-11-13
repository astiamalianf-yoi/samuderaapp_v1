import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const beaches = sqliteTable("beaches", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	latitude: integer("latitude"),
	longitude: integer("longitude"),
	communityRiskLevel: text("community_risk_level"),
});

export const reports = sqliteTable("reports", {
	id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
	beachId: integer("beach_id").references(() => beaches.id),
	reporterId: text("reporter_id"),
	source: text("source").notNull(),
	naturalSigns: text("natural_signs").notNull().$type<string[]>(),
	rawBody: text("raw_body").$type<Record<string, unknown>>(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const shapPredictions = sqliteTable("shap_predictions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	reportId: text("report_id").references(() => reports.id),
	riskLevel: text("risk_level").notNull(),
	communityCharacteristics: text("community_characteristics"),
	validatedSigns: text("validated_signs").$type<string[]>(),
	actions: text("actions").$type<string[]>(),
	rawResponse: text("raw_response").$type<Record<string, unknown>>(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const bmkgSnapshots = sqliteTable("bmkg_snapshots", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	beachId: integer("beach_id").references(() => beaches.id),
	weather: text("weather").$type<Record<string, unknown>>(),
	waveForecast: text("wave_forecast").$type<Record<string, unknown>>(),
	warning: text("warning").$type<Record<string, unknown>>(),
	fetchedAt: text("fetched_at").default(sql`(datetime('now'))`).notNull(),
});

export const reassuranceResults = sqliteTable("reassurance_results", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	predictionId: integer("prediction_id"),
	reportId: text("report_id").references(() => reports.id).unique(),
	shapRisk: text("shap_risk"),
	bmkgRisk: text("bmkg_risk"),
	agreed: integer("agreed", { mode: "boolean" }),
	finalLevel: text("final_level").notNull(),
	details: text("details").$type<Record<string, unknown>>(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

/**
 * Registered fishermen (app). Identity = WhatsApp number; only a keyed hash of the number and its
 * last 4 digits are stored, so the number itself is never kept in the database. The same hash is
 * computed for WhatsApp senders, which links a fisherman's app and WhatsApp-group reports.
 */
export const fishermen = sqliteTable("fishermen", {
	id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
	phoneHash: text("phone_hash").notNull().unique(),
	phoneLast4: text("phone_last4").notNull(),
	homeBeach: text("home_beach").notNull(),
	/** Registration answers (years, hazards list, counts): see lib/adaptive-profile.ts. */
	profile: text("profile", { mode: "json" }).$type<Record<string, unknown>>(),
	tokenHash: text("token_hash").notNull(),
	consentAt: text("consent_at").notNull(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
	updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

/**
 * Every sign report by a registered fisherman (app or WhatsApp), counted or not. Used for his
 * activity (reports per month, signs used) and as the per-fisherman log of the field study.
 * (The reports table only holds reports that triggered a warning.)
 */
export const fishermanReports = sqliteTable("fisherman_reports", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	fishermanId: text("fisherman_id").notNull().references(() => fishermen.id),
	beach: text("beach").notNull(),
	signs: text("signs", { mode: "json" }).$type<string[]>().notNull(),
	channel: text("channel").notNull(),
	counted: integer("counted", { mode: "boolean" }).notNull(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

/**
 * WhatsApp reports and incidents from a number that is not registered yet, kept under the keyed
 * hash of the number (never the number). When that number registers in the app, they move into
 * his history with their original time, so app and WhatsApp give one history per fisherman.
 */
export const waHeld = sqliteTable("wa_held", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	phoneHash: text("phone_hash").notNull(),
	kind: text("kind").notNull(), // "report" | "incident"
	beach: text("beach").notNull(),
	payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

/** "Lapor kejadian": a fisherman met dangerous weather at sea, optionally asking for help. */
export const incidents = sqliteTable("incidents", {
	id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
	fishermanId: text("fisherman_id").notNull().references(() => fishermen.id),
	beach: text("beach").notNull(),
	type: text("type").notNull(),
	needHelp: integer("need_help", { mode: "boolean" }).notNull().default(false),
	/** He reported a natural sign at this beach within the window before (codebook No. 12: "detected using LIK"); set by the server. */
	detectedBySign: integer("detected_by_sign", { mode: "boolean" }).notNull().default(false),
	latitude: real("latitude"),
	longitude: real("longitude"),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

/**
 * Researcher log: the fisherman's effective profile and the Random Forest output each time it is
 * recomputed (registration, report, incident). Not shown to the fisherman.
 */
export const fishermanClassHistory = sqliteTable("fisherman_class_history", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	fishermanId: text("fisherman_id").notNull().references(() => fishermen.id),
	reason: text("reason").notNull(),
	effectiveProfile: text("effective_profile", { mode: "json" }).$type<Record<string, number>>().notNull(),
	activity: text("activity", { mode: "json" }).$type<Record<string, unknown>>(),
	meanProbability: real("mean_probability"),
	behaviouralClass: integer("behavioural_class"),
	perSign: text("per_sign", { mode: "json" }).$type<Record<string, number | null>>(),
	source: text("source"),
	/** per-fisherman SHAP of his answers ({ base_value, contributions }) for "Profil Anda" */
	explanation: text("explanation", { mode: "json" }).$type<Record<string, unknown>>(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});
