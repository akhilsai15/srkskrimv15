/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiClient } from '../apiClient';
import { uploadToS3 } from '../services/s3Upload';

export interface Book {
  id: string;
  ownerUsername: string;
  ownerDisplayName: string;
  title: string;
  author: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: number;
  dataUrl?: string; // For uploaded PDF base64 / blob URLs
  pdfUrl?: string;  // CloudFront PDF URLs
  description?: string;
  coverColor: string; // Tailwind gradient/solid bg class
  content?: string[]; // Array of pages/chapters for built-in text reading
}

const DEFAULT_BOOKS: Book[] = [
  {
    id: "b_art_of_war",
    ownerUsername: "@system",
    ownerDisplayName: "Skrim Library",
    title: "The Art of War",
    author: "Sun Tzu",
    fileName: "the_art_of_war.pdf",
    pdfUrl: "https://d1skrimchatlib.cloudfront.net/books/the_art_of_war.pdf",
    sizeBytes: 45200,
    uploadedAt: 1782136400000,
    description: "An ancient Chinese military treatise dating from the Late Spring and Autumn Period. The work, which is attributed to the ancient Chinese military strategist Sun Tzu, is composed of 13 chapters.",
    coverColor: "from-red-900 to-black text-red-100 border-red-800/30",
    content: [
      "CHAPTER I: Laying Plans\n\nSun Tzu said: The art of war is of vital importance to the State.\n\nIt is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.\n\nThe art of war, then, is governed by five constant factors, to be taken into account in one's deliberations, when seeking to determine the conditions obtaining in the field.\n\nThese are: (1) The Moral Law; (2) Heaven; (3) Earth; (4) The Commander; (5) Method and discipline.",
      "CHAPTER II: Waging War\n\nSun Tzu said: In the operations of war, where there are in the field a thousand swift chariots, as many heavy chariots, and a hundred thousand mail-clad soldiers, with provisions enough to carry them a thousand li, the expenditure at home and at the front, including entertainment of guests, small items such as glue and paint, and sums spent on chariots and armor, will reach the total of a thousand ounces of silver per day. Such is the cost of raising an army of 100,000 men.\n\nWhen you engage in actual fighting, if victory is long in coming, then men's weapons will grow dull and their ardor will be damped. If you lay siege to a town, you will exhaust your strength.",
      "CHAPTER III: Attack by Stratagem\n\nSun Tzu said: In the practical art of war, the best thing of all is to take the enemy's country whole and intact; to shatter and destroy it is not so good. So, too, it is better to recapture an army entire than to destroy it, to capture a regiment, a detachment or a company entire than to destroy them.\n\nHence to fight and conquer in all your battles is not supreme excellence; supreme excellence consists in breaking the enemy's resistance without fighting."
    ]
  },
  {
    id: "b_scandal_bohemia",
    ownerUsername: "@system",
    ownerDisplayName: "Skrim Library",
    title: "A Scandal in Bohemia",
    author: "Arthur Conan Doyle",
    fileName: "scandal_in_bohemia.pdf",
    pdfUrl: "https://d1skrimchatlib.cloudfront.net/books/scandal_in_bohemia.pdf",
    sizeBytes: 124000,
    uploadedAt: 1782136400000,
    description: "The first of Arthur Conan Doyle's Sherlock Holmes short stories, featuring the famous detective's duel of wits with Irene Adler, the woman who outsmarted him.",
    coverColor: "from-indigo-950 to-slate-900 text-indigo-100 border-indigo-800/30",
    content: [
      "I.\n\nTo Sherlock Holmes she is always THE woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.\n\nHe was, I take it, the most perfect reasoning and observing machine that the world has seen, but as a lover he would have placed himself in a false position. He never spoke of the softer passions, save with a gibe and a sneer.",
      "II.\n\nIt was on the night of the twentieth of March, 1888, that I was returning from a journey to a patient (for I had now returned to civil practice), when my way led me through Baker Street. As I passed the well-remembered door, which must always be associated in my mind with my wooing, and with the dark incidents of the Study in Scarlet, I was seized with a keen desire to see Holmes again, and to know how he was employing his extraordinary powers. His rooms were brilliantly lit, and, even as I looked up, I saw his tall, spare figure pass twice in a dark silhouette against the blind."
    ]
  },
  {
    id: "b_gatsby",
    ownerUsername: "@system",
    ownerDisplayName: "Skrim Library",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    fileName: "the_gatsby.pdf",
    pdfUrl: "https://d1skrimchatlib.cloudfront.net/books/the_gatsby.pdf",
    sizeBytes: 154000,
    uploadedAt: 1782136400000,
    description: "The classic 1925 novel following a cast of characters living in the fictional towns of West Egg and East Egg on prosperous Long Island in the summer of 1922.",
    coverColor: "from-amber-950 via-yellow-950 to-black text-amber-100 border-amber-900/30",
    content: [
      "CHAPTER I\n\nIn my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.\n\n\"Whenever you feel like criticizing any one,\" he told me, \"just remember that all the people in this world haven't had the advantages that you've had.\"\n\nHe didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.",
      "CHAPTER II\n\nAbout half-way between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile, so as to shrink away from a certain desolate area of land. This is a valley of ashes—a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens; where ashes take the forms of houses and chimneys and rising smoke and, finally, with a transcendent effort, of men who move dimly and already crumbling through the powdery air."
    ]
  }
];

