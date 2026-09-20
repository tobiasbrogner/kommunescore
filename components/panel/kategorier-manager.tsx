"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Input,
  Label,
  Modal,
  NumberField,
  Separator,
  TextField,
} from "@heroui/react";
import { AlleVaerdierTabel } from "@/components/panel/alle-vaerdier-tabel";
import { IkonVaelger } from "@/components/panel/ikon-vaelger";

type Noegletal = {
  id: number;
  navn: string;
  enhed: string;
  retning: "hoejere_bedre" | "lavere_bedre";
};

type Kategori = {
  id: number;
  navn: string;
  slug: string;
  ikon: string | null;
  standardvaegt: string;
  sortering: number;
  noegletal: Noegletal[];
};

type Kommune = { kode: string; navn: string };
type Vaerdi = { kommuneKode: string; noegletalId: number; vaerdi: string };

const RETNING_LABEL: Record<Noegletal["retning"], string> = {
  hoejere_bedre: "Højere er bedre",
  lavere_bedre: "Lavere er bedre",
};

async function kald(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.fejl ?? "Der skete en fejl.");
  }
  return res.json().catch(() => null);
}

export function KategorierManager({
  initielleKategorier,
  kommuner,
  vaerdier,
}: {
  initielleKategorier: Kategori[];
  kommuner: Kommune[];
  vaerdier: Vaerdi[];
}) {
  const router = useRouter();
  const [fejl, setFejl] = useState<string | null>(null);
  const [nyKategoriNavn, setNyKategoriNavn] = useState("");
  const [nyKategoriSlug, setNyKategoriSlug] = useState("");
  const [nyKategoriVaegt, setNyKategoriVaegt] = useState<number | undefined>(1);

  function medFejlHaandtering(fn: () => Promise<void>) {
    return async () => {
      setFejl(null);
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setFejl(err instanceof Error ? err.message : "Der skete en fejl.");
      }
    };
  }

  const opretKategori = medFejlHaandtering(async () => {
    await kald("/api/admin/kategorier", "POST", {
      navn: nyKategoriNavn,
      slug: nyKategoriSlug,
      standardvaegt: nyKategoriVaegt ?? 1,
    });
    setNyKategoriNavn("");
    setNyKategoriSlug("");
    setNyKategoriVaegt(1);
  });

  return (
    <div className="flex flex-col gap-6">
      {fejl && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{fejl}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {initielleKategorier.map((kategori) => (
        <KategoriKort
          key={kategori.id}
          kategori={kategori}
          kommuner={kommuner}
          vaerdier={vaerdier}
          onFejl={setFejl}
          onAendret={() => router.refresh()}
        />
      ))}

      <Card className="border border-dashed border-border bg-background">
        <Card.Header>
          <Card.Title>Ny kategori</Card.Title>
          <Card.Description>Fx &quot;Adgang til kyst&quot; eller &quot;Transport&quot;.</Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <TextField value={nyKategoriNavn} onChange={setNyKategoriNavn}>
            <Label>Navn</Label>
            <Input />
          </TextField>
          <TextField value={nyKategoriSlug} onChange={setNyKategoriSlug}>
            <Label>Slug</Label>
            <Input placeholder="fx kyst" />
          </TextField>
          <NumberField value={nyKategoriVaegt} onChange={setNyKategoriVaegt} minValue={0}>
            <Label>Standardvægt</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
          <Button
            variant="primary"
            isDisabled={!nyKategoriNavn || !nyKategoriSlug}
            onPress={opretKategori}
          >
            Opret
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}

function KategoriKort({
  kategori,
  kommuner,
  vaerdier,
  onFejl,
  onAendret,
}: {
  kategori: Kategori;
  kommuner: Kommune[];
  vaerdier: Vaerdi[];
  onFejl: (fejl: string | null) => void;
  onAendret: () => void;
}) {
  const [navn, setNavn] = useState(kategori.navn);
  const [ikon, setIkon] = useState<string | null>(kategori.ikon);
  const [standardvaegt, setStandardvaegt] = useState<number | undefined>(
    Number(kategori.standardvaegt),
  );
  const [nytNoegletalNavn, setNytNoegletalNavn] = useState("");
  const [nytNoegletalEnhed, setNytNoegletalEnhed] = useState("");
  const [nytNoegletalRetning, setNytNoegletalRetning] =
    useState<Noegletal["retning"]>("hoejere_bedre");

  async function forsoeg(fn: () => Promise<void>) {
    onFejl(null);
    try {
      await fn();
      onAendret();
    } catch (err) {
      onFejl(err instanceof Error ? err.message : "Der skete en fejl.");
    }
  }

  const noegletalIds = new Set(kategori.noegletal.map((n) => n.id));
  const kategoriVaerdier = vaerdier.filter((v) => noegletalIds.has(v.noegletalId));

  return (
    <Card className="border border-border/80 bg-background">
      <Card.Header>
        <Card.Title>{kategori.navn}</Card.Title>
        <Card.Description>Slug: {kategori.slug}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-[auto_2fr_1fr_auto_auto_auto] sm:items-end">
          <IkonVaelger value={ikon} onChange={setIkon} />
          <TextField value={navn} onChange={setNavn}>
            <Label>Navn</Label>
            <Input />
          </TextField>
          <NumberField value={standardvaegt} onChange={setStandardvaegt} minValue={0}>
            <Label>Standardvægt</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
          <Button
            variant="secondary"
            onPress={() =>
              forsoeg(() =>
                kald(`/api/admin/kategorier/${kategori.id}`, "PATCH", {
                  navn,
                  ikon,
                  standardvaegt: standardvaegt ?? 0,
                }),
              )
            }
          >
            Gem
          </Button>
          <Modal>
            <Button variant="secondary" isDisabled={kategori.noegletal.length === 0}>
              Værdier
            </Button>
            <Modal.Backdrop>
              <Modal.Container size="cover" scroll="inside">
                <Modal.Dialog className="h-full max-h-full">
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading>{kategori.navn} — værdier</Modal.Heading>
                    <p className="mt-1 text-sm text-muted">
                      Klik i en celle, ret værdien, og tryk væk for at gemme.
                    </p>
                  </Modal.Header>
                  <Modal.Body>
                    <AlleVaerdierTabel
                      kommuner={kommuner}
                      kategorier={[kategori]}
                      vaerdier={kategoriVaerdier}
                    />
                  </Modal.Body>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
          <Button
            variant="danger-soft"
            onPress={() => forsoeg(() => kald(`/api/admin/kategorier/${kategori.id}`, "DELETE"))}
          >
            Slet kategori
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted">Nøgletal i denne kategori</p>

          {kategori.noegletal.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{n.navn}</p>
                <p className="text-muted">
                  {n.enhed} · {RETNING_LABEL[n.retning]}
                </p>
              </div>
              <Button
                size="sm"
                variant="danger-soft"
                onPress={() => forsoeg(() => kald(`/api/admin/noegletal/${n.id}`, "DELETE"))}
              >
                Slet
              </Button>
            </div>
          ))}

          {kategori.noegletal.length === 0 && (
            <p className="text-sm text-muted">Ingen nøgletal endnu.</p>
          )}

          <div className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <TextField value={nytNoegletalNavn} onChange={setNytNoegletalNavn}>
              <Label>Nyt nøgletal</Label>
              <Input placeholder="fx Gennemsnitsløn" />
            </TextField>
            <TextField value={nytNoegletalEnhed} onChange={setNytNoegletalEnhed}>
              <Label>Enhed</Label>
              <Input placeholder="kr., dB, km …" />
            </TextField>
            <div className="flex flex-col gap-1.5">
              <Label>Retning</Label>
              <Dropdown>
                <Button variant="outline" className="justify-between">
                  {RETNING_LABEL[nytNoegletalRetning]}
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    selectionMode="single"
                    selectedKeys={new Set([nytNoegletalRetning])}
                    onSelectionChange={(keys) => {
                      const valgt = Array.from(keys as Set<string>)[0] as Noegletal["retning"];
                      if (valgt) setNytNoegletalRetning(valgt);
                    }}
                  >
                    <Dropdown.Item key="hoejere_bedre" id="hoejere_bedre" textValue="Højere er bedre">
                      <Label>Højere er bedre</Label>
                    </Dropdown.Item>
                    <Dropdown.Item key="lavere_bedre" id="lavere_bedre" textValue="Lavere er bedre">
                      <Label>Lavere er bedre</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
            <Button
              variant="primary"
              isDisabled={!nytNoegletalNavn || !nytNoegletalEnhed}
              onPress={() =>
                forsoeg(async () => {
                  await kald("/api/admin/noegletal", "POST", {
                    navn: nytNoegletalNavn,
                    enhed: nytNoegletalEnhed,
                    retning: nytNoegletalRetning,
                    kategoriId: kategori.id,
                  });
                  setNytNoegletalNavn("");
                  setNytNoegletalEnhed("");
                })
              }
            >
              Opret
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
