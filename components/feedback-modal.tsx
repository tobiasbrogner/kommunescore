"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Alert,
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  IconBug,
  IconBulb,
  IconCircleCheck,
  IconMapPin,
  IconMessageCircle,
  IconPuzzle,
} from "@tabler/icons-react";

type FeedbackType = "fejl" | "oenske" | "mangel" | "andet";

const TYPER: {
  id: FeedbackType;
  navn: string;
  ikon: typeof IconBug;
  pladsholder: string;
}[] = [
  {
    id: "fejl",
    navn: "Fejl",
    ikon: IconBug,
    pladsholder: "Hvad skete der, og hvad havde du forventet? Fx “Kortet viser forkert score for Aarhus”.",
  },
  {
    id: "oenske",
    navn: "Ønske",
    ikon: IconBulb,
    pladsholder: "Hvad kunne gøre siden bedre for dig? Fx “Jeg vil gerne kunne sammenligne to kommuner”.",
  },
  {
    id: "mangel",
    navn: "Mangler data",
    ikon: IconPuzzle,
    pladsholder: "Hvilke tal, kategorier eller informationer savner du? Fx “Afstand til nærmeste sygehus”.",
  },
  {
    id: "andet",
    navn: "Andet",
    ikon: IconMessageCircle,
    pladsholder: "Ros, ris eller spørgsmål — alt er velkomment.",
  },
];

const MIN_BESKED = 5;
const MAKS_BESKED = 4000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_NOEGLE = "feedback-email";

function hentGemtEmail() {
  try {
    return localStorage.getItem(EMAIL_NOEGLE) ?? "";
  } catch {
    return "";
  }
}

function gemEmail(email: string) {
  try {
    if (email) localStorage.setItem(EMAIL_NOEGLE, email);
    else localStorage.removeItem(EMAIL_NOEGLE);
  } catch {
    // Privat vindue o.l. — e-mailen huskes bare ikke.
  }
}

