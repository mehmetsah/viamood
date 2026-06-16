'use client';

import { useRef, useState } from 'react';

/**
 * Shopify-vari ürün görsel galerisi: sürükle-bırak yükleme (çoklu), thumbnail grid,
 * sürükle-sırala + ←/→ butonları (öne/geriye), sil, ilk görsel = kapak.
 * Hidden input'lar: `images` (JSON dizi) + `featuredImageUrl` (ilk) → form ile gönderilir.
 */
export function ProductImageGallery({
  defaultImages = [],
  name = 'images',
}: {
  defaultImages?: string[];
  name?: string;
}) {
  const [images, setImages] = useState<string[]>(defaultImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const res = await fetch('/api/admin/product-images/upload', { method: 'POST', body: fd });
      const data = (await res.json()) as { urls?: string[]; errors?: string[] };
      const newUrls = data.urls ?? [];
      if (newUrls.length) setImages((prev) => [...prev, ...newUrls]);
      if (data.errors?.length) setError(data.errors.join(' · '));
      else if (!newUrls.length) setError('Yükleme başarısız');
    } catch (e) {
      setError('Bağlantı hatası: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setUploading(false);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    setImages((prev) => {
      const a = [...prev];
      const [x] = a.splice(from, 1);
      if (x === undefined) return prev;
      a.splice(to, 0, x);
      return a;
    });
  }
  function remove(i: number) {
    setImages((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(images)} />
      <input type="hidden" name="featuredImageUrl" value={images[0] ?? ''} />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          dragOver
            ? 'border-[var(--color-brand-orange)] bg-orange-50'
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-sm font-medium text-neutral-700">
          {uploading ? '⏳ Yükleniyor…' : '📷 Görselleri buraya sürükle veya tıklayıp seç'}
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          PNG / JPG / WebP · birden fazla seçebilirsin · ilk görsel kapak olur
        </p>
      </div>
      {error && <p className="text-xs text-red-600 mt-2 break-words">{error}</p>}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
          {images.map((url, i) => (
            <div
              key={`${url}-${i}`}
              draggable
              onDragStart={() => {
                dragIndex.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null && dragIndex.current !== i) move(dragIndex.current, i);
                dragIndex.current = null;
              }}
              className="relative group aspect-square rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden cursor-grab"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">
                  Kapak
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between items-center bg-black/55 opacity-0 group-hover:opacity-100 transition px-1 py-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="text-white text-sm px-1 disabled:opacity-30 hover:text-orange-300"
                  title="Öne al"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-white text-sm px-1 hover:text-red-400"
                  title="Sil"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === images.length - 1}
                  className="text-white text-sm px-1 disabled:opacity-30 hover:text-orange-300"
                  title="Geriye al"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
