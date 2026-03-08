"use client";
import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGallery, updateRating, deleteGalleryItem, GalleryItem } from "@/lib/api";
import Navbar from "@/components/layout/Navbar";
import toast from "react-hot-toast";

const sortOptions = [
    { label: "Latest", value: "created_at" },
    { label: "CLIP Score", value: "clip_score" },
    { label: "Rating", value: "human_rating" },
];

export default function GalleryPage() {
    const [sortBy, setSortBy] = useState("created_at");
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const queryClient = useQueryClient();

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: ["gallery", sortBy],
        queryFn: ({ pageParam = 1 }) => fetchGallery({ page: pageParam as number, page_size: 24, sort_by: sortBy }),
        getNextPageParam: (last, all) => all.length < Math.ceil(last.total / 24) ? all.length + 1 : undefined,
        initialPageParam: 1,
    });

    const ratingMutation = useMutation({
        mutationFn: ({ id, rating }: { id: string; rating: -1 | 0 | 1 }) => updateRating(id, rating),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery"] });
            toast.success("Rating updated");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteGalleryItem(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery"] });
            setSelectedItem(null);
            toast.success("Image deleted");
        },
        onError: () => {
            toast.error("Failed to delete image");
        },
    });

    const allItems = data?.pages.flatMap((p) => p.items) ?? [];
    const totalCount = data?.pages[0]?.total ?? 0;

    // Filter items based on search query
    const filteredItems = searchQuery.trim()
        ? allItems.filter(item => 
            item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : allItems;

    return (
        <div className="min-h-screen bg-white flex flex-col font-body">
            <Navbar />

            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 pb-8 border-b border-zinc-200">
                    <div>
                        <h1 className="font-display text-4xl font-black tracking-tight text-zinc-900">Image Gallery</h1>
                        <p className="text-zinc-500 text-base mt-3 font-light">
                            {(searchQuery.trim() ? filteredItems.length : totalCount) > 0 
                                ? `${searchQuery.trim() ? filteredItems.length : totalCount} images` 
                                : "No images found"}
                            {searchQuery.trim() && ` matching "${searchQuery}"`}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Search input */}
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Search prompts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black w-full sm:w-56"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {sortOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setSortBy(opt.value)}
                                className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${sortBy === opt.value
                                    ? "bg-black text-white border-black shadow-md"
                                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-black hover:shadow-sm"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="skeleton aspect-square rounded-xl" />
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 text-center">
                        <div className="w-32 h-32 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-300 flex items-center justify-center mb-8">
                            <span className="material-symbols-outlined text-6xl text-zinc-300">{searchQuery.trim() ? "search_off" : "photo_library"}</span>
                        </div>
                        <h3 className="font-display text-2xl font-bold text-zinc-900 mb-3">{searchQuery.trim() ? "No matches found" : "No images yet"}</h3>
                        <p className="text-zinc-500 text-base max-w-md leading-relaxed">{searchQuery.trim() ? "Try a different search term" : "Generate your first image in the Generate tab to see it appear here."}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                        {filteredItems.map((item) => (
                            <GalleryCard
                                key={item.id}
                                item={item}
                                onClick={() => setSelectedItem(item)}
                                onRate={(rating) => ratingMutation.mutate({ id: item.id, rating })}
                            />
                        ))}
                    </div>
                )}

                {/* Load more */}
                {hasNextPage && (
                    <div className="flex justify-center mt-12">
                        <button
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isFetchingNextPage ? (
                                <span className="material-symbols-outlined animate-spin text-lg">autorenew</span>
                            ) : (
                                <span className="material-symbols-outlined text-lg">expand_more</span>
                            )}
                            Load More
                        </button>
                    </div>
                )}
            </main>

            {/* Lightbox */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Image section */}
                        <div className="relative bg-zinc-100 flex items-center justify-center p-6">
                            <img 
                                src={selectedItem.image_url} 
                                alt={selectedItem.prompt} 
                                className="w-auto h-auto max-w-full max-h-[50vh] object-contain rounded-lg shadow-lg" 
                            />
                            <button 
                                onClick={() => setSelectedItem(null)} 
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-all"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>
                        
                        {/* Prompt section */}
                        <div className="p-6 bg-white">
                            <p className="text-sm text-zinc-800 font-mono leading-relaxed">{selectedItem.prompt}</p>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-zinc-100">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Rate:</span>
                                {([-1, 0, 1] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => ratingMutation.mutate({ id: selectedItem.id, rating: r })}
                                        className={`px-5 py-2.5 text-sm font-bold rounded-xl border-2 transition-all ${selectedItem.human_rating === r
                                            ? "bg-black text-white border-black"
                                            : "border-zinc-200 text-zinc-600 hover:border-black hover:text-black"
                                            }`}
                                    >
                                        {r === 1 ? "👍" : r === -1 ? "👎" : "○"}
                                    </button>
                                ))}
                                <a href={selectedItem.image_url} download className="ml-auto">
                                    <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border-2 border-zinc-200 hover:border-black transition-all">
                                        <span className="material-symbols-outlined text-lg">download</span>
                                        Download
                                    </button>
                                </a>
                                <button 
                                    onClick={() => { if (confirm("Delete this image?")) deleteMutation.mutate(selectedItem.id) }}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function GalleryCard({ item, onClick, onRate }: { item: GalleryItem; onClick: () => void; onRate: (r: -1 | 0 | 1) => void }) {
    return (
        <div className="relative group cursor-pointer rounded-xl overflow-hidden border border-zinc-200 bg-white shadow-sm hover:shadow-xl hover:border-zinc-400 transition-all duration-300 aspect-[3/4] flex flex-col" onClick={onClick}>
            <img src={item.image_url} alt={item.prompt} className="w-full h-[75%] object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300" loading="lazy" />
            <div className="flex-1 bg-white p-3 flex flex-col justify-between">
                <p className="text-[10px] text-zinc-500 font-mono line-clamp-2 leading-tight">{item.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                    {item.clip_score && (
                        <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded">
                            CLIP: {item.clip_score.toFixed(2)}
                        </span>
                    )}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {([-1, 0, 1] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => onRate(r)}
                                className={`text-xs w-6 h-6 rounded flex items-center justify-center font-bold transition-all ${item.human_rating === r ? "bg-black text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                            >
                                {r === 1 ? "✓" : r === -1 ? "✗" : "○"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
