"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, TextField } from "@heroui/react";

export default function PanelLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fejl, setFejl] = useState<string | null>(null);
  const [indsender, setIndsender] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFejl(null);
    setIndsender(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFejl(data?.fejl ?? "Der skete en fejl. Prøv igen.");
        return;
      }

      router.push("/panel");
      router.refresh();
    } finally {
      setIndsender(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <Card className="border border-border/80 bg-background">
        <Card.Header>
          <Card.Title>Log ind på panelet</Card.Title>
          <Card.Description>Kun for administratoren af Kommunescore.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField type="email" value={email} onChange={setEmail} isRequired>
              <Label>E-mail</Label>
              <Input autoComplete="username" />
            </TextField>
            <TextField type="password" value={password} onChange={setPassword} isRequired>
              <Label>Adgangskode</Label>
              <Input autoComplete="current-password" />
            </TextField>

            {fejl && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{fejl}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <Button type="submit" variant="primary" isDisabled={indsender} className="mt-2">
              {indsender ? "Logger ind…" : "Log ind"}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </main>
  );
}
