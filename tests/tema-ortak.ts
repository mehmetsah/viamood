/**
 * Tema yaması testleri için ORTAK yardımcılar — #995986 k3b (22 Kas 2026).
 *
 * NEDEN: tema testleri paketlerin gerçek `yama.py`'sini koşturuyor, ama yorumlayıcıyı
 * `'python3'` olarak SABİT yazmışlardı. Bu Windows makinesinde PATH'te yalnız `python`
 * var (`python3` → "Python bulunamadı", çıkış 49), bu yüzden `yama.py` koşturan her tema
 * testi kalıcı kırıktı. Aynı düzeltmeyi 9 dosyaya kopyalamamak için tek kaynak burada.
 *
 * SATIR SONU: paketlerin `md5.json`'u LF md5 tutar ve Shopify'a LF gider (bkz. kök
 * `.gitattributes` → `tema-yamalari/** text eol=lf`, ve `bas.py`'nin PUT öncesi CR kapısı).
 * `lf()` ikinci bir güvence: hem CRLF ile checkout edilmiş bir dosyayı, hem de alt sürecin
 * Windows metin kipinde `\n` → `\r\n` çevirdiği stdout'u LF'e indirir.
 *
 * Bu dosya `*.test.ts` değil → vitest onu test olarak toplamaz (vitest.config.ts include).
 */
import { execFileSync } from 'node:child_process';

/** CRLF ve tek başına CR → LF. */
export const lf = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

/**
 * Alt süreç olarak koşan Python'un çıktısı UTF-8 olsun.
 * Windows konsolu cp1254 olduğundan `print('çapa …')` çıktısı aksi hâlde bozuk gelir
 * (testler Türkçe DUR mesajlarını birebir karşılaştırıyor). Bu dosyayı içe alan her test
 * dosyası için bir kez yeterli: `execFileSync` varsayılan olarak `process.env`'i devralır,
 * kendi `env`'ini verenler de `{ ...process.env }` ile yayıyor.
 * (`yamaKos` ayrıca `-X utf8` geçer; o `-I` yalıtık kipte koştuğu için PYTHON* değişkenlerini
 * görmez — bu yüzden iki yol birbirinin yedeği.)
 */
process.env.PYTHONUTF8 = '1';
process.env.PYTHONIOENCODING = 'utf-8';

/**
 * Bu makinede gerçekten koşan Python yorumlayıcısı.
 * Windows'ta `python` önce denenir: bazı kurulumlarda `python3` yalnızca Microsoft Store'u
 * açan bir takma addır. Diğer platformlarda (sunucu/CI) `python3` önce gelir.
 */
export const PYTHON: string = (() => {
  const adaylar = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  for (const aday of adaylar) {
    try {
      execFileSync(aday, ['-c', 'pass'], { stdio: 'ignore' });
      return aday;
    } catch {
      /* sıradakini dene */
    }
  }
  throw new Error('python bulunamadı; denenenler: ' + adaylar.join(', '));
})();

/** `-c` ile verilen koddan önce koşan önsöz: paket dizinini yola ekler, yama'yı içe alır. */
const ONSOZ = 'import sys; sys.path.insert(0, sys.argv[1]); import yama\n';
/** `-I` yalıtık kip; `-X utf8` komut satırından geldiği için `-I`'ya takılmaz (Türkçe çıktı). */
const BAYRAK = ['-I', '-X', 'utf8', '-B', '-c'];

/**
 * `paket` dizinindeki GERÇEK `yama.py`'yi içe alıp `kod`'u koşturur.
 * stdout LF'e indirilmiş metin olarak döner (Windows metin kipi `\n` → `\r\n` yapar).
 * Python hata verirse `execFileSync` fırlatır — testler bunu `.toThrow(...)` ile bekler.
 */
export const yamaKos = (paket: string, kod: string, girdi = ''): string =>
  lf(execFileSync(PYTHON, [...BAYRAK, ONSOZ + kod, paket], {
    input: girdi,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  }));

/**
 * Aynısı ama HAM stdout (Buffer) — satır sonlarına DOKUNULMAZ.
 * LF güvencesini sınayan testler bunu kullanır; `yamaKos` oradaki CR'yi gizlerdi.
 * Kodun `sys.stdout.buffer.write(...)` kullanması gerekir (metin kipi yine çevirirdi).
 */
export const yamaKosHam = (paket: string, kod: string, girdi = ''): Buffer =>
  execFileSync(PYTHON, [...BAYRAK, ONSOZ + kod, paket], {
    input: Buffer.from(girdi, 'utf8'),
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  }) as Buffer;
