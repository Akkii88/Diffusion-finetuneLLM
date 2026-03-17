"use client";
import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { generateImage, saveToGallery } from "@/lib/api";
import toast from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";

const styleChips = ["Photorealistic", "Anime", "Architecture", "Cinematic", "Abstract"];
const samplers = ["Euler a", "DPM++ 2M", "DDIM", "LMS", "PNDM"];
const aspectRatios = [
    { label: "1:1", w: 512, h: 512, icon: "■" },
    { label: "2:3", w: 512, h: 768, icon: "▬" },
    { label: "16:9", w: 768, h: 432, icon: "▬" },
];

// Prompt enhancement keywords
const enhanceKeywords = [
    "high quality", "detailed", "8k", "photorealistic", "professional",
    "perfect composition", "beautiful lighting", "sharp focus", "masterpiece"
];

// Prompt history (stored in state for demo)
const PROMPT_HISTORY_KEY = "diffusionlab_prompt_history";

export default function GeneratePage() {
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [negEnabled, setNegEnabled] = useState(false);
    const [steps, setSteps] = useState(30);
    const [guidance, setGuidance] = useState(7.5);
    const [seed, setSeed] = useState(-1);
    const [sampler, setSampler] = useState("Euler a");
    const [aspectIdx, setAspectIdx] = useState(0);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [meta, setMeta] = useState<{ time?: number | null; seed?: number | null } | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [promptHistory, setPromptHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load prompt history on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(PROMPT_HISTORY_KEY);
            if (saved) setPromptHistory(JSON.parse(saved));
        } catch {}
    }, []);

    // Save prompt to history
    const saveToHistory = (p: string) => {
        if (!p.trim()) return;
        const updated = [p, ...promptHistory.filter(x => x !== p)].slice(0, 10);
        setPromptHistory(updated);
        try {
            localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(updated));
        } catch {}
    };

    // Randomize seed
    const handleRandomSeed = () => {
        setSeed(Math.floor(Math.random() * 999999999));
    };

    // Improve prompt function
    const handleEnhancePrompt = () => {
        if (!prompt.trim()) {
            toast.error("Enter a prompt first");
            return;
        }
        setIsEnhancing(true);
        // Simulate AI enhancement
        setTimeout(() => {
            const randomEnhancements = enhanceKeywords
                .sort(() => Math.random() - 0.5)
                .slice(0, 3)
                .join(", ");
            setPrompt(prev => prev.includes(randomEnhancements) 
                ? prev 
                : `${prev}, ${randomEnhancements}`);
            setIsEnhancing(false);
            toast.success("Prompt enhanced!");
        }, 800);
    };

    // Save to gallery function
    const handleSaveToGallery = async () => {
        if (!generatedImage) return;
        setIsSaving(true);
        try {
            await saveToGallery({
                image_url: generatedImage,
                prompt,
                negative_prompt: negEnabled ? negativePrompt : undefined,
                seed: meta?.seed ?? undefined,
                num_steps: steps,
                guidance_scale: guidance,
                scheduler: sampler,
            });
            toast.success("Saved to gallery!");
        } catch (e) {
            toast.error("Failed to save to gallery");
        } finally {
            setIsSaving(false);
        }
    };

    const { mutate, isPending } = useMutation({
        mutationFn: generateImage,
        onSuccess: (data) => {
            setGeneratedImage(data.image_url);
            setMeta({ time: data.generation_time_ms / 1000, seed: data.seed_used });
            toast.success("Image generated!");
        },
        onError: (e: Error) => toast.error(e.message || "Generation failed."),
    });

    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
        saveToHistory(prompt);
        mutate({
            prompt,
            negative_prompt: negEnabled ? negativePrompt : "",
            num_steps: steps,
            guidance_scale: guidance,
            seed,
            scheduler: sampler === "Euler a" ? "ddim" : sampler === "DPM++ 2M" ? "dpm++" : "ddim",
        });
    }, [prompt, negativePrompt, negEnabled, steps, guidance, seed, aspectIdx, mutate]);

    // Keyboard shortcut: Ctrl+Enter to generate
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (prompt.trim() && !isPending) {
                    handleGenerate();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [prompt, isPending, handleGenerate]);

    return (
        <div className="relative bg-white font-body text-zinc-900 min-h-screen flex flex-col overflow-hidden antialiased">
            <Navbar />

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Left aside */}
                <aside className="w-full lg:w-[380px] bg-white border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col h-auto lg:h-[calc(100vh-65px)] overflow-y-auto">
                    <div className="p-8 flex flex-col gap-8">
                        {/* Header */}
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight mb-2 text-black font-display">Image Generation</h1>
                            <p className="text-zinc-500 text-sm leading-relaxed font-light">
                                Configure synthesis parameters for high-fidelity output.
                            </p>
                        </div>

                        <hr className="border-zinc-200" />

                        {/* Positive prompt */}
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-900">Positive Prompt</label>
                                <div className="flex items-center gap-3">
                                    {promptHistory.length > 0 && (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setShowHistory(!showHistory)}
                                                className="text-[10px] uppercase tracking-wide text-zinc-500 font-bold flex items-center gap-1 hover:text-zinc-900 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">history</span>
                                            </button>
                                            {showHistory && (
                                                <div className="absolute right-0 top-6 w-80 max-h-48 overflow-y-auto bg-white border border-zinc-200 shadow-lg rounded-none z-50">
                                                    <div className="p-2 text-[10px] font-bold uppercase text-zinc-400 border-b border-zinc-100">Recent Prompts</div>
                                                    {promptHistory.map((p, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => { setPrompt(p); setShowHistory(false); }}
                                                            className="w-full text-left p-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 truncate border-b border-zinc-50 last:border-0"
                                                        >
                                                            {p.slice(0, 80)}{p.length > 80 ? "..." : ""}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <button 
                                        onClick={handleEnhancePrompt}
                                        disabled={isEnhancing}
                                        className="text-[10px] uppercase tracking-wide text-zinc-900 font-bold flex items-center gap-1 hover:opacity-70 transition-opacity border-b border-zinc-300 pb-0.5 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-[14px] animate-spin">{isEnhancing ? "autorenew" : "auto_awesome"}</span> {isEnhancing ? "Enhancing..." : "Improve"}
                                    </button>
                                </div>
                            </div>
                            <div className="relative group">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    maxLength={1000}
                                    className="w-full min-h-[140px] p-4 border border-zinc-300 bg-zinc-50 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black resize-none placeholder:text-zinc-400 transition-all text-zinc-900 font-mono leading-relaxed rounded-none"
                                    placeholder="Describe the image you want to generate..."
                                />
                                <div className="absolute bottom-3 right-3 text-[10px] text-zinc-500 font-mono">{prompt.length}/1000</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {styleChips.map((chip) => (
                                    <button
                                        key={chip}
                                        onClick={() => setPrompt((p) => p ? `${p}, ${chip.toLowerCase()}` : chip.toLowerCase())}
                                        className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 border border-zinc-200 text-zinc-600 hover:border-black hover:text-black bg-transparent transition-all rounded-none"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Negative prompt */}
                        <div className="border border-zinc-200 p-5 bg-zinc-50/50 rounded-none">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-zinc-900 text-lg">remove_circle_outline</span>
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-900">Negative Prompt</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={negEnabled} onChange={(e) => setNegEnabled(e.target.checked)} />
                                    <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-black" />
                                </label>
                            </div>
                            {negEnabled && (
                                <input
                                    type="text"
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                    className="w-full p-3 text-xs border-b border-zinc-300 bg-transparent focus:outline-none focus:border-black text-zinc-900 font-mono placeholder:text-zinc-400"
                                    placeholder="e.g. blur, noise, watermark"
                                />
                            )}
                        </div>

                        <hr className="border-zinc-200" />

                        {/* Parameters */}
                        <div className="flex flex-col gap-8">
                            <div className="flex items-center justify-between w-full">
                                <span className="text-base font-bold text-zinc-900 font-display uppercase tracking-tight">Model Parameters</span>
                                <span className="material-symbols-outlined text-zinc-400 text-lg">tune</span>
                            </div>

                            {/* Steps */}
                            <div>
                                <div className="flex justify-between mb-4 items-end">
                                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Inference Steps</label>
                                    <span className="text-xs font-mono font-bold text-zinc-900 border border-black px-2 py-1">{steps}</span>
                                </div>
                                <input type="range" min={10} max={60} step={5} value={steps} onChange={(e) => setSteps(+e.target.value)} className="w-full" />
                            </div>

                            {/* Guidance */}
                            <div>
                                <div className="flex justify-between mb-3 items-end">
                                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Guidance Scale</label>
                                    <span className="text-xs font-mono font-bold text-zinc-900 border border-black px-2 py-1">{guidance}</span>
                                </div>
                                <input type="range" min={1} max={20} step={0.5} value={guidance} onChange={(e) => setGuidance(+e.target.value)} className="w-full" />
                            </div>

                            {/* Seed + Sampler */}
                            <div className="grid grid-cols-2 gap-x-6">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-3">Seed</label>
                                    <div className="flex items-center relative group">
                                        <input
                                            type="number"
                                            value={seed}
                                            onChange={(e) => setSeed(+e.target.value)}
                                            className="w-full p-2.5 text-xs border border-zinc-300 bg-transparent focus:outline-none focus:border-black pl-9 pr-16 text-zinc-900 font-mono transition-colors rounded-none"
                                            placeholder="Random"
                                        />
                                        <span className="material-symbols-outlined absolute left-2.5 text-[16px] text-zinc-400">casino</span>
                                        <button
                                            onClick={handleRandomSeed}
                                            className="absolute right-2 p-1 hover:bg-zinc-200 rounded transition-colors"
                                            title="Randomize seed"
                                        >
                                            <span className="material-symbols-outlined text-sm text-zinc-500">shuffle</span>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-3">Sampler</label>
                                    <div className="relative">
                                        <select
                                            value={sampler}
                                            onChange={(e) => setSampler(e.target.value)}
                                            className="w-full p-2.5 text-xs border border-zinc-300 bg-transparent focus:outline-none focus:border-black cursor-pointer text-zinc-900 appearance-none font-mono rounded-none"
                                        >
                                            {samplers.map((s) => <option key={s}>{s}</option>)}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-2 top-2.5 text-zinc-500 pointer-events-none text-sm">expand_more</span>
                                    </div>
                                </div>
                            </div>

                            {/* Aspect Ratio */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block mb-3">Aspect Ratio</label>
                                <div className="grid grid-cols-3 gap-4">
                                    {aspectRatios.map((ar, i) => (
                                        <button
                                            key={ar.label}
                                            onClick={() => setAspectIdx(i)}
                                            className={`flex flex-col items-center justify-center py-3 px-2 rounded-none border text-xs font-bold transition-all ${aspectIdx === i
                                                ? "border-black bg-zinc-100 text-black"
                                                : "border-zinc-200 bg-transparent text-zinc-500 hover:border-black hover:text-black"
                                                }`}
                                        >
                                            <span className={`border border-current mb-2 ${i === 0 ? "w-4 h-4" : i === 1 ? "w-3 h-4" : "w-5 h-3"}`} />
                                            {ar.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Generate button */}
                        <div className="mt-auto pt-4 sticky bottom-0 bg-white z-10 border-t border-zinc-100">
                            <button
                                onClick={handleGenerate}
                                disabled={isPending}
                                className="w-full bg-black hover:opacity-80 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-none transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                            >
                                {isPending ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-lg">autorenew</span>
                                        Generating...
                                    </>
                                ) : (
                                    <>✦ GENERATE</>
                                )}
                            </button>
                            <div className="flex justify-between items-center mt-3 text-[10px] text-zinc-400 font-mono uppercase tracking-wide">
                                <span>Steps: {steps} · CFG: {guidance}</span>
                                <span>Seed: {seed === -1 ? "random" : seed}</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right canvas */}
                <main className="flex-1 bg-zinc-50 relative flex flex-col items-center justify-center p-4 md:p-10 overflow-hidden h-auto lg:h-[calc(100vh-65px)] min-h-[50vh]">
                    <div
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{ backgroundImage: "radial-gradient(#000000 1px, transparent 1px)", backgroundSize: "40px 40px" }}
                    />

                    <div className="w-full h-full flex flex-col items-center justify-center relative max-w-4xl">
                        {generatedImage ? (
                            <>
                                <div className="relative w-full max-h-[70vh] overflow-hidden rounded-none border border-zinc-200 shadow-sm">
                                    <img src={generatedImage} alt="Generated result" className="w-full h-full object-contain" />
                                </div>
                                {meta && (
                                    <div className="w-full mt-6 flex flex-wrap items-center justify-between gap-6 px-6 py-4 rounded-none border border-zinc-200 bg-white shadow-sm z-10">
                                        <div className="flex items-center gap-8 text-xs text-zinc-500 font-mono uppercase tracking-tight">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">schedule</span>
                                                <span>{meta.time ? `${meta.time.toFixed(1)}s` : "—"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">memory</span>
                                                <span>CFG: {guidance}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">fingerprint</span>
                                                <span>Seed: {meta.seed ?? "—"}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <a href={generatedImage} download="diffusionlab-output.png">
                                                <button className="h-8 w-8 flex items-center justify-center rounded-none hover:bg-zinc-100 text-zinc-600 transition-colors border border-transparent hover:border-black" title="Download">
                                                    <span className="material-symbols-outlined text-lg">download</span>
                                                </button>
                                            </a>
                                            <button
                                                onClick={handleSaveToGallery}
                                                disabled={isSaving}
                                                className="h-8 w-8 flex items-center justify-center rounded-none hover:bg-zinc-100 text-zinc-600 transition-colors border border-transparent hover:border-black disabled:opacity-50"
                                                title="Save to Gallery"
                                            >
                                                <span className="material-symbols-outlined text-lg animate-spin">{isSaving ? "autorenew" : "add_photo_alternate"}</span>
                                            </button>
                                            <div className="h-4 w-px bg-zinc-300 mx-2" />
                                            <button
                                                onClick={handleGenerate}
                                                disabled={isPending}
                                                className="flex items-center gap-2 px-4 py-2 rounded-none bg-zinc-100 text-zinc-900 hover:bg-black hover:text-white transition-all text-xs font-bold uppercase tracking-widest border border-zinc-200 hover:border-black disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-sm">refresh</span>
                                                Regenerate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="relative w-full aspect-[16/9] max-h-[80vh] bg-white rounded-none border border-dashed border-zinc-400 shadow-sm flex flex-col items-center justify-center group overflow-hidden transition-all hover:border-black">
                                <div className="flex flex-col items-center text-center p-12 max-w-lg">
                                    <div className="w-24 h-24 rounded-none bg-zinc-50 flex items-center justify-center mb-8 text-zinc-300 group-hover:text-black transition-colors border border-dashed border-zinc-200">
                                        <span className="material-symbols-outlined text-5xl">image</span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-zinc-900 mb-4 font-display tracking-tight">Canvas</h3>
                                    <p className="text-zinc-500 text-base leading-relaxed font-light">
                                        Configure your prompt on the left and click <strong>Generate</strong> to render your image.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="absolute bottom-4 left-0 w-full text-[10px] uppercase tracking-widest text-zinc-400 text-center font-mono opacity-50">
                        DiffusionLab Research Edition v2.4 · High-Precision Output
                    </div>
                </main>
            </div>
        </div>
    );
}
