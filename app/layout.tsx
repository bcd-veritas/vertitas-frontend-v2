import type { Metadata } from "next";
import { Geist, Geist_Mono, Handjet, VT323 } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/app/Web3Provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const handjet = Handjet({
  variable: "--font-handjet",
  subsets: ["latin"],
});

/** PREVIEW: CRT-terminal face trialled for the =<13px label layer on /home.
 *  Single weight (400) — VT323 ships no others. */
const vt323 = VT323({
  weight: "400",
  variable: "--font-vt323",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veritas — Trade What Comes Next",
  description:
    "Veritas is a prediction market. Buy Yes or No shares on real-world events; prices are live probabilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${handjet.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
