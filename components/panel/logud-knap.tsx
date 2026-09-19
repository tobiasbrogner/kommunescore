"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";

export function LogudKnap() {
  const router = useRouter();

  async function handleLogud() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/panel/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onPress={handleLogud}>
      Log ud
    </Button>
  );
}
