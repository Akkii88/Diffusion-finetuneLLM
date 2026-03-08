import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
    title: "DiffusionLab — Research Edition",
    description:
        "A research-grade platform for LoRA fine-tuning Stable Diffusion, evaluating model quality, and generating domain-specific artwork.",
    keywords: ["stable diffusion", "lora", "fine-tuning", "image generation", "AI art"],
    openGraph: {
        title: "DiffusionLab — Research Edition",
        description: "Fine-tune and deploy domain-specific diffusion models",
        type: "website",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-white font-body antialiased text-text-main selection:bg-zinc-200 selection:text-black">
                <Providers>
                    {children}
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            style: {
                                background: "#ffffff",
                                color: "#1e293b",
                                border: "1px solid #e4e4e7",
                                borderRadius: "8px",
                                fontSize: "0.875rem",
                                fontFamily: "Inter, sans-serif",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            },
                            success: { iconTheme: { primary: "#000000", secondary: "#ffffff" } },
                            error: { iconTheme: { primary: "#ef4444", secondary: "#ffffff" } },
                        }}
                    />
                </Providers>
            </body>
        </html>
    );
}
