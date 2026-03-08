"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchMetrics, fetchGallery, generateImage, GalleryItem } from "@/lib/api";
import Navbar from "@/components/layout/Navbar";
import toast from "react-hot-toast";

const features = [
    {
        icon: "tune",
        title: "LoRA Fine-Tuning",
        desc: "Rapidly adapt diffusion models to new concepts with Low-Rank Adaptation techniques without retraining from scratch.",
        link: "/training",
        linkLabel: "Configure",
    },
    {
        icon: "analytics",
        title: "FID Evaluation",
        desc: "Automated Fréchet Inception Distance calculation to benchmark the realism and diversity of your generated samples.",
        link: "/evaluation",
        linkLabel: "View Metrics",
    },
    {
        icon: "shield_lock",
        title: "Safety Filters",
        desc: "Enterprise-grade content moderation and NSF filtering pipeline ensuring safe generation for sensitive domains.",
        link: "/generate",
        linkLabel: "Manage Rules",
    },
];

const shortcuts = [
    { key: "⌘ G", action: "Go to Generate" },
    { key: "⌘ T", action: "Go to Training" },
    { key: "⌘ E", action: "Go to Evaluation" },
    { key: "⌘ D", action: "Go to Dashboard" },
    { key: "⌘ L", action: "Go to Gallery" },
];

const checklistItems = [
    { label: "Upload training dataset", done: true },
    { label: "Configure LoRA parameters", done: true },
    { label: "Run initial training", done: false },
    { label: "Evaluate model performance", done: false },
    { label: "Generate images", done: false },
];

