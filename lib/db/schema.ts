import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const retningEnum = pgEnum("retning", ["hoejere_bedre", "lavere_bedre"]);

// Logaritmisk til meget skæve tal, der spænder over flere størrelsesordener (fx
// befolkningstæthed fra 15 til 12.000 pr. km²); se lib/scores/compute.ts.
export const skalaEnum = pgEnum("skala", ["lineaer", "logaritmisk"]);

export const feedbackTypeEnum = pgEnum("feedback_type", ["fejl", "oenske", "mangel", "andet"]);

export const kommuner = pgTable("kommuner", {
  kode: varchar("kode", { length: 4 }).primaryKey(),
  navn: varchar("navn", { length: 100 }).notNull(),
  // Vises under "Om [kommune]" på rapportsiden; redigeres i admin-panelet.
  stoersteBy: varchar("stoerste_by", { length: 100 }),
  beskrivelse: varchar("beskrivelse", { length: 2000 }),
});

export const kategorier = pgTable("kategorier", {
  id: serial("id").primaryKey(),
  navn: varchar("navn", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  ikon: varchar("ikon", { length: 50 }),
  standardvaegt: numeric("standardvaegt", { precision: 5, scale: 2 })
    .notNull()
    .default("1"),
  sortering: integer("sortering").notNull().default(0),
  // 0-100. 0 = lineær skala; højere løfter lave/mellemste værdier (se lib/scores/compute.ts).
  venlighed: integer("venlighed").notNull().default(0),
});

export const noegletal = pgTable("noegletal", {
  id: serial("id").primaryKey(),
  kategoriId: integer("kategori_id")
    .notNull()
    .references(() => kategorier.id, { onDelete: "cascade" }),
  navn: varchar("navn", { length: 150 }).notNull(),
  enhed: varchar("enhed", { length: 30 }).notNull(),
  retning: retningEnum("retning").notNull(),
  skala: skalaEnum("skala").notNull().default("lineaer"),
  // Tæller med i kategoriens standardscore (forsiden, rapporter og /kort fra start).
  // Nøgletal der ikke gør, er tilvalg, som man kan slå til under Prioritet på /kort.
  standardValgt: boolean("standard_valgt").notNull().default(true),
  // Valgfri forklaring, vist i kategoriens tooltip på /kort.
  beskrivelse: varchar("beskrivelse", { length: 500 }),
});

export const kommuneNoegletal = pgTable(
  "kommune_noegletal",
  {
    kommuneKode: varchar("kommune_kode", { length: 4 })
      .notNull()
      .references(() => kommuner.kode, { onDelete: "cascade" }),
    noegletalId: integer("noegletal_id")
      .notNull()
      .references(() => noegletal.id, { onDelete: "cascade" }),
    vaerdi: numeric("vaerdi", { precision: 14, scale: 4 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.kommuneKode, t.noegletalId] })],
);

export const administratorer = pgTable("administratorer", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessioner = pgTable("sessioner", {
  id: serial("id").primaryKey(),
  administratorId: integer("administrator_id")
    .notNull()
    .references(() => administratorer.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Feedback indsendt af besøgende via knappen i headeren; læses i admin-panelet.
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  type: feedbackTypeEnum("type").notNull(),
  besked: varchar("besked", { length: 4000 }).notNull(),
  email: varchar("email", { length: 255 }),
  // Siden brugeren stod på, da feedbacken blev sendt (fx "/kort?kommune=0101").
  side: varchar("side", { length: 500 }),
  brugeragent: varchar("brugeragent", { length: 500 }),
  behandlet: boolean("behandlet").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kategorierRelations = relations(kategorier, ({ many }) => ({
  noegletal: many(noegletal),
}));

export const noegletalRelations = relations(noegletal, ({ one, many }) => ({
  kategori: one(kategorier, {
    fields: [noegletal.kategoriId],
    references: [kategorier.id],
  }),
  vaerdier: many(kommuneNoegletal),
}));

export const kommunerRelations = relations(kommuner, ({ many }) => ({
  noegletalVaerdier: many(kommuneNoegletal),
}));

export const kommuneNoegletalRelations = relations(kommuneNoegletal, ({ one }) => ({
  kommune: one(kommuner, {
    fields: [kommuneNoegletal.kommuneKode],
    references: [kommuner.kode],
  }),
  noegletal: one(noegletal, {
    fields: [kommuneNoegletal.noegletalId],
    references: [noegletal.id],
  }),
}));

export const administratorerRelations = relations(administratorer, ({ many }) => ({
  sessioner: many(sessioner),
}));

export const sessionerRelations = relations(sessioner, ({ one }) => ({
  administrator: one(administratorer, {
    fields: [sessioner.administratorId],
    references: [administratorer.id],
  }),
}));
