"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createGroup } from "@/lib/data/remote-store";
import { loadKnownGroups, rememberGroup, type KnownGroup } from "@/lib/data/session";

/** The front door: create a group of friends, or open the one you were invited to. */
export function Landing() {
  const router = useRouter();
  // Rendered only in the browser (see page.tsx), so local storage is readable at once.
  const [known] = useState<KnownGroup[]>(loadKnownGroups);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canCreate = name.trim().length >= 2 && password.length >= 4 && confirm === password && !busy;

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(name.trim(), password);
      rememberGroup(group);
      router.push(`/g/${group.slug}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Le serveur a trébuché.");
      setBusy(false);
    }
  };

  const open = () => {
    const slug = code.trim().replace(/^.*\/g\//, "").replace(/\/.*$/, "");
    if (slug) router.push(`/g/${encodeURIComponent(slug)}/rejoindre`);
  };

  return (
    <main className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto bg-ink-deep px-4 py-8 text-parchment">
      <header className="text-center">
        <p className="engrave text-xs opacity-70">Saison 2026</p>
        <h1 className="font-display text-4xl tracking-wide text-gold-light sm:text-5xl">Chômage &amp; Dragons</h1>
      </header>

      {known.length > 0 ? (
        <section className="frame riveted rise w-full max-w-md p-5">
          <h2 className="engrave text-center text-sm">Tes groupes sur cet appareil</h2>
          <ul className="mt-3 grid gap-2">
            {known.map((group) => (
              <li key={group.slug}>
                <button type="button" onClick={() => router.push(`/g/${group.slug}`)} className="slot w-full px-4 py-2.5 text-left font-display text-lg tracking-wide text-gold-light">
                  {group.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="frame riveted rise w-full max-w-md p-5">
        <h2 className="engrave text-center text-sm">Créer un groupe</h2>
        <div className="gold-rule mx-auto mt-3 mb-4 w-32" />
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void create(); }}>
          <label className="block">
            <span className="engrave text-[0.65rem] opacity-70">Nom du groupe</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Les Chômeurs Magnifiques" autoComplete="off"
              className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 font-display text-lg tracking-wide text-parchment outline-none placeholder:text-parchment/25 focus:border-gold-light" />
          </label>
          <label className="block">
            <span className="engrave text-[0.65rem] opacity-70">Mot de passe du groupe</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={4} maxLength={72} autoComplete="new-password"
              className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 text-parchment outline-none focus:border-gold-light" />
          </label>
          <label className="block">
            <span className="engrave text-[0.65rem] opacity-70">Encore une fois</span>
            <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} maxLength={72} autoComplete="new-password" aria-invalid={mismatch}
              className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 text-parchment outline-none focus:border-gold-light aria-[invalid=true]:border-blood" />
          </label>
          {mismatch ? <p className="text-xs text-blood">Les deux mots de passe diffèrent.</p> : null}
          {error ? <p role="alert" className="text-sm text-blood">{error}</p> : null}
          <button type="submit" disabled={!canCreate} className="slot px-4 py-2.5 font-display text-sm tracking-widest text-gold-light disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Création…" : "Créer et entrer"}
          </button>
        </form>
      </section>

      <section className="frame riveted rise w-full max-w-md p-5">
        <h2 className="engrave text-center text-sm">Rejoindre un groupe</h2>
        <div className="gold-rule mx-auto mt-3 mb-4 w-32" />
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); open(); }}>
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Lien ou code du groupe" autoComplete="off" aria-label="Lien ou code du groupe"
            className="min-w-0 flex-1 border border-gold-dim bg-black/45 px-3 py-2 text-sm text-parchment outline-none placeholder:text-parchment/25 focus:border-gold-light" />
          <button type="submit" disabled={!code.trim()} className="slot px-4 py-2 font-display text-sm tracking-widest text-gold-light disabled:opacity-50">Ouvrir</button>
        </form>
      </section>

      <Link href="/local" className="text-xs text-parchment/45 underline-offset-2 hover:underline">Mode solo</Link>
    </main>
  );
}
