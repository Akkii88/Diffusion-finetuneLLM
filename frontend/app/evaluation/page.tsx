"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMetrics } from "@/lib/api";
import Navbar from "@/components/layout/Navbar";

function ComparisonSlider({ prompt, baseSrc, ftSrc }: { prompt: string; baseSrc: string; ftSrc: string }) {
    const [position, setPosition] = useState(50);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const move = (clientX: number) => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
        setPosition(pct);
    };

    // Handle mouse/touch down - start dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        move(e.clientX);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        isDragging.current = true;
        move(e.touches[0].clientX);
    };

    // Handle mouse move globally
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            move(e.clientX);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging.current) return;
            move(e.touches[0].clientX);
        };

        const handleEnd = () => {
            isDragging.current = false;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("touchmove", handleTouchMove);
        window.addEventListener("mouseup", handleEnd);
        window.addEventListener("touchend", handleEnd);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("mouseup", handleEnd);
            window.removeEventListener("touchend", handleEnd);
        };
    }, []);

    return (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-slate-400 mt-0.5">terminal</span>
                <code className="text-sm text-slate-600 font-mono break-all">{prompt}</code>
            </div>

            {/* Comparison area */}
            <div
                ref={wrapperRef}
                className="relative w-full aspect-[21/9] bg-slate-100 overflow-hidden cursor-ew-resize select-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {/* Fine-tuned image — full background */}
                <img
                    src={ftSrc}
                    alt="Fine-tuned"
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                />
                <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider pointer-events-none">
                    Fine-Tuned LoRA
                </div>

                {/* Base image — same size/crop, clipped from right */}
                <img
                    src={baseSrc}
                    alt="Base model"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                    draggable={false}
                />
                <div
                    className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider pointer-events-none"
                    style={{ opacity: position > 10 ? 1 : 0 }}
                >
                    Base Model (SD v1.5)
                </div>

                {/* Divider line */}
                <div
                    className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] cursor-ew-resize"
                    style={{ left: `${position}%`, transform: "translateX(-50%)" }}
                />

                {/* Drag handle */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform"
                    style={{ left: `${position}%` }}
                >
                    <svg width="20" height="16" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 7H17M1 7L5 3M1 7L5 11M17 7L13 3M17 7L13 11" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {/* Footer stats */}
            <div className="flex divide-x divide-slate-100">
                <div className="flex-1 p-3 text-center">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Original Data</span>
                    <span className="font-mono text-sm text-slate-700">Training Set</span>
                </div>
                <div className="flex-1 p-3 text-center">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Fine-Tuned</span>
                    <span className="font-mono text-sm text-slate-700">LoRA v2.1</span>
                </div>
                <div className="flex-1 p-3 text-center">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Position</span>
                    <span className="font-mono text-sm text-slate-700">{position.toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
}

export default function EvaluationPage() {
    const { data: metrics, isLoading } = useQuery({
        queryKey: ["metrics"],
        queryFn: fetchMetrics,
        staleTime: 30000,
    });

    // Eval image pairs — original training data vs fine-tuned model output
    const imagePairs = [
        { prompt: "Portrait sample 01 — original training data vs fine-tuned output", baseSrc: "/eval/base_01.png", ftSrc: "/eval/ft_01.png" },
        { prompt: "Portrait sample 02 — original training data vs fine-tuned output", baseSrc: "/eval/base_02.png", ftSrc: "/eval/ft_02.png" },
    ];

    const hasEvalImages = true; // Always render comparison section

    return (
        <div className="relative min-h-screen bg-white flex flex-col font-body">
            <Navbar />

            <main className="flex-1 flex justify-center py-10 px-4 sm:px-6">
                <div className="flex flex-col w-full max-w-[900px] gap-10">

                    {/* Page header */}
                    <div className="flex flex-col gap-3 pb-6 border-b border-slate-200">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${metrics?.status === "completed" ? "bg-slate-100 text-slate-900" : "bg-zinc-100 text-zinc-500"
                                }`}>
                                {metrics?.status ?? "No Run"}
                            </span>
                            {metrics?.run_name && (
                                <span className="text-slate-400 text-sm font-mono">Run: {metrics.run_name}</span>
                            )}
                        </div>
                        <h1 className="text-slate-900 text-3xl md:text-5xl font-black leading-tight tracking-tight font-display">
                            Model Evaluation
                            {metrics?.run_name && (
                                <span className="block text-slate-400 text-2xl font-normal mt-1">{metrics.run_name}</span>
                            )}
                        </h1>
                        <p className="text-slate-500 text-base max-w-2xl">
                            Comparative analysis of the fine-tuned LoRA model vs. the Stable Diffusion base. Metrics calculated on the validation set.
                        </p>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                icon: "analytics",
                                label: "FID Score",
                                value: isLoading ? "..." : metrics?.fid_score != null ? metrics.fid_score.toFixed(2) : "—",
                                desc: "Fréchet Inception Distance. Measures texture realism & distribution.",
                                sub: "Lower is better",
                                trend: metrics?.fid_score ? "trending_down" : null,
                                trendLabel: metrics?.fid_score ? `${metrics.fid_score.toFixed(2)} score` : null,
                            },
                            {
                                icon: "image_search",
                                label: "Avg CLIP Score",
                                value: isLoading ? "..." : metrics?.avg_clip_score != null ? metrics.avg_clip_score.toFixed(3) : metrics?.clip_score != null ? metrics.clip_score.toFixed(3) : "—",
                                desc: "Semantic alignment between image and text prompt keywords.",
                                sub: "Higher is better",
                                trend: metrics?.avg_clip_score ? "trending_up" : null,
                                trendLabel: metrics?.avg_clip_score ? "Alignment metric" : null,
                            },
                        ].map((card) => (
                            <div key={card.label} className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 hover:border-slate-400 transition-colors group">
                                <div className="flex flex-row justify-between items-start h-full">
                                    <div className="flex flex-col justify-between h-full pr-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-slate-100 rounded text-black">
                                                    <span className="material-symbols-outlined text-lg">{card.icon}</span>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">{card.sub}</span>
                                            </div>
                                            <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider mt-2">{card.label}</h3>
                                            <p className="text-slate-400 text-xs mt-2 leading-relaxed max-w-[200px]">{card.desc}</p>
                                        </div>
                                        {card.trend && (
                                            <span className="flex items-center text-slate-600 text-sm font-bold mt-4">
                                                <span className="material-symbols-outlined text-sm mr-1">{card.trend}</span>
                                                {card.trendLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-start">
                                        <p className="text-black text-[3.5rem] font-bold leading-none tracking-tight">{card.value}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Additional stats */}
                    {metrics && (
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: "Total Generated", value: metrics.total_generated ?? "—" },
                                { label: "Human Approved", value: metrics.human_approved_count ?? "—" },
                                {
                                    label: "Avg Gen Time",
                                    value: metrics.avg_generation_time_ms
                                        ? `${(metrics.avg_generation_time_ms / 1000).toFixed(1)}s`
                                        : "—",
                                },
                            ].map((s) => (
                                <div key={s.label} className="border border-slate-200 rounded-xl p-5 text-center bg-white">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">{s.label}</p>
                                    <p className="text-2xl font-bold text-slate-900 font-mono">{String(s.value)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Visual comparison */}
                    <div className="flex flex-col gap-8 mt-4">
                        <div className="flex items-end justify-between px-2 pb-2 border-b border-slate-100">
                            <div>
                                <h2 className="text-slate-900 text-2xl font-bold leading-tight">Visual Comparison</h2>
                                <p className="text-slate-500 text-sm mt-2">
                                    Interactive comparison. Left: Base Stable Diffusion v1.5. Right: Fine-Tuned LoRA output.
                                </p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
                                <span className="material-symbols-outlined text-lg">drag_pan</span>
                                <span>Drag slider to compare</span>
                            </div>
                        </div>

                        {imagePairs.map((pair, i) => (
                            <ComparisonSlider key={i} prompt={pair.prompt} baseSrc={pair.baseSrc} ftSrc={pair.ftSrc} />
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="border border-slate-200 rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 mb-12 hover:bg-slate-50 transition-colors cursor-pointer group bg-white shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="bg-black p-3 rounded-lg text-white">
                                <span className="material-symbols-outlined">code_blocks</span>
                            </div>
                            <div>
                                <h3 className="text-slate-900 font-bold text-lg">Backend API Documentation</h3>
                                <p className="text-slate-500 text-sm">Access auto-generated FastAPI docs and model endpoints.</p>
                            </div>
                        </div>
                        <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">
                            <button className="flex items-center gap-2 text-slate-900 font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                                <span>Open API Docs</span>
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                            </button>
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
}
