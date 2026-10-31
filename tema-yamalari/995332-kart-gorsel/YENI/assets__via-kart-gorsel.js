/* #995332 · ayse:802 · ÜRÜN KARTI GÖRSELİ — BEYAZ ÇERÇEVEYİ PROGRAMATİK KIRP + SIĞDIR
   Ürün fotoğraflarının çoğu paketi geniş beyaz zemin üstünde taşıyor (ölçüm 29 Eki: 33 üründe
   beyaz çerçeve medyan %36, 15 üründe > %40) ve oranları 0,667–1,0 arasında değişiyor. Kap tek oranda
   (2/3) olsa da paketler farklı boyda görünüyordu. Bu betik her kart görselinin beyaz olmayan içerik
   kutusunu küçük bir tuvalde ölçer, görseli `scale` + `translate` ile içerik kutuya aynı payla
   (%6) oturacak şekilde büyütür. Ürün medyasına DOKUNMAZ; görsel dosyası aynen kalır.
   Ölçülemeyen görselde (CORS, boş, şeffaf) hiçbir şey yapmaz → `object-fit: contain` kalır.
   Kapatma: URL'ye `via_kirp=0` eklenirse betik çalışmaz (önizlemede karşılaştırma için).
   Ayak 2 (29 Eki): koleksiyon/kategori kartı `.vkol2-media img` de aynı seçiciye alındı
   (sections/via-koleksiyon-v2.liquid). Ölçek sınırları DEĞİŞMEDİ — hedef sığdırmak, büyütmek değil. */
(function () {
  if (/[?&]via_kirp=0(?:&|$)/.test(location.search)) return;
  var PAY = 0.06, ESIK = 18, OLCU = 64, EN_AZ = 1, EN_COK = 3;
  var SECICI = '.product-card .product-media__image, .vkol2-media img';
  var tuval = document.createElement('canvas');
  var cx = tuval.getContext('2d', { willReadFrequently: true });

  function icerikKutusu(img) {
    var nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh || !cx) return null;
    var k = OLCU / Math.max(nw, nh), w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
    tuval.width = w; tuval.height = h;
    cx.clearRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    var d;
    try { d = cx.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      if (d[i + 3] < 16) continue;
      if (255 - d[i] > ESIK || 255 - d[i + 1] > ESIK || 255 - d[i + 2] > ESIK) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    return { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h, oran: nw / nh };
  }

  function yerlestir(img) {
    var b = img._viaKutu, W = img.offsetWidth, H = img.offsetHeight;
    if (!b || !W || !H) return;
    // object-fit: contain altında görselin kap içindeki yeri
    var dw = W, dh = W / b.oran;
    if (dh > H) { dh = H; dw = H * b.oran; }
    var ox = (W - dw) / 2, oy = (H - dh) / 2;
    var cw = (b.x1 - b.x0) * dw, ch = (b.y1 - b.y0) * dh;
    var ccx = ox + (b.x0 + b.x1) / 2 * dw, ccy = oy + (b.y0 + b.y1) / 2 * dh;
    var s = Math.min(W * (1 - 2 * PAY) / cw, H * (1 - 2 * PAY) / ch);
    s = Math.max(EN_AZ, Math.min(EN_COK, s));
    img.style.scale = s.toFixed(4);
    img.style.translate = (-s * (ccx - W / 2)).toFixed(1) + 'px ' + (-s * (ccy - H / 2)).toFixed(1) + 'px';
    img.dataset.viaKirp = s.toFixed(2);
  }

  function isle(img) {
    if (!img.complete || !img.naturalWidth) return;
    var b = icerikKutusu(img);
    if (!b) { img.dataset.viaKirp = 'yok'; return; }
    img._viaKutu = b;
    yerlestir(img);
  }

  function bagla(img) {
    if (img._viaBagli) return;
    img._viaBagli = true;
    img.addEventListener('load', function () { isle(img); });
    isle(img);
  }

  function tara() { document.querySelectorAll(SECICI).forEach(bagla); }

  var bekleyen = 0;
  new MutationObserver(function () {
    if (bekleyen) return;
    bekleyen = requestAnimationFrame(function () { bekleyen = 0; tara(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  var ro = 0;
  addEventListener('resize', function () {
    clearTimeout(ro);
    ro = setTimeout(function () { document.querySelectorAll(SECICI).forEach(yerlestir); }, 120);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tara); else tara();
})();
