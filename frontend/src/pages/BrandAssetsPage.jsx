import React, { useEffect, useRef, useState } from "react";
import {
  fetchNiches,
  listBrandAssets,
  uploadTextBrandAsset,
  uploadFileBrandAsset,
  deleteBrandAsset,
} from "../api";
import {
  BookOpen,
  UploadCloud,
  FileText,
  FileCode,
  Trash2,
  Plus,
  RefreshCw,
  Folder,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export function BrandAssetsPage() {
  const [niches, setNiches] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [assets, setAssets] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [textInput, setTextInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchNiches()
      .then((data) => {
        const items = data.items || [];
        setNiches(items);
        if (items.length > 0 && !selectedNiche) {
          setSelectedNiche(items[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadAssets = async (nicheId) => {
    if (!nicheId) return;
    setLoading(true);
    setError("");
    try {
      const data = await listBrandAssets(nicheId);
      setAssets(data.items || []);
      setTotalChunks(data.total_chunks || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedNiche) loadAssets(selectedNiche);
  }, [selectedNiche]);

  const handleTextUpload = async () => {
    if (!textInput.trim() || textInput.trim().length < 10) {
      setError("Guideline text must be at least 10 characters.");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const result = await uploadTextBrandAsset(selectedNiche, textInput.trim());
      setSuccess(`Successfully embedded ${result.chunk_count} RAG chunks.`);
      setTextInput("");
      setShowTextModal(false);
      loadAssets(selectedNiche);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md"].includes(ext)) {
      setError("Supported formats: .pdf, .txt, .md");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const result = await uploadFileBrandAsset(selectedNiche, file);
      setSuccess(`Uploaded "${file.name}" — embedded ${result.chunk_count} vector chunks.`);
      loadAssets(selectedNiche);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId) => {
    try {
      await deleteBrandAsset(selectedNiche, assetId);
      setSuccess("Asset removed from vector knowledge store.");
      loadAssets(selectedNiche);
    } catch (err) {
      setError(err.message);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const currentNiche = niches.find((n) => n.id === selectedNiche);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e0d4]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1c1917] flex items-center gap-2">
            <span>Brand Assets & RAG Knowledge Store</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] tabular-nums">
              {totalChunks} vector chunks
            </span>
          </h1>
          <p className="text-xs text-[#57534e] mt-1">
            Ingest brand voice documents, tonal guidelines, and stylistic constraints to ground the Copywriter Agent.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowTextModal(true)}
            className="btn btn-secondary flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Paste Guidelines</span>
          </button>

          <button
            onClick={() => loadAssets(selectedNiche)}
            className="btn btn-secondary flex items-center gap-1.5"
            title="Refresh assets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#c2410c]" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="hover:text-[#1c1917]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {success}
          </span>
          <button onClick={() => setSuccess("")} className="hover:text-[#1c1917]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Niche selector toolbar */}
      <div className="surface-panel p-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <label className="label-micro">Active Niche Knowledge Base</label>
            <select
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              className="select-base !py-1.5 !text-xs"
            >
              <option value="">Select a brand niche...</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedNiche && (
          <div className="text-right text-xs font-mono text-[#57534e]">
            <span>{assets.length} Documents</span>
            <span className="mx-2">•</span>
            <span className="text-[#15803d]">{totalChunks} Chunks Ingested</span>
          </div>
        )}
      </div>

      {selectedNiche && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Drag & Drop Ingestion Zone (5 Cols) */}
          <div className="lg:col-span-5 surface-panel p-5 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
              <UploadCloud className="w-3.5 h-3.5 text-[#c2410c]" />
              Ingest Document Asset
            </span>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-lg border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-3 ${
                dragOver
                  ? "border-[#c2410c] bg-[#fff7ed]/50"
                  : "border-[#e6e0d4] hover:border-[#c2410c]/50 bg-[#fbf9f5]"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-[#c2410c]">
                <UploadCloud className="w-5 h-5" />
              </div>

              <div>
                <p className="text-xs font-medium text-[#1c1917]">
                  Drop PDF or Markdown guidelines here
                </p>
                <p className="text-[11px] text-[#78716c] mt-1">
                  Supports .pdf, .txt, .md (Max 15MB)
                </p>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-xs font-mono text-[#c2410c] mt-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#c2410c] border-t-transparent rounded-full animate-spin" />
                  <span>Chunking & Vectorizing...</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
            </div>

            <p className="text-[11px] text-[#78716c] leading-relaxed">
              Uploaded files are parsed, sliced into semantic chunks, and embedded into the local ChromaDB vector store.
            </p>
          </div>

          {/* Right Column: Asset Inventory (7 Cols) */}
          <div className="lg:col-span-7 surface-panel p-5 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#c2410c]" />
              Ingested Knowledge Assets ({assets.length})
            </span>

            {loading && assets.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 skeleton-shimmer" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="p-12 text-center border border-[#e6e0d4] rounded-lg bg-[#fbf9f5]">
                <BookOpen className="w-8 h-8 text-[#a8a29e] mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-[#1c1917]">
                  No brand guidelines uploaded yet
                </h4>
                <p className="text-[11px] text-[#78716c] mt-1">
                  Upload a PDF or paste guideline text to enable grounded RAG generation for{" "}
                  {currentNiche?.name}.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3.5 rounded-lg border border-[#e6e0d4] bg-[#fbf9f5] flex items-center justify-between gap-3 hover:border-[#c2410c]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-[#ffffff] border border-[#e6e0d4] flex items-center justify-center flex-shrink-0 text-[#c2410c]">
                        {asset.source_type === "pdf" ? (
                          <FileText className="w-4 h-4 text-[#b91c1c]" />
                        ) : (
                          <FileCode className="w-4 h-4 text-[#c2410c]" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#1c1917] truncate">
                          {asset.original_filename || "Inline Guideline Text"}
                        </div>
                        <div className="text-[10px] font-mono text-[#78716c] flex items-center gap-2 mt-0.5">
                          <span className="uppercase">{asset.source_type}</span>
                          <span>•</span>
                          <span>Ingested {new Date(asset.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="btn btn-destructive !p-1.5 !rounded text-[#78716c] hover:text-[#b91c1c]"
                      title="Delete asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal / Drawer for Pasting Guidelines */}
      {showTextModal && (
        <div className="sheet-backdrop flex items-center justify-center p-4" onClick={() => setShowTextModal(false)}>
          <div
            className="surface-panel p-6 w-full max-w-xl border border-[#e6e0d4] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e6e0d4]">
              <h3 className="text-sm font-semibold text-[#1c1917]">
                Paste Brand Guidelines
              </h3>
              <button onClick={() => setShowTextModal(false)} className="text-[#78716c] hover:text-[#1c1917]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label-micro">Guideline Content</label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste tone guide, mandatory brand slogans, target personas, do's & don'ts..."
                rows={6}
                className="textarea-base"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowTextModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleTextUpload}
                disabled={uploading || textInput.trim().length < 10}
                className="btn btn-primary"
              >
                {uploading ? "Ingesting..." : "Save & Chunk Guidelines"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
