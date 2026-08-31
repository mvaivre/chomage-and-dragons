import type { Metadata, Viewport } from "next";
import { EB_Garamond, Pirata_One } from "next/font/google";
import "./globals.css";

const pirata = Pirata_One({
  variable: "--font-pirata",
  subsets: ["latin"],
  weight: "400",
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chômage & Dragons",
  description:
    "Chaque tentative fait avancer. De la Plaine de la Poisse à la Taverne du Triomphe.",
};

export const viewport: Viewport = {
  themeColor: "#120c07",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${pirata.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-ink-deep text-parchment">
        {children}
      </body>
    </html>
  );
}
