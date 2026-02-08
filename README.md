<div align="center">

# 🌐 CDN IP Scanner Pro

**High accuracy • Ultra fast • AI powered ⚡**

**دقت بالا • فوق‌سریع • هوشمند ⚡**

---

### 🛠 Technologies & Stack

<a href="https://www.python.org/" target="_blank"><img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"></a>
<a href="https://docs.python.org/3/library/tkinter.html" target="_blank"><img src="https://img.shields.io/badge/Tkinter-GUI-2D2D2D?style=for-the-badge&logo=python&logoColor=white" alt="Tkinter"></a>
<a href="https://requests.readthedocs.io/" target="_blank"><img src="https://img.shields.io/badge/Requests-HTTP-00A884?style=for-the-badge&logo=requests&logoColor=white" alt="Requests"></a>
<a href="https://openpyxl.readthedocs.io/" target="_blank"><img src="https://img.shields.io/badge/Openpyxl-Excel-217346?style=for-the-badge&logo=microsoft-excel&logoColor=white" alt="Openpyxl"></a>
<a href="https://docs.python.org/3/library/ipaddress.html" target="_blank"><img src="https://img.shields.io/badge/ipaddress-Networks-4B8BBE?style=for-the-badge&logo=python&logoColor=white" alt="ipaddress"></a>
<a href="https://urllib3.readthedocs.io/" target="_blank"><img src="https://img.shields.io/badge/urllib3-SSL-006699?style=for-the-badge&logo=python&logoColor=white" alt="urllib3"></a>
<a href="https://github.com/shahinst/cdn-ip-scanner/blob/main/version" target="_blank"><img src="https://img.shields.io/badge/Version-1.6-6C5CE7?style=for-the-badge" alt="Version"></a>
<a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License"></a>

</div>

---

## 📖 About | دربارهٔ پروژه

<table>
<tr>
<td width="50%">

### English

**CDN IP Scanner Pro** is a desktop application for finding the best CDN (e.g. Cloudflare) IPs for your connection. It supports multiple scan methods, operator-based IP ranges (Iran, China, Russia), and exports to Excel, JSON, and TXT.

- Choose language: **English**, **Persian (فارسی)**, **Chinese (中文)**, **Russian (Русский)**  
- Fetch IP ranges from Cloudflare/Fastly APIs or ASN  
- Scan by **cloud ranges** or by **mobile operator IP ranges** (Iran, China, Russia)  
- AI-powered analysis and scoring  
- Save results to Excel (xlsx), JSON, or TXT  
- Built-in update checker and one-click update from GitHub  

</td>
<td width="50%">

### فارسی

**CDN IP Scanner Pro** یک برنامهٔ دسکتاپ برای پیدا کردن بهترین آی‌پی‌های CDN (مثل کلودفلیر) برای اتصال شماست. چند روش اسکن، رنج آی‌پی اپراتورها (ایران، چین، روسیه) و خروجی اکسل، JSON و TXT را پشتیبانی می‌کند.

- انتخاب زبان: **انگلیسی**، **فارسی**، **چینی**، **روسی**  
- دریافت رنج آی‌پی از API یا ASN کلودفلیر/فستلی  
- اسکن با **رنج کلود** یا **رنج آی‌پی اپراتورهای موبایل** (ایران، چین، روسیه)  
- تحلیل و امتیازدهی هوشمند  
- ذخیرهٔ نتایج در اکسل (xlsx)، JSON یا TXT  
- بررسی بروزرسانی و بروزرسانی یک‌کلیکه از گیت‌هاب  

</td>
</tr>
</table>

---

## ✨ Features | قابلیت‌ها

| Feature | English | فارسی |
|--------|---------|--------|
| **Multi-language** | EN, FA, ZH, RU | چندزبانگی (انگلیسی، فارسی، چینی، روسی) |
| **Scan methods** | Cloud, Operator ranges, V2rayN (soon) | اسکن کلود، رنج اپراتورها، V2rayN (به‌زودی) |
| **Operator countries** | Iran, China, Russia (EN: choose country) | ایران، چین، روسیه |
| **Fetch ranges** | Cloudflare API/ASN/GitHub, Fastly API/ASN | دریافت از API/ASN کلودفلیر و فستلی |
| **AI Analyze** | Score IPs and suggest best ranges | امتیاز و پیشنهاد بهترین رنج‌ها |
| **Export** | Excel (xlsx), JSON, TXT | خروجی اکسل، JSON، TXT |
| **Ports** | Configurable (443, 80, 8443, …) | پورت‌های قابل تنظیم |
| **Ping filter** | Min/Max ping (ms) | فیلتر حداقل/حداکثر پینگ |
| **Update** | Check version & update from GitHub | بررسی نسخه و بروزرسانی از گیت‌هاب |
| **Theme** | Dark/Light (theme.json) | تم تیره/روشن |

---

## 🚀 Installation & Run | نصب و اجرا

### English

1. **Requirements:** Python 3.10+  
2. **Clone or download** this repository.  
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Run:**
   ```bash
   python ip_scanner_pro.py
   ```
   Or double-click **Scanner_Pro.bat** (Windows).  

   **Standalone EXE (Windows):** Use the built `CDN_IP_Scanner_Pro.exe` from the `ScannerPro_exe` folder — no Python needed. Run the EXE; a loading screen with progress bar will appear, then the main window.

