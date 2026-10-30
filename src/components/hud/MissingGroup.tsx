"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { forgetGroup } from "@/lib/data/session";

/** The server confirmed this group is gone; forget only its device references. */
export function MissingGroup({ slug }: { slug: string }) {
  const router = useRouter();
  useEffect(() => {
    forgetGroup(slug);
    router.replace("/");
  }, [slug, router]);
  return <main className="adventure-landing flex h-full flex-col items-center justify-center gap-4 bg-ink-deep p-6 text-center text-parchment">
    <h1 className="font-display text-3xl text-gold-light">Ce groupe n’existe plus</h1>
    <p>Retour à l’accueil pour retrouver tes compagnons.</p>
    <Link href="/" replace className="slot px-5 py-3 text-gold-light">Retour à l’accueil</Link>
  </main>;
}
