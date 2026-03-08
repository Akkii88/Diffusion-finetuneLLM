"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const EXAMPLES = [
    "cinematic portrait, dramatic lighting, shallow depth of field, 85mm lens",
    "oil painting, impressionist style, vibrant color palette, visible brushstrokes",
    "watercolor landscape, dreamy soft colors, loose painting style",
    "digital art, concept art style, hyper-detailed, epic scene",
    "studio photography, professional lighting, clean background, sharp focus",
    "fantasy illustration, intricate details, magical atmosphere",
    "vintage photography, film grain, warm tones, 1970s aesthetic",
    "architectural visualization, photorealistic render, natural lighting",
    "abstract expressionism, bold colors, dynamic composition",
    "anime style, cel shading, clean line art, pastel colors",
];

export function PromptGuide({ onSelect }: { onSelect: (p: string) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="glass" style={{ padding: 16 }}>
            <button
                onClick={() => setOpen(!open)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.04em" }}
                aria-expanded={open}
                aria-controls="prompt-guide-list"
            >
                <BookOpen size={14} /> PROMPT GUIDE {open ? <ChevronUp size={14} style={{ marginLeft: "auto" }} /> : <ChevronDown size={14} style={{ marginLeft: "auto" }} />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div id="prompt-guide-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                        <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                            {EXAMPLES.map((ex, i) => (
                                <button
                                    key={i}
                                    onClick={() => { onSelect(ex); setOpen(false); }}
                                    style={{
                                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                                        borderRadius: 8, padding: "8px 12px", color: "#94a3b8", fontSize: "0.8rem",
                                        cursor: "pointer", textAlign: "left", transition: "all 0.15s", lineHeight: 1.5,
                                        fontFamily: "Inter, sans-serif",
                                    }}
                                    onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#d8b4fe"; }}
                                    onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                                    aria-label={`Use prompt: ${ex}`}
                                >
                                    {ex}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
