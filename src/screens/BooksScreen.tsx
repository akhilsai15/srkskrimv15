/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Book,
  BookOpen,
  Trash2,
  Search,
  UploadCloud,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Eye,
  Sparkles,
  FileText,
  Bookmark as BookmarkIcon,
  Plus
} from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  getStoredBooks,
  getStoredBooksAsync,
  addBook,
  addBookWithBlob,
  getPDFBlob,
  deleteBook,
  Book as BookType,
  Bookmark,
  getBookmarks,
  addBookmark,
  deleteBookmark
} from "../lib/mock/mockBooks";

export default function BooksScreen() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if viewing own books or someone else's
  // If username is provided, we are viewing that specific user's books.
  // If not, we are viewing our own library.
  const isOwnLibrary = !username || (currentUser && (username === currentUser.username?.replace("@", "") || username === currentUser.id));
  
  // Normalize usernames for filtering
  const targetUsername = username
    ? username.startsWith("@") ? username : `@${username}`
    : (currentUser?.username || "@me");

  const [books, setBooks] = useState<BookType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingStatus, setUploadingStatus] = useState<string>("Uploading publication...");
  
  // Reader state
  const [activeBook, setActiveBook] = useState<BookType | null>(null);
  const [readerTheme, setReaderTheme] = useState<"sepia" | "charcoal" | "light">("sepia");
  const [readerFontSize, setReaderFontSize] = useState<number>(18);
  const [readerPage, setReaderPage] = useState<number>(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [readerMode, setReaderMode] = useState<"text" | "pdf">("text");
  const [deleteTarget, setDeleteTarget] = useState<BookType | null>(null);

  // Scroll and overall progress state
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const readerScrollContainerRef = useRef<HTMLDivElement>(null);

  // Bookmarks state
  const [activeBookmarks, setActiveBookmarks] = useState<Bookmark[]>([]);
  const [showBookmarksSidebar, setShowBookmarksSidebar] = useState(false);
  const [newBookmarkLabel, setNewBookmarkLabel] = useState("");

  // Calculate progress based on scroll position within the current page.
  // When a page's content fits entirely on screen (nothing to scroll), the
  // whole page is already visible/read, so it should count as 100% of that
  // page's contribution — otherwise the last page can never reach 100%.
  const computeReadProgress = (pageIndex: number, scrollFraction: number, totalPages: number) => {
    const clampedScroll = Math.min(1, Math.max(0, scrollFraction));
    const pageContribution = pageIndex / totalPages;
    const scrollContribution = clampedScroll / totalPages;
    return Math.min(100, Math.round((pageContribution + scrollContribution) * 100));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!activeBook) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const totalScrollable = scrollHeight - clientHeight;
    // No scrollable overflow => the entire page is already visible => fully read.
    const scrollPercent = totalScrollable > 0 ? scrollTop / totalScrollable : 1;

    const totalPages = activeBook.content?.length || 1;
    setScrollProgress(computeReadProgress(readerPage, scrollPercent, totalPages));
  };

  // Reset scroll and initialize progress on page or book change
  useEffect(() => {
    if (readerScrollContainerRef.current) {
      readerScrollContainerRef.current.scrollTop = 0;
    }
    if (!activeBook) {
      setScrollProgress(0);
      return;
    }
    const totalPages = activeBook.content?.length || 1;
    // Measure after layout so short pages (no scrollbar) are correctly
    // treated as fully read the moment they're opened.
    const raf = requestAnimationFrame(() => {
      const el = readerScrollContainerRef.current;
      const totalScrollable = el ? el.scrollHeight - el.clientHeight : 0;
      const scrollPercent = totalScrollable > 0 ? 0 : 1;
      setScrollProgress(computeReadProgress(readerPage, scrollPercent, totalPages));
    });
    return () => cancelAnimationFrame(raf);
  }, [readerPage, activeBook]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load books
  const loadBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await getStoredBooksAsync();
      setBooks(fetched);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load publications");
    } finally {
      setLoading(false);
    }
  };

  // Load bookmarks for the active book
  const loadActiveBookmarks = () => {
    if (activeBook) {
      setActiveBookmarks(getBookmarks(activeBook.id));
    } else {
      setActiveBookmarks([]);
    }
  };

  useEffect(() => {
    loadBooks();
    const handleUpdate = () => { loadBooks(); };
    window.addEventListener("skrimchat_books_updated", handleUpdate);
    return () => window.removeEventListener("skrimchat_books_updated", handleUpdate);
  }, []);

  useEffect(() => {
    loadActiveBookmarks();
    // Reset new bookmark label input and sidebar state when switching books
    setNewBookmarkLabel("");
    setShowBookmarksSidebar(false);
  }, [activeBook]);

  // Filter books based on search query and ownership
  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.ownerDisplayName.toLowerCase().includes(searchQuery.toLowerCase());

    if (isOwnLibrary) {
      // In my books view, we show ALL books but highlight search results, or filter down
      return matchesSearch;
    } else {
      // Viewing someone else's books: must strictly match their username
      const bookOwner = book.ownerUsername.replace("@", "").toLowerCase();
      const targetUserClean = targetUsername.replace("@", "").toLowerCase();
      return bookOwner === targetUserClean && matchesSearch;
    }
  });

  // Handle Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Helper to dynamically load PDF.js and extract text page-by-page
  const extractTextFromPDF = async (file: File): Promise<string[]> => {
    if (typeof window === "undefined") return [];
    
    // 1. Ensure PDF.js library is loaded
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load PDF processing engine"));
        document.head.appendChild(script);
      });
    }

    // 2. Load the document
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pagesText: string[] = [];

    // 3. Loop through pages and extract text
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      let lastY: number | null = null;
      let pageText = "";
      
      for (const item of items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 12) {
          pageText += "\n";
        }
        pageText += item.str + " ";
        lastY = item.transform[5];
      }

      if (!pageText.trim()) {
        pageText = items.map(item => item.str).join(" ");
      }

      pagesText.push(pageText.trim() || `[Blank Page ${i}]`);
    }

    return pagesText;
  };

  // Check file type and size before uploading
  const processFile = async (file: File) => {
    setUploadError(null);
    setUploadingStatus("Uploading publication...");
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setUploadError("Only standard PDF publications are allowed.");
      return;
    }

    // 100MB limit check
    const maxSizeBytes = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSizeBytes) {
      setUploadError("File exceeds the 100MB limit. Please upload a smaller publication.");
      return;
    }

    // Start simulated progress indicator
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null) {
          clearInterval(interval);
          return null;
        }
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 80);

    try {
      setUploadingStatus("✨ Synthesizing publication pages & reflowing layout...");
      
      // Extract text page-by-page
      let pagesText: string[] | undefined = undefined;
      try {
        pagesText = await extractTextFromPDF(file);
      } catch (e) {
        console.warn("Could not extract PDF text, saving metadata without content", e);
      }

      // Random premium book cover gradient
      const gradients = [
        "from-emerald-950 via-teal-950 to-black text-emerald-100 border-emerald-900/30",
        "from-purple-950 via-violet-950 to-black text-purple-100 border-violet-900/30",
        "from-rose-950 via-red-950 to-black text-rose-100 border-rose-900/30",
        "from-sky-950 via-blue-950 to-black text-sky-100 border-blue-900/30",
        "from-amber-950 via-yellow-950 to-black text-amber-100 border-amber-900/30"
      ];
      const randomCover = gradients[Math.floor(Math.random() * gradients.length)];

      await addBookWithBlob({
        ownerUsername: currentUser?.username || "@anonymous",
        ownerDisplayName: currentUser?.fullName || currentUser?.displayName || "Anonymous Creator",
        title: file.name.replace(".pdf", "").replace(/[-_]/g, " "),
        author: currentUser?.fullName || currentUser?.displayName || "You",
        fileName: file.name,
        sizeBytes: file.size,
        description: "User uploaded publication in high-fidelity secure sandbox.",
        coverColor: randomCover,
        content: pagesText
      }, file);

      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(null);
        loadBooks(); // reload catalog state immediately
      }, 300);

    } catch (err) {
      console.error("IndexedDB error:", err);
      setUploadError("Secure sandboxed write error. Please try again.");
      setUploadProgress(null);
    } finally {
      clearInterval(interval);
    }
  };

  // Delete Book handler
  const handleDelete = (e: React.MouseEvent, book: BookType) => {
    e.stopPropagation();
    setDeleteTarget(book);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      const deleted = deleteBook(deleteTarget.id);
      if (deleted) {
        loadBooks(); // refresh list immediately
      }
      setDeleteTarget(null);
    }
  };

  // Programmatic container click handler for file picker
  const handleContainerClick = () => {
    if (uploadProgress !== null) return;
    fileInputRef.current?.click();
  };

  // Open protected reader
  const openReader = async (book: BookType) => {
    setActiveBook(book);
    setReaderPage(0);
    setPdfBlobUrl(null);
    setReaderMode(book.content ? "text" : "pdf");
    
    // Always attempt to load the PDF blob if it is stored, so hybrid view works
    try {
      const blob = await getPDFBlob(book.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      } else if (book.dataUrl) {
        // Fallback for base64 from legacy storage
        const byteString = atob(book.dataUrl.split(",")[1]);
        const mimeString = book.dataUrl.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const fallbackBlob = new Blob([ab], { type: mimeString });
        const url = URL.createObjectURL(fallbackBlob);
        setPdfBlobUrl(url);
      } else {
        console.warn("No local binary stored for book:", book.id);
      }
    } catch (e) {
      console.error("Error loading PDF blob:", e);
      if (book.dataUrl) {
        setPdfBlobUrl(book.dataUrl);
      }
    }
  };

  const closeReader = () => {
    setActiveBook(null);
    if (pdfBlobUrl && pdfBlobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(pdfBlobUrl);
    }
    setPdfBlobUrl(null);
  };

  return (
    <div id="books-screen" className="w-full h-full min-h-screen bg-black text-white overflow-y-auto no-scrollbar pb-24 relative select-none">
      
      {/* ────────────────── HEADER ────────────────── */}
      <div className="sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-white/10 py-5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all border border-white/5"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#B026FF]" />
              {isOwnLibrary ? "Publications & Library" : `${targetUsername}'s Publications`}
            </h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wide flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#00F0FF]" /> Protected Sandbox Reader Mode
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        
        {/* ────────────────── UPLOAD ZONE (Only for Own Library) ────────────────── */}
        {isOwnLibrary && (
          <div
            onClick={handleContainerClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed p-8 transition-all duration-300 flex flex-col items-center text-center group cursor-pointer ${
              isDragging
                ? "border-[#B026FF] bg-[#B026FF]/5 shadow-[0_0_20px_rgba(176,38,255,0.15)]"
                : "border-white/10 bg-[#0A0A0F] hover:border-white/20"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#B026FF]/5 to-[#00F0FF]/5 rounded-2xl opacity-50 blur-xl pointer-events-none group-hover:opacity-100 transition-opacity duration-500" />
            
            <UploadCloud className="w-12 h-12 text-[#B026FF] mb-3 group-hover:scale-110 transition-transform duration-300" />
            <h3 className="text-sm font-bold text-white mb-1">Upload a PDF Publication</h3>
            <p className="text-xs text-gray-400 max-w-sm mb-4">
              Drag & drop your publication here, or <span className="text-[#00F0FF] underline cursor-pointer font-semibold">browse files</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              <Info className="w-3 h-3 text-[#B026FF]" />
              <span>Max size: 100MB • Only PDF publications allowed</span>
            </div>

            {/* Upload Progress */}
            {uploadProgress !== null && (
              <div className="w-full max-w-xs mt-4 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex justify-between text-[11px] font-bold text-gray-400">
                  <span>{uploadingStatus}</span>
                  <span className="text-[#B026FF]">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF] rounded-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <p className="text-xs text-red-500 font-bold mt-3 animate-pulse">
                ⚠️ {uploadError}
              </p>
            )}
          </div>
        )}

        {/* ────────────────── UPLOAD RESPONSIBILITY DISCLAIMER ────────────────── */}
        {isOwnLibrary && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
            <Info className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              By uploading a book or PDF, you confirm you own the rights to this content or have permission to share it, and you are solely responsible for ensuring it does not infringe on any copyright or third-party rights.
            </p>
          </div>
        )}

        {/* ────────────────── SEARCH BAR ────────────────── */}
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search publications by title, author, or publisher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-[#0A0A0F] border border-white/10 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#B026FF]/50 focus:ring-1 focus:ring-[#B026FF]/50 transition-all duration-300"
          />
        </div>

        {/* ────────────────── CATALOG GRID ────────────────── */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00F0FF]" /> 
              {isOwnLibrary ? "Publications Collection" : `${targetUsername}'s Publications`}
            </h2>
            <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 font-semibold">
              {filteredBooks.length} items
            </span>
          </div>

          {loading ? (
            <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-t-transparent border-[#B026FF] animate-spin mb-4" />
              <p className="text-sm font-bold text-gray-300">Loading library publications...</p>
            </div>
          ) : error ? (
            <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <p className="text-red-400 font-medium mb-3">{error}</p>
              <button onClick={() => loadBooks()} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full text-xs">Try Again</button>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <Book className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-sm font-bold text-gray-300">No publications found</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                {isOwnLibrary 
                  ? "Your reading collection is empty. Drag or upload a PDF to publish it safely." 
                  : "This creator hasn't published any protected literature yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.map((book) => {
                const sizeMB = (book.sizeBytes / (1024 * 1024)).toFixed(2);
                const dateString = new Date(book.uploadedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                });
                const isOwnBook = currentUser && book.ownerUsername.toLowerCase() === currentUser.username?.toLowerCase();

                return (
                  <motion.div
                    key={book.id}
                    whileHover={{ y: -4, scale: 1.02 }}
                    onClick={() => openReader(book)}
                    className="flex flex-col bg-[#0A0A0F] border border-white/10 rounded-2xl overflow-hidden cursor-pointer group shadow-xl hover:shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition-all duration-300"
                  >
                    {/* Visual Premium Hardcover Cover */}
                    <div className={`h-48 w-full bg-gradient-to-br ${book.coverColor} p-5 flex flex-col justify-between relative border-b overflow-hidden`}>
                      <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-l from-white/5 to-transparent skew-x-12 pointer-events-none" />
                      {/* Spine detail */}
                      <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-black/40 border-r border-white/10" />
                      
                      <div className="flex justify-between items-start pl-2">
                        <span className="text-[9px] uppercase tracking-widest font-black bg-black/40 px-2 py-0.5 rounded border border-white/10">
                          PROTECTED
                        </span>
                        <BookOpen className="w-4 h-4 text-white/70" />
                      </div>

                      <div className="space-y-1.5 pl-2 z-10">
                        <h3 className="font-serif text-lg font-extrabold leading-snug line-clamp-2 tracking-tight group-hover:text-white transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-xs text-white/75 font-medium italic truncate">
                          by {book.author}
                        </p>
                      </div>

                      <div className="flex justify-between items-end pl-2 z-10 text-[9px] text-white/50 border-t border-white/10 pt-2">
                        <span>{book.ownerDisplayName}</span>
                        <span className="font-mono">{sizeMB} MB</span>
                      </div>
                    </div>

                    {/* Meta info & actions */}
                    <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {book.description || "An immersive literature sandbox publication."}
                      </p>
                      
                      <div className="flex justify-between items-center text-[11px] text-gray-500 border-t border-white/5 pt-3">
                        <span className="font-mono">{dateString}</span>
                        <div className="flex items-center gap-1.5">
                          {isOwnBook && (
                            <button
                              onClick={(e) => handleDelete(e, book)}
                              className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-200"
                              title="Delete Publication"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            className="px-3 py-1.5 rounded-full bg-[#B026FF]/10 border border-[#B026FF]/20 text-[#00F0FF] group-hover:bg-[#B026FF] group-hover:text-white transition-all duration-300 font-bold text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Read
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ────────────────── PROTECTED FULL-SCREEN READER MODAL ────────────────── */}
      <AnimatePresence>
        {activeBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black flex flex-col select-none"
            onContextMenu={(e) => e.preventDefault()} // Block right click
          >
            {/* Top Toolbar */}
            <div className="bg-[#0A0A0F] border-b border-white/10 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeReader}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all border border-white/5"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight">
                    {activeBook.title}
                  </h2>
                  <p className="text-xs text-[#00F0FF] font-medium tracking-wide flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Lock className="w-3 h-3" />
                    <span>Protected Sandbox Mode</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-400">Downloads Blocked</span>
                    <span className="text-gray-600">•</span>
                    <span className="bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-transparent bg-clip-text font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border border-[#B026FF]/30">
                      {scrollProgress}% Read
                    </span>
                  </p>
                </div>
              </div>

              {/* Reader Adjustments */}
              <div className="flex items-center gap-4">
                {/* Theme select (Only for built-in text reading) */}
                {readerMode === "text" && activeBook.content && (
                  <div className="flex items-center bg-white/5 rounded-xl p-0.5 border border-white/5">
                    {(["sepia", "charcoal", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setReaderTheme(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                          readerTheme === t
                            ? "bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-white"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Font sizing (Only for built-in text reading) */}
                {readerMode === "text" && activeBook.content && (
                  <div className="flex items-center bg-white/5 rounded-xl border border-white/5 divide-x divide-white/5">
                    <button
                      onClick={() => setReaderFontSize((f) => Math.max(12, f - 2))}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 font-bold"
                    >
                      A-
                    </button>
                    <button
                      onClick={() => setReaderFontSize((f) => Math.min(28, f + 2))}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 font-bold"
                    >
                      A+
                    </button>
                  </div>
                )}

                {/* Bookmarks Toggle */}
                <button
                  onClick={() => setShowBookmarksSidebar((prev) => !prev)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    showBookmarksSidebar
                      ? "bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-white border-transparent shadow-lg shadow-[#B026FF]/20"
                      : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <BookmarkIcon className={`w-3.5 h-3.5 ${showBookmarksSidebar ? "fill-white" : ""}`} />
                  <span>Bookmarks ({activeBookmarks.length})</span>
                </button>

                <button
                  onClick={closeReader}
                  className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Reading Progress Bar */}
            <div className="w-full h-1 bg-white/5 relative z-40 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${scrollProgress}%` }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#B026FF] to-[#00F0FF]"
              />
            </div>

            {/* Immersive Protected Container */}
            <div className="flex-1 w-full flex relative overflow-hidden">
              
              {/* Main Reader Viewport */}
              <div className="flex-1 h-full flex flex-col justify-between relative overflow-hidden bg-black">
                {/* If it is in PDF mode, render the PDF viewer */}
                {readerMode === "pdf" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center relative">
                    {/* Glassmorphic Safety Overlay covering the native PDF controls top bar area */}
                    <div className="absolute top-0 left-0 right-0 h-14 bg-black/60 backdrop-blur-md flex items-center justify-center z-30 px-6 border-b border-white/10 select-none pointer-events-none">
                      <div className="flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
                        <Lock className="w-4 h-4 text-[#00F0FF] animate-pulse" />
                        <span>🔒 SECURE SANDBOX READING CANVAS • PREVENT DIRECT DOWNLOADING</span>
                      </div>
                    </div>

                    {/* PDF Viewer */}
                    {pdfBlobUrl ? (
                      <iframe
                        src={`${pdfBlobUrl}#page=${readerPage + 1}&toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full bg-[#121214] border-none"
                        title={activeBook.title}
                        id="secure-pdf-iframe"
                      />
                    ) : (
                      <div className="text-center p-8 flex flex-col items-center justify-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B026FF]"></div>
                        <p className="text-xs text-gray-400">Loading secure digital edition...</p>
                      </div>
                    )}

                    {/* If in an iframe/sandbox and the browser blocks embeds, give them a seamless direct tab reader fallback */}
                    {pdfBlobUrl && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 bg-[#0A0A0F]/90 border border-white/10 px-5 py-4 rounded-2xl backdrop-blur-md shadow-2xl text-center max-w-sm">
                        <p className="text-[11px] text-gray-400 font-medium leading-normal">
                          Secure CloudFront content delivery has been optimized for this browser canvas. Direct downloading is strictly disabled.
                        </p>
                        <div className="flex items-center gap-1.5 text-[#00F0FF] text-xs font-bold font-mono">
                          <Lock className="w-3.5 h-3.5 animate-pulse" /> DOWNLOAD PROTECTED BY DRM
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Beautifully formatted Epub/Simulated chapter book reader */
                  <div
                    ref={readerScrollContainerRef}
                    onScroll={handleScroll}
                    className={`w-full h-full flex flex-col justify-between p-8 transition-colors duration-300 overflow-y-auto ${
                      readerTheme === "sepia"
                        ? "bg-[#FAF4E8] text-[#433422]"
                        : readerTheme === "charcoal"
                        ? "bg-[#141416] text-[#E4E4E7]"
                        : "bg-[#FFFFFF] text-[#1F2937]"
                    }`}
                  >
                    <div className="max-w-2xl mx-auto flex-1 flex flex-col justify-center py-6">
                      {/* Chapter Page Content */}
                      <div
                        className="font-serif leading-relaxed space-y-6 select-text whitespace-pre-line"
                        style={{ fontSize: `${readerFontSize}px` }}
                      >
                        {activeBook.content && activeBook.content[readerPage]}
                      </div>
                    </div>

                    {/* Book Pagination & Footer controls */}
                    <div className="max-w-2xl mx-auto w-full flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-4 text-xs font-semibold select-none">
                      <button
                        disabled={readerPage === 0}
                        onClick={() => setReaderPage((p) => p - 1)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
                          readerTheme === "sepia"
                            ? "hover:bg-black/5 text-[#433422]/80 hover:text-[#433422]"
                            : readerTheme === "charcoal"
                            ? "hover:bg-white/5 text-[#E4E4E7]/80 hover:text-[#E4E4E7]"
                            : "hover:bg-black/5 text-[#1F2937]/80 hover:text-[#1F2937]"
                        } ${readerPage === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </button>
                      <span className="font-mono opacity-80">
                        Page {readerPage + 1} of {activeBook.content?.length || 1}
                      </span>
                      <button
                        disabled={readerPage === (activeBook.content?.length || 1) - 1}
                        onClick={() => setReaderPage((p) => p + 1)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
                          readerTheme === "sepia"
                            ? "hover:bg-black/5 text-[#433422]/80 hover:text-[#433422]"
                            : readerTheme === "charcoal"
                            ? "hover:bg-white/5 text-[#E4E4E7]/80 hover:text-[#E4E4E7]"
                            : "hover:bg-black/5 text-[#1F2937]/80 hover:text-[#1F2937]"
                        } ${readerPage === (activeBook.content?.length || 1) - 1 ? "opacity-30 cursor-not-allowed" : ""}`}
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Bookmarks Sidebar */}
              <AnimatePresence>
                {showBookmarksSidebar && (
                  <motion.div
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 220 }}
                    className="w-80 h-full border-l border-white/10 bg-[#0A0A0F]/95 backdrop-blur-md flex flex-col z-20 shrink-0 relative"
                  >
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookmarkIcon className="w-4 h-4 text-[#B026FF] fill-[#B026FF]/20" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-white">
                          Saved Positions
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowBookmarksSidebar(false)}
                        className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Add Form */}
                    <div className="p-4 border-b border-white/10 space-y-3 bg-white/[0.01]">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                        <span>Current Location:</span>
                        <span className="text-[#00F0FF] font-bold bg-[#00F0FF]/10 px-2 py-0.5 rounded">
                          Page {readerPage + 1}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newBookmarkLabel}
                          onChange={(e) => setNewBookmarkLabel(e.target.value)}
                          placeholder="Optional short note (e.g., Chapter 2 start)"
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#B026FF] transition-colors"
                          maxLength={45}
                        />
                        <button
                          onClick={() => {
                            if (!activeBook) return;
                            let finalLabel = newBookmarkLabel.trim();
                            if (!finalLabel) {
                              if (readerMode === "text" && activeBook.content && activeBook.content[readerPage]) {
                                const text = activeBook.content[readerPage].trim();
                                const firstLine = text.split("\n")[0].trim();
                                finalLabel = firstLine.length > 35 ? firstLine.substring(0, 35) + "..." : firstLine;
                              } else {
                                finalLabel = `Saved Position at Page ${readerPage + 1}`;
                              }
                            }
                            addBookmark(activeBook.id, readerPage, finalLabel);
                            setNewBookmarkLabel("");
                            loadActiveBookmarks();
                          }}
                          className="w-full py-2 bg-gradient-to-r from-[#B026FF] to-[#00F0FF] rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Bookmark This Page</span>
                        </button>
                      </div>
                    </div>

                    {/* Bookmarks List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                      {activeBookmarks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-12 space-y-2">
                          <BookmarkIcon className="w-8 h-8 opacity-20 text-[#B026FF]" />
                          <p className="text-xs font-medium text-gray-400">No saved positions yet</p>
                          <p className="text-[10px] opacity-60 leading-normal max-w-[180px]">
                            Bookmark pages to easily save and jump back to key sections.
                          </p>
                        </div>
                      ) : (
                        [...activeBookmarks]
                          .sort((a, b) => a.pageIndex - b.pageIndex)
                          .map((bm) => {
                            const isCurrent = readerPage === bm.pageIndex;
                            return (
                              <div
                                key={bm.id}
                                onClick={() => setReaderPage(bm.pageIndex)}
                                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5 text-left relative group ${
                                  isCurrent
                                    ? "bg-[#B026FF]/10 border-[#B026FF]/30 shadow-[0_0_15px_rgba(176,38,255,0.05)]"
                                    : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-mono font-bold text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded">
                                    Page {bm.pageIndex + 1}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteBookmark(bm.id);
                                      loadActiveBookmarks();
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/15 text-gray-400 hover:text-red-500 transition-all"
                                    title="Delete bookmark"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className={`text-xs ${isCurrent ? "text-white font-semibold" : "text-gray-300"}`}>
                                  {bm.label}
                                </p>
                                <span className="text-[9px] text-gray-500 font-mono">
                                  {new Date(bm.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern custom confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-[#0A0A0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Delete Publication
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono">
                    This action is irreversible
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="ml-auto w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Are you sure you want to remove the publication <span className="font-bold text-white italic">"{deleteTarget.title}"</span> from your catalog?
                </p>
                <p className="text-[11px] text-gray-500 leading-normal bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                  This will permanently delete the metadata and its associated secure binary content from your IndexedDB workspace sandbox.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 text-xs font-bold hover:bg-white/10 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-red-900/20"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