export default function HomePage() {
    const router = useRouter();
    const [quickPrompt, setQuickPrompt] = useState("");
    const [quickImage, setQuickImage] = useState<string | null>(null);
    const [quickMeta, setQuickMeta] = useState<{ time?: number; seed?: number } | null>(null);
    
    // Keyboard shortcuts handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Require Ctrl/Cmd key to prevent accidental navigation
            if (!e.ctrlKey && !e.metaKey) return;
            
            // Don't trigger if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            switch (e.key.toLowerCase()) {
                case "g":
                    router.push("/generate");
                    break;
                case "t":
                    router.push("/training");
                    break;
                case "e":
                    router.push("/evaluation");
                    break;
                case "d":
                    router.push("/");
                    break;
                case "l":
                    router.push("/gallery");
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [router]);
    
    const { data: metrics } = useQuery({
        queryKey: ["metrics"],
        queryFn: fetchMetrics,
        staleTime: 30000,
    });

    const { data: galleryData } = useQuery({
        queryKey: ["gallery", "home"],
        queryFn: () => fetchGallery({ page: 1, page_size: 6, sort_by: "created_at" }),
        staleTime: 60000,
    });

    const { data: trainingStatus } = useQuery({
        queryKey: ["training-status"],
        queryFn: () => fetch("/api/training").then(r => r.json()).catch(() => ({ status: "not_started" })),
        refetchInterval: 10000,
    });

    const generateMutation = useMutation({
        mutationFn: generateImage,
        onSuccess: (data) => {
            setQuickImage(data.image_url);
            setQuickMeta({ time: data.generation_time_ms / 1000, seed: data.seed_used });
            toast.success("Image generated!");
        },
        onError: () => toast.error("Generation failed"),
    });

    const handleQuickGenerate = () => {
        if (!quickPrompt.trim()) {
            toast.error("Enter a prompt first");
            return;
        }
        generateMutation.mutate({ prompt: quickPrompt, num_steps: 25 });
    };

    const recentImages = galleryData?.items ?? [];
    const isTraining = trainingStatus?.status === "running" || trainingStatus?.status === "starting";

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-white">
            <Navbar />

            <main className="flex-1 flex flex-col items-center w-full relative">
                {/* Micro-grid background */}
                <div
                    className="absolute inset-0 h-[600px] w-full opacity-50 pointer-events-none -z-10"
                    style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 0V20M0 1H20' fill='none' stroke='%23E5E7EB' stroke-width='0.5'/%3E%3C/svg%3E\")",
                    }}
                />

                {/* Hero */}
                <section className="w-full max-w-[860px] px-6 pt-[100px] pb-12 flex flex-col items-center text-center">
                    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-zinc-50 px-4 py-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-zinc-600 text-[16px]">verified</span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                            Master&apos;s Research Project v2.4
                        </span>
                    </div>

                    <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] text-black mb-6 leading-[1.1]">
                        Generate Art.{" "}
                        <br className="hidden sm:block" />
                        <span className="text-zinc-500">Fine-Tuned for Your Domain.</span>
                    </h1>

                    <p className="max-w-2xl text-lg text-zinc-600 mb-10 leading-relaxed">
                        Access state-of-the-art diffusion models optimized for specific scientific and creative domains.
                        Calculate metrics like FID scores and ensure safety with our integrated toolkit.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <Link href="/generate">
                            <button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-black text-white font-medium shadow-lg shadow-zinc-200 hover:bg-zinc-800 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined mr-1 text-[20px]">rocket_launch</span>
                                Start Generating
                            </button>
                        </Link>
                        <Link href="/evaluation">
                            <button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-white border border-border-subtle text-zinc-900 font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined mr-1 text-[20px]">menu_book</span>
                                View Evaluation
                            </button>
                        </Link>
                    </div>
                </section>

                {/* Quick Generate Widget */}
                <section className="w-full max-w-[860px] px-6 pb-8">
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                            <h3 className="font-display font-semibold text-zinc-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">bolt</span>
                                Quick Generate
                            </h3>
                            <Link href="/generate" className="text-xs font-medium text-zinc-500 hover:text-black transition-colors">
                                Advanced →
                            </Link>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={quickPrompt}
                                            onChange={(e) => setQuickPrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleQuickGenerate()}
                                            placeholder="Describe your image..."
                                            className="w-full px-4 py-3 border border-zinc-300 bg-zinc-50 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black rounded-lg font-mono"
                                        />
                                        <button
                                            onClick={handleQuickGenerate}
                                            disabled={generateMutation.isPending}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black text-white text-xs font-bold rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                        >
                                            {generateMutation.isPending ? "Generating..." : "Generate"}
                                        </button>
                                    </div>
                                </div>
                                <div className="w-full md:w-48 h-24 bg-zinc-100 rounded-lg border border-zinc-200 flex items-center justify-center overflow-hidden">
                                    {quickImage ? (
                                        <img src={quickImage} alt="Generated" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-zinc-400 text-center p-4">
                                            <span className="material-symbols-outlined text-3xl mb-1">image</span>
                                            <p className="text-xs">Preview</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {quickMeta && (
                                <div className="flex gap-4 mt-3 text-xs text-zinc-500 font-mono">
                                    <span>⏱ {quickMeta.time?.toFixed(1)}s</span>
                                    <span>🎲 Seed: {quickMeta.seed}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Stats bar */}
                <section className="w-full max-w-[860px] px-6 py-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
                        {[
                            {
                                label: "Current FID Score",
                                value: metrics?.fid_score ? metrics.fid_score.toFixed(2) : "—",
                                sub: metrics?.fid_score ? "↓ lower is better" : "Awaiting run",
                                tooltip: "Fréchet Inception Distance",
                            },
                            {
                                label: "CLIP Score",
                                value: metrics?.avg_clip_score ? metrics.avg_clip_score.toFixed(3) : "—",
                                sub: metrics?.avg_clip_score ? "Higher = better alignment" : "Awaiting run",
                            },
                            {
                                label: "Generated Images",
                                value: metrics?.total_generated ?? "—",
                                sub: "Total this session",
                            },
                        ].map((stat) => (
                            <div key={stat.label} className="p-6 text-center group hover:bg-zinc-50 transition-colors">
                                <p className="text-sm font-medium text-zinc-500 mb-1 flex items-center justify-center gap-1 tracking-wide uppercase text-[11px]">
                                    {stat.label}
                                    {stat.tooltip && (
                                        <span className="material-symbols-outlined text-[16px] text-zinc-400 cursor-help" title={stat.tooltip}>
                                            info
                                        </span>
                                    )}
                                </p>
                                <p className="font-display text-3xl font-bold text-zinc-900 group-hover:text-black transition-colors tracking-tight">
                                    {stat.value}
                                </p>
                                <span className="text-[11px] tracking-wide text-zinc-500 mt-2 inline-block">{stat.sub}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Recent Images Grid */}
                <section className="w-full max-w-[860px] px-6 pb-8">
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                            <h3 className="font-display font-semibold text-zinc-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">photo_library</span>
                                Recent Images
                            </h3>
                            <Link href="/gallery" className="text-xs font-medium text-zinc-500 hover:text-black transition-colors">
                                View All →
                            </Link>
                        </div>
                        <div className="p-6">
                            {recentImages.length > 0 ? (
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                    {recentImages.map((item) => (
                                        <Link key={item.id} href="/gallery" className="group">
                                            <div className="aspect-square rounded-lg overflow-hidden border border-zinc-200 group-hover:border-zinc-400 transition-colors">
                                                <img 
                                                    src={item.image_url} 
                                                    alt={item.prompt} 
                                                    className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all" 
                                                />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-zinc-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">image_not_supported</span>
                                    <p className="text-sm">No images generated yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Two Column Layout: System Health (full width) */}
                <section className="w-full max-w-[860px] px-6 pb-8">
                    {/* System Health */}
                        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-100">
                                <h3 className="font-display font-semibold text-zinc-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">monitor_heart</span>
                                    System Status
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-600">Training Status</span>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                                            isTraining 
                                                ? "bg-zinc-100 border-zinc-200 text-zinc-700 animate-pulse" 
                                                : "bg-green-50 border-green-200 text-green-700"
                                        }`}>
                                            <span className={`size-2 rounded-full ${isTraining ? "bg-zinc-500" : "bg-green-500"}`} />
                                            {isTraining ? "Running" : "Idle"}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-600">Backend API</span>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-green-50 border-green-200 text-green-700">
                                            <span className="size-2 rounded-full bg-green-500" />
                                            Online
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-600">Model Loaded</span>
                                        <span className="text-xs font-mono text-zinc-900">SD v1.5</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-600">Session Time</span>
                                        <span className="text-xs font-mono text-zinc-900">{metrics?.total_generated ? "Active" : "—"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                </section>

                {/* Keyboard Shortcuts + Getting Started */}
                <section className="w-full max-w-[860px] px-6 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Keyboard Shortcuts */}
                        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-100">
                                <h3 className="font-display font-semibold text-zinc-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">keyboard</span>
                                    Shortcuts
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className="space-y-2">
                                    {shortcuts.map((shortcut) => (
                                        <div key={shortcut.key} className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-500">{shortcut.action}</span>
                                            <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono text-zinc-700">
                                                {shortcut.key}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Getting Started Checklist */}
                        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-100">
                                <h3 className="font-display font-semibold text-zinc-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">checklist</span>
                                    Getting Started
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className="space-y-3">
                                    {checklistItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className={`material-symbols-outlined text-lg ${item.done ? "text-green-600" : "text-zinc-300"}`}>
                                                {item.done ? "check_circle" : "radio_button_unchecked"}
                                            </span>
                                            <span className={`text-sm ${item.done ? "text-zinc-500 line-through" : "text-zinc-700"}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="w-full max-w-[860px] px-6 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {features.map((f) => (
                            <Link href={f.link} key={f.title}>
                                <div className="group relative flex flex-col rounded-sm border border-[#e4e4e7] bg-white p-6 transition-all hover:shadow-lg hover:border-zinc-400 h-full cursor-pointer">
                                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 border border-border-subtle group-hover:bg-black group-hover:text-white group-hover:border-black transition-colors">
                                        <span className="material-symbols-outlined text-[28px]">{f.icon}</span>
                                    </div>
                                    <h3 className="font-display text-lg font-bold text-zinc-900 mb-2">{f.title}</h3>
                                    <p className="text-sm text-zinc-600 leading-relaxed mb-4 flex-grow">{f.desc}</p>
                                    <span className="inline-flex items-center text-sm font-semibold text-zinc-900 hover:text-black">
                                        {f.linkLabel}
                                        <span className="material-symbols-outlined text-[16px] ml-1 transition-transform group-hover:translate-x-1">
                                            arrow_forward
                                        </span>
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Recent Training Jobs */}
                <section className="w-full max-w-[860px] px-6 pb-20">
                    <div className="rounded-sm border border-[#e4e4e7] bg-white overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-zinc-50/50">
                            <h3 className="font-display font-semibold text-zinc-900">Recent Training Jobs</h3>
                            <Link href="/training">
                                <button className="text-xs font-medium text-zinc-500 hover:text-black transition-colors">
                                    View All
                                </button>
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-zinc-400 uppercase bg-zinc-50/50">
                                    <tr>
                                        <th className="px-6 py-3 font-medium tracking-wider">Model Name</th>
                                        <th className="px-6 py-3 font-medium tracking-wider">Status</th>
                                        <th className="px-6 py-3 font-medium tracking-wider">Steps</th>
                                        <th className="px-6 py-3 font-medium text-right tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {metrics?.run_name ? (
                                        <tr className="hover:bg-zinc-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-zinc-900">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded bg-gradient-to-br from-zinc-400 to-zinc-600 shrink-0 border border-border-subtle" />
                                                    {metrics.run_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase border ${metrics.status === "running"
                                                    ? "bg-zinc-100 border-zinc-200 text-zinc-700 animate-pulse"
                                                    : "bg-zinc-100 border-zinc-200 text-zinc-700"
                                                    }`}>
                                                    <span className="size-1.5 rounded-full bg-zinc-500" />
                                                    {metrics.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-zinc-500 font-mono">
                                                {metrics.current_step ?? "—"} / {metrics.total_steps ?? "—"}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href="/training">
                                                    <button className="text-zinc-400 hover:text-black transition-colors">
                                                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                                    </button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-10 text-center text-zinc-400 text-sm">
                                                No training runs yet. <Link href="/training" className="text-black font-semibold hover:underline">Start one →</Link>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </main>

            {/* Blurred blobs */}
            <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] left-[20%] w-[500px] h-[500px] bg-zinc-200/50 rounded-full blur-3xl opacity-60" />
                <div className="absolute top-[20%] -right-[10%] w-[400px] h-[400px] bg-zinc-100/50 rounded-full blur-3xl opacity-60" />
            </div>
        </div>
    );
}
