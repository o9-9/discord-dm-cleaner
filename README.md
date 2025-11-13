# oxy-dm-cleaner

Discord özel mesajlarını (DM) verimli bir şekilde temizlemek için bir araç.

## Ana Özellikler ve Faydalar

- **Verimli DM Temizliği:** Discord’daki mesajları hızlıca silebilirsiniz.  
- **Özelleştirilebilir Silme:** Performansı optimize etmek için silme gecikmelerini ayarlayabilirsiniz.  
- **Oran Sınırı Yönetimi:** Discord’un oran sınırlarını (rate limit) otomatik olarak yönetir.  
- **Hata Kurtarma:** Başarısız silme girişimlerini otomatik olarak yeniden dener.  
- **Kullanıcı Dostu:** Komut satırı arayüzü üzerinden kolay kurulum ve kullanım sağlar.

## Gerekli Ön Koşullar

Başlamadan önce aşağıdakilerin kurulu olduğundan emin olun:

- **Node.js:** [https://nodejs.org/](https://nodejs.org/) (sürüm 20 veya üzeri önerilir)  
- **npm** (Node Package Manager, genellikle Node.js ile birlikte gelir)

## Kurulum ve Başlangıç

1. **Depoyu klonlayın:**

   ```bash
   git clone https://github.com/hasbutcu/oxy-dm-cleaner.git
   cd oxy-dm-cleaner
   ```

2. **Bağımlılıkları yükleyin:**

   ```bash
   npm install
   ```

3. **Discord Token’ınızı alın:**

   - Discord’u tarayıcınızda açın.  
   - Geliştirici araçlarını açın (genellikle F12 tuşuyla).  
   - “Network” sekmesine gidin.  
   - Discord’u yenileyin.  
   - Filtre kutusuna “messages” yazın.  
   - Mesaj içeren bir isteği seçin.  
   - “Headers” sekmesinde “Authorization” başlığını bulun. Değeri sizin token’ınızdır. *Bu bilgiyi kimseyle paylaşmayın!*

4. **`oxy.js` dosyasını oluşturun/düzenleyin (gerekirse):**  
   Token’ınızın doğru şekilde dosyaya eklendiğinden emin olun.

## Kullanım

1. **Temizleyiciyi çalıştırın:**

   Windows için `start.bat` dosyasını çalıştırabilir veya Node.js ile doğrudan başlatabilirsiniz:

   ```bash
   node oxy.js
   ```

2. **Komut Satırı Arayüzü ile Etkileşim:**

   Komut satırı, sizden Discord token’ınızı isteyecek ve mesaj silme seçeneklerini sunacaktır. Ekrandaki yönergeleri izleyin.

## Katkıda Bulunma

Katkılar memnuniyetle karşılanır!  
Katkıda bulunmak için:

1. Depoyu çatallayın (fork).  
2. Yeni bir dal (branch) oluşturun.  
3. Değişikliklerinizi yapın ve açıklayıcı mesajlarla commit edin.  
4. Bir pull request gönderin.

## Lisans

Bu proje MIT Lisansı ile lisanslanmıştır — ayrıntılar için `LICENSE` dosyasına bakın.


