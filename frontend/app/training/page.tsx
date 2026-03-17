"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startTraining, stopTraining, fetchMetrics, fetchTrainingLogs, fetchTrainingHistory } from "@/lib/api";
import Navbar from "@/components/layout/Navbar";
import NoSSR from "@/components/ui/NoSSR";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, BarChart, Bar, Legend, ReferenceLine } from "recharts";
import toast from "react-hot-toast";

interface TrainingConfig {
    run_name?: string;
    lora_rank?: number;
    learning_rate?: number;
    max_train_steps?: number;
    train_batch_size?: number;
}

interface Dataset {
    id: string;
    name: string;
    image_count: number;
    description?: string;
}

// Preset configurations
const PRESET_CONFIGS = {
    best: {
        run_name: "LoRA-Best",
        lora_rank: 32,
        learning_rate: 0.00005,
        max_train_steps: 750,
        train_batch_size: 2,
    },
    fast: {
        run_name: "LoRA-Fast",
        lora_rank: 4,
        learning_rate: 0.0005,
        max_train_steps: 100,
        train_batch_size: 1,
    },
    custom: {
        run_name: "LoRA-Custom",
        lora_rank: 16,
        learning_rate: 0.0001,
        max_train_steps: 500,
        train_batch_size: 2,
    },
};

// Fetch datasets from API
async function fetchDatasets(): Promise<Dataset[]> {
    const response = await fetch('/api/datasets');
    if (!response.ok) throw new Error('Failed to fetch datasets');
    return response.json();
}

