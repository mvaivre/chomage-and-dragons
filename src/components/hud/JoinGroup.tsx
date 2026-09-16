"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinGroup } from "@/lib/data/remote-store";
import { rememberGroup } from "@/lib/data/session";

/** The invitation landing: the password, then the game. */
export function JoinGroup({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (password.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const group = await joinGroup(slug, password);
      rememberGroup(group);
      router.push(`/g/${group.slug}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Le serveur a trébuché.");
      setBusy(false);
    }
  };

  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-ink-deep px-4 py-8 text-parchment">
      <header className="text-center">
        <p className="engrave text-xs opacity-70">Invitation</p>
        <h1 className="font-display text-4xl tracking-wide text-gold-light">{name}</h1>
      </header>
      <form className="frame riveted rise grid w-full max-w-sm gap-3 p-5" onSubmit={(event) => { event.preventDefault(); void join(); }}>
        <label className="block">
          <span className="engrave text-[0.65rem] opacity-70">Mot de passe du groupe</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus
            className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 text-parchment outline-none focus:border-gold-light" />
        </label>
        {error ? <p role="alert" className="text-sm text-blood">{error}</p> : null}
        <button type="submit" disabled={password.length === 0 || busy} className="slot px-4 py-2.5 font-display text-sm tracking-widest text-gold-light disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Vérification…" : "Entrer dans le groupe"}
        </button>
      </form>
      <Link href="/" className="text-xs text-parchment/45 underline-offset-2 hover:underline">Retour à l’accueil</Link>
    </main>
  );
}
