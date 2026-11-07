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
	profile: text("profile", { mode: "json" }).$type<Record<string, number>>(),
	tokenHash: text("token_hash").notNull(),
	consentAt: text("consent_at").notNull(),
	createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
	updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});
