"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { forgetGroup } from "@/lib/data/session";

/** The server confirmed this group is gone; forget only its device references. */
export function MissingGroup({ slug }: { slug: string ;
}) {
  const uiLocale = useLocale();
    const router = useRouter();
  useEffect(() => {
    forgetGroup(slug);
    router.replace("/");
  }, [slug, router]);
  return <main className="adventure-landing flex h-full flex-col items-center justify-center gap-4 bg-ink-deep p-6 text-center text-parchment">
    <h1 className="font-display text-3xl text-gold-light">{tr("Ce groupe n’existe plus", undefined, uiLocale)}</h1>
    <p>{tr("Retour à l’accueil pour retrouver tes compagnons.", undefined, uiLocale)}</p>
    <Link href="/" replace className="slot px-5 py-3 text-gold-light">{tr("Retour à l’accueil", undefined, uiLocale)}</Link>
  </main>;
}
