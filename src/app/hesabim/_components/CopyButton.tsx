'use client';

import { useState } from 'react';

export function CopyButton({
  value,
  className = 'vh-btn vh-btn-bos',
  label = 'Kopyala',
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        });
      }}
    >
      {ok ? 'Kopyalandı ✓' : label}
    </button>
  );
}
