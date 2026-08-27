import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Louchômage & Dragons",
  description:
    "Plus on se fait recaler, plus on avance. De la Forêt des Candidatures à la Taverne du Champion.",
};

export const viewport: Viewport = {
  themeColor: "#120c07",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${cinzel.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-ink-deep text-parchment">
        {children}
      </body>
    </html>
  );
}
