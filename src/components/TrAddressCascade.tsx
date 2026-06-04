'use client';

/**
 * TR İl/İlçe/Mahalle cascading address picker.
 *
 * - İl: 81 il'den select
 * - İlçe: seçilen il'in ilçelerinden select
 * - Mahalle: serbest metin (datalist eklenebilir runtime'da)
 *
 * Controlled component — value/onChange ile çalışır.
 */
import { useEffect, useMemo, useState } from 'react';
import { ILLER, getIlceler } from '@/lib/tr-addresses';

export interface TrAddressValue {
  province: string;
  district: string;
  neighborhood: string;
}

interface Props {
  value: TrAddressValue;
  onChange: (v: TrAddressValue) => void;
  required?: boolean;
  disabled?: boolean;
  /** Form name prefix — name'leri customize etmek için */
  namePrefix?: string;
  className?: string;
}

export function TrAddressCascade({
  value,
  onChange,
  required = false,
  disabled = false,
  namePrefix = 'address',
  className = '',
}: Props) {
  const [provinceText, setProvinceText] = useState(value.province);

  // Sync external value changes to internal
  useEffect(() => {
    setProvinceText(value.province);
  }, [value.province]);

  const ilceler = useMemo(() => {
    return value.province ? getIlceler(value.province) : [];
  }, [value.province]);

  function setProvince(v: string) {
    setProvinceText(v);
    onChange({ province: v, district: '', neighborhood: value.neighborhood });
  }
  function setDistrict(v: string) {
    onChange({ ...value, district: v });
  }
  function setNeigh(v: string) {
    onChange({ ...value, neighborhood: v });
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
      <label className="block">
        <span className="text-xs font-semibold mb-1 block uppercase tracking-wider text-neutral-600">
          İl {required && <span className="text-red-500">*</span>}
        </span>
        <select
          name={`${namePrefix}[province]`}
          value={provinceText}
          onChange={(e) => setProvince(e.target.value)}
          required={required}
          disabled={disabled}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-neutral-100 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none"
        >
          <option value="">Seçiniz…</option>
          {ILLER.map((il) => (
            <option key={il.kod} value={il.ad}>
              {il.ad}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold mb-1 block uppercase tracking-wider text-neutral-600">
          İlçe {required && <span className="text-red-500">*</span>}
        </span>
        <select
          name={`${namePrefix}[district]`}
          value={value.district}
          onChange={(e) => setDistrict(e.target.value)}
          required={required}
          disabled={disabled || !value.province}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-neutral-100 disabled:text-neutral-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none"
        >
          <option value="">{value.province ? 'Seçiniz…' : 'Önce il seçin…'}</option>
          {ilceler.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold mb-1 block uppercase tracking-wider text-neutral-600">
          Mahalle / Semt
        </span>
        <input
          type="text"
          name={`${namePrefix}[neighborhood]`}
          value={value.neighborhood}
          onChange={(e) => setNeigh(e.target.value)}
          placeholder="Mahalle veya semt adı"
          autoComplete="address-level3"
          disabled={disabled}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none"
        />
      </label>
    </div>
  );
}
