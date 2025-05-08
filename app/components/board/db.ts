// src/utils/db.ts
import type { StickyNoteData, TextNoteData, DrawLineData, ImageItemData, PanOffset } from "@/components/board/constants";

export interface DashboardStorageDataV2 {
  notes: StickyNoteData[];
  texts: TextNoteData[];
  lines: DrawLineData[];
  images: ImageItemData[];
  panOffset: PanOffset;
  zoomLevel: number;
}

const DB_NAME = "DashboardDB_V1";
const DB_VERSION = 1;

const STORE_NOTES = "notes";
const STORE_TEXTS = "texts";
const STORE_LINES = "lines";
const STORE_IMAGES = "images";
const STORE_CONFIG = "config";

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      console.error("IndexedDB not supported!");
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_TEXTS)) {
        db.createObjectStore(STORE_TEXTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_LINES)) {
        db.createObjectStore(STORE_LINES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
      dbPromise = null;
    };
  });
  return dbPromise;
};

export const saveDataToDB = async (data: DashboardStorageDataV2): Promise<{ success: boolean; message: string }> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NOTES, STORE_TEXTS, STORE_LINES, STORE_IMAGES, STORE_CONFIG], "readwrite");

    const notesStore = transaction.objectStore(STORE_NOTES);
    const textsStore = transaction.objectStore(STORE_TEXTS);
    const linesStore = transaction.objectStore(STORE_LINES);
    const imagesStore = transaction.objectStore(STORE_IMAGES);
    const configStore = transaction.objectStore(STORE_CONFIG);

    notesStore.clear();
    textsStore.clear();
    linesStore.clear();
    imagesStore.clear();
    configStore.clear();

    data.notes.forEach((note) => notesStore.put(note));
    data.texts.forEach((text) => textsStore.put(text));
    data.lines.forEach((line) => linesStore.put(line));
    data.images.forEach((image) => imagesStore.put(image));

    configStore.put({ panOffset: data.panOffset, zoomLevel: data.zoomLevel }, "mainConfig");

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve({ success: true, message: "データをIndexedDBに保存しました" });
      };
      transaction.onerror = () => {
        console.error("Transaction error on save:", transaction.error);
        reject({ success: false, message: `IndexedDBへの保存に失敗しました: ${transaction.error?.message}` });
      };
      transaction.onabort = () => {
        console.error("Transaction aborted on save:", transaction.error);
        reject({ success: false, message: `IndexedDBへの保存が中断されました: ${transaction.error?.message}` });
      };
    });
  } catch (error) {
    console.error("Failed to save to IndexedDB:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `IndexedDBへの保存準備中にエラーが発生しました: ${message}` };
  }
};

export const loadDataFromDB = async (): Promise<DashboardStorageDataV2> => {
  const defaultState: DashboardStorageDataV2 = {
    notes: [],
    texts: [],
    lines: [],
    images: [],
    panOffset: { x: 0, y: 0 },
    zoomLevel: 1,
  };

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NOTES, STORE_TEXTS, STORE_LINES, STORE_IMAGES, STORE_CONFIG], "readonly");

    const notesStore = transaction.objectStore(STORE_NOTES);
    const textsStore = transaction.objectStore(STORE_TEXTS);
    const linesStore = transaction.objectStore(STORE_LINES);
    const imagesStore = transaction.objectStore(STORE_IMAGES);
    const configStore = transaction.objectStore(STORE_CONFIG);

    const notesRequest = notesStore.getAll();
    const textsRequest = textsStore.getAll();
    const linesRequest = linesStore.getAll();
    const imagesRequest = imagesStore.getAll();
    const configRequest = configStore.get("mainConfig");

    return new Promise((resolve, reject) => {
      let resultsCount = 0;
      const totalRequests = 5;
      const loadedData: Partial<DashboardStorageDataV2> = {};

      const checkCompletion = () => {
        resultsCount++;
        if (resultsCount === totalRequests) {
          resolve({
            notes: loadedData.notes || [],
            texts: loadedData.texts || [],
            lines: loadedData.lines || [],
            images: loadedData.images || [],
            panOffset: loadedData.panOffset || defaultState.panOffset,
            zoomLevel: loadedData.zoomLevel === undefined ? defaultState.zoomLevel : loadedData.zoomLevel,
          });
        }
      };

      const createRequestHandler = <T>(request: IDBRequest<T>, dataKey: keyof Partial<DashboardStorageDataV2>) => {
        request.onsuccess = () => {
          (loadedData[dataKey] as T) = request.result;
          checkCompletion();
        };
        request.onerror = () => {
          console.error(`Error loading ${String(dataKey)}:`, request.error);
          (loadedData[dataKey] as T) = defaultState[dataKey as keyof DashboardStorageDataV2] as T;
          checkCompletion();
        };
      };

      createRequestHandler(notesRequest, "notes");
      createRequestHandler(textsRequest, "texts");
      createRequestHandler(linesRequest, "lines");
      createRequestHandler(imagesRequest, "images");

      configRequest.onsuccess = () => {
        const config = configRequest.result;
        if (config) {
          loadedData.panOffset = config.panOffset;
          loadedData.zoomLevel = config.zoomLevel;
        }
        checkCompletion();
      };
      configRequest.onerror = () => {
        console.error("Error loading config:", configRequest.error);
        checkCompletion();
      };

      transaction.onerror = () => {
        console.error("Transaction error during load:", transaction.error);
        resolve(defaultState);
      };
      transaction.onabort = () => {
        console.error("Transaction aborted during load:", transaction.error);
        resolve(defaultState);
      };
    });
  } catch (error) {
    console.error("Failed to load from IndexedDB:", error);
    return defaultState
  }
};
