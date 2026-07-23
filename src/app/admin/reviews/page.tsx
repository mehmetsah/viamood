/**
 * Admin — Müşteri Yorumları Moderasyonu + Manuel Ekleme.
 *
 * İKİ yetenek:
 *  1) MODERASYON: müşteri formundan gelen yorumlar 'pending' → Yayınla/Reddet.
 *  2) MANUEL EKLEME (Göknil): isim/puan/metin/ürün + GÖRSEL yükleme → doğrudan 'approved'.
 *     Görsel Shopify Files'a yüklenir (uploadImageToShopifyFiles), CDN url'i image_url'e yazılır.
 *
 * Admin route `src/app/admin/layout.tsx` ile korunuyor (role admin/super_admin).
 */
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { reviews } from '@/db/schema/reviews';
import { uploadImageToShopifyFiles } from '@/lib/shopify/upload-image';

export const dynamic = 'force-dynamic';

async function moderate(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  const action = String(formData.get('action') ?? '');
  if (!id || !['approved', 'rejected'].includes(action)) return;
  await db
    .update(reviews)
    .set({ status: action, moderatedAt: new Date().toISOString() })
    .where(eq(reviews.id, id));
  revalidatePath('/admin/reviews');
}

/** Göknil / admin — panelden manuel yorum ekle (doğrudan yayında). */
async function addReview(formData: FormData) {
  'use server';
  const authorName = String(formData.get('isim') ?? '').trim().slice(0, 80);
  const body = String(formData.get('metin') ?? '').trim().slice(0, 1000);
  const rating = Math.max(1, Math.min(5, Number(formData.get('puan')) || 5));
  const location = String(formData.get('konum') ?? '').trim().slice(0, 60) || null;
  const productTitle = String(formData.get('urun') ?? '').trim().slice(0, 160) || null;
  const verifiedBuyer = formData.get('dogrulanmis') === 'on';
  if (authorName.length < 2 || body.length < 5) return;

  let imageUrl: string | null = null;
  const file = formData.get('gorsel');
  if (file && typeof file === 'object' && 'size' in file && (file as File).size > 0) {
    const f = file as File;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const up = await uploadImageToShopifyFiles(bytes, f.name || 'yorum.jpg', f.type || 'image/jpeg');
    if (up.ok) imageUrl = up.url;
  }

  await db.insert(reviews).values({
    source: 'seed',
    status: 'approved',
    authorName,
    location,
    rating,
    body,
    productTitle,
    imageUrl,
    verifiedBuyer,
    moderatedAt: new Date().toISOString(),
  });
  revalidatePath('/admin/reviews');
}

interface PageProps {
  searchParams: Promise<{ durum?: string }>;
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const durum = sp.durum && ['pending', 'approved', 'rejected'].includes(sp.durum) ? sp.durum : 'pending';

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.status, durum))
    .orderBy(desc(reviews.createdAt))
    .limit(100);

  const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #ddd2c2', fontSize: 14, background: '#fff' } as const;
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6a655d', marginBottom: 5 } as const;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Müşteri Yorumları</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>Müşteri yorumları onaya düşer; “Yayınla” dedikten sonra anasayfada görünür. Panelden manuel eklenen yorumlar doğrudan yayına girer.</p>

      {/* ===== MANUEL EKLEME (Göknil) ===== */}
      <details style={{ marginBottom: 24, border: '1px solid #e7dfd5', borderRadius: 14, background: '#fffdf9' }}>
        <summary style={{ padding: '14px 16px', fontWeight: 700, cursor: 'pointer', color: '#f06436' }}>➕ Panelden yorum ekle (doğrudan yayında)</summary>
        <form action={addReview} style={{ padding: 16, borderTop: '1px solid #eee', display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>İsim *</label><input name="isim" required style={inputStyle} placeholder="Örn. Ayşe K. / Via Mood Müşterisi" /></div>
            <div><label style={labelStyle}>Konum (opsiyonel)</label><input name="konum" style={inputStyle} placeholder="İstanbul" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Puan</label>
              <select name="puan" defaultValue="5" style={inputStyle}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Ürün adı (opsiyonel)</label><input name="urun" style={inputStyle} placeholder="Çamaşır Sepeti / Düzenleyici" /></div>
          </div>
          <div><label style={labelStyle}>Yorum metni *</label><textarea name="metin" required rows={3} style={inputStyle} placeholder="Yorum metnini yaz..." /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div><label style={labelStyle}>Görsel (opsiyonel — Shopify'a yüklenir)</label><input type="file" name="gorsel" accept="image/*" style={{ fontSize: 13 }} /></div>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" name="dogrulanmis" defaultChecked /> Doğrulanmış rozeti</label>
          </div>
          <button style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#f06436', color: '#fff', fontWeight: 700, cursor: 'pointer', justifySelf: 'start' }}>Yorumu ekle ve yayınla</button>
        </form>
      </details>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <a
            key={s}
            href={`/admin/reviews?durum=${s}`}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid #ddd',
              textDecoration: 'none',
              color: durum === s ? '#fff' : '#333',
              background: durum === s ? '#f06436' : '#fff',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {s === 'pending' ? 'Beklemede' : s === 'approved' ? 'Yayında' : 'Reddedilen'}
          </a>
        ))}
      </nav>

      {rows.length === 0 && <p style={{ color: '#999' }}>Bu durumda yorum yok.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((r) => (
          <article key={r.id} style={{ border: '1px solid #e7dfd5', borderRadius: 14, padding: 16, background: '#fffdf9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <strong>{r.authorName}</strong>{' '}
                <span style={{ color: '#f0a636' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                {r.verifiedBuyer && <span style={{ marginLeft: 8, fontSize: 11, color: '#f06436', fontWeight: 700 }}>✔ Doğrulanmış</span>}
                {r.source === 'seed' && <span style={{ marginLeft: 8, fontSize: 11, color: '#5e725d', fontWeight: 700 }}>SEED</span>}
                <div style={{ fontSize: 12, color: '#888' }}>
                  {[r.location, r.productTitle, r.customerEmail].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {durum !== 'approved' && (
                  <form action={moderate}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="action" value="approved" />
                    <button style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#5e725d', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Yayınla</button>
                  </form>
                )}
                {durum !== 'rejected' && (
                  <form action={moderate}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="action" value="rejected" />
                    <button style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#c0392b', fontWeight: 600, cursor: 'pointer' }}>Reddet</button>
                  </form>
                )}
              </div>
            </div>
            <p style={{ margin: '10px 0 0', lineHeight: 1.6, color: '#3c3934' }}>{r.body}</p>
            {r.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.imageUrl} alt="" style={{ marginTop: 10, maxWidth: 180, borderRadius: 8 }} />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