// Modalen styres udefra, så den kan åbnes fra både desktop-headeren og
// mobilmenuen uden at blive afmonteret, når mobilmenuen lukker.
export function FeedbackModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const pathname = usePathname();

  // Kladden overlever at modalen lukkes; den nulstilles først efter afsendelse.
  const [type, setType] = useState<FeedbackType>("fejl");
  const [besked, setBesked] = useState("");
  const [email, setEmail] = useState("");
  const [hjemmeside, setHjemmeside] = useState(""); // honeypot
  const [sender, setSender] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);
  const [sendt, setSendt] = useState(false);

  // Ved hver åbning: start på formularen igen og hent den huskede e-mail.
  // Kun ved åbning — ellers ville et bevidst tømt e-mailfelt blive genudfyldt.
  // (Justeres under render i stedet for i en effect — se react.dev/learn/you-might-not-need-an-effect.)
  const [varAaben, setVarAaben] = useState(isOpen);
  if (isOpen !== varAaben) {
    setVarAaben(isOpen);
    if (isOpen) {
      setSendt(false);
      setFejl(null);
      if (!email) setEmail(hentGemtEmail());
    }
  }

  const valgtType = TYPER.find((t) => t.id === type)!;
  const trimmet = besked.trim();
  const emailUgyldig = email.trim() !== "" && !EMAIL_REGEX.test(email.trim());
  const kanSende = trimmet.length >= MIN_BESKED && besked.length <= MAKS_BESKED && !emailUgyldig;

  async function send() {
    if (!kanSende || sender) return;
    setSender(true);
    setFejl(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          besked: trimmet,
          email: email.trim(),
          hjemmeside,
          side: window.location.pathname + window.location.search,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFejl(data?.fejl ?? "Noget gik galt. Prøv igen om lidt.");
        return;
      }

      gemEmail(email.trim());
      setBesked("");
      setType("fejl");
      setSendt(true);
    } catch {
      setFejl("Kunne ikke få forbindelse. Tjek din internetforbindelse og prøv igen.");
    } finally {
      setSender(false);
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container placement="auto" scroll="inside">
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />

            {sendt ? (
              <>
                <Modal.Body className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <IconCircleCheck className="size-12 text-success" stroke={1.5} />
                  <Modal.Heading>Tak for din feedback!</Modal.Heading>
                  <p className="max-w-sm text-sm leading-6 text-muted">
                    Jeg læser alt, hvad der bliver sendt ind.
                    {email.trim()
                      ? " Hvis jeg har spørgsmål, skriver jeg til dig på e-mail."
                      : " Den er med til at gøre siden bedre."}
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={() => setSendt(false)}>
                    Send mere
                  </Button>
                  <Button slot="close">Luk</Button>
                </Modal.Footer>
              </>
            ) : (
              <>
                <Modal.Header>
                  <Modal.Heading>Giv feedback</Modal.Heading>
                  <p className="mt-1.5 text-sm leading-5 text-muted">
                    Har du fundet en fejl, savner du noget, eller har du en idé?
                    <br />
                    Jeg vil meget gerne høre det.
                  </p>
                </Modal.Header>

                <Modal.Body>
                  <form
                    className="flex flex-col gap-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Hvad handler det om?
                      </span>
                      <ToggleButtonGroup
                        aria-label="Hvad handler det om?"
                        fullWidth
                        selectionMode="single"
                        disallowEmptySelection
                        selectedKeys={[type]}
                        onSelectionChange={(keys) => {
                          const [valgt] = keys;
                          if (valgt) setType(valgt as FeedbackType);
                        }}
                      >
                        {TYPER.map(({ id, navn, ikon: TypeIkon }, i) => (
                          <ToggleButton
                            key={id}
                            id={id}
                            className="h-auto flex-col gap-1 px-1 py-2.5 text-xs"
                          >
                            {i > 0 && <ToggleButtonGroup.Separator />}
                            <TypeIkon className="size-5" stroke={1.7} />
                            {navn}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    </div>

                    <TextField
                      variant="secondary"
                      isRequired
                      value={besked}
                      onChange={setBesked}
                      isInvalid={besked.length > MAKS_BESKED}
                    >
                      <Label>Din besked</Label>
                      <TextArea
                        autoFocus
                        rows={5}
                        className="w-full resize-y"
                        placeholder={valgtType.pladsholder}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <div className="flex justify-end text-xs text-muted">
                        <span
                          className={`shrink-0 tabular-nums ${
                            besked.length > MAKS_BESKED ? "text-danger" : ""
                          }`}
                        >
                          {besked.length}/{MAKS_BESKED}
                        </span>
                      </div>
                    </TextField>

                    <TextField
                      variant="secondary"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      isInvalid={emailUgyldig}
                    >
                      <Label>E-mail (valgfri)</Label>
                      <Input placeholder="din@email.dk" autoComplete="email" />
                      <Description>Kun hvis du vil have svar. Den bruges ikke til andet.</Description>
                      <FieldError>E-mailadressen ser ikke rigtig ud.</FieldError>
                    </TextField>

                    {/* Honeypot: skjult for mennesker, bots udfylder den. */}
                    <input
                      type="text"
                      name="hjemmeside"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="absolute -left-[9999px] h-px w-px opacity-0"
                      value={hjemmeside}
                      onChange={(e) => setHjemmeside(e.target.value)}
                    />

                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <IconMapPin className="size-3.5 shrink-0" />
                      Sendes med info om, at du var på{" "}
                      <code className="truncate rounded bg-default px-1 py-0.5">{pathname}</code>
                    </p>

                    {fejl && (
                      <Alert status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Description>{fejl}</Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )}

                    {/* Skjult submit, så Enter i e-mailfeltet sender formularen. */}
                    <button type="submit" hidden />
                  </form>
                </Modal.Body>

                <Modal.Footer className="items-center">
                  <span className="mr-auto hidden text-xs text-muted sm:block">
                    Ctrl + Enter for at sende
                  </span>
                  <Button slot="close" variant="secondary">
                    Annuller
                  </Button>
                  <Button isDisabled={!kanSende || sender} onPress={send}>
                    {sender ? "Sender…" : "Send feedback"}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
  );
}
