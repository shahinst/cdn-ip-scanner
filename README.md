# 🚀 CDN IP Scanner V1.0

<div align="center">

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](https://www.python.org/)

**Professional CDN IP Scanner with AI Optimization**  
**اسکنر حرفه‌ای IP های CDN با بهینه‌سازی هوش مصنوعی**  
**Профессиональный сканер CDN IP с ИИ-оптимизацией**  
**专业 CDN IP 扫描器，带 AI 优化**

[فارسی](#-فارسی--persian) · [English](#-english) · [Русский](#-русский--russian) · [中文](#-中文--chinese)

</div>

---

## 📑 Table of Contents / فهرست

| [فارسی](#-فارسی--persian) | [English](#-english) | [Русский](#-русский--russian) | [中文](#-中文--chinese) |
|:---:|:---:|:---:|:---:|

---

## 🇮🇷 فارسی (Persian)

### 📖 درباره پروژه

**CDN IP Scanner V1.0** ابزار حرفه‌ای برای یافتن IPهای تمیز (Clean) از Cloudflare و Fastly با استفاده از هوش مصنوعی است. مناسب برای بهبود سرعت و پایداری اتصال از ایران.

### ✨ ویژگی‌ها

- 🤖 **هوش مصنوعی** — پیش‌بینی و رتبه‌بندی هوشمند رنج‌های IP
- ⚡ **سرعت بالا** — بیش از ۵۰۰ thread همزمان
- 📡 **چند منبع** — Cloudflare و Fastly (API، ASN، GitHub)
- 🌐 **چندزبان** — فارسی، انگلیسی، چینی، روسی
- 🎨 **دارک/لایت مود** — رابط گرافیکی مدرن
- 💾 **خروجی** — ذخیره به صورت JSON و Excel

### 📋 پیش‌نیاز

- **ویندوز ۱۰/۱۱** (یا لینوکس/مک با پایتون)
- **Python 3.11 یا بالاتر**
- اتصال اینترنت

### 🔧 نصب با PowerShell (ویندوز)

۱. **PowerShell** را با حقوق مدیر باز کنید (کلیک راست روی Start → Windows PowerShell (Admin)).

۲. در صورت نیاز، پایتون را با **winget** نصب کنید:

```powershell
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

۳. پس از نصب پایتون، **ترمینال را ببندید و دوباره باز کنید**، سپس به پوشه پروژه بروید:

```powershell
cd "C:\path\to\cdn-ip-scanner"
```

۴. یک محیط مجازی (اختیاری ولی توصیه‌شده) بسازید:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

۵. اگر خطای اجرای اسکریپت دریافت کردید، سیاست اجرا را یک‌بار تغییر دهید:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

۶. کتابخانه‌ها را نصب کنید:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

۷. برنامه را اجرا کنید:

```powershell
python iran_cdn_scanner_pro.py
```

**روش ساده‌تر:** در پوشه پروژه دابل‌کلیک روی **`Scanner_Pro.bat`** یا **`Run_Scanner.bat`**.

### 📦 نصب از طریق دانلود ZIP

۱. در صفحه پروژه گیت‌هاب روی **Code** → **Download ZIP** کلیک کنید.

۲. فایل ZIP را استخراج کنید (مثلاً در `C:\Users\YourName\Downloads\cdn-ip-scanner-main`).

۳. پوشه استخراج‌شده را باز کنید و یکی از این کارها را انجام دهید:

   - **روش آسان:** دابل‌کلیک روی **`Scanner_Pro.bat`** (در صورت نصب بودن پایتون، پکیج‌ها نصب و برنامه اجرا می‌شود).
   - **روش دستی با PowerShell:** در نوار آدرس پوشه `powershell` تایپ کنید و Enter بزنید، سپس:

```powershell
pip install -r requirements.txt
python iran_cdn_scanner_pro.py
```

۴. اگر پایتون نصب نیست، از [python.org](https://www.python.org/downloads/) نصب کنید و گزینه **Add Python to PATH** را تیک بزنید؛ بعد دوباره مرحله ۳ را انجام دهید.

### 👤 نویسنده و پشتیبانی

- **نویسنده:** شاهین سالک توتونچی (shahin salek tootoonchi)
- **سایت:** [https://digicloud.tr](https://digicloud.tr) — خرید سرور
- **گیت‌هاب:** [github.com/shahinst](https://github.com/shahinst)
- **یوتیوب:** [youtube.com/@shaahinst](https://www.youtube.com/@shaahinst)

---

## 🇬🇧 English

### 📖 About

**CDN IP Scanner V1.0** is a professional tool for finding clean IPs from Cloudflare and Fastly CDNs using AI optimization. Ideal for improving speed and stability from Iran (or other regions).

### ✨ Features

- 🤖 **AI optimization** — Smart prediction and ranking of IP ranges
- ⚡ **High speed** — 500+ concurrent threads
- 📡 **Multiple sources** — Cloudflare & Fastly (API, ASN, GitHub)
- 🌐 **Multi-language** — Persian, English, Chinese, Russian
- 🎨 **Dark/Light mode** — Modern GUI
- 💾 **Export** — Save results as JSON and Excel

### 📋 Requirements

- **Windows 10/11** (or Linux/macOS with Python)
- **Python 3.11 or newer**
- Internet connection

### 🔧 Install via PowerShell (Windows)

1. Open **PowerShell as Administrator** (Right-click Start → Windows PowerShell (Admin)).

2. Install Python with **winget** if needed:

```powershell
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

3. **Close and reopen** the terminal, then go to the project folder:

```powershell
cd "C:\path\to\cdn-ip-scanner"
```

4. (Optional) Create a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

5. If you get a script execution error, set execution policy once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

6. Install dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

7. Run the program:

```powershell
python iran_cdn_scanner_pro.py
```

**Easier:** Double-click **`Scanner_Pro.bat`** or **`Run_Scanner.bat`** in the project folder.

### 📦 Install from ZIP Download

1. On the GitHub project page, click **Code** → **Download ZIP**.

2. Extract the ZIP (e.g. to `C:\Users\YourName\Downloads\cdn-ip-scanner-main`).

3. Open the extracted folder and either:

   - **Easy:** Double-click **`Scanner_Pro.bat`** (if Python is installed, it will install packages and run the app).
   - **Manual in PowerShell:** In the folder address bar, type `powershell` and press Enter, then:

```powershell
pip install -r requirements.txt
python iran_cdn_scanner_pro.py
```

4. If Python is not installed, download from [python.org](https://www.python.org/downloads/) and check **Add Python to PATH**, then repeat step 3.

### 👤 Author & Support

- **Author:** shahin salek tootoonchi
- **Website:** [https://digicloud.tr](https://digicloud.tr) — Buy server
- **GitHub:** [github.com/shahinst](https://github.com/shahinst)
- **YouTube:** [youtube.com/@shaahinst](https://www.youtube.com/@shaahinst)

---

## 🇷🇺 Русский (Russian)

### 📖 О проекте

**CDN IP Scanner V1.0** — профессиональный инструмент для поиска «чистых» IP-адресов CDN Cloudflare и Fastly с оптимизацией на основе ИИ. Подходит для улучшения скорости и стабильности из Ирана и других регионов.

### ✨ Возможности

- 🤖 **ИИ-оптимизация** — умное предсказание и ранжирование диапазонов IP
- ⚡ **Высокая скорость** — более 500 потоков одновременно
- 📡 **Несколько источников** — Cloudflare и Fastly (API, ASN, GitHub)
- 🌐 **Мультиязычность** — персидский, английский, китайский, русский
- 🎨 **Тёмная/светлая тема** — современный интерфейс
- 💾 **Экспорт** — сохранение в JSON и Excel

### 📋 Требования

- **Windows 10/11** (или Linux/macOS с Python)
- **Python 3.11 или новее**
- Подключение к интернету

### 🔧 Установка через PowerShell (Windows)

1. Откройте **PowerShell от имени администратора** (ПКМ по «Пуск» → Windows PowerShell (Admin)).

2. При необходимости установите Python через **winget**:

```powershell
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

3. **Закройте и снова откройте** терминал, затем перейдите в папку проекта:

```powershell
cd "C:\path\to\cdn-ip-scanner"
```

4. (По желанию) Создайте виртуальное окружение:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

5. Если появляется ошибка выполнения скриптов, один раз выполните:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

6. Установите зависимости:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

7. Запустите программу:

```powershell
python iran_cdn_scanner_pro.py
```

**Проще:** дважды щёлкните по **`Scanner_Pro.bat`** или **`Run_Scanner.bat`** в папке проекта.

### 📦 Установка из ZIP-архива

1. На странице проекта в GitHub нажмите **Code** → **Download ZIP**.

2. Распакуйте архив (например, в `C:\Users\ВашеИмя\Downloads\cdn-ip-scanner-main`).

3. Откройте распакованную папку и выберите один из вариантов:

   - **Простой:** дважды щёлкните **`Scanner_Pro.bat`** (при установленном Python зависимости установятся и программа запустится).
   - **Вручную в PowerShell:** в адресной строке папки введите `powershell` и нажмите Enter, затем:

```powershell
pip install -r requirements.txt
python iran_cdn_scanner_pro.py
```

4. Если Python не установлен, скачайте его с [python.org](https://www.python.org/downloads/) и отметьте **Add Python to PATH**, затем повторите шаг 3.

### 👤 Автор и поддержка

- **Автор:** shahin salek tootoonchi
- **Сайт:** [https://digicloud.tr](https://digicloud.tr) — Купить сервер
- **GitHub:** [github.com/shahinst](https://github.com/shahinst)
- **YouTube:** [youtube.com/@shaahinst](https://www.youtube.com/@shaahinst)

---

## 🇨🇳 中文 (Chinese)

### 📖 项目简介

**CDN IP Scanner V1.0** 是一款通过 AI 优化从 Cloudflare 和 Fastly CDN 查找优质 IP 的专业工具，适用于从伊朗或其他地区提升访问速度和稳定性。

### ✨ 功能特点

- 🤖 **AI 优化** — 智能预测与 IP 段排序
- ⚡ **高速** — 500+ 并发线程
- 📡 **多源** — Cloudflare 与 Fastly（API、ASN、GitHub）
- 🌐 **多语言** — 波斯语、英语、中文、俄语
- 🎨 **深色/浅色主题** — 现代界面
- 💾 **导出** — 支持 JSON 与 Excel 保存

### 📋 系统要求

- **Windows 10/11**（或带 Python 的 Linux/macOS）
- **Python 3.11 或更高**
- 需要网络连接

### 🔧 通过 PowerShell 安装（Windows）

1. **以管理员身份**打开 **PowerShell**（右键“开始” → Windows PowerShell (Admin)）。

2. 如未安装 Python，可使用 **winget** 安装：

```powershell
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
```

3. **关闭并重新打开**终端，然后进入项目目录：

```powershell
cd "C:\path\to\cdn-ip-scanner"
```

4. （可选）创建虚拟环境：

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

5. 若出现脚本执行策略错误，可执行一次：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

6. 安装依赖：

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

7. 运行程序：

```powershell
python iran_cdn_scanner_pro.py
```

**更简单：** 在项目文件夹中双击 **`Scanner_Pro.bat`** 或 **`Run_Scanner.bat`**。

### 📦 从 ZIP 下载并安装

1. 在 GitHub 项目页点击 **Code** → **Download ZIP**。

2. 解压 ZIP（例如到 `C:\Users\您的用户名\Downloads\cdn-ip-scanner-main`）。

3. 打开解压后的文件夹，任选其一：

   - **简单方式：** 双击 **`Scanner_Pro.bat`**（若已安装 Python，将自动安装依赖并运行）。
   - **手动在 PowerShell 中：** 在文件夹地址栏输入 `powershell` 回车，然后执行：

```powershell
pip install -r requirements.txt
python iran_cdn_scanner_pro.py
```

4. 若未安装 Python，请从 [python.org](https://www.python.org/downloads/) 下载并勾选 **Add Python to PATH**，然后重复步骤 3。

### 👤 作者与支持

- **作者：** shahin salek tootoonchi
- **网站：** [https://digicloud.tr](https://digicloud.tr) — 购买服务器
- **GitHub：** [github.com/shahinst](https://github.com/shahinst)
- **YouTube：** [youtube.com/@shaahinst](https://www.youtube.com/@shaahinst)

---

## 📁 Project structure / ساختار پروژه

```
cdn-ip-scanner/
├── iran_cdn_scanner_pro.py   # Main application
├── requirements.txt          # Python dependencies
├── Run_Scanner.bat           # Quick run (Windows)
├── Scanner_Pro.bat           # Setup + run (Windows)
├── fonts/                   # Persian fonts (Vazirmatn)
│   ├── Vazirmatn-Regular.ttf
│   └── Vazirmatn-Bold.ttf
└── README.md
```

---

## 💎 Donate / حمایت

If this project helped you, you can support development:

```
USDT (Ethereum): 0xde200d902bcf7d2a4f4a17b337b93caa7f78c269
```

---

## 📜 License

MIT License — see [LICENSE](LICENSE) if present.

---

<div align="center">

**Made with ❤️ by shahin salek tootoonchi**

[GitHub](https://github.com/shahinst) · [digicloud.tr](https://digicloud.tr) · [YouTube @shaahinst](https://www.youtube.com/@shaahinst)

</div>
