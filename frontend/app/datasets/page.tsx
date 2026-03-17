'use client';

import { useState, useCallback, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import toast from 'react-hot-toast';

// Types
interface DatasetImage {
  id: string;
  filename: string;
  url: string;
  storage_path: string;
  file_size: number;
  created_at: string;
}

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  image_count: number;
  created_at: string;
  updated_at: string;
  images?: DatasetImage[];
}

// API Functions
async function fetchDatasets(): Promise<Dataset[]> {
  const response = await fetch('/api/datasets');
  if (!response.ok) throw new Error('Failed to fetch datasets');
  return response.json();
}

async function fetchDataset(id: string): Promise<Dataset> {
  const response = await fetch(`/api/datasets/${id}`);
  if (!response.ok) throw new Error('Failed to fetch dataset');
  return response.json();
}

async function createDataset(name: string, description?: string): Promise<Dataset> {
  const response = await fetch('/api/datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) throw new Error('Failed to create dataset');
  return response.json();
}

async function deleteDatasetApi(id: string): Promise<void> {
  const response = await fetch(`/api/datasets?id=${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete dataset');
}

async function uploadToDataset(datasetId: string, files: File[]): Promise<{ uploadedImages: DatasetImage[], error?: string, message?: string }> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch(`/api/datasets/${datasetId}/images`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload images');
  }

  return data;
}

async function deleteDatasetImage(datasetId: string, imageId: string): Promise<void> {
  const response = await fetch(`/api/datasets/${datasetId}/images?imageId=${imageId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete image');
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load datasets on mount
  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDatasets();
      setDatasets(data);
    } catch (error) {
      console.error('Failed to load datasets:', error);
      toast.error('Failed to load datasets');
    } finally {
      setIsLoading(false);
    }
  };

  // Reload a specific dataset with its images
  const reloadSelectedDataset = useCallback(async (datasetId?: string) => {
    const id = datasetId ?? selectedDataset?.id;
    if (!id) return;
    try {
      const updated = await fetchDataset(id);
      // Ensure images array exists
      if (updated && !updated.images) {
        updated.images = [];
      }
      setSelectedDataset(updated);
    } catch (error) {
      console.error('Failed to reload dataset:', error);
    }
  }, [selectedDataset?.id]);

  const createDatasetHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDatasetName.trim()) {
      toast.error('Please enter a dataset name');
      return;
    }

    setIsCreating(true);
    try {
      const newDataset = await createDataset(newDatasetName.trim());
      toast.success(`Dataset "${newDatasetName}" created!`);
      setNewDatasetName('');
      await loadDatasets();
      setSelectedDataset(newDataset);
    } catch (error) {
      console.error('Failed to create dataset:', error);
      toast.error('Failed to create dataset');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteDatasetHandler = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset and all its images?')) {
      return;
    }

    try {
      await deleteDatasetApi(datasetId);
      toast.success('Dataset deleted');
      if (selectedDataset?.id === datasetId) {
        setSelectedDataset(null);
      }
      await loadDatasets();
    } catch (error) {
      console.error('Failed to delete dataset:', error);
      toast.error('Failed to delete dataset');
    }
  };

  const selectDataset = async (dataset: Dataset) => {
    try {
      const fullDataset = await fetchDataset(dataset.id);
      setSelectedDataset(fullDataset);
    } catch (error) {
      console.error('Failed to fetch dataset details:', error);
      toast.error('Failed to load dataset');
    }
  };

  const deleteImageHandler = async (imageId: string) => {
    if (!selectedDataset || !confirm('Delete this image?')) return;

    try {
      await deleteDatasetImage(selectedDataset.id, imageId);
      toast.success('Image deleted');
      // Refresh the selected dataset
      const updated = await fetchDataset(selectedDataset.id);
      setSelectedDataset(updated);
      await loadDatasets();
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!selectedDataset) {
      toast.error('Please select a dataset first');
      return;
    }

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/') &&
        ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)
    );

    if (files.length === 0) {
      toast.error('Please upload JPG, JPEG, or PNG files only');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadToDataset(selectedDataset.id, files);
      if (result.uploadedImages && result.uploadedImages.length > 0) {
        toast.success(`${result.uploadedImages.length} image(s) uploaded!`);
        // Update selected dataset with new images directly
        const newImages = result.uploadedImages;
        setSelectedDataset(prev => prev ? {
          ...prev,
          images: [...(prev.images || []), ...newImages],
          image_count: (prev.image_count || 0) + newImages.length
        } : null);
        await loadDatasets();
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${files.length} image(s) uploaded!`);
      }
    } catch (error) {
      console.error('Failed to upload images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  }, [selectedDataset, reloadSelectedDataset]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDataset) {
      toast.error('Please select a dataset first');
      return;
    }

    const files = Array.from(e.target.files || []).filter(
      file => file.type.startsWith('image/') &&
        ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)
    );

    if (files.length === 0) {
      toast.error('Please select JPG, JPEG, or PNG files only');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadToDataset(selectedDataset.id, files);
      if (result.uploadedImages && result.uploadedImages.length > 0) {
        toast.success(`${result.uploadedImages.length} image(s) uploaded!`);
        // Update selected dataset with new images directly
        const newImages = result.uploadedImages;
        setSelectedDataset(prev => prev ? {
          ...prev,
          images: [...(prev.images || []), ...newImages],
          image_count: (prev.image_count || 0) + newImages.length
        } : null);
        await loadDatasets();
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${files.length} image(s) uploaded!`);
      }
    } catch (error) {
      console.error('Failed to upload images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="relative min-h-screen bg-white flex flex-col font-body">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 pb-8 border-b border-zinc-200">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-zinc-900">Dataset Management</h1>
            <p className="text-zinc-500 text-base mt-3 font-light">
              {datasets.length > 0
                ? `${datasets.length} dataset${datasets.length !== 1 ? 's' : ''}`
                : 'No datasets yet'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Dataset List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Create New Dataset */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wide mb-4">Create Dataset</h3>
              <form onSubmit={createDatasetHandler} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  placeholder="e.g., portraits, cars, animals"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-sm font-medium"
                />
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">add</span>
                      Create Dataset
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Dataset List */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
                <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wide">Your Datasets</h3>
              </div>

              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto" />
                </div>
              ) : datasets.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">
                  <span className="material-symbols-outlined text-4xl">folder_open</span>
                  <p className="mt-2 text-sm">No datasets yet</p>
                  <p className="text-xs">Create one to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
                  {datasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className={`p-4 cursor-pointer transition-all ${selectedDataset?.id === dataset.id
                        ? 'bg-zinc-100'
                        : 'hover:bg-zinc-50'
                        }`}
                      onClick={() => selectDataset(dataset)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedDataset?.id === dataset.id ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                            <span className="material-symbols-outlined text-lg">folder</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-zinc-900 text-sm">{dataset.name}</h4>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {dataset.image_count} image{dataset.image_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDatasetHandler(dataset.id);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 mt-2 ml-11">
                        Created {formatDate(dataset.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Upload & Images */}
          <div className="lg:col-span-3">
            {selectedDataset ? (
              <div className="space-y-6">
                {/* Upload Area */}
                <div
                  className={`rounded-xl border-2 border-dashed p-8 transition-colors ${isDragging
                    ? 'border-black bg-zinc-50'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${isDragging ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                      <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">
                      {isDragging ? 'Drop images here' : 'Drag & drop images'}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-4">
                      or click to select files (JPG, JPEG, PNG)
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="file-upload"
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl cursor-pointer transition-colors text-sm font-bold ${isUploading
                        ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                        : 'bg-black text-white hover:bg-zinc-800'
                        }`}
                    >
                      {isUploading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-zinc-400/30 border-t-zinc-600 rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
                          Select Images
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Images Grid */}
                <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-zinc-900 text-sm uppercase tracking-wide">
                      {selectedDataset.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => reloadSelectedDataset()}
                        className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                        title="Refresh images"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                      </button>
                      <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">
                        {selectedDataset.images?.length || 0} images
                      </span>
                    </div>
                  </div>

                  {!selectedDataset.images || selectedDataset.images.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                      <span className="material-symbols-outlined text-5xl">photo_library</span>
                      <p className="mt-3 text-sm font-medium text-zinc-600">No images yet</p>
                      <p className="text-xs mt-1">Upload images using drag & drop above</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-5">
                      {selectedDataset.images.map((image) => (
                        <div
                          key={image.id}
                          className="group relative aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 hover:border-zinc-400 transition-all"
                        >
                          <img
                            src={image.url}
                            alt={image.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f4f4f5" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2371717a" font-size="10">Error</text></svg>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => deleteImageHandler(image.id)}
                              className="p-2 bg-white/20 hover:bg-red-500 text-white rounded-lg transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="text-[10px] text-white truncate font-medium">
                              {image.filename}
                            </p>
                            <p className="text-[9px] text-white/70">
                              {formatFileSize(image.file_size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <span className="material-symbols-outlined text-4xl">folder_open</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">
                  Select a Dataset
                </h3>
                <p className="text-zinc-500 text-sm">
                  Choose a dataset from the list to view and upload images
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
