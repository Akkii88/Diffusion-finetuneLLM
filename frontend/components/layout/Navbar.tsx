"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTrainingStatus } from "@/lib/api";

const navLinks = [
    { label: "Dashboard", href: "/", icon: "dashboard" },
    { label: "Generate", href: "/generate", icon: "auto_awesome" },
    { label: "Gallery", href: "/gallery", icon: "photo_library" },
    { label: "Training", href: "/training", icon: "model_training" },
    { label: "Datasets", href: "/datasets", icon: "folder_copy" },
    { label: "Evaluation", href: "/evaluation", icon: "analytics" },
];

export default function Navbar() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { data: status } = useQuery({
        queryKey: ["training-status"],
        queryFn: getTrainingStatus,
        refetchInterval: 8000,
    });

    const isRunning = status?.status === "running" || status?.status === "starting";

    return (
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 shadow-sm">
            <div className="flex items-center gap-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white border border-slate-800 shadow-sm">
                        <span className="material-symbols-outlined text-lg">science</span>
                    </div>
                    <div className="hidden sm:flex flex-col">
                        <h1 className="text-slate-900 text-sm font-bold leading-tight font-display tracking-tight">DiffusionLab</h1>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Research Edition</p>
                    </div>
                </Link>

                {/* Vertical Divider */}
                <div className="hidden md:block h-6 w-px bg-slate-200" />

                {/* Navigation Links */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => {
                        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? "text-black bg-slate-100 shadow-sm ring-1 ring-slate-200"
                                    : "text-slate-500 hover:text-black hover:bg-slate-50"
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-lg ${isActive ? "text-black" : "text-slate-400"}`}>
                                    {link.icon}
                                </span>
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="flex items-center gap-3 md:gap-5">
                {/* Mobile Menu Button */}
                <button 
                    className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label="Open menu"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>

                {/* System Status Indicator - Horizontal version */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50/50">
                    <span className="relative flex h-2 w-2">
                        {isRunning && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? "bg-black" : "bg-slate-400"}`} />
                    </span>
                    <span className="text-[10px] font-mono text-slate-900 uppercase tracking-widest font-bold">
                        {isRunning ? "Active" : "Ready"}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
                        <span className="material-symbols-outlined">notifications</span>
                        {isRunning && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-black border border-white" />
                        )}
                    </button>
                    <a
                        href="http://localhost:8000/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex h-9 items-center justify-center gap-1.5 rounded-lg bg-black px-4 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-all uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Docs
                    </a>
                    <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
                        R
                    </div>
                </div>

                {/* Mobile Menu Drawer */}
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div 
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        {/* Drawer */}
                        <div className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-xl z-50 md:hidden flex flex-col animate-in slide-in-from-left duration-200">
                            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
                                        <span className="material-symbols-outlined text-lg">science</span>
                                    </div>
                                    <span className="font-bold text-slate-900">Menu</span>
                                </div>
                                <button 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <nav className="flex-1 p-4 overflow-y-auto">
                                <div className="flex flex-col gap-1">
                                    {navLinks.map((link) => {
                                        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                                                    ? "text-black bg-slate-100"
                                                    : "text-slate-600 hover:text-black hover:bg-slate-50"
                                                    }`}
                                            >
                                                <span className={`material-symbols-outlined ${isActive ? "text-black" : "text-slate-400"}`}>
                                                    {link.icon}
                                                </span>
                                                {link.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </nav>
                            <div className="p-4 border-t border-slate-200">
                                <a
                                    href="http://localhost:8000/docs"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-black text-white text-sm font-bold hover:bg-zinc-800 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    API Documentation
                                </a>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </header>
        );
}
