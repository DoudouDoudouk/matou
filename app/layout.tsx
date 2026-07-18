import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matou · Apprends l'argent, un geste par jour",
  description: "Un Duolingo de la finance — apprends à mieux utiliser ton argent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