export default function TrainingPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const logEndRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [showDatasetDropdown, setShowDatasetDropdown] = useState(false);

    // Selected dataset from datasets page
    const [selectedDataset, setSelectedDataset] = useState<{id: string; name: string; image_count: number} | null>(null);

    // Training history state
    const [showHistory, setShowHistory] = useState(false);

    // Query to fetch training history
    const { data: trainingHistory = { runs: [] }, isLoading: isLoadingHistory } = useQuery({
        queryKey: ["trainingHistory"],
        queryFn: fetchTrainingHistory,
        enabled: showHistory,
    });

    // Query to fetch all available datasets
    const { data: datasets = [], isLoading: isLoadingDatasets } = useQuery({
        queryKey: ["datasets"],
        queryFn: fetchDatasets,
        enabled: showDatasetDropdown, // Only fetch when dropdown is opened
    });

    // Load selected dataset from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('selected_training_dataset');
        if (stored) {
            try {
                setSelectedDataset(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse selected dataset:', e);
            }
        }
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.dataset-dropdown-container')) {
                setShowDatasetDropdown(false);
            }
        };

        if (showDatasetDropdown) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showDatasetDropdown]);

    const [config, setConfig] = useState<TrainingConfig>(PRESET_CONFIGS.best);

    // Function to apply preset
    const applyPreset = (preset: 'best' | 'fast' | 'custom') => {
        setConfig(PRESET_CONFIGS[preset]);
        toast.success(`Applied ${preset === 'best' ? 'Best Results' : preset === 'fast' ? 'Fast Results' : 'Custom'} preset`);
    };

    // Modal state for confirmation
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Collapsible chart sections state
    const [expandedCharts, setExpandedCharts] = useState<Record<string, boolean>>({
        lossCurve: true,
        smoothedLoss: true,
        lrSchedule: true,
        gradNorm: false,
        stepDuration: false,
        advancedCharts: true,
    });

    const toggleChart = (chart: string) => {
        if (chart === 'advancedCharts') {
            // Toggle both gradNorm and stepDuration together
            const currentlyExpanded = expandedCharts.gradNorm;
            setExpandedCharts(prev => ({
                ...prev,
                gradNorm: !currentlyExpanded,
                stepDuration: !currentlyExpanded,
            }));
        } else {
            setExpandedCharts(prev => ({ ...prev, [chart]: !prev[chart] }));
        }
    };

    // Live logs state
    const [logLines, setLogLines] = useState<string[]>([]);
    const [logFilter, setLogFilter] = useState<"all" | "error" | "warning" | "info">("all");

    const { data: metrics, isLoading, error } = useQuery({
        queryKey: ["metrics"],
        queryFn: fetchMetrics,
        refetchInterval: 2000,
        refetchOnMount: true,
    });

    // Debug log for metrics
    if (error) {
        console.error("Error fetching metrics:", error);
    }
    // console.log("Metrics:", metrics);

    const startMutation = useMutation({
        mutationFn: startTraining,
        onSuccess: () => {
            toast.success("Training started!");
            queryClient.invalidateQueries({ queryKey: ["metrics"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const stopMutation = useMutation({
        mutationFn: stopTraining,
        onSuccess: () => {
            toast.success("Training stopped");
            queryClient.invalidateQueries({ queryKey: ["metrics"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const isRunning = metrics?.status === "running" || metrics?.status === "starting";
    const progress =
        metrics?.current_step && metrics?.total_steps
            ? Math.round((metrics.current_step / metrics.total_steps) * 100)
            : 0;

    const lossData = (metrics?.training_log ?? []).map((entry) => ({
        step: entry.step,
        train: entry.train_loss,
        val: entry.val_loss,
        smoothed: entry.smoothed_loss,
        lr: entry.learning_rate,
        grad_norm: entry.grad_norm,
        step_time: entry.step_time_ms,
        epoch: entry.epoch,
    }));

    // Compute summary stats
    const avgStepTime = lossData.length > 0
        ? lossData.reduce((s, d) => s + (d.step_time ?? 0), 0) / lossData.filter(d => d.step_time).length
        : 0;
    const throughput = avgStepTime > 0 ? (1000 / avgStepTime).toFixed(1) : "—";
    const lastLoss = lossData.length > 0 ? lossData[lossData.length - 1].train : null;
    const firstLoss = lossData.length > 0 ? lossData[0].train : null;
    const lossReduction = firstLoss && lastLoss ? (((firstLoss - lastLoss) / firstLoss) * 100).toFixed(1) : null;

    // Connect to SSE stream for live logs
    useEffect(() => {
        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connectSSE = () => {
            eventSource = new EventSource("/api/training/stream-logs");

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLogLines((prev) => {
                        const newLines = [...prev, data];
                        // Keep max 500 lines
                        return newLines.slice(-500);
                    });
                } catch (e) {
                    console.error("Failed to parse SSE log:", e);
                }
            };

            eventSource.onerror = () => {
                eventSource?.close();
                // Reconnect after 2 seconds
                reconnectTimeout = setTimeout(connectSSE, 2000);
            };
        };

        connectSSE();

        return () => {
            eventSource?.close();
            clearTimeout(reconnectTimeout);
        };
    }, []);

    // Auto-scroll log terminal when new lines arrive
    useEffect(() => {
        if (logEndRef.current && autoScroll) {
            logEndRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [logLines]);

    const metricCards = [
        { icon: "bolt", label: "Current Step", value: metrics?.current_step?.toLocaleString() ?? "—", badge: isRunning ? "LIVE" : null },
        { icon: "timeline", label: "Training Loss", value: metrics?.final_loss?.toFixed(4) ?? "—", badge: metrics?.final_loss ? "↓" : null },
        { icon: "tune", label: "Learning Rate", value: metrics?.learning_rate ? metrics.learning_rate.toExponential(1) : `${config.learning_rate}`, badge: null },
        { icon: "memory", label: "LoRA Rank", value: metrics?.lora_rank ? String(metrics.lora_rank) : String(config.lora_rank), badge: null },
    ];

    return (
        <div className="relative flex flex-col min-h-screen w-full bg-white antialiased">
            <Navbar />

            <main className="relative flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
                <div className="mx-auto max-w-7xl flex flex-col gap-8">

                    {/* Page title */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-display">
                                {selectedDataset ? `${selectedDataset.name} Training` : (metrics?.run_name ?? config.run_name ?? "Training Dashboard")}
                            </h2>
                            <p className="text-slate-500 text-sm">
                                {isRunning ? (
                                    <span>Training active · Step {metrics?.current_step?.toLocaleString() ?? 0} / {metrics?.total_steps?.toLocaleString() ?? config.max_train_steps}</span>
                                ) : (
                                    <span>Configure and start a new LoRA fine-tuning run</span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => queryClient.invalidateQueries({ queryKey: ["metrics"] })}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
                                title="Refresh metrics"
                            >
                                <span className="material-symbols-outlined text-lg">refresh</span>
                            </button>
                            <button
                                onClick={() => setShowHistory(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
                                title="View training history"
                            >
                                <span className="material-symbols-outlined text-lg">history</span>
                            </button>
                            {isRunning ? (
                                <button
                                    onClick={() => stopMutation.mutate()}
                                    disabled={stopMutation.isPending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-lg">stop</span>
                                    Stop Training
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowConfirmModal(true)}
                                    disabled={startMutation.isPending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-bold shadow-sm hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                                    {startMutation.isPending ? "Starting..." : "Start Training"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress bar */}
                    {isRunning && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-700">
                                        {metrics?.current_step?.toLocaleString()} / {metrics?.total_steps?.toLocaleString()} steps
                                    </span>
                                    <span className="text-xs text-slate-500">Training in progress...</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-slate-900">{progress}%</span>
                                </div>
                            </div>
                            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                                <div className="h-full bg-black rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Metric cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {metricCards.map((card) => (
                            <div key={card.label} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-slate-400">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-slate-50 rounded-lg text-black border border-slate-200">
                                        <span className="material-symbols-outlined">{card.icon}</span>
                                    </div>
                                    {card.badge && (
                                        <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                                            {card.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-500 text-sm font-medium">{card.label}</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{isLoading ? "..." : card.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Bottom grid: Chart (8 cols) + Config (4 cols) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        {/* Left: Loss chart - 8 columns */}
                        <div className="lg:col-span-8 flex flex-col">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Training Loss Curve</h3>
                                        <p className="text-slate-500 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>Real-time loss metrics over steps</p>
                                    </div>
                                </div>
                                {lossData.length > 0 ? (
                                    <NoSSR>
                                        <div className="flex-1 min-h-[60vh]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={lossData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="step" tick={{ fontSize: 11, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                    <YAxis tick={{ fontSize: 11, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                    <Tooltip
                                                        contentStyle={{ background: "#000", border: "none", borderRadius: "6px", color: "#fff", fontSize: 12, fontFamily: "JetBrains Mono" }}
                                                        labelStyle={{ color: "#94a3b8" }}
                                                    />
                                                    <Line type="monotone" dataKey="train" stroke="#000000" strokeWidth={2} dot={lossData.length <= 30 ? { r: 3, fill: "#000" } : false} activeDot={{ r: 5 }} name="Train Loss" />
                                                    {lossData.some((d) => d.val != null) && (
                                                        <Line type="monotone" dataKey="val" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={lossData.length <= 30 ? { r: 2, fill: "#64748b" } : false} activeDot={{ r: 4 }} name="Val Loss" />
                                                    )}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </NoSSR>
                                ) : (
                                    <div className="flex flex-col items-center justify-center flex-1 text-center">
                                        <span className="material-symbols-outlined text-5xl text-zinc-200 mb-4">show_chart</span>
                                        <p className="text-zinc-400 text-sm">
                                            {isRunning ? "Waiting for first log entry..." : "Start training to see loss curve"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right column: Config only - 4 columns */}
                        <div className="lg:col-span-4 flex flex-col">
                            {/* Configuration Panel */}
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1 flex flex-col">
                                <div className="border-b border-slate-200 px-5 py-4 bg-slate-50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Configuration</h3>
                                </div>
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex flex-col gap-4">
                                        {/* Dataset Selection */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Training Dataset</label>
                                            {selectedDataset ? (
                                                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                                    <div className="p-1 bg-green-100 rounded">
                                                        <span className="material-symbols-outlined text-green-600 text-sm">folder</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-green-800 truncate">{selectedDataset.name}</p>
                                                        <p className="text-xs text-green-600">{selectedDataset.image_count} images</p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDataset(null);
                                                            localStorage.removeItem('selected_training_dataset');
                                                        }}
                                                        className="p-1 hover:bg-green-100 rounded"
                                                    >
                                                        <span className="material-symbols-outlined text-green-600 text-sm">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative dataset-dropdown-container">
                                                    <button
                                                        onClick={() => setShowDatasetDropdown(!showDatasetDropdown)}
                                                        className="flex items-center gap-2 p-3 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors text-left w-full"
                                                    >
                                                        <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-600">Select Dataset</p>
                                                            <p className="text-xs text-slate-400">Choose from your datasets</p>
                                                        </div>
                                                        <span className="material-symbols-outlined text-slate-400 ml-auto">expand_more</span>
                                                    </button>
                                                    
                                                    {/* Dataset Dropdown */}
                                                    {showDatasetDropdown && (
                                                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                            {isLoadingDatasets ? (
                                                                <div className="p-3 text-sm text-slate-500">Loading datasets...</div>
                                                            ) : datasets.length === 0 ? (
                                                                <div className="p-3">
                                                                    <p className="text-sm text-slate-500 mb-2">No datasets found</p>
                                                                    <button
                                                                        onClick={() => {
                                                                            setShowDatasetDropdown(false);
                                                                            router.push('/datasets');
                                                                        }}
                                                                        className="text-sm text-blue-600 hover:underline"
                                                                    >
                                                                        Create a new dataset
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                datasets.map((dataset: Dataset) => (
                                                                    <button
                                                                        key={dataset.id}
                                                                        onClick={() => {
                                                                            const datasetInfo = {
                                                                                id: dataset.id,
                                                                                name: dataset.name,
                                                                                image_count: dataset.image_count
                                                                            };
                                                                            setSelectedDataset(datasetInfo);
                                                                            localStorage.setItem('selected_training_dataset', JSON.stringify(datasetInfo));
                                                                            setShowDatasetDropdown(false);
                                                                        }}
                                                                        className="flex items-center gap-2 p-3 w-full hover:bg-slate-50 text-left border-b border-slate-100 last:border-b-0"
                                                                    >
                                                                        <span className="material-symbols-outlined text-slate-400">folder</span>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-slate-800 truncate">{dataset.name}</p>
                                                                            <p className="text-xs text-slate-500">{dataset.image_count} images</p>
                                                                        </div>
                                                                    </button>
                                                                ))
                                                            )}
                                                            {/* Option to create new dataset */}
                                                            <div className="border-t border-slate-200 p-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setShowDatasetDropdown(false);
                                                                        router.push('/datasets');
                                                                    }}
                                                                    className="flex items-center gap-2 p-2 w-full text-left hover:bg-slate-50 rounded text-sm text-blue-600"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">add</span>
                                                                    Create new dataset
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Preset Buttons */}
                                        <div className="flex gap-2 mb-4">
                                            <button
                                                onClick={() => applyPreset('best')}
                                                disabled={isRunning}
                                                className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Best Results
                                            </button>
                                            <button
                                                onClick={() => applyPreset('fast')}
                                                disabled={isRunning}
                                                className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Fast Results
                                            </button>
                                            <button
                                                onClick={() => applyPreset('custom')}
                                                disabled={isRunning}
                                                className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Custom
                                            </button>
                                        </div>

                                        {[
                                            { label: "Run Name", key: "run_name", type: "text" },
                                            { label: "LoRA Rank", key: "lora_rank", type: "number" },
                                            { label: "Learning Rate", key: "learning_rate", type: "number", step: "0.00001" },
                                            { label: "Max Steps", key: "max_train_steps", type: "number" },
                                            { label: "Batch Size", key: "train_batch_size", type: "number" },
                                        ].map((field) => (
                                            <div key={field.key} className="flex flex-col gap-1">
                                                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">{field.label}</label>
                                                <input
                                                    type={field.type}
                                                    step={field.step}
                                                    value={config[field.key as keyof TrainingConfig] as string | number}
                                                    onChange={(e) => setConfig((c) => ({
                                                        ...c,
                                                        [field.key]: field.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
                                                    }))}
                                                    disabled={isRunning}
                                                    className="text-sm font-medium text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-transparent focus:outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setShowConfirmModal(true)}
                                        disabled={isRunning || startMutation.isPending}
                                        className="mt-auto w-full bg-black text-white rounded-lg py-2.5 text-sm font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                                        {isRunning ? "Training in Progress..." : startMutation.isPending ? "Starting..." : "Start Training"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ===== NEW VISUALIZATION SECTION ===== */}

                        {/* Training Summary Stats - Full Width */}
                        {lossData.length > 0 && (
                            <div className="lg:col-span-12">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        {
                                            icon: "speed",
                                            label: "Avg Step Time",
                                            value: avgStepTime ? `${avgStepTime.toFixed(0)}ms` : "—",
                                            sub: "per gradient step",
                                        },
                                        {
                                            icon: "bolt",
                                            label: "Throughput",
                                            value: `${throughput} steps/s`,
                                            sub: "training speed",
                                        },
                                        {
                                            icon: "trending_down",
                                            label: "Loss Reduction",
                                            value: lossReduction ? `${lossReduction}%` : "—",
                                            sub: "from start",
                                        },
                                        {
                                            icon: "layers",
                                            label: "Current Epoch",
                                            value: lossData[lossData.length - 1]?.epoch?.toString() ?? "—",
                                            sub: "training cycle",
                                        },
                                    ].map((stat) => (
                                        <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-400 transition-all">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 bg-zinc-100 rounded-lg border border-slate-200">
                                                    <span className="material-symbols-outlined text-base text-zinc-700">{stat.icon}</span>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500" style={{ fontFamily: 'Inter, sans-serif' }}>{stat.label}</span>
                                            </div>
                                            <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</p>
                                            <p className="text-xs text-zinc-400 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>{stat.sub}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Smoothed Loss + Raw Loss Overlay - 6 columns */}
                        <div className="lg:col-span-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Smoothed Loss (EMA)</h3>
                                    <p className="text-zinc-400 text-xs mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Exponential moving average vs raw loss</p>
                                </div>
                                {lossData.length > 0 && lossData.some(d => d.smoothed != null) ? (
                                    <NoSSR>
                                        <ResponsiveContainer width="100%" height={240}>
                                            <AreaChart data={lossData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#18181b" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="step" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                <Tooltip contentStyle={{ background: "#000", border: "none", borderRadius: "6px", color: "#fff", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                                                <Area type="monotone" dataKey="train" stroke="#d4d4d8" strokeWidth={1} fill="none" dot={false} name="Raw Loss" />
                                                <Area type="monotone" dataKey="smoothed" stroke="#18181b" strokeWidth={2.5} fill="url(#lossGrad)" dot={lossData.length <= 30 ? { r: 2, fill: "#18181b" } : false} name="Smoothed" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </NoSSR>
                                ) : (
                                    <div className="flex items-center justify-center h-[240px] text-zinc-300">
                                        <span className="material-symbols-outlined text-4xl">area_chart</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Learning Rate Schedule - 6 columns */}
                        <div className="lg:col-span-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Learning Rate Schedule</h3>
                                    <p className="text-zinc-400 text-xs mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>LR decay over training steps</p>
                                </div>
                                {lossData.length > 0 && lossData.some(d => d.lr != null) ? (
                                    <NoSSR>
                                        <ResponsiveContainer width="100%" height={240}>
                                            <AreaChart data={lossData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="lrGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#71717a" stopOpacity={0.15} />
                                                        <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="step" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                <YAxis
                                                    tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }}
                                                    tickFormatter={(v: number) => v.toExponential(1)}
                                                />
                                                <Tooltip
                                                    contentStyle={{ background: "#000", border: "none", borderRadius: "6px", color: "#fff", fontSize: 11, fontFamily: "JetBrains Mono" }}
                                                    formatter={(value: number | undefined) => [value != null ? value.toExponential(3) : "—", "LR"]}
                                                />
                                                <Area type="monotone" dataKey="lr" stroke="#52525b" strokeWidth={2.5} fill="url(#lrGrad)" dot={lossData.length <= 30 ? { r: 2, fill: "#52525b" } : false} name="Learning Rate" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </NoSSR>
                                ) : (
                                    <div className="flex items-center justify-center h-[240px] text-zinc-300">
                                        <span className="material-symbols-outlined text-4xl">timeline</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Advanced Charts Toggle */}
                        <div className="lg:col-span-12">
                            <button
                                onClick={() => toggleChart('advancedCharts')}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-600"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">analytics</span>
                                    Advanced Metrics
                                </span>
                                <span className={`material-symbols-outlined transition-transform ${expandedCharts.gradNorm ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>
                        </div>

                        {/* Gradient Norm - 6 columns */}
                        {expandedCharts.gradNorm && (
                        <div className="lg:col-span-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Gradient Norm</h3>
                                    <p className="text-zinc-400 text-xs mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Gradient magnitude — monitors training stability</p>
                                </div>
                                {lossData.length > 0 && lossData.some(d => d.grad_norm != null) ? (
                                    <NoSSR>
                                        <ResponsiveContainer width="100%" height={240}>
                                            <LineChart data={lossData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="step" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                <Tooltip contentStyle={{ background: "#000", border: "none", borderRadius: "6px", color: "#fff", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                                                <ReferenceLine y={1.0} stroke="#a1a1aa" strokeDasharray="4 4" label={{ value: "clip=1.0", position: "right", fill: "#a1a1aa", fontSize: 10 }} />
                                                <Line type="monotone" dataKey="grad_norm" stroke="#3f3f46" strokeWidth={2} dot={lossData.length <= 30 ? { r: 2, fill: "#3f3f46" } : false} activeDot={{ r: 4 }} name="Grad Norm" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </NoSSR>
                                ) : (
                                    <div className="flex items-center justify-center h-[240px] text-zinc-300">
                                        <span className="material-symbols-outlined text-4xl">monitoring</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {/* Step Duration - 6 columns */}
                        {expandedCharts.stepDuration && (
                        <div className="lg:col-span-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Step Duration</h3>
                                    <p className="text-zinc-400 text-xs mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Time per training step (ms)</p>
                                </div>
                                {lossData.length > 0 && lossData.some(d => d.step_time != null) ? (
                                    <NoSSR>
                                        <ResponsiveContainer width="100%" height={240}>
                                            <BarChart data={lossData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#27272a" stopOpacity={0.9} />
                                                        <stop offset="95%" stopColor="#71717a" stopOpacity={0.4} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="step" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} />
                                                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#94a3b8" }} unit="ms" />
                                                <Tooltip
                                                    contentStyle={{ background: "#000", border: "none", borderRadius: "6px", color: "#fff", fontSize: 11, fontFamily: "JetBrains Mono" }}
                                                    formatter={(value: number | undefined) => [value != null ? `${value.toFixed(0)}ms` : "—", "Duration"]}
                                                />
                                                <Bar dataKey="step_time" fill="url(#barGrad)" radius={[3, 3, 0, 0]} name="Step Time" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </NoSSR>
                                ) : (
                                    <div className="flex items-center justify-center h-[240px] text-zinc-300">
                                        <span className="material-symbols-outlined text-4xl">timer</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {/* Live Log Terminal - Full Width (VS Code style) */}
                        <div className="lg:col-span-12">
                            <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col h-[360px]">
                                <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200 flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                                            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                                            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">terminal</span>
                                            <span className="text-xs text-slate-500 font-bold uppercase" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>Terminal</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAutoScroll(!autoScroll)}
                                        className={`px-2.5 py-1 text-[10px] rounded font-bold uppercase tracking-wider ${autoScroll ? 'bg-slate-200 text-slate-700 border border-slate-300' : 'bg-slate-100 text-slate-500 border border-slate-200'} hover:bg-slate-200 transition-colors`}
                                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                                    >
                                        {autoScroll ? '↓ Auto' : '↑ Manual'}
                                    </button>
                                    <button
                                        onClick={() => setLogFilter(logFilter === 'all' ? 'error' : logFilter === 'error' ? 'warning' : logFilter === 'warning' ? 'info' : 'all')}
                                        className={`px-2.5 py-1 text-[10px] rounded font-bold uppercase tracking-wider ${logFilter !== 'all' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-500 border border-slate-200'} hover:bg-slate-200 transition-colors`}
                                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                                    >
                                        {logFilter === 'all' ? 'All' : logFilter === 'error' ? 'Errors' : logFilter === 'warning' ? 'Warnings' : 'Info'}
                                    </button>
                                    <button
                                        onClick={() => setLogLines([])}
                                        className="px-2.5 py-1 text-[10px] rounded font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-[1.8] flex flex-col gap-0.5" style={{ fontFamily: 'JetBrains Mono, monospace', backgroundColor: '#f8fafc' }}>
                                    {logLines.length === 0 ? (
                                        <div className="text-slate-400">
                                            <span className="text-slate-500">$</span> Waiting for training to start...
                                        </div>
                                    ) : (
                                        logLines.map((line, i) => (
                                            <div key={i} className="text-slate-700 pl-2 border-l border-slate-200 hover:bg-slate-100/50 transition-colors">
                                                <span className="text-slate-400 mr-2 select-none" style={{ fontSize: '9px' }}>{String(i + 1).padStart(3, ' ')}</span>
                                                {line}
                                            </div>
                                        ))
                                    )}
                                    {isRunning && (
                                        <div className="text-slate-700 mt-2 flex items-center gap-2">
                                            <span className="text-slate-500">$</span>
                                            Processing step {metrics?.current_step ?? "..."}
                                            <span className="w-1.5 h-4 bg-slate-400 blink-cursor block" />
                                        </div>
                                    )}
                                    <div ref={logEndRef} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowConfirmModal(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <span className="material-symbols-outlined text-blue-600 text-xl">info</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Confirm Training</h3>
                        </div>

                        <p className="text-slate-600 mb-5">
                            Are you sure you want to start training with the following parameters?
                        </p>

                        {/* Parameters Summary */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-slate-500">Run Name</span>
                                    <p className="font-semibold text-slate-900">{config.run_name}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">LoRA Rank</span>
                                    <p className="font-semibold text-slate-900">{config.lora_rank}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Learning Rate</span>
                                    <p className="font-semibold text-slate-900">{config.learning_rate}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Max Steps</span>
                                    <p className="font-semibold text-slate-900">{config.max_train_steps}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-slate-500">Batch Size</span>
                                    <p className="font-semibold text-slate-900">{config.train_batch_size}</p>
                                </div>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2">
                            <span className="material-symbols-outlined text-amber-600 text-lg mt-0.5">warning</span>
                            <p className="text-xs text-amber-800">
                                Training will use your GPU/CPU resources. The button will be disabled until training completes or is stopped.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    startMutation.mutate({
                                        ...config,
                                        dataset_id: selectedDataset?.id,
                                    });
                                }}
                                disabled={startMutation.isPending}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-black text-white font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">play_arrow</span>
                                {startMutation.isPending ? "Starting..." : "Start Training"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Training History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <span className="material-symbols-outlined text-slate-600 text-xl">history</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Training History</h3>
                            </div>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            {isLoadingHistory ? (
                                <div className="flex justify-center py-10"><span className="material-symbols-outlined text-4xl text-slate-400 animate-spin">sync</span></div>
                            ) : trainingHistory.runs && trainingHistory.runs.length > 0 ? (
                                <div className="space-y-3">
                                    {trainingHistory.runs.map((run: any, i: number) => (
                                        <div key={run.id || i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-semibold">{run.run_name || `Run ${i+1}`}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${run.status==='completed'?'bg-green-100 text-green-700':run.status==='running'?'bg-blue-100 text-blue-700':'bg-red-100 text-red-700'}`}>{run.status}</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-sm text-slate-600">
                                                <div>Steps: <span className="text-slate-900 font-medium">{run.current_step||0}/{run.total_steps||0}</span></div>
                                                <div>Rank: <span className="text-slate-900 font-medium">{run.lora_rank||'-'}</span></div>
                                                <div>Loss: <span className="text-slate-900 font-medium">{run.final_loss?.toFixed(4)||'-'}</span></div>
                                                <div>CLIP: <span className="text-slate-900 font-medium">{run.clip_score?.toFixed(3)||'-'}</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="text-center py-10 text-slate-500">No training history found</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
