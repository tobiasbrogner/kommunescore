import { relations } from "drizzle-orm";
import {
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
