import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "FIX Detective | Hawkeye", description: "Evidence-first investigation of simulated FIX trading sessions." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