### فارسی

1. **پیش‌نیاز:** پایتون ۳.۱۰ یا بالاتر  
2. مخزن را **کلون یا دانلود** کنید.  
3. **نصب وابستگی‌ها:**
   ```bash
   pip install -r requirements.txt
   ```
4. **اجرا:**
   ```bash
   python ip_scanner_pro.py
   ```
   یا دوبار کلیک روی **Scanner_Pro.bat** (ویندوز).  

   **فایل EXE (ویندوز):** از پوشهٔ `ScannerPro_exe` فایل **CDN_IP_Scanner_Pro.exe** را اجرا کنید — نیازی به نصب پایتون نیست. پس از اجرا ابتدا صفحهٔ بارگذاری با نوار پیشرفت نمایش داده می‌شود، سپس پنجرهٔ اصلی برنامه باز می‌شود.

---

## 📁 Project structure | ساختار پروژه

```
├── ip_scanner_pro.py    # Main application
├── requirements.txt     # Python dependencies
├── version              # Current version (e.g. 1.6)
├── assets/
│   └── theme.json       # UI theme (dark/light)
├── fonts/               # Vazirmatn, Font Awesome, etc.
├── Scanner_Pro.bat      # Quick run (Windows)
├── exe_build/           # Build EXE (PyInstaller)
└── ScannerPro_exe/      # Output: EXE + requirements + version
```

---

## 📊 Stats & Usage | آمار و استفاده

<div align="center">

### Repository & downloads

[![GitHub Repo](https://img.shields.io/badge/GitHub-cdn--ip--scanner-181717?style=for-the-badge&logo=github)](https://github.com/shahinst/cdn-ip-scanner)
[![GitHub stars](https://img.shields.io/github/stars/shahinst/cdn-ip-scanner?style=for-the-badge&logo=github)](https://github.com/shahinst/cdn-ip-scanner/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/shahinst/cdn-ip-scanner?style=for-the-badge&logo=github)](https://github.com/shahinst/cdn-ip-scanner/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/shahinst/cdn-ip-scanner?style=for-the-badge&logo=github)](https://github.com/shahinst/cdn-ip-scanner/watchers)

</div>

<div align="center">

### Profile & repo activity

![Profile views](https://komarev.com/ghpvc/?username=shahinst&label=Profile%20views&color=6C5CE7&style=for-the-badge)
![Repo size](https://img.shields.io/github/repo-size/shahinst/cdn-ip-scanner?label=Repo%20size&style=for-the-badge&color=00B894)

</div>

<div align="center">

### 📈 Usage & stats diagram

| Stars ⭐ | Forks 🍴 | Watchers 👀 | Profile views 📊 |
|----------|----------|-------------|-------------------|
| [![Stars](https://img.shields.io/github/stars/shahinst/cdn-ip-scanner?label=)](https://github.com/shahinst/cdn-ip-scanner/stargazers) | [![Forks](https://img.shields.io/github/forks/shahinst/cdn-ip-scanner?label=)](https://github.com/shahinst/cdn-ip-scanner/network/members) | [![Watchers](https://img.shields.io/github/watchers/shahinst/cdn-ip-scanner?label=)](https://github.com/shahinst/cdn-ip-scanner/watchers) | ![Views](https://komarev.com/ghpvc/?username=shahinst) |

**This repo (stars, forks, size):**

[![CDN IP Scanner Pro](https://github-readme-stats.vercel.app/api/pin?username=shahinst&repo=cdn-ip-scanner&theme=default&hide_border=true)](https://github.com/shahinst/cdn-ip-scanner)

**Language usage in this project:**

<img src="https://github-readme-stats.vercel.app/api/top-langs/?username=shahinst&repo=cdn-ip-scanner&layout=compact&hide_border=true&langs_count=5" alt="Top languages" width="380" />

</div>

<div align="center">

| 📥 Downloads / استفاده | 📌 Version |
|------------------------|------------|
| Run from source or use **CDN_IP_Scanner_Pro.exe** from [Releases](https://github.com/shahinst/cdn-ip-scanner/releases) (when available) | **1.6** |

*برای مشاهدهٔ تعداد دانلودها به صفحهٔ [Releases](https://github.com/shahinst/cdn-ip-scanner/releases) مراجعه کنید.*  
*For download counts, check the [Releases](https://github.com/shahinst/cdn-ip-scanner/releases) page.*

</div>

---

## 👤 Author | نویسنده

**شاهین سالک توتونچی (Shahin Salek Tootoonchi)**

- GitHub: [@shahinst](https://github.com/shahinst)
- Website: [digicloud.tr](https://digicloud.tr)
- YouTube: [@shaahinst](https://www.youtube.com/@shaahinst)

---

## 📜 License | مجوز

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.  
این پروژه تحت مجوز **MIT** منتشر شده است.

---

<div align="center">

**Made with ❤️ for network engineers and CDN users**

**ساخته شده با ❤️ برای مهندسان شبکه و کاربران CDN**

</div>
