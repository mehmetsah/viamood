'use client';

import { useActionState, useState, useTransition } from 'react';
import { changePasswordAction, updateProfileAction } from '@/lib/actions/customer';
import { saveNotifPrefs, type NotifPrefs } from '@/lib/actions/prefs';
import { type ActionResult } from '@/lib/actions/auth';

function Banner({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.success)
    return (
      <p
        style={{
          fontSize: 13,
          color: 'var(--vh-iyi)',
          background: 'var(--vh-iyi-zemin)',
          borderRadius: 8,
          padding: '8px 12px',
          margin: '0 0 12px',
        }}
      >
        Kaydedildi ✓
      </p>
    );
  if (!state.fieldErrors)
    return (
      <p
        style={{
          fontSize: 13,
          color: 'var(--vh-kotu)',
          background: 'var(--vh-kotu-zemin)',
          borderRadius: 8,
          padding: '8px 12px',
          margin: '0 0 12px',
        }}
      >
        {state.error}
      </p>
    );
  return null;
}

function Toggle({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="vh-tercih">
      <div>
        <b>{label}</b>
        <span>{hint}</span>
      </div>
      <button
        type="button"
        className="vh-anahtar"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
      />
    </div>
  );
}

export function ProfileForms({
  initialName,
  initialPhone,
  email,
  initialPrefs,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
  initialPrefs: NotifPrefs;
}) {
  const [pState, pAction, pPending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => updateProfileAction(fd),
    null as ActionResult | null,
  );
  const [wState, wAction, wPending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => changePasswordAction(fd),
    null as ActionResult | null,
  );
  const pErr = pState && !pState.success ? pState.fieldErrors ?? {} : {};
  const wErr = wState && !wState.success ? wState.fieldErrors ?? {} : {};

  const [prefs, setPrefs] = useState<NotifPrefs>({
    campaign: initialPrefs.campaign ?? true,
    sms: initialPrefs.sms ?? true,
    whatsapp: initialPrefs.whatsapp ?? false,
  });
  const [, startSave] = useTransition();
  const [kayitli, setKayitli] = useState(false);

  function tercihDegis(key: keyof NotifPrefs) {
    const yeni = { ...prefs, [key]: !prefs[key] };
    setPrefs(yeni);
    startSave(async () => {
      await saveNotifPrefs(yeni);
      setKayitli(true);
      setTimeout(() => setKayitli(false), 1500);
    });
  }

  return (
    <>
      {/* Kişisel bilgiler */}
      <form action={pAction} className="vh-kart vh-form">
        <h2>Kişisel bilgiler</h2>
        <div className="vh-alanlar">
          <div className="vh-alan">
            <label htmlFor="pf-email">E-posta</label>
            <input id="pf-email" value={email} disabled />
          </div>
          <div className="vh-alan">
            <label htmlFor="pf-tel">Telefon</label>
            <input
              id="pf-tel"
              name="phone"
              defaultValue={initialPhone}
              autoComplete="tel"
              placeholder="5XX XXX XX XX"
            />
          </div>
          <div className="vh-alan" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="pf-ad">Ad Soyad</label>
            <input id="pf-ad" name="name" defaultValue={initialName} required autoComplete="name" />
            {pErr.name ? (
              <span style={{ color: 'var(--vh-kotu)', fontSize: 12 }}>{pErr.name}</span>
            ) : null}
          </div>
        </div>
        <Banner state={pState} />
        <div className="vh-form-alt">
          <button type="submit" className="vh-btn vh-btn-dolu" disabled={pPending}>
            {pPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>

      {/* Şifre */}
      <form action={wAction} className="vh-kart vh-form">
        <h2>Şifre</h2>
        <div className="vh-alanlar">
          <div className="vh-alan">
            <label htmlFor="pf-eski">Mevcut şifre</label>
            <input
              id="pf-eski"
              name="current"
              type="password"
              required
              autoComplete="current-password"
            />
            {wErr.current ? (
              <span style={{ color: 'var(--vh-kotu)', fontSize: 12 }}>{wErr.current}</span>
            ) : null}
          </div>
          <div className="vh-alan">
            <label htmlFor="pf-yeni">Yeni şifre</label>
            <input
              id="pf-yeni"
              name="next"
              type="password"
              required
              autoComplete="new-password"
              placeholder="En az 8 karakter"
            />
            {wErr.next ? (
              <span style={{ color: 'var(--vh-kotu)', fontSize: 12 }}>{wErr.next}</span>
            ) : null}
          </div>
          <div className="vh-alan" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="pf-yeni2">Yeni şifre (tekrar)</label>
            <input
              id="pf-yeni2"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
            />
            {wErr.confirm ? (
              <span style={{ color: 'var(--vh-kotu)', fontSize: 12 }}>{wErr.confirm}</span>
            ) : null}
          </div>
        </div>
        <Banner state={wState} />
        <div className="vh-form-alt">
          <button type="submit" className="vh-btn vh-btn-bos" disabled={wPending}>
            {wPending ? 'Güncelleniyor…' : 'Şifreyi Değiştir'}
          </button>
        </div>
      </form>

      {/* Bildirim tercihleri */}
      <div className="vh-kart vh-form">
        <h2>
          Bildirim tercihleri{' '}
          {kayitli ? (
            <span style={{ fontSize: 12, color: 'var(--vh-iyi)', fontWeight: 400 }}>· kaydedildi ✓</span>
          ) : null}
        </h2>
        <Toggle
          label="Kampanya e-postaları"
          hint="Yeni ürünler ve sana özel indirimler"
          checked={!!prefs.campaign}
          onToggle={() => tercihDegis('campaign')}
        />
        <Toggle
          label="Sipariş SMS'leri"
          hint="Kargo çıkışı ve teslimat bildirimleri"
          checked={!!prefs.sms}
          onToggle={() => tercihDegis('sms')}
        />
        <Toggle
          label="WhatsApp bildirimleri"
          hint="Sipariş durumun WhatsApp'tan da gelsin"
          checked={!!prefs.whatsapp}
          onToggle={() => tercihDegis('whatsapp')}
        />
      </div>

      {/* Tehlike bölgesi */}
      <div className="vh-kart vh-form vh-tehlike">
        <h2>Hesabı kapat</h2>
        <p>
          Hesabını kapatmak istiyorsan destek ekibimizle iletişime geç — talebin 48 saat içinde
          işleme alınır. Sipariş geçmişin ve kişisel bilgilerin kalıcı olarak silinir.
        </p>
        <a
          className="vh-btn-tehlike"
          href="mailto:destek@viamood.com?subject=Hesap%20kapatma%20talebi"
        >
          Hesap kapatma talebi gönder
        </a>
      </div>
    </>
  );
}
