/** Storefront içerik sayfaları (hakkımızda, iletişim, sözleşmeler) — varsayılan içerik.
 *  İleride store_settings.theme.pages ile düzenlenebilir olacak; bu dosya fallback/varsayilan. */

export interface SitePage {
  slug: string;
  title: string;
  html: string;
}

const COMPANY = {
  name: 'Via Glocal Dış Tic. Ltd. Şti.',
  brand: 'Via Mood',
  vergiNo: '9250770472',
  address: 'Bostan Mh. Kaşkaval Sk. No:23 Beyoğlu / İstanbul',
  phone: '0553 170 71 32',
  email: 'viahomedecor25@gmail.com',
};

export const SITE_PAGES: SitePage[] = [
  {
    slug: 'hakkimizda',
    title: 'Hakkımızda',
    html: `
<p>${COMPANY.brand}, mutfak, banyo, dolap içi ve günlük yaşam alanlarınız için pratik düzenleyici ve saklama çözümleri sunan bir markadır. İstanbul / Beyoğlu'ndan tüm Türkiye'ye hizmet veriyoruz.</p>
<p>Amacımız; evinizin her köşesini daha düzenli, işlevsel ve estetik kılan, günlük rutini kolaylaştıran ürünleri özenle seçip sizinle buluşturmak. Her ürünü kalite, kullanışlılık ve fiyat dengesi gözeterek belirliyoruz.</p>
<h2>Neden Via Mood?</h2>
<ul>
<li>Seçkin üreticilerden, özenle seçilmiş ürünler</li>
<li>Türkiye geneline hızlı ve güvenli kargo</li>
<li>Kapıda ödeme ve güvenli online ödeme seçenekleri</li>
<li>Müşteri memnuniyeti odaklı kolay iade</li>
</ul>
<p>Sorularınız için bize her zaman <a href="/sayfa/iletisim">iletişim</a> sayfamızdan ulaşabilirsiniz.</p>`,
  },
  {
    slug: 'iletisim',
    title: 'İletişim',
    html: `
<p>Bize aşağıdaki kanallardan ulaşabilirsiniz. Mesajlarınıza en kısa sürede dönüş yapıyoruz.</p>
<ul>
<li><strong>Telefon / WhatsApp:</strong> <a href="tel:+905531707132">${COMPANY.phone}</a></li>
<li><strong>E-posta:</strong> <a href="mailto:${COMPANY.email}">${COMPANY.email}</a></li>
<li><strong>Instagram:</strong> <a href="https://instagram.com/viamood.store" target="_blank" rel="noopener">@viamood.store</a></li>
<li><strong>Adres:</strong> ${COMPANY.address}</li>
</ul>
<p><strong>Firma:</strong> ${COMPANY.name} · Vergi No: ${COMPANY.vergiNo}</p>
<p>Çalışma saatleri: Hafta içi 09:00 – 18:00</p>`,
  },
  {
    slug: 'mesafeli-satis-sozlesmesi',
    title: 'Mesafeli Satış Sözleşmesi',
    html: `
<h2>1. Taraflar</h2>
<p>İşbu sözleşme, SATICI ${COMPANY.name} (${COMPANY.address}, Vergi No: ${COMPANY.vergiNo}) ile ALICI (sipariş veren müşteri) arasında, aşağıda belirtilen şartlar dahilinde elektronik ortamda kurulmuştur.</p>
<h2>2. Konu</h2>
<p>İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait <strong>${COMPANY.brand}</strong> internet sitesinden elektronik ortamda siparişini verdiği ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.</p>
<h2>3. Ürün ve Ödeme</h2>
<p>Ürünlerin cinsi, adedi, satış fiyatı, ödeme şekli ve teslimat bilgileri sipariş onayında belirtildiği gibidir. Ödeme; kredi/banka kartı, havale/EFT veya kapıda ödeme yöntemleriyle yapılabilir.</p>
<h2>4. Teslimat</h2>
<p>Ürün, ALICI'nın sipariş sırasında bildirdiği adrese anlaşmalı kargo firması ile teslim edilir. Teslimat süresi, sipariş onayından itibaren ortalama 1-5 iş günüdür.</p>
<h2>5. Cayma Hakkı</h2>
<p>ALICI, malın tesliminden itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Cayma hakkının kullanımı için <a href="/sayfa/iletisim">iletişim</a> kanallarımızdan bildirimde bulunulması yeterlidir.</p>
<h2>6. Genel Hükümler</h2>
<p>ALICI, siparişi onaylamakla işbu sözleşmenin tüm şartlarını kabul etmiş sayılır. Uyuşmazlıklarda Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.</p>`,
  },
  {
    slug: 'iade-ve-teslimat',
    title: 'İade ve Teslimat Koşulları',
    html: `
<h2>Teslimat</h2>
<p>Siparişleriniz, ödeme onayının ardından ortalama <strong>1-5 iş günü</strong> içinde anlaşmalı kargo firmaları ile adresinize gönderilir. Kargo takip bilgisi, ürün kargoya verildiğinde e-posta ile iletilir.</p>
<p>Türkiye genelinde kargo imkânı sunuyoruz. Belirli tutar üzeri siparişlerde <strong>ücretsiz kargo</strong> uygulanır.</p>
<h2>İade ve Değişim</h2>
<p>Teslim aldığınız üründen memnun kalmazsanız, teslimat tarihinden itibaren <strong>14 gün</strong> içinde iade edebilirsiniz. İade edilecek ürünün kullanılmamış, orijinal ambalajında ve faturasıyla birlikte olması gerekir.</p>
<ul>
<li>İade talebinizi <a href="/sayfa/iletisim">iletişim</a> kanallarımızdan iletin.</li>
<li>Onay sonrası ürünü anlaşmalı kargoyla tarafımıza gönderin.</li>
<li>Ürün tarafımıza ulaşıp kontrol edildikten sonra ödeme iadesi 1-7 iş günü içinde yapılır.</li>
</ul>
<h2>Hasarlı / Yanlış Ürün</h2>
<p>Hasarlı veya yanlış ürün tesliminde kargo ücreti tarafımıza aittir; ürün ücretsiz değiştirilir veya bedeli iade edilir.</p>`,
  },
  {
    slug: 'gizlilik-politikasi',
    title: 'Gizlilik Politikası',
    html: `
<p>${COMPANY.brand} olarak kişisel verilerinizin güvenliğine önem veriyoruz. İşbu Gizlilik Politikası, ${COMPANY.brand} internet sitesini kullanırken toplanan bilgilerin nasıl işlendiğini açıklar.</p>
<h2>Toplanan Bilgiler</h2>
<p>Sipariş ve üyelik sırasında ad-soyad, iletişim, teslimat/fatura adresi ve sipariş bilgileriniz işlenir. Ödeme bilgileriniz (kart numarası vb.) tarafımızca saklanmaz; ödeme, güvenli ödeme altyapısı (İyzico/PayTR) üzerinden hosted/iframe ortamında alınır.</p>
<h2>Bilgilerin Kullanımı</h2>
<p>Bilgileriniz; siparişinizin işlenmesi, teslimatın sağlanması, müşteri desteği ve yasal yükümlülüklerin yerine getirilmesi amacıyla kullanılır. Açık rızanız olmadan üçüncü taraflarla pazarlama amacıyla paylaşılmaz.</p>
<h2>Çerezler</h2>
<p>Site deneyimini iyileştirmek için çerezler kullanılabilir. Tarayıcı ayarlarınızdan çerezleri yönetebilirsiniz.</p>
<h2>Güvenlik</h2>
<p>Verileriniz, yetkisiz erişime karşı uygun teknik ve idari tedbirlerle korunur. Sorularınız için <a href="/sayfa/iletisim">iletişim</a> kanallarımızdan bize ulaşabilirsiniz.</p>`,
  },
  {
    slug: 'kvkk',
    title: 'KVKK Aydınlatma Metni',
    html: `
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, veri sorumlusu sıfatıyla ${COMPANY.name} tarafından kişisel verilerinizin işlenmesine ilişkin aydınlatma metnidir.</p>
<h2>İşlenen Veriler ve Amaç</h2>
<p>Kimlik, iletişim, adres ve sipariş/işlem bilgileriniz; sözleşmenin kurulması ve ifası, sipariş ve teslimat süreçlerinin yürütülmesi, müşteri ilişkileri yönetimi ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.</p>
<h2>Hukuki Sebep</h2>
<p>Verileriniz; bir sözleşmenin kurulması/ifası, hukuki yükümlülük ve meşru menfaat hukuki sebeplerine dayanılarak işlenir.</p>
<h2>Aktarım</h2>
<p>Verileriniz; kargo firmaları, ödeme kuruluşları ve yasal olarak yetkili kurumlarla, yalnızca işbu amaçlarla sınırlı olarak paylaşılabilir.</p>
<h2>Haklarınız (KVKK md. 11)</h2>
<p>Kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini/silinmesini isteme ve KVKK md. 11'de sayılan diğer haklarınızı, <a href="mailto:${COMPANY.email}">${COMPANY.email}</a> adresine başvurarak kullanabilirsiniz.</p>
<p><strong>Veri Sorumlusu:</strong> ${COMPANY.name} · ${COMPANY.address} · Vergi No: ${COMPANY.vergiNo}</p>`,
  },
];

export function getSitePage(slug: string): SitePage | undefined {
  return SITE_PAGES.find((p) => p.slug === slug);
}