export function getStoredBooks(): Book[] {
  if (typeof window === 'undefined') return DEFAULT_BOOKS;
  const raw = localStorage.getItem('skrimchat_books');
  if (!raw) {
    localStorage.setItem('skrimchat_books', JSON.stringify(DEFAULT_BOOKS));
    return DEFAULT_BOOKS;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_BOOKS;
  }
}

export async function getStoredBooksAsync(): Promise<Book[]> {
  try {
    return await apiClient.get<Book[]>('/books');
  } catch (err) {
    console.warn("TODO: Real backend GET /books not ready yet. Returning cached/local books.", err);
    return getStoredBooks();
  }
}

export function saveStoredBooks(books: Book[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('skrimchat_books', JSON.stringify(books));
    window.dispatchEvent(new Event('skrimchat_books_updated'));
  }
}

export async function saveStoredBooksAsync(books: Book[]): Promise<void> {
  try {
    await apiClient.post('/books/sync', { books });
  } catch (err) {
    console.warn("TODO: Real backend POST /books/sync not ready yet.", err);
  }
  saveStoredBooks(books);
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEXEDDB BINARY STORAGE MANAGER FOR LARGE PDF PUBLICATIONS
// ─────────────────────────────────────────────────────────────────────────────
const DB_NAME = "SkrimChatLibraryDB";
const STORE_NAME = "pdf_blobs";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storePDFBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPDFBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePDFBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function addBookWithBlob(bookMeta: Omit<Book, 'id' | 'uploadedAt' | 'dataUrl'>, fileBlob: Blob): Promise<Book> {
  const id = 'b_' + Math.random().toString(36).substr(2, 9);
  
  try {
    const uploadResult = await uploadToS3(fileBlob, 'books-media', id, bookMeta.fileName || 'publication.pdf');
    const s3Url = uploadResult.url;

    const bookPayload = {
      ...bookMeta,
      dataUrl: s3Url,
    };
    const created = await apiClient.post<Book>('/books', bookPayload);
    return created;
  } catch (err) {
    console.warn("S3 books-media upload/save flow failed, falling back to local storage", err);
  }

  await storePDFBlob(id, fileBlob);
  
  const books = getStoredBooks();
  const newBook: Book = {
    ...bookMeta,
    id,
    uploadedAt: Date.now(),
  };
  books.unshift(newBook);
  saveStoredBooks(books);
  
  return newBook;
}

export function addBook(book: Omit<Book, 'id' | 'uploadedAt'>): Book {
  const books = getStoredBooks();
  const newBook: Book = {
    ...book,
    id: 'b_' + Math.random().toString(36).substr(2, 9),
    uploadedAt: Date.now(),
  };
  books.unshift(newBook);
  saveStoredBooks(books);
  return newBook;
}

export async function addBookAsync(book: Omit<Book, 'id' | 'uploadedAt'>): Promise<Book> {
  try {
    return await apiClient.post<Book>('/books', book);
  } catch (err) {
    console.warn("TODO: Real backend POST /books not ready. Using local fallback.", err);
    return addBook(book);
  }
}

export function deleteBook(id: string): boolean {
  const books = getStoredBooks();
  const filtered = books.filter(b => b.id !== id);
  if (filtered.length !== books.length) {
    saveStoredBooks(filtered);
    deletePDFBlob(id).catch(err => console.error("Failed to delete PDF blob from IndexedDB:", err));
    
    const bookmarks = getBookmarks();
    const remainingBookmarks = bookmarks.filter(b => b.bookId !== id);
    saveBookmarks(remainingBookmarks);
    
    return true;
  }
  return false;
}

export async function deleteBookAsync(id: string): Promise<boolean> {
  try {
    await apiClient.delete(`/books/${id}`);
    return true;
  } catch (err) {
    console.warn("TODO: Real backend DELETE /books/:id not ready. Using local fallback.", err);
    return deleteBook(id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKMARKS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
export interface Bookmark {
  id: string;
  bookId: string;
  pageIndex: number;
  label: string;
  createdAt: number;
}

export function getBookmarks(bookId?: string): Bookmark[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('skrimchat_bookmarks');
  if (!raw) return [];
  try {
    const all: Bookmark[] = JSON.parse(raw);
    if (bookId) {
      return all.filter(b => b.bookId === bookId);
    }
    return all;
  } catch (e) {
    return [];
  }
}

export async function getBookmarksAsync(bookId?: string): Promise<Bookmark[]> {
  try {
    const url = bookId ? `/books/bookmarks?bookId=${bookId}` : '/books/bookmarks';
    return await apiClient.get<Bookmark[]>(url);
  } catch (err) {
    console.warn("TODO: Real backend GET /books/bookmarks not ready. Returning local bookmarks.", err);
    return getBookmarks(bookId);
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('skrimchat_bookmarks', JSON.stringify(bookmarks));
    window.dispatchEvent(new Event('skrimchat_bookmarks_updated'));
  }
}

export async function saveBookmarksAsync(bookmarks: Bookmark[]): Promise<void> {
  try {
    await apiClient.post('/books/bookmarks/sync', { bookmarks });
  } catch (err) {
    console.warn("TODO: Real backend POST /books/bookmarks/sync not ready.", err);
  }
  saveBookmarks(bookmarks);
}

export function addBookmark(bookId: string, pageIndex: number, label: string): Bookmark {
  const bookmarks = getBookmarks();
  const existingIndex = bookmarks.findIndex(b => b.bookId === bookId && b.pageIndex === pageIndex);
  if (existingIndex !== -1) {
    bookmarks[existingIndex].label = label;
    bookmarks[existingIndex].createdAt = Date.now();
    saveBookmarks(bookmarks);
    return bookmarks[existingIndex];
  }

  const newBookmark: Bookmark = {
    id: 'bm_' + Math.random().toString(36).substr(2, 9),
    bookId,
    pageIndex,
    label,
    createdAt: Date.now()
  };
  bookmarks.push(newBookmark);
  saveBookmarks(bookmarks);
  return newBookmark;
}

export async function addBookmarkAsync(bookId: string, pageIndex: number, label: string): Promise<Bookmark> {
  try {
    return await apiClient.post<Bookmark>('/books/bookmarks', { bookId, pageIndex, label });
  } catch (err) {
    console.warn("TODO: Real backend POST /books/bookmarks not ready. Falling back to local.", err);
    return addBookmark(bookId, pageIndex, label);
  }
}

export function deleteBookmark(id: string): void {
  const bookmarks = getBookmarks();
  const filtered = bookmarks.filter(b => b.id !== id);
  saveBookmarks(filtered);
}

export async function deleteBookmarkAsync(id: string): Promise<void> {
  try {
    await apiClient.delete(`/books/bookmarks/${id}`);
  } catch (err) {
    console.warn("TODO: Real backend DELETE /books/bookmarks/:id not ready. Falling back to local.", err);
    deleteBookmark(id);
  }
}


