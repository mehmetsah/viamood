/* #994887 · via-kaynak-izi — trafik kaynağını (UTM + yönlendiren + giriş yolu) yakalar.
   İlk dokunuş bir kez yazılır, ASLA ezilmez. Son dokunuş yalnız ANLAMLI bir gelişte
   (UTM / reklam tıklaması / yeni oturumda dış site) güncellenir; aynı oturumdaki iç
   gezinme ve 3D ödeme dönüşü (banka alan adı yönlendiren olur) son dokunuşu EZMEZ.
   KVKK: tam URL değil alan adı, sorgu dizesi değil yol, tıklama kimliğinin değeri değil türü. */
(function (w) {
  var ANAHTAR = 'via_kaynak_v1', OTURUM = 'via_kaynak_oturum';
  var UTM = { utm_source: 'kaynak', utm_medium: 'ortam', utm_campaign: 'kampanya', utm_content: 'icerik', utm_term: 'terim' };
  var TIKLAMA = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'];
  /* İç alanlar + ödeme/API dönüş alanları: bunlardan gelen ziyaret yeni kaynak DEĞİLDİR. */
  var IC_ALAN = ['viamood.com.tr', 'via-mood.myshopify.com', 'amazonaws.com', 'iyzipay.com', 'paytr.com', 'halkode.com.tr'];

  function temiz(s) {
    s = String(s == null ? '' : s);
    try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { s = s.replace(/%[0-9a-f]{0,2}/gi, ' '); }
    return s.replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').slice(0, 100);
  }
  function sorgu(arama) {
    var o = {}, p = String(arama || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < p.length; i++) {
      if (!p[i]) continue;
      var j = p[i].indexOf('='), a = (j < 0 ? p[i] : p[i].slice(0, j)).toLowerCase();
      if (!(a in o)) o[a] = j < 0 ? '' : p[i].slice(j + 1);
    }
    return o;
  }
  function alanAdi(url) {
    var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:@]+)/i.exec(String(url || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function icMi(h, kendi) {
    if (!h) return true;
    var liste = IC_ALAN.concat(kendi ? [kendi.toLowerCase().replace(/^www\./, '')] : []);
    h = h.replace(/^www\./, '');
    for (var i = 0; i < liste.length; i++) {
      if (h === liste[i] || h.slice(-(liste[i].length + 1)) === '.' + liste[i]) return true;
    }
    return false;
  }

  /* Bu sayfa görüntülemesinden çıkan dokunuş. */
  function dokunus(konum, yonlendiren, simdi) {
    var q = sorgu(konum.search), d = { kaynak: '', ortam: '', kampanya: '', icerik: '', terim: '', yonlendiren: '', giris: '', tiklama: '', tarih: simdi };
    var utmVar = false;
    for (var k in UTM) if (q[k] != null) { var v = temiz(q[k]); if (v) { d[UTM[k]] = v; utmVar = true; } }
    if (d.kaynak) d.kaynak = d.kaynak.toLowerCase();
    if (d.ortam) d.ortam = d.ortam.toLowerCase();
    for (var i = 0; i < TIKLAMA.length; i++) if (q[TIKLAMA[i]] != null) { d.tiklama = TIKLAMA[i]; break; }
    var h = alanAdi(yonlendiren);
    if (!icMi(h, konum.hostname)) d.yonlendiren = h;
    d.giris = String(konum.pathname || '/').slice(0, 200);
    d.utmVar = utmVar;
    return d;
  }

  function oku(depo) {
    try { var o = JSON.parse(depo.getItem(ANAHTAR) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  }

  /* Yakala + sakla. Depo yazılamıyorsa (gizli sekme vb.) yalnız bellekte tutulur. */
  function yakala(ortam) {
    var konum = ortam.konum, yerel = ortam.yerel, oturum = ortam.oturum;
    var d = dokunus(konum, ortam.yonlendiren, ortam.simdi);
    var yeniOturum = true;
    try { yeniOturum = !oturum.getItem(OTURUM); oturum.setItem(OTURUM, '1'); } catch (e) {}
    var anlamli = d.utmVar || !!d.tiklama || (yeniOturum && !!d.yonlendiren);
    delete d.utmVar;
    var kayit = oku(yerel) || { ilk: null, son: null };
    if (!kayit.ilk) kayit.ilk = d;
    if (anlamli || !kayit.son) kayit.son = d;
    try { yerel.setItem(ANAHTAR, JSON.stringify(kayit)); } catch (e) {}
    return kayit;
  }

  /* Safari gizli sekme / çerez engeli: depoya ERİŞİM bile istisna fırlatabilir. */
  function depo(ad) { try { return w[ad] || null; } catch (e) { return null; } }
  var bellek = null;
  w.viaKaynak = {
    yakala: yakala,
    oku: function () { return oku(depo('localStorage')) || bellek; }
  };
  try {
    bellek = yakala({
      konum: w.location, yonlendiren: w.document ? w.document.referrer : '',
      yerel: depo('localStorage'), oturum: depo('sessionStorage'), simdi: new Date().toISOString()
    });
  } catch (e) {}
})(window);
