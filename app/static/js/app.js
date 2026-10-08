/**
 * CDN IP Scanner V2.0 - Frontend Application
 * Author: shahinst
 */

// ===== Persian numeral converter =====
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
function toFaNum(val) {
    return String(val).replace(/[0-9]/g, d => FA_DIGITS[+d]);
}
function localNum(val) {
    return lang === 'fa' ? toFaNum(val) : String(val);
}

// (Operator detection is handled server-side based on user's ISP)

// ===== Translations =====
const T = {
    en: {
        app_title: "CDN IP Scanner V 2.0", app_subtitle: "High accuracy \u2022 Ultra fast \u2022 Real-time",
        target: "Target", latency: "Latency", found: "Found", time: "Time",
        settings: "\u2699\uFE0F Settings", mode: "Mode", count: "Count",
        fetch_ranges_btn: "\uD83D\uDCE1 Fetch Ranges", analyze_btn: "\uD83D\uDCCA Analyze",
        save_btn: "\uD83D\uDCBE Save", stop_btn: "\u23F9\uFE0F Stop", start_btn: "\uD83D\uDE80 Start Scan",
        export_modal_title: "Choose export format", export_hint: "Select the format for downloading results:",
        export_json: "JSON", export_excel: "Excel", export_text: "Text (IPs only)",
        retest_btn: "🔁 Re-test", retest_started: "Re-testing {n} IPs...", retest_done: "Re-test done: {alive} alive, {dead} dead", retest_none: "No results to re-test", copy_best_btn: "📋 Copy best IPs", best_copied: "{n} best IPs copied", export_csv: "CSV", settings_notify_scan: "Send the best IPs to Telegram when a scan finishes", dead_label: "dead",
        progress_title: "Progress", ready_status: "Ready to start",
        results_title: "Results (by speed)", rank_hdr: "Rank", ip_hdr: "IP",
        ping_hdr: "Ping", ports_hdr: "Ports", score_hdr: "Score", operator_hdr: "Operator",
        ranges_to_scan_label: "Ranges to scan", ranges_hint_paste_fetch: "Paste IPs or fetch ranges. One IP/CIDR per line.",
        add_range_btn: "Add", filter_only_clean_label: "Only IPs with open port + ping",
        box_range_and_scan: "Select range and scan method", scan_method_label: "Scan method",
        scan_method_cloud: "Cloud scan", scan_method_operators: "With operator IP ranges",
        scan_method_v2ray: "With custom config in V2rayN",
        range_fetcher_title: "Fetch IP Ranges",
        reset_data_btn: "\uD83D\uDD04 Reset", close_btn: "Close",
        settings_ping_range: "Ping range filter (ms)", settings_ports: "Scan ports", settings_theme: "Theme",
        settings_log: "Log", settings_log_desc: "Show scan log panel",
        settings_debug: "Debug", settings_debug_desc: "Enable debug mode (detailed logs)",
        update_btn: "Update", update_checking: "Checking for update...",
        update_available: "New version {v} available!",
        update_confirm: "Version {v} is available. Do you want to update now?",
        update_latest: "You have the latest version.",
        update_error: "Update check failed.",
        update_downloading: "Downloading update...",
        update_installing: "Installing update...",
        update_restarting: "Update complete! Restarting in 5 seconds...",
        update_yes: "Yes, update", update_no: "Cancel",
        operator_country: "Operator country", scan_from_operator: "Ping on operator",
        operator_ping_on: "Ping on operator",
        operators_mode_hint: "Paste CDN ranges above. Select your operator — we check which CDN IPs have ping and open ports on that operator.",
        operator_all: "All (auto-detect)",
        fetch_all_operators_btn: "\uD83D\uDCE1 Fetch all operator IPs",
        log_title: "\uD83D\uDCCB Scan Log",
        download_hdr: "Download",
        colo_hdr: "Colo", speed_hdr: "Speed", speed_unit: "KB/s",
        settings_speed: "Download speed test",
        settings_speed_desc: "After the scan, test the download speed of the best IPs",
        settings_speed_size: "Test size (KB)", settings_speed_count: "Number of IPs to test",
        settings_speed_url: "Test URL ({bytes} = size)",
        speed_testing: "Testing download speed...",
        qr_btn: "QR", sub_btn: "\uD83D\uDD17 Subscription link", copy_all_btn: "\uD83D\uDCCB Copy all configs",
        sub_copied: "Subscription link copied. Add it in v2rayN / v2rayNG / Hiddify.",
        configs_copied: "Configs copied", qr_title: "Scan with your phone",
        real_hdr: "Real delay", settings_xray: "Real test with Xray-core (V2Ray scan)",
        settings_xray_desc: "Test the best IPs through your own config (only IPs that really work)",
        settings_xray_count: "Number of IPs to test", settings_xray_url: "Test URL",
        xray_testing: "Real test through Xray...", xray_missing: "Xray-core is not installed.",
        xray_install_btn: "Install Xray", xray_installing: "Downloading Xray...", xray_ready: "Xray ready:",
        favorites_btn: "\u2B50 Favorites", favorites_title: "Favorite IPs", fav_added: "Added to favorites:",
        fav_empty: "No favorites yet. Click \u2606 next to a result to add it.",
        fav_check_now: "Check now", fav_checking: "Checking...", fav_status: "Status",
        fav_uptime: "Uptime 24h", fav_last_check: "Last check", fav_remove: "Remove",
        settings_monitor: "Monitoring & Telegram", settings_monitor_interval: "Re-check favorites every (minutes)",
        monitor_off: "Off", minutes: "min",
        settings_tg_token: "Telegram bot token", settings_tg_chat: "Chat ID",
        settings_tg_proxy: "Proxy for Telegram (optional, e.g. socks5h://127.0.0.1:10808)",
        tg_test_btn: "Send test message", tg_sent: "Test message sent",
        clash_btn: "\u2B07 Clash / Mihomo", singbox_btn: "\u2B07 sing-box",
        chart_speed: "Scan speed (IP/s)", chart_ping: "Ping of found IPs (ms)",
        resume_text: "Scan #{id} was interrupted with {found} of {target} IPs found.",
        resume_btn: "\u25B6 Resume", resume_discard: "Dismiss",
        settings_diag: "Diagnostics", diag_desc: "Download a report (version, system, settings without secrets, recent logs) to attach to a GitHub issue.",
        diag_btn: "\u2B07 Download report",
        profile_label: "Scan profile", profile_custom: "Custom (my settings)",
        profile_quick: "\u26A1 Quick \u2014 a few fast IPs", profile_balanced: "\u2696\uFE0F Balanced \u2014 recommended",
        profile_thorough: "\uD83D\uDD0D Thorough \u2014 many IPs, all tests",
        profile_mobile: "\uD83D\uDCF1 Mobile networks \u2014 tolerant of high latency",
        profile_applied: "Profile applied:",
        filter_placeholder: "Filter by IP or colo...", filter_all_colos: "All data centers",
        filter_only_working: "Hide IPs that failed the real test",
        scan_complete: "Done! {found} IPs in {time}s", ip_copied: "IP copied!",
    },
    fa: {
        app_title: "CDN IP Scanner V 2.0", app_subtitle: "\u062F\u0642\u062A \u0628\u0627\u0644\u0627 \u2022 \u0633\u0631\u0639\u062A \u0641\u0648\u0642\u200C\u0627\u0644\u0639\u0627\u062F\u0647 \u2022 لحظه‌ای",
        target: "\u0647\u062F\u0641", latency: "\u062A\u0623\u062E\u06CC\u0631", found: "\u06CC\u0627\u0641\u062A \u0634\u062F\u0647", time: "\u0632\u0645\u0627\u0646",
        settings: "\u2699\uFE0F \u062A\u0646\u0638\u06CC\u0645\u0627\u062A", mode: "\u062D\u0627\u0644\u062A", count: "\u062A\u0639\u062F\u0627\u062F",
        fetch_ranges_btn: "\uD83D\uDCE1 \u062F\u0631\u06CC\u0627\u0641\u062A \u0631\u0646\u062C\u200C\u0647\u0627", analyze_btn: "\uD83D\uDCCA \u062A\u062D\u0644\u06CC\u0644",
        save_btn: "\uD83D\uDCBE \u0630\u062E\u06CC\u0631\u0647", stop_btn: "\u23F9\uFE0F \u062A\u0648\u0642\u0641", start_btn: "\uD83D\uDE80 \u0634\u0631\u0648\u0639 \u0627\u0633\u06A9\u0646",
        export_modal_title: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0641\u0631\u0645\u062A \u062E\u0631\u0648\u062C\u06CC", export_hint: "\u0641\u0631\u0645\u062A \u062E\u0631\u0648\u062C\u06CC \u0631\u0627 \u0628\u0631\u0627\u06CC \u062F\u0627\u0646\u0644\u0648\u062F \u0646\u062A\u0627\u06CC\u062C \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F:",
        export_json: "JSON", export_excel: "\u0627\u06A9\u0633\u0644", export_text: "\u062A\u06A9\u0633\u062A (\u0641\u0642\u0637 \u0622\u06CC\u200C\u067E\u06CC)",
        retest_btn: "🔁 تست مجدد", retest_started: "تست مجدد {n} آی‌پی...", retest_done: "تست مجدد تمام شد: {alive} سالم، {dead} خراب", retest_none: "نتیجه‌ای برای تست مجدد نیست", copy_best_btn: "📋 کپی بهترین آی‌پی‌ها", best_copied: "{n} آی‌پی برتر کپی شد", export_csv: "CSV", settings_notify_scan: "پس از پایان اسکن، بهترین آی‌پی‌ها به تلگرام ارسال شود", dead_label: "خراب",
        progress_title: "\u067E\u06CC\u0634\u0631\u0641\u062A", ready_status: "\u0622\u0645\u0627\u062F\u0647 \u0628\u0631\u0627\u06CC \u0634\u0631\u0648\u0639",
        results_title: "\u0646\u062A\u0627\u06CC\u062C (\u0628\u0631 \u0627\u0633\u0627\u0633 \u0633\u0631\u0639\u062A)", rank_hdr: "\u0631\u062A\u0628\u0647", ip_hdr: "\u0622\u062F\u0631\u0633 IP",
        ping_hdr: "Ping", ports_hdr: "\u067E\u0648\u0631\u062A\u200C\u0647\u0627", score_hdr: "\u0627\u0645\u062A\u06CC\u0627\u0632", operator_hdr: "\u0627\u067E\u0631\u0627\u062A\u0648\u0631",
        ranges_to_scan_label: "\u0631\u0646\u062C\u200C\u0647\u0627 \u0628\u0631\u0627\u06CC \u0627\u0633\u06A9\u0646", ranges_hint_paste_fetch: "\u0622\u06CC\u200C\u067E\u06CC \u06CC\u0627 \u0631\u0646\u062C \u0628\u06AF\u0630\u0627\u0631\u06CC\u062F. \u0647\u0631 \u062E\u0637 \u06CC\u06A9 CIDR.",
        add_range_btn: "\u0627\u0641\u0632\u0648\u062F\u0646", filter_only_clean_label: "\u0641\u0642\u0637 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632",
        box_range_and_scan: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0631\u0646\u062C \u0648 \u0646\u062D\u0648\u0647 \u0627\u0633\u06A9\u0646", scan_method_label: "\u0646\u062D\u0648\u0647 \u0627\u0633\u06A9\u0646",
        scan_method_cloud: "\u0627\u0633\u06A9\u0646 \u06A9\u0644\u0648\u062F", scan_method_operators: "\u0628\u0627 \u0631\u0646\u062C \u0622\u06CC\u200C\u067E\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631\u0647\u0627",
        scan_method_v2ray: "\u0628\u0627 \u06A9\u0627\u0646\u0641\u06CC\u06AF \u062F\u0644\u062E\u0648\u0627\u0647 \u062F\u0631 V2rayN",
        range_fetcher_title: "\u062F\u0631\u06CC\u0627\u0641\u062A \u0631\u0646\u062C\u200C\u0647\u0627\u06CC IP",
        reset_data_btn: "\uD83D\uDD04 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647\u200C\u0647\u0627",
        close_btn: "\u0628\u0633\u062A\u0646", settings_ping_range: "\u0641\u06CC\u0644\u062A\u0631 \u0645\u062D\u062F\u0648\u062F\u0647 \u067E\u06CC\u0646\u06AF (ms)",
        settings_ports: "\u067E\u0648\u0631\u062A\u200C\u0647\u0627\u06CC \u0627\u0633\u06A9\u0646", settings_theme: "\u062A\u0645",
        settings_log: "\u0644\u0627\u06AF", settings_log_desc: "\u0646\u0645\u0627\u06CC\u0634 \u067E\u0646\u0644 \u0644\u0627\u06AF \u0627\u0633\u06A9\u0646",
        settings_debug: "\u062F\u06CC\u0628\u0627\u06AF", settings_debug_desc: "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u062D\u0627\u0644\u062A \u062F\u06CC\u0628\u0627\u06AF (\u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u062C\u0632\u0626\u06CC)",
        update_btn: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC", update_checking: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0631\u0633\u06CC \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC...",
        update_available: "\u0646\u0633\u062E\u0647 \u062C\u062F\u06CC\u062F {v} \u0645\u0648\u062C\u0648\u062F \u0627\u0633\u062A!",
        update_confirm: "\u0646\u0633\u062E\u0647 {v} \u0645\u0648\u062C\u0648\u062F \u0627\u0633\u062A. \u0622\u06CC\u0627 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u06CC\u062F \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0646\u06CC\u062F\u061F",
        update_latest: "\u0634\u0645\u0627 \u0622\u062E\u0631\u06CC\u0646 \u0646\u0633\u062E\u0647 \u0631\u0627 \u062F\u0627\u0631\u06CC\u062F.",
        update_error: "\u0628\u0631\u0631\u0633\u06CC \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.",
        update_downloading: "\u062F\u0631 \u062D\u0627\u0644 \u062F\u0627\u0646\u0644\u0648\u062F \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC...",
        update_installing: "\u062F\u0631 \u062D\u0627\u0644 \u0646\u0635\u0628 \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC...",
        update_restarting: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0627\u0645\u0644 \u0634\u062F! \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0645\u062C\u062F\u062F \u062F\u0631 \u06F5 \u062B\u0627\u0646\u06CC\u0647...",
        update_yes: "\u0628\u0644\u0647\u060C \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0646", update_no: "\u0627\u0646\u0635\u0631\u0627\u0641",
        operator_country: "\u06A9\u0634\u0648\u0631 \u0627\u067E\u0631\u0627\u062A\u0648\u0631", scan_from_operator: "\u067E\u06CC\u0646\u06AF \u0628\u0631 \u0627\u067E\u0631\u0627\u062A\u0648\u0631",
        operator_ping_on: "\u067E\u06CC\u0646\u06AF \u0628\u0631 \u0627\u067E\u0631\u0627\u062A\u0648\u0631",
        operators_mode_hint: "\u0631\u0646\u062C\u200C\u0647\u0627\u06CC CDN \u0631\u0627 \u0628\u0627\u0644\u0627 \u0628\u06AF\u0630\u0627\u0631\u06CC\u062F. \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062E\u0648\u062F \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F \u2014 \u0627\u0633\u06A9\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F \u06A9\u062F\u0627\u0645 \u0622\u06CC\u200C\u067E\u06CC CDN \u0631\u0648\u06CC \u0627\u06CC\u0646 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u067E\u06CC\u0646\u06AF \u0648 \u067E\u0648\u0631\u062A \u0628\u0627\u0632 \u062F\u0627\u0631\u062F.",
        operator_all: "\u0647\u0645\u0647 (\u062E\u0648\u062F\u0627\u06CC\u0627\u0631 \u0627\u0632 \u0631\u0648\u0634)",
        fetch_all_operators_btn: "\uD83D\uDCE1 \u062F\u0631\u06CC\u0627\u0641\u062A \u0647\u0645\u0647 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631\u0647\u0627",
        log_title: "\uD83D\uDCCB \u0644\u0627\u06AF \u0627\u0633\u06A9\u0646",
        download_hdr: "\u062F\u0627\u0646\u0644\u0648\u062F",
        colo_hdr: "دیتاسنتر", speed_hdr: "سرعت", speed_unit: "KB/s",
        settings_speed: "تست سرعت دانلود",
        settings_speed_desc: "بعد از اسکن، سرعت دانلود بهترین آی‌پی‌ها تست شود",
        settings_speed_size: "حجم تست (KB)", settings_speed_count: "تعداد آی‌پی برای تست",
        settings_speed_url: "آدرس تست ({bytes} = حجم)",
        speed_testing: "در حال تست سرعت دانلود...",
        qr_btn: "QR", sub_btn: "\uD83D\uDD17 لینک ساب‌اسکریپشن", copy_all_btn: "\uD83D\uDCCB کپی همه کانفیگ‌ها",
        sub_copied: "لینک ساب‌اسکریپشن کپی شد. آن را در v2rayN / v2rayNG / Hiddify اضافه کنید.",
        configs_copied: "کانفیگ‌ها کپی شد", qr_title: "با گوشی اسکن کنید",
        real_hdr: "تأخیر واقعی", settings_xray: "تست واقعی با Xray-core (اسکن V2Ray)",
        settings_xray_desc: "بهترین آی‌پی‌ها با کانفیگ خود شما تست شوند (فقط آی‌پی‌هایی که واقعاً کار می‌کنند)",
        settings_xray_count: "تعداد آی‌پی برای تست", settings_xray_url: "آدرس تست",
        xray_testing: "در حال تست واقعی با Xray...", xray_missing: "Xray-core نصب نیست.",
        xray_install_btn: "نصب Xray", xray_installing: "در حال دانلود Xray...", xray_ready: "Xray آماده است:",
        favorites_btn: "\u2B50 علاقه‌مندی‌ها", favorites_title: "آی‌پی‌های مورد علاقه", fav_added: "به علاقه‌مندی‌ها اضافه شد:",
        fav_empty: "هنوز آی‌پی ذخیره نشده. روی \u2606 کنار هر نتیجه بزنید.",
        fav_check_now: "بررسی الان", fav_checking: "در حال بررسی...", fav_status: "وضعیت",
        fav_uptime: "پایداری ۲۴ ساعت", fav_last_check: "آخرین بررسی", fav_remove: "حذف",
        settings_monitor: "پایش و تلگرام", settings_monitor_interval: "بررسی خودکار علاقه‌مندی‌ها هر (دقیقه)",
        monitor_off: "خاموش", minutes: "دقیقه",
        settings_tg_token: "توکن ربات تلگرام", settings_tg_chat: "Chat ID",
        settings_tg_proxy: "پروکسی برای تلگرام (اختیاری، مثلاً socks5h://127.0.0.1:10808)",
        tg_test_btn: "ارسال پیام آزمایشی", tg_sent: "پیام آزمایشی ارسال شد",
        clash_btn: "\u2B07 Clash / Mihomo", singbox_btn: "\u2B07 sing-box",
        chart_speed: "سرعت اسکن (IP در ثانیه)", chart_ping: "پینگ آی‌پی‌های پیدا شده (ms)",
        resume_text: "اسکن #{id} نیمه‌کاره ماند: {found} از {target} آی‌پی پیدا شده.",
        resume_btn: "\u25B6 ادامه اسکن", resume_discard: "بستن",
        settings_diag: "عیب‌یابی", diag_desc: "دانلود گزارش (نسخه، سیستم، تنظیمات بدون اطلاعات محرمانه، لاگ‌های اخیر) برای پیوست به issue در گیت‌هاب.",
        diag_btn: "\u2B07 دانلود گزارش",
        profile_label: "پروفایل اسکن", profile_custom: "سفارشی (تنظیمات من)",
        profile_quick: "\u26A1 سریع \u2014 چند آی‌پی سریع", profile_balanced: "\u2696\uFE0F متعادل \u2014 پیشنهادی",
        profile_thorough: "\uD83D\uDD0D کامل \u2014 آی‌پی بیشتر، همه تست‌ها",
        profile_mobile: "\uD83D\uDCF1 اینترنت موبایل \u2014 مناسب تأخیر بالا",
        profile_applied: "پروفایل اعمال شد:",
        filter_placeholder: "فیلتر بر اساس IP یا دیتاسنتر...", filter_all_colos: "همه دیتاسنترها",
        filter_only_working: "پنهان کردن آی‌پی‌هایی که در تست واقعی رد شدند",
        scan_complete: "\u0627\u062A\u0645\u0627\u0645! {found} IP \u062F\u0631 {time} \u062B\u0627\u0646\u06CC\u0647", ip_copied: "IP \u06A9\u067E\u06CC \u0634\u062F!",
    },
    zh: {
        app_title: "CDN IP \u626B\u63CF\u5668 V 2.0", app_subtitle: "\u9AD8\u7CBE\u5EA6 \u2022 \u8D85\u5FEB \u2022 \u5B9E\u65F6",
        target: "\u76EE\u6807", latency: "\u5EF6\u8FDF", found: "\u5DF2\u627E\u5230", time: "\u65F6\u95F4",
        settings: "\u2699\uFE0F \u8BBE\u7F6E", start_btn: "\uD83D\uDE80 \u5F00\u59CB\u626B\u63CF", stop_btn: "\u23F9\uFE0F \u505C\u6B62",
        save_btn: "\uD83D\uDCBE \u4FDD\u5B58", ready_status: "\u51C6\u5907\u5C31\u7EEA",
        results_title: "\u7ED3\u679C", rank_hdr: "\u6392\u540D", ip_hdr: "IP", ping_hdr: "Ping",
        ports_hdr: "\u7AEF\u53E3", score_hdr: "\u5206\u6570", operator_hdr: "\u8FD0\u8425\u5546",
        log_title: "\uD83D\uDCCB \u626B\u63CF\u65E5\u5FD7", download_hdr: "\u4E0B\u8F7D",
        colo_hdr: "\u673A\u623F", speed_hdr: "\u901F\u5EA6",
        retest_btn: "🔁 重新测试", retest_started: "正在重新测试 {n} 个 IP...", retest_done: "重新测试完成：{alive} 个可用，{dead} 个失效", retest_none: "没有可重新测试的结果", copy_best_btn: "📋 复制最佳 IP", best_copied: "已复制 {n} 个最佳 IP", export_csv: "CSV", settings_notify_scan: "扫描完成后将最佳 IP 发送到 Telegram", dead_label: "失效",
        settings_log: "\u65E5\u5FD7", settings_log_desc: "\u663E\u793A\u626B\u63CF\u65E5\u5FD7\u9762\u677F",
        settings_debug: "\u8C03\u8BD5", settings_debug_desc: "\u542F\u7528\u8C03\u8BD5\u6A21\u5F0F",
        update_checking: "\u68C0\u67E5\u66F4\u65B0\u4E2D...", update_available: "\u65B0\u7248\u672C {v} \u53EF\u7528\uFF01",
        update_confirm: "\u7248\u672C {v} \u53EF\u7528\u3002\u662F\u5426\u66F4\u65B0\uFF1F",
        update_latest: "\u5DF2\u662F\u6700\u65B0\u7248\u672C\u3002", update_error: "\u66F4\u65B0\u68C0\u67E5\u5931\u8D25\u3002",
        update_downloading: "\u4E0B\u8F7D\u66F4\u65B0\u4E2D...", update_installing: "\u5B89\u88C5\u66F4\u65B0\u4E2D...",
        update_restarting: "\u66F4\u65B0\u5B8C\u6210\uFF01\u91CD\u542F\u4E2D...",
        update_yes: "\u786E\u8BA4\u66F4\u65B0", update_no: "\u53D6\u6D88",
        scan_complete: "\u5B8C\u6210\uFF01{found} IP\uFF0C\u8017\u65F6 {time}s", ip_copied: "IP \u5DF2\u590D\u5236\uFF01",
    },
    ru: {
        app_title: "CDN IP \u0421\u043A\u0430\u043D\u0435\u0440 V 2.0", app_subtitle: "\u0422\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u2022 \u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u2022 \u0420\u0435\u0430\u043B\u044C\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F",
        target: "\u0426\u0435\u043B\u044C", latency: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430", found: "\u041D\u0430\u0439\u0434\u0435\u043D\u043E", time: "\u0412\u0440\u0435\u043C\u044F",
        settings: "\u2699\uFE0F \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438", start_btn: "\uD83D\uDE80 \u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C", stop_btn: "\u23F9\uFE0F \u0421\u0442\u043E\u043F",
        save_btn: "\uD83D\uDCBE \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C", ready_status: "\u0413\u043E\u0442\u043E\u0432",
        results_title: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B", rank_hdr: "\u0420\u0430\u043D\u0433", ip_hdr: "IP", ping_hdr: "Ping",
        ports_hdr: "\u041F\u043E\u0440\u0442\u044B", score_hdr: "\u041E\u0446\u0435\u043D\u043A\u0430", operator_hdr: "\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440",
        log_title: "\uD83D\uDCCB \u041B\u043E\u0433 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F", download_hdr: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C",
        colo_hdr: "\u0414\u0426", speed_hdr: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C",
        retest_btn: "🔁 Перепроверить", retest_started: "Перепроверка {n} IP...", retest_done: "Готово: {alive} работают, {dead} не работают", retest_none: "Нет результатов для перепроверки", copy_best_btn: "📋 Копировать лучшие IP", best_copied: "Скопировано IP: {n}", export_csv: "CSV", settings_notify_scan: "Отправлять лучшие IP в Telegram после сканирования", dead_label: "не работает",
        settings_log: "\u041B\u043E\u0433", settings_log_desc: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C \u043B\u043E\u0433\u043E\u0432",
        settings_debug: "\u041E\u0442\u043B\u0430\u0434\u043A\u0430", settings_debug_desc: "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0436\u0438\u043C \u043E\u0442\u043B\u0430\u0434\u043A\u0438",
        update_checking: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439...", update_available: "\u041D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F {v}!",
        update_confirm: "\u0412\u0435\u0440\u0441\u0438\u044F {v} \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C?",
        update_latest: "\u0423 \u0432\u0430\u0441 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0432\u0435\u0440\u0441\u0438\u044F.", update_error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438.",
        update_downloading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...", update_installing: "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430...",
        update_restarting: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E! \u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A...",
        update_yes: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C", update_no: "\u041E\u0442\u043C\u0435\u043D\u0430",
        scan_complete: "\u0413\u043E\u0442\u043E\u0432\u043E! {found} IP \u0437\u0430 {time}s", ip_copied: "IP \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D!",
    }
};

// ===== App State =====
let lang = document.querySelector('#app')?.dataset.lang || 'en';
let socket = null;
let isScanning = false;
let startTime = null;
let timerInterval = null;
let sessionId = null;
let resultCount = 0;
let currentV2rayConfig = '';
let currentScanMethod = 'cloud';
let logEnabled = false;

// ===== Translation =====
function t(key) { return (T[lang] && T[lang][key]) || (T.en[key]) || key; }

function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.dataset.t;
        let text = t(key);
        if (key === 'app_title') text = text.replace('2.0', document.querySelector('#app')?.dataset.version || '2.0');
        if (text) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = text;
            else el.textContent = text;
        }
    });
}

// ===== Theme =====
function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cdn-theme', theme);
    const btn = document.getElementById('btnTheme');
    if (btn) btn.textContent = theme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F';
}

function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
}

// ===== Log/Debug visibility =====
let debugEnabled = false;

function updateLogVisibility() {
    // Log section is visible if EITHER log or debug is enabled
    const shouldShow = logEnabled || debugEnabled;
    const sec = document.getElementById('logSection');
    if (sec) sec.classList.toggle('hidden', !shouldShow);
}

function setLogVisible(visible) {
    logEnabled = visible;
    updateLogVisibility();
}

function setDebugVisible(visible) {
    debugEnabled = visible;
    updateLogVisibility();
}

// (CDN provider detection removed - operator detection is server-side ISP detection)

// ===== Live charts =====
let speedChart = null, pingChart = null;

function initCharts() {
    if (!window.LiveChart) return;
    const fmtX = s => localNum(Math.round(s)) + 's';
    const sc = document.getElementById('chartSpeed'), pc = document.getElementById('chartPing');
    if (sc) speedChart = new LiveChart(sc, { kind: 'line', label: t('chart_speed'), formatX: fmtX,
        formatY: v => localNum(Math.round(v)) + ' IP/s' });
    if (pc) pingChart = new LiveChart(pc, { kind: 'dots', label: t('chart_ping'), formatX: fmtX,
        formatY: v => localNum(Math.round(v)) + ' ms' });
}

function resetCharts() {
    document.getElementById('chartsRow')?.classList.remove('hidden');
    speedChart?.reset();
    pingChart?.reset();
}

// ===== WebSocket =====
function initSocket() {
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => { addLog('INFO', 'Connected to server'); });
    socket.on('disconnect', () => { addLog('WARN', 'Disconnected from server'); });

    socket.on('scan_progress', data => {
        const bar = document.getElementById('progressBar');
        const status = document.getElementById('progressStatus');
        if (bar) bar.style.width = data.percent + '%';
        if (!data.phase && data.elapsed > 0) speedChart?.push(data.elapsed, data.speed);
        if (status) {
            status.textContent = data.phase === 'speed'
                ? t('speed_testing') + ' ' + localNum(data.done) + '/' + localNum(data.total)
                : data.phase === 'xray'
                ? t('xray_testing') + ' ' + localNum(data.done) + '/' + localNum(data.total)
                : localNum(data.percent) + '% | ' + localNum(data.speed.toFixed(0)) + ' IP/s';
        }
        document.getElementById('statFound').textContent = localNum(resultCount);
    });

    socket.on('scan_result', data => {
        resultCount++;
        if (startTime && data.ping) pingChart?.push((Date.now() - startTime) / 1000, data.ping);
        addResultRow(data);
        document.getElementById('statFound').textContent = localNum(resultCount);
        if (data.ping) {
            document.getElementById('statLatency').textContent = localNum(Math.round(data.ping)) + ' ms';
        }
    });

    socket.on('scan_complete', data => {
        isScanning = false;
        clearInterval(timerInterval);
        const bar = document.getElementById('progressBar');
        if (bar) bar.style.width = '100%';
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStop').disabled = true;
        const elapsed = data.duration || ((Date.now() - startTime) / 1000).toFixed(1);
        const msg = t('scan_complete')
            .replace('{found}', localNum(data.total_found || resultCount))
            .replace('{time}', localNum(elapsed));
        document.getElementById('progressStatus').textContent = msg;
        addLog('INFO', 'Scan complete: ' + (data.total_found || resultCount) + ' IPs found');
        updateV2rayTools();
        checkResumable();  // a stopped scan can be continued later
    });

    socket.on('scan_result_update', data => {
        const row = document.querySelector('#resultsBody tr[data-ip="' + CSS.escape(data.ip) + '"]');
        if (!row) return;
        if (data.alive !== undefined) {
            row.classList.toggle('row-failed', data.alive === false);
            row.classList.toggle('row-dead', data.alive === false);
        }
        if (data.ping !== undefined) {
            row.dataset.ping = data.ping ?? '';
            const cell = row.querySelector('.ping-cell');
            if (cell) cell.textContent = data.alive === false ? t('dead_label') : (data.ping ? localNum(Math.round(data.ping)) + ' ms' : '—');
        }
        if (data.colo !== undefined) {
            row.dataset.colo = data.colo || '';
            const cell = row.querySelector('.colo-cell');
            if (cell) { cell.textContent = data.colo || '—'; cell.title = data.colo_name || ''; }
            addColoOption(data.colo, data.colo_name);
        }
        if (data.speed !== undefined) {
            row.querySelector('.speed-cell').textContent = formatSpeed(data.speed);
            row.dataset.speed = data.speed ?? '';
        }
        if (data.score != null) row.dataset.score = data.score;
        if (data.real_delay !== undefined) row.dataset.real = data.real_delay ?? '';
        if (data.score != null) {
            row.querySelector('.score-cell').textContent = localNum(Number(data.score).toFixed(0)) + '/' + localNum('100');
        }
        if (data.real_delay !== undefined) {
            const cell = row.querySelector('.real-cell');
            if (cell) cell.textContent = formatRealDelay(data.real_delay);
            row.classList.toggle('row-failed', data.real_delay !== null && data.real_delay < 0);
        }
        applyResultsView();
    });

    socket.on('scan_error', data => {
        isScanning = false;
        clearInterval(timerInterval);
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStop').disabled = true;
        document.getElementById('progressStatus').textContent = 'Error: ' + (data.error || 'Unknown');
        addLog('ERROR', 'Scan error: ' + (data.error || 'Unknown'));
    });

    socket.on('retest_complete', data => {
        isRetesting = false;
        const btn = document.getElementById('btnRetest');
        if (btn) btn.disabled = false;
        showToast(t('retest_done').replace('{alive}', localNum(data.alive || 0)).replace('{dead}', localNum(data.dead || 0)));
        applyResultsView();
    });
    socket.on('scan_log', data => { addLog(data.level, data.message); });
    socket.on('favorites_update', data => {
        if (!document.getElementById('favoritesModal')?.classList.contains('hidden')) renderFavorites(data.favorites || []);
    });
    socket.on('scan_status', data => {
        addLog('INFO', 'Scan status: ' + data.status + ', total IPs: ' + data.total);
        if (data.status === 'speed_testing') {
            document.getElementById('progressStatus').textContent = t('speed_testing');
        } else if (data.status === 'xray_testing') {
            document.getElementById('progressStatus').textContent = t('xray_testing');
        }
    });
}

// ===== Log =====
function addLog(level, message) {
    const container = document.getElementById('logContainer');
    if (!container) return;
    const entry = document.createElement('div');
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0];
    entry.className = 'log-entry ' + (level || 'info').toLowerCase();
    const displayTs = lang === 'fa' ? toFaNum(ts) : ts;
    entry.textContent = '[' + displayTs + '] [' + level + '] ' + message;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

// Escape untrusted text before putting it into innerHTML
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== Results Table =====
function addResultRow(data) {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;
    const row = document.createElement('tr');
    const ports = (data.open_ports || []).map(p => escapeHtml(p) + '\u2705').join(' ');
    const ping = data.ping ? localNum(Math.round(data.ping)) + ' ms' : '\u2014';
    const score = data.score ? localNum(data.score.toFixed(0)) + '/' + localNum('100') : '\u2014';
    const isV2ray = data.is_v2ray === true;
    const showOperator = currentScanMethod !== 'cloud';
    const operatorText = escapeHtml(data.operator || '\u2014');
    const ipText = escapeHtml(data.ip);
    row.dataset.ip = data.ip;
    row.dataset.rank = resultCount;
    row.dataset.ping = data.ping ?? '';
    row.dataset.score = data.score ?? '';
    row.dataset.colo = data.colo || '';
    row.dataset.speed = data.speed ?? '';
    row.dataset.real = data.real_delay ?? '';

    let cells =
        '<td><button type="button" class="btn-star" title="' + escapeHtml(t('favorites_btn')) + '">\u2606</button> ' +
            localNum('#' + resultCount) + '</td>' +
        '<td class="ip-cell" data-ip="' + ipText + '">' + ipText + '</td>' +
        '<td class="ping-cell">' + ping + '</td>' +
        '<td>' + (ports || '\u2014') + '</td>' +
        '<td class="score-cell">' + score + '</td>' +
        '<td class="colo-cell" title="' + escapeHtml(data.colo_name || '') + '">' + escapeHtml(data.colo || '—') + '</td>' +
        '<td class="speed-cell">' + formatSpeed(data.speed) + '</td>';
    if (showOperator) {
        cells += '<td>' + operatorText + '</td>';
    }
    if (isV2ray) {
        cells += '<td class="real-cell">' + formatRealDelay(data.real_delay) + '</td>';
        cells += '<td class="download-col"><button type="button" class="btn btn-sm btn-download" data-ip="' + ipText + '">' + (lang === 'fa' ? '\u062F\u0627\u0646\u0644\u0648\u062F' : 'Download') + '</button>' +
            ' <button type="button" class="btn btn-sm btn-qr">' + t('qr_btn') + '</button></td>';
    }
    row.innerHTML = cells;
    row.querySelector('.btn-star').addEventListener('click', e => addFavorite(data, e.currentTarget));
    row.querySelector('.ip-cell').addEventListener('click', () => {
        navigator.clipboard?.writeText(data.ip);
        showToast(t('ip_copied') + ' ' + data.ip);
    });
    if (isV2ray) {
        const btn = row.querySelector('.btn-download');
        if (btn) btn.addEventListener('click', () => downloadV2rayConfig(data.ip));
        row.querySelector('.btn-qr')?.addEventListener('click', () => showConfigQr(data.ip));
    }
    if (data.alive === false) row.classList.add('row-failed', 'row-dead');
    tbody.appendChild(row);
    addColoOption(data.colo, data.colo_name);
    applyResultsView();
}

// ===== Results: sort + filter (client-side, on the rows already shown) =====
let sortKey = null, sortAsc = true;

function sortValue(row, key) {
    const v = row.dataset[key];
    if (key === 'colo') return v || '\uFFFF';
    if (v === '' || v === undefined) return null;
    const n = Number(v);
    if (key === 'real' && n < 0) return Infinity;  // failed real tests sort last
    return n;
}

function applyResultsView() {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;
    const text = (document.getElementById('resultsFilter')?.value || '').trim().toLowerCase();
    const colo = document.getElementById('coloFilter')?.value || '';
    const onlyWorking = document.getElementById('onlyWorking')?.checked;
    const rows = Array.from(tbody.rows);
    rows.forEach(r => {
        const matchText = !text || r.dataset.ip.toLowerCase().includes(text) || r.dataset.colo.toLowerCase().includes(text);
        const matchColo = !colo || r.dataset.colo === colo;
        const failed = r.classList.contains('row-failed');
        r.classList.toggle('hidden', !(matchText && matchColo && !(onlyWorking && failed)));
    });
    if (!sortKey) return;
    rows.sort((a, b) => {
        const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
        if (va === null && vb === null) return Number(a.dataset.rank) - Number(b.dataset.rank);
        if (va === null) return 1;   // untested values always last
        if (vb === null) return -1;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortAsc ? cmp : -cmp;
    });
    rows.forEach(r => tbody.appendChild(r));
}

function setSort(key) {
    // Score and speed are "higher is better": first click sorts descending
    const defaultAsc = !(key === 'score' || key === 'speed');
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = defaultAsc; }
    document.querySelectorAll('#resultsTable th[data-sort]').forEach(th => {
        th.classList.toggle('sort-asc', th.dataset.sort === sortKey && sortAsc);
        th.classList.toggle('sort-desc', th.dataset.sort === sortKey && !sortAsc);
    });
    applyResultsView();
}

function addColoOption(colo, coloName) {
    const sel = document.getElementById('coloFilter');
    if (!sel || !colo || Array.from(sel.options).some(o => o.value === colo)) return;
    const opt = document.createElement('option');
    opt.value = colo;
    opt.textContent = coloName ? colo + ' — ' + coloName : colo;
    sel.appendChild(opt);
}

function resetResultsView() {
    const sel = document.getElementById('coloFilter');
    if (sel) while (sel.options.length > 1) sel.remove(1);
}

// ===== Scan profiles =====
const PROFILES = {
    quick:    { mode: 'hyper', target: '50',  ping_max: '800',  ports: '443',
                speed: false, xray: false },
    balanced: { mode: 'turbo', target: '100', ping_max: '1500', ports: '443,8443,2053,2083,2087,2096',
                speed: true, speed_count: '5', speed_size: '1024', xray: true, xray_count: '20' },
    thorough: { mode: 'deep',  target: '500', ping_max: '3000', ports: '443,80,8443,2053,2083,2087,2096',
                speed: true, speed_count: '20', speed_size: '5120', xray: true, xray_count: '50' },
    mobile:   { mode: 'ultra', target: '100', ping_max: '2500', ports: '443,8443,2053',
                speed: true, speed_count: '10', speed_size: '512', xray: true, xray_count: '20' },
};

function setField(id, value) {
    const el = document.getElementById(id);
    if (!el || value === undefined) return;
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value;
}

async function applyProfile(name) {
    const p = PROFILES[name];
    if (!p) return;
    setField('settingMode', p.mode);
    setField('settingTarget', p.target);
    setField('settingPingMin', '0');
    setField('settingPingMax', p.ping_max);
    setField('settingPorts', p.ports);
    setField('settingSpeedTest', p.speed);
    setField('settingSpeedCount', p.speed_count);
    setField('settingSpeedSize', p.speed_size);
    setField('settingXrayTest', p.xray);
    setField('settingXrayCount', p.xray_count);
    await saveSettings({ quiet: true });
    showToast(t('profile_applied') + ' ' + t('profile_' + name));
}


// ===== Favorites / monitoring =====
async function addFavorite(data, btn) {
    const res = await api('/favorites', 'POST', {
        ip: data.ip, port: (data.open_ports || [])[0] || 443, ping: data.ping, colo: data.colo,
    });
    if (res.error) { showToast(res.error); return; }
    if (btn) { btn.textContent = '\u2605'; btn.classList.add('active'); }
    showToast(t('fav_added') + ' ' + data.ip);
}

function renderFavorites(list) {
    const body = document.getElementById('favoritesBody');
    const empty = document.getElementById('favoritesEmpty');
    if (!body) return;
    body.innerHTML = '';
    empty?.classList.toggle('hidden', list.length > 0);
    list.forEach(f => {
        const tr = document.createElement('tr');
        const status = f.last_ok === true ? '\u2705' : f.last_ok === false ? '\u274C' : '\u2014';
        const ping = f.last_ping ? localNum(Math.round(f.last_ping)) + ' ms' : '\u2014';
        const uptime = f.uptime_24h != null ? localNum(f.uptime_24h) + '%' : '\u2014';
        const last = f.last_checked ? new Date(f.last_checked + 'Z').toLocaleString(lang === 'fa' ? 'fa-IR' : undefined) : '\u2014';
        tr.innerHTML =
            '<td>' + status + '</td>' +
            '<td class="ip-cell">' + escapeHtml(f.ip) + '</td>' +
            '<td>' + localNum(f.port) + '</td>' +
            '<td>' + ping + '</td>' +
            '<td>' + escapeHtml(f.last_colo || '\u2014') + '</td>' +
            '<td>' + uptime + '</td>' +
            '<td>' + escapeHtml(last) + '</td>' +
            '<td><button type="button" class="btn btn-sm btn-fav-remove">\uD83D\uDDD1</button></td>';
        tr.querySelector('.ip-cell').addEventListener('click', () => {
            navigator.clipboard?.writeText(f.ip);
            showToast(t('ip_copied') + ' ' + f.ip);
        });
        tr.querySelector('.btn-fav-remove').addEventListener('click', async () => {
            await api('/favorites/' + encodeURIComponent(f.ip), 'DELETE');
            loadFavorites();
        });
        body.appendChild(tr);
    });
}

async function loadFavorites() {
    const list = await api('/favorites');
    renderFavorites(Array.isArray(list) ? list : []);
}

async function openFavorites() {
    document.getElementById('favoritesModal').classList.remove('hidden');
    loadFavorites();
}

async function checkFavoritesNow() {
    const btn = document.getElementById('btnFavCheck');
    if (btn) { btn.disabled = true; btn.textContent = t('fav_checking'); }
    const res = await api('/favorites/check', 'POST');
    if (btn) { btn.disabled = false; btn.textContent = t('fav_check_now'); }
    if (res.favorites) renderFavorites(res.favorites);
}

async function testTelegram() {
    const res = await api('/telegram/test', 'POST', {
        telegram_token: document.getElementById('settingTgToken')?.value || '',
        telegram_chat_id: document.getElementById('settingTgChat')?.value || '',
        telegram_proxy: document.getElementById('settingTgProxy')?.value || '',
    });
    showToast(res.error ? 'Telegram: ' + res.error : t('tg_sent'));
}

function formatRealDelay(delay) {
    if (delay == null) return '\u2014';
    if (delay < 0) return '\u274C';
    return '\u2705 ' + localNum(Math.round(delay)) + ' ms';
}

async function refreshXrayStatus() {
    const el = document.getElementById('xrayStatus');
    const btn = document.getElementById('btnInstallXray');
    if (!el) return;
    const st = await api('/xray/status');
    if (st.available) {
        el.textContent = t('xray_ready') + ' ' + (st.version || '');
        btn?.classList.add('hidden');
    } else {
        el.textContent = t('xray_missing');
        btn?.classList.toggle('hidden', st.can_install === false);
    }
}

async function installXray() {
    const el = document.getElementById('xrayStatus');
    const btn = document.getElementById('btnInstallXray');
    if (btn) btn.disabled = true;
    if (el) el.textContent = t('xray_installing');
    const res = await api('/xray/install', 'POST');
    if (btn) btn.disabled = false;
    if (res.error) { if (el) el.textContent = res.error; return; }
    refreshXrayStatus();
}

function formatSpeed(speed) {
    if (speed == null || speed === '') return '\u2014';
    return speed >= 1024
        ? localNum((speed / 1024).toFixed(1)) + ' MB/s'
        : localNum(Math.round(speed)) + ' ' + t('speed_unit');
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // Fallback for contexts without the async clipboard API
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

function updateV2rayTools() {
    const tools = document.getElementById('v2rayTools');
    if (tools) tools.classList.toggle('hidden', !(currentScanMethod === 'v2ray' && sessionId && resultCount > 0));
}

async function copySubscriptionLink() {
    if (!sessionId) return;
    const url = location.origin + '/api/v2ray/subscription/' + sessionId;
    if (await copyText(url)) showToast(t('sub_copied'));
}

async function downloadClientConfig(fmt) {
    if (!sessionId) return;
    const url = '/api/v2ray/export/' + sessionId + '?format=' + fmt;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || ('HTTP ' + res.status));
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fmt === 'clash' ? 'clash-' + sessionId + '.yaml' : 'sing-box-' + sessionId + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (e) {
        showToast('Error: ' + e.message);
    }
}

async function copyAllConfigs() {
    if (!sessionId) return;
    try {
        const res = await fetch('/api/v2ray/subscription/' + sessionId + '?format=plain');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (await copyText(await res.text())) showToast(t('configs_copied'));
    } catch (e) {
        showToast('Error: ' + e.message);
    }
}

async function showConfigQr(ip) {
    if (!currentV2rayConfig) return;
    try {
        const res = await fetch('/api/v2ray/qr', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: currentV2rayConfig, ip: ip }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const svg = await res.text();
        document.getElementById('qrModal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'qrModal';
        modal.className = 'modal';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:380px">' +
                '<div class="modal-header"><h2>' + escapeHtml(t('qr_title')) + '</h2>' +
                    '<button class="modal-close">&times;</button></div>' +
                '<div class="modal-body qr-body"></div>' +
                '<p style="text-align:center">' + escapeHtml(ip) + '</p>' +
            '</div>';
        // SVG generated by our own server (segno), not user-controlled markup
        modal.querySelector('.qr-body').innerHTML = svg.replace(/^<\?xml[^>]*>/, '');
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    } catch (e) {
        showToast('Error: ' + e.message);
    }
}

async function downloadV2rayConfig(ip) {
    if (!currentV2rayConfig) {
        showToast(lang === 'fa' ? '\u0627\u0628\u062A\u062F\u0627 \u06A9\u0627\u0646\u0641\u06CC\u06AF \u0627\u0648\u0644\u06CC\u0647 \u0631\u0627 \u062F\u0631 \u0628\u0627\u06A9\u0633 \u0628\u0630\u0627\u0631\u06CC\u062F' : 'Paste the original config in the V2Ray box first');
        return;
    }
    const res = await api('/v2ray/build-config', 'POST', { config: currentV2rayConfig, ip: ip });
    if (res.error) { showToast(res.error); return; }
    const blob = new Blob([res.config], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'v2ray-' + ip + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(lang === 'fa' ? '\u062F\u0627\u0646\u0644\u0648\u062F \u0634\u062F: ' + ip : 'Downloaded: ' + ip);
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--accent);color:var(--accent-fg);padding:0.5rem 1.25rem;border-radius:8px;font-size:0.85rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ===== API Helpers =====
async function api(url, method, body) {
    const opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch('/api' + url, opts);
        return await res.json();
    } catch (e) {
        addLog('ERROR', 'API error: ' + e.message);
        return {};
    }
}

function apiWithTimeout(url, method, body, timeoutMs) {
    const ctrl = new AbortController();
    const opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal };
    if (body) opts.body = JSON.stringify(body);
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 60000);
    return fetch('/api' + url, opts)
        .then(res => res.json())
        .finally(() => clearTimeout(timer));
}

// ===== Settings =====
async function loadSettings() {
    if (!document.getElementById('settingMode')) return; // landing page has no settings form
    const s = await api('/settings');
    if (s.mode) document.getElementById('settingMode').value = s.mode;
    if (s.target_count) document.getElementById('settingTarget').value = s.target_count;
    if (s.ping_min) document.getElementById('settingPingMin').value = s.ping_min;
    if (s.ping_max) document.getElementById('settingPingMax').value = s.ping_max;
    if (s.scan_ports) document.getElementById('settingPorts').value = s.scan_ports;
    const speedEl = document.getElementById('settingSpeedTest');
    if (speedEl) speedEl.checked = (s.speed_test === 'true');
    if (s.speed_test_size) document.getElementById('settingSpeedSize').value = s.speed_test_size;
    if (s.speed_test_count) document.getElementById('settingSpeedCount').value = s.speed_test_count;
    if (s.speed_test_url) document.getElementById('settingSpeedUrl').value = s.speed_test_url;
    const profEl = document.getElementById('scanProfile');
    if (profEl && s.profile) profEl.value = s.profile;
    const xrayEl = document.getElementById('settingXrayTest');
    if (xrayEl) xrayEl.checked = (s.xray_test === 'true');
    if (s.xray_test_count) document.getElementById('settingXrayCount').value = s.xray_test_count;
    if (s.xray_test_url) document.getElementById('settingXrayUrl').value = s.xray_test_url;
    if (s.monitor_interval) document.getElementById('settingMonitorInterval').value = s.monitor_interval;
    document.getElementById('settingTgToken').value = s.telegram_token || '';
    document.getElementById('settingTgChat').value = s.telegram_chat_id || '';
    document.getElementById('settingTgProxy').value = s.telegram_proxy || '';
    const notifyEl = document.getElementById('settingNotifyScan');
    if (notifyEl) notifyEl.checked = (s.notify_scan_complete === 'true');
    if (s.theme) setTheme(s.theme);
    // Log checkbox
    const logEl = document.getElementById('settingLogEnabled');
    const logVal = (s.log_enabled === 'true' || s.log_enabled === true);
    if (logEl) logEl.checked = logVal;
    setLogVisible(logVal);
    // Debug checkbox
    const debugEl = document.getElementById('settingDebug');
    const debugVal = (s.debug_enabled === 'true' || s.debug_enabled === true);
    if (debugEl) debugEl.checked = debugVal;
    setDebugVisible(debugVal);
    document.getElementById('statTarget').textContent = localNum(s.target_count || '100');
}

async function saveSettings(opts) {
    const quiet = opts && opts.quiet;
    const prof = document.getElementById('scanProfile');
    // Settings changed by hand: no longer a predefined profile
    if (!quiet && prof) prof.value = 'custom';
    const theme = document.querySelector('input[name="theme"]:checked')?.value || 'light';
    const logEnabledVal = document.getElementById('settingLogEnabled')?.checked || false;
    const debugEnabledVal = document.getElementById('settingDebug')?.checked || false;
    setTheme(theme);
    setLogVisible(logEnabledVal);
    setDebugVisible(debugEnabledVal);
    await api('/settings', 'POST', {
        mode: document.getElementById('settingMode').value,
        target_count: document.getElementById('settingTarget').value,
        ping_min: document.getElementById('settingPingMin').value,
        ping_max: document.getElementById('settingPingMax').value,
        scan_ports: document.getElementById('settingPorts').value,
        speed_test: document.getElementById('settingSpeedTest')?.checked ? 'true' : 'false',
        speed_test_size: document.getElementById('settingSpeedSize')?.value || '1024',
        speed_test_count: document.getElementById('settingSpeedCount')?.value || '10',
        speed_test_url: document.getElementById('settingSpeedUrl')?.value || '',
        xray_test: document.getElementById('settingXrayTest')?.checked ? 'true' : 'false',
        xray_test_count: document.getElementById('settingXrayCount')?.value || '20',
        xray_test_url: document.getElementById('settingXrayUrl')?.value || '',
        monitor_interval: document.getElementById('settingMonitorInterval')?.value || '0',
        telegram_token: document.getElementById('settingTgToken')?.value.trim() || '',
        telegram_chat_id: document.getElementById('settingTgChat')?.value.trim() || '',
        telegram_proxy: document.getElementById('settingTgProxy')?.value.trim() || '',
        notify_scan_complete: document.getElementById('settingNotifyScan')?.checked ? 'true' : 'false',
        log_enabled: logEnabledVal ? 'true' : 'false',
        debug_enabled: debugEnabledVal ? 'true' : 'false',
        theme: theme,
        profile: prof?.value || 'custom',
    });
    document.getElementById('statTarget').textContent = localNum(document.getElementById('settingTarget').value);
    if (quiet) return;
    document.getElementById('settingsModal').classList.add('hidden');
    showToast(lang === 'fa' ? '\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F' : 'Settings saved');
}

// ===== Scan =====
async function startScan() {
    if (isScanning) return;

    const ranges = document.getElementById('rangesText').value.trim().split('\n').filter(l => l.trim());
    const method = document.getElementById('scanMethod').value;
    const v2rayConfig = document.getElementById('v2rayConfig')?.value || '';

    if (ranges.length === 0 && method !== 'operators') {
        showToast(lang === 'fa' ? '\u0627\u0628\u062A\u062F\u0627 \u0631\u0646\u062C\u200C\u0647\u0627 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F' : 'Enter ranges or fetch them first');
        return;
    }

    document.getElementById('resumeBanner')?.classList.add('hidden');
    enterScanningState(method);
    addLog('INFO', 'Scan started: method=' + method);
    await startScanRequest(ranges, method, v2rayConfig);
}

// Reset the results area and switch the UI to "scanning" (new or resumed scan)
function enterScanningState(method) {
    isScanning = true;
    resultCount = 0;
    currentScanMethod = method;
    resetResultsView();
    resetCharts();
    sessionId = null;
    updateV2rayTools();
    currentV2rayConfig = (method === 'v2ray' ? (document.getElementById('v2rayConfig')?.value || '') : '');
    startTime = Date.now();
    document.getElementById('resultsBody').innerHTML = '';
    document.getElementById('logContainer').innerHTML = '';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnStop').disabled = false;
    document.getElementById('statFound').textContent = localNum(0);
    document.getElementById('statLatency').textContent = '\u2014 ms';
    document.getElementById('progressStatus').textContent = lang === 'fa' ? '\u062F\u0631 \u062D\u0627\u0644 \u0627\u0633\u06A9\u0646...' : 'Scanning...';

    // Show/hide method-specific columns
    document.getElementById('thOperator')?.classList.toggle('hidden', method === 'cloud');
    document.getElementById('thDownload')?.classList.toggle('hidden', method !== 'v2ray');
    document.getElementById('thReal')?.classList.toggle('hidden', method !== 'v2ray');

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('statTime').textContent = localNum(elapsed) + 's';
    }, 1000);
}

// ===== Resume an interrupted / stopped scan =====
async function checkResumable() {
    const banner = document.getElementById('resumeBanner');
    if (!banner) return;
    const r = await api('/scan/resumable');
    if (!r.resumable) { banner.classList.add('hidden'); return; }
    document.getElementById('resumeText').textContent = t('resume_text')
        .replace('{id}', localNum(r.session_id))
        .replace('{found}', localNum(r.found))
        .replace('{target}', localNum(r.target_count === 'All' ? '\u221E' : r.target_count));
    banner.dataset.sessionId = r.session_id;
    banner.dataset.method = r.scan_method || 'cloud';
    banner.classList.remove('hidden');
}

async function resumeScan() {
    const banner = document.getElementById('resumeBanner');
    const sid = Number(banner.dataset.sessionId);
    const method = banner.dataset.method;
    enterScanningState(method);
    const res = await api('/scan/resume', 'POST', { session_id: sid });
    if (res.error || !res.session_id) {
        addLog('ERROR', res.error || 'Could not resume scan');
        showToast(res.error || 'Could not resume scan');
        leaveScanningState();
        return;
    }
    banner.classList.add('hidden');
    sessionId = res.session_id;
    addLog('INFO', 'Resumed session #' + sessionId);
    // Show what the scan had already found
    const prior = await api('/scan/results?limit=10000&session_id=' + sessionId);
    (Array.isArray(prior) ? prior : []).forEach(r => {
        if (document.querySelector('#resultsBody tr[data-ip="' + CSS.escape(r.ip) + '"]')) return;
        resultCount++;
        addResultRow(Object.assign({}, r, { is_v2ray: method === 'v2ray' }));
    });
    document.getElementById('statFound').textContent = localNum(resultCount);
}

async function discardResume() {
    await api('/scan/discard-resume', 'POST');
    document.getElementById('resumeBanner')?.classList.add('hidden');
}

function leaveScanningState() {
    isScanning = false;
    clearInterval(timerInterval);
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStop').disabled = true;
}

async function startScanRequest(ranges, method, v2rayConfig) {
    const data = await api('/scan/start', 'POST', {
        ranges: ranges,
        scan_method: method,
        mode: document.getElementById('settingMode')?.value || 'hyper',
        target_count: document.getElementById('settingTarget')?.value || '100',
        ping_min: document.getElementById('settingPingMin')?.value || '0',
        ping_max: document.getElementById('settingPingMax')?.value || '9999',
        ports: document.getElementById('settingPorts')?.value || '443,80,8443,2053,2083,2087,2096',
        operator_key: document.getElementById('operatorSelect')?.value || '',
        country: document.getElementById('operatorCountry')?.value || 'ir',
        v2ray_config: v2rayConfig,
        log_enabled: logEnabled,
        debug_enabled: document.getElementById('settingDebug')?.checked || false,
        speed_test: document.getElementById('settingSpeedTest')?.checked || false,
        speed_test_size: document.getElementById('settingSpeedSize')?.value || '1024',
        speed_test_count: document.getElementById('settingSpeedCount')?.value || '10',
        speed_test_url: document.getElementById('settingSpeedUrl')?.value || '',
        xray_test: document.getElementById('settingXrayTest')?.checked || false,
        xray_test_count: document.getElementById('settingXrayCount')?.value || '20',
        xray_test_url: document.getElementById('settingXrayUrl')?.value || '',
    });

    if (data.error || !data.session_id) {
        addLog('ERROR', data.error || 'Could not start scan');
        if (data.error) showToast(data.error);
        leaveScanningState();
        return;
    }
    sessionId = data.session_id;
    addLog('INFO', 'Session created: #' + data.session_id);
}

async function stopScan() {
    await api('/scan/stop', 'POST');
    isScanning = false;
    clearInterval(timerInterval);
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStop').disabled = true;
    addLog('INFO', 'Scan stopped by user');
}

// ===== Fetch Ranges =====
async function fetchRanges(source) {
    const statusEl = document.getElementById('fetchStatus');
    const statusMsg = lang === 'fa' ? '\u062F\u0631 \u062D\u0627\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A...' : 'Fetching...';
    statusEl.textContent = statusMsg;
    addLog('INFO', 'Fetching ranges from: ' + source);
    try {
        const data = await apiWithTimeout('/ranges/fetch', 'POST', { source }, 60000);
        document.getElementById('fetchedRanges').value = (data.ranges || []).join('\n');
        const count = data.count || 0;
        if (data.error) {
            statusEl.textContent = (lang === 'fa' ? '\u062E\u0637\u0627: ' : 'Error: ') + data.error;
            addLog('ERROR', data.error);
            showToast(data.error);
        } else {
            statusEl.textContent = localNum(count) + ' ranges from ' + source;
            addLog('INFO', 'Fetched ' + count + ' ranges');
        }
    } catch (e) {
        let errMsg = e.message || '';
        if (e.name === 'AbortError' || errMsg.indexOf('abort') !== -1)
            errMsg = lang === 'fa' ? '\u0627\u062E\u062A\u0635\u0627\u0644 \u06CC\u0627 \u0628\u06CC\u0627\u0646\u062F\u0627\u062F (\u062A\u0627\u06CC\u0645\u0627\u0648\u062A)' : 'Timeout or connection aborted';
        if (!errMsg) errMsg = lang === 'fa' ? '\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627 \u0646\u0634\u062F' : 'Request failed';
        statusEl.textContent = errMsg;
        addLog('ERROR', errMsg);
        showToast(errMsg);
    }
}

function useFetchedRanges() {
    const fetched = document.getElementById('fetchedRanges').value;
    if (fetched) document.getElementById('rangesText').value = fetched;
    document.getElementById('fetchModal').classList.add('hidden');
}

// ===== Scan Method Toggle =====
function onScanMethodChange() {
    const method = document.getElementById('scanMethod').value;
    document.getElementById('operatorSection').classList.toggle('hidden', method !== 'operators');
    document.getElementById('v2raySection').classList.toggle('hidden', method !== 'v2ray');
    var thOp = document.getElementById('thOperator');
    if (thOp) thOp.classList.toggle('hidden', method === 'cloud');
    var thDl = document.getElementById('thDownload');
    if (thDl) thDl.classList.toggle('hidden', method !== 'v2ray');
}

// ===== V2Ray =====
async function parseV2RayConfig() {
    const config = document.getElementById('v2rayConfig').value;
    if (!config) return;
    const data = await api('/v2ray/parse', 'POST', { config });
    const el = document.getElementById('v2rayParsed');
    if (data.error) { el.textContent = 'Error: ' + data.error; }
    else {
        el.innerHTML = '<strong>Protocol:</strong> ' + escapeHtml(data.protocol) + '<br>' +
            '<strong>IP:</strong> ' + escapeHtml(data.ip) + '<br>' +
            '<strong>Port:</strong> ' + escapeHtml(data.port) + '<br>' +
            '<strong>SNI:</strong> ' + escapeHtml(data.params?.sni || '\u2014') + '<br>' +
            '<strong>Host:</strong> ' + escapeHtml(data.params?.host || '\u2014');
    }
    el.classList.remove('hidden');
}

// ===== Operators =====
async function loadOperators() {
    const select = document.getElementById('operatorSelect');
    if (!select) return; // landing page has no scanner form
    const country = document.getElementById('operatorCountry')?.value || 'ir';
    const data = await api('/ranges/operators?country=' + country);
    select.innerHTML = '';
    const keys = Object.keys(data);
    for (const key of keys) {
        const info = data[key];
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = info.name + ' (' + localNum(info.prefix_count) + ' ranges)';
        select.appendChild(opt);
    }
    if (keys.length) select.value = keys[0];
}

async function fetchAllOperators() {
    const country = document.getElementById('operatorCountry')?.value || 'ir';
    showToast(lang === 'fa' ? '\u062F\u0631 \u062D\u0627\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A...' : 'Fetching operator ranges...');
    await api('/ranges/operators/fetch-all', 'POST', { country });
    await loadOperators();
    showToast(lang === 'fa' ? '\u0647\u0645\u0647 \u0631\u0646\u062C\u200C\u0647\u0627\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F' : 'All operator ranges fetched');
}

// ===== Re-test & copy best =====
let isRetesting = false;

async function retestResults() {
    if (!sessionId || resultCount === 0) { showToast(t('retest_none')); return; }
    if (isScanning || isRetesting) return;
    const res = await api('/scan/retest', 'POST', { session_id: sessionId });
    if (!res || res.error) { showToast(res?.error || 'Error'); return; }
    isRetesting = true;
    const btn = document.getElementById('btnRetest');
    if (btn) btn.disabled = true;
    showToast(t('retest_started').replace('{n}', localNum(res.count || 0)));
}

async function copyBestIps(n) {
    const rows = Array.from(document.querySelectorAll('#resultsBody tr'))
        .filter(r => !r.classList.contains('hidden') && !r.classList.contains('row-failed'));
    if (!sortKey) rows.sort((a, b) => Number(b.dataset.score || 0) - Number(a.dataset.score || 0));
    const ips = rows.slice(0, n || 10).map(r => r.dataset.ip);
    if (!ips.length) { showToast(t('retest_none')); return; }
    if (await copyText(ips.join('\n'))) showToast(t('best_copied').replace('{n}', localNum(ips.length)));
}

// ===== Export & Reset =====
function exportResults(fmt) {
    let url = '/api/export/' + fmt;
    const params = [];
    if (sessionId) params.push('session_id=' + sessionId);
    if (fmt === 'excel') params.push('lang=' + (lang || 'en'));
    if (params.length) url += '?' + params.join('&');
    window.open(url, '_blank');
}

async function resetData() {
    await api('/reset', 'POST');
    document.getElementById('resultsBody').innerHTML = '';
    document.getElementById('logContainer').innerHTML = '';
    document.getElementById('statFound').textContent = localNum(0);
    document.getElementById('statLatency').textContent = '\u2014 ms';
    document.getElementById('statTime').textContent = localNum(0) + 's';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressStatus').textContent = t('ready_status');
    showToast(lang === 'fa' ? '\u062F\u0627\u062F\u0647\u200C\u0647\u0627 \u067E\u0627\u06A9 \u0634\u062F' : 'Data reset');
}

function addRange() {
    const input = document.getElementById('addRangeInput');
    const val = input.value.trim();
    if (!val) return;
    const textarea = document.getElementById('rangesText');
    textarea.value = (textarea.value ? textarea.value + '\n' : '') + val;
    input.value = '';
}

// ===== Update Checker with Confirmation + Progress =====
function openExternal(url) {
    // target=_blank links are opened in the system browser by the desktop window too
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

async function checkForUpdate() {
    const btn = document.getElementById('btnCheckUpdate');
    if (btn) btn.disabled = true;
    showToast(t('update_checking'));
    addLog('INFO', t('update_checking'));

    try {
        const data = await api('/check-update', 'POST');
        if (data.error) {
            showToast(t('update_error') + ' ' + data.error);
            addLog('ERROR', t('update_error') + ': ' + data.error);
        } else if (data.update_available && data.can_self_update === false && data.download_url) {
            // Packaged desktop app: updates are new releases, not git pulls
            showToast('v' + data.remote_version + ' \u2192 ' + data.download_url);
            openExternal(data.download_url);
        } else if (data.update_available) {
            // Show confirmation modal
            showUpdateModal(data.remote_version);
        } else {
            showToast(t('update_latest'));
            addLog('INFO', t('update_latest') + ' (v' + data.current_version + ')');
        }
    } catch (e) {
        showToast(t('update_error'));
        addLog('ERROR', 'Update check error: ' + e.message);
    }
    if (btn) btn.disabled = false;
}

function showUpdateModal(version) {
    // Remove existing modal if any
    let existing = document.getElementById('updateModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'updateModal';
    modal.className = 'modal';
    modal.innerHTML =
        '<div class="modal-content" style="max-width:450px">' +
            '<div class="modal-header"><h2>' + t('update_btn') + '</h2>' +
                '<button class="modal-close" id="closeUpdate">&times;</button></div>' +
            '<div class="modal-body" style="text-align:center">' +
                '<p style="font-size:1rem;margin-bottom:1rem">' + escapeHtml(t('update_confirm').replace('{v}', version)) + '</p>' +
                '<div id="updateProgressWrap" class="hidden" style="margin:1rem 0">' +
                    '<div class="progress-bar-outer"><div class="progress-bar-inner" id="updateProgressBar" style="width:0%"></div></div>' +
                    '<p id="updateProgressText" style="font-size:0.8rem;color:var(--muted);margin-top:0.5rem"></p>' +
                '</div>' +
            '</div>' +
            '<div class="modal-footer" id="updateFooter">' +
                '<button class="btn btn-primary" id="btnUpdateYes">' + t('update_yes') + '</button>' +
                '<button class="btn" id="btnUpdateNo">' + t('update_no') + '</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);

    document.getElementById('closeUpdate').onclick = () => modal.remove();
    document.getElementById('btnUpdateNo').onclick = () => modal.remove();
    document.getElementById('btnUpdateYes').onclick = () => doUpdate(modal, version);
}

async function doUpdate(modal, version) {
    const footer = document.getElementById('updateFooter');
    const progressWrap = document.getElementById('updateProgressWrap');
    const progressBar = document.getElementById('updateProgressBar');
    const progressText = document.getElementById('updateProgressText');

    // Hide buttons, show progress
    footer.classList.add('hidden');
    progressWrap.classList.remove('hidden');

    // Step 1: Downloading (0-40%)
    progressBar.style.width = '10%';
    progressText.textContent = t('update_downloading');
    addLog('INFO', t('update_downloading'));

    await new Promise(r => setTimeout(r, 500));
    progressBar.style.width = '30%';

    // Step 2: Installing (40-80%)
    progressBar.style.width = '40%';
    progressText.textContent = t('update_installing');
    addLog('INFO', t('update_installing'));

    const res = await api('/do-update', 'POST');

    if (res.error) {
        progressText.textContent = t('update_error') + ' ' + res.error;
        progressBar.style.width = '100%';
        progressBar.style.background = 'var(--error)';
        addLog('ERROR', 'Update failed: ' + res.error);
        footer.classList.remove('hidden');
        footer.innerHTML = '<button class="btn" onclick="document.getElementById(\'updateModal\').remove()">' + t('close_btn') + '</button>';
        return;
    }

    // Step 3: Restarting (80-100%)
    progressBar.style.width = '80%';
    progressText.textContent = t('update_restarting');
    addLog('INFO', t('update_restarting'));

    await new Promise(r => setTimeout(r, 1000));
    progressBar.style.width = '100%';

    // Countdown reload
    let countdown = 5;
    const countdownInterval = setInterval(() => {
        countdown--;
        progressText.textContent = t('update_restarting').replace('5', String(countdown));
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            window.location.reload();
        }
    }, 1000);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('cdn-theme') || 'light';
    setTheme(savedTheme);
    applyTranslations();
    initCharts();
    initSocket();
    loadSettings();

    // Event listeners
    document.getElementById('btnCheckUpdate')?.addEventListener('click', checkForUpdate);
    document.getElementById('btnTheme')?.addEventListener('click', toggleTheme);
    document.getElementById('btnStart')?.addEventListener('click', startScan);
    document.getElementById('btnStop')?.addEventListener('click', stopScan);
    document.getElementById('btnAddRange')?.addEventListener('click', addRange);
    document.getElementById('btnReset')?.addEventListener('click', resetData);
    document.getElementById('btnRetest')?.addEventListener('click', retestResults);
    document.getElementById('btnCopyBest')?.addEventListener('click', () => copyBestIps(10));
    document.getElementById('scanMethod')?.addEventListener('change', onScanMethodChange);
    document.getElementById('btnParseConfig')?.addEventListener('click', parseV2RayConfig);
    document.getElementById('operatorCountry')?.addEventListener('change', loadOperators);
    document.getElementById('btnFetchAllOps')?.addEventListener('click', fetchAllOperators);
    document.getElementById('btnCopySub')?.addEventListener('click', copySubscriptionLink);
    document.getElementById('btnInstallXray')?.addEventListener('click', installXray);
    document.getElementById('btnFavorites')?.addEventListener('click', openFavorites);
    document.getElementById('scanProfile')?.addEventListener('change', e => applyProfile(e.target.value));
    ['resultsFilter', 'coloFilter', 'onlyWorking'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', applyResultsView);
    });
    document.querySelectorAll('#resultsTable th[data-sort]').forEach(th =>
        th.addEventListener('click', () => setSort(th.dataset.sort)));
    document.getElementById('btnFavCheck')?.addEventListener('click', checkFavoritesNow);
    document.getElementById('btnTgTest')?.addEventListener('click', testTelegram);
    document.getElementById('btnResume')?.addEventListener('click', resumeScan);
    document.getElementById('btnResumeDiscard')?.addEventListener('click', discardResume);
    checkResumable();
    document.getElementById('btnDiagnostics')?.addEventListener('click', () => openExternal('/api/diagnostics'));
    ['closeFavorites', 'btnCloseFavorites'].forEach(id => document.getElementById(id)?.addEventListener('click',
        () => document.getElementById('favoritesModal').classList.add('hidden')));
    refreshXrayStatus();
    document.getElementById('btnCopyAllConfigs')?.addEventListener('click', copyAllConfigs);
    document.getElementById('btnExportClash')?.addEventListener('click', () => downloadClientConfig('clash'));
    document.getElementById('btnExportSingbox')?.addEventListener('click', () => downloadClientConfig('singbox'));

    // Settings modal
    document.getElementById('btnSettings')?.addEventListener('click', () => document.getElementById('settingsModal').classList.remove('hidden'));
    document.getElementById('closeSettings')?.addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
    document.getElementById('btnCloseSettings')?.addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
    document.getElementById('btnSaveSettings')?.addEventListener('click', saveSettings);

    // Fetch modal
    document.getElementById('btnFetchRanges')?.addEventListener('click', () => document.getElementById('fetchModal').classList.remove('hidden'));
    document.getElementById('closeFetch')?.addEventListener('click', () => document.getElementById('fetchModal').classList.add('hidden'));
    document.getElementById('btnCloseFetch')?.addEventListener('click', () => document.getElementById('fetchModal').classList.add('hidden'));
    document.getElementById('btnUseFetched')?.addEventListener('click', useFetchedRanges);
    document.querySelectorAll('.fetch-buttons .btn').forEach(btn => {
        const source = btn.dataset.source;
        if (source) btn.addEventListener('click', () => fetchRanges(source));
    });

    // Save/Export: show format modal
    document.getElementById('btnSave')?.addEventListener('click', () => {
        if (resultCount === 0) {
            showToast(lang === 'fa' ? '\u0646\u062A\u06CC\u062C\u0647\u200C\u0627\u06CC \u0628\u0631\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0646\u06CC\u0633\u062A' : 'No results to save');
            return;
        }
        document.getElementById('exportModal').classList.remove('hidden');
    });
    document.getElementById('closeExport')?.addEventListener('click', () => document.getElementById('exportModal').classList.add('hidden'));
    document.getElementById('btnCloseExport')?.addEventListener('click', () => document.getElementById('exportModal').classList.add('hidden'));
    document.querySelectorAll('.btn-export, [data-export]').forEach(btn => {
        btn.addEventListener('click', () => {
            const fmt = btn.getAttribute('data-export');
            if (fmt) { exportResults(fmt); document.getElementById('exportModal').classList.add('hidden'); }
        });
    });

    // Analyze
    document.getElementById('btnAnalyze')?.addEventListener('click', async () => {
        if (resultCount === 0) { showToast(lang === 'fa' ? '\u0646\u062A\u06CC\u062C\u0647\u200C\u0627\u06CC \u0646\u06CC\u0633\u062A' : 'No results'); return; }
        const data = await api('/scan/results?limit=200' + (sessionId ? '&session_id=' + sessionId : ''));
        if (!data || data.length === 0) return;
        const avgPing = data.reduce((s, r) => s + (r.ping || 0), 0) / data.length;
        const best = data[0];
        const colos = {};
        data.forEach(r => { if (r.colo) colos[r.colo] = (colos[r.colo] || 0) + 1; });
        const coloText = Object.entries(colos).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ': ' + n).join(', ') || 'N/A';
        const speeds = data.filter(r => r.speed).map(r => r.speed);
        const bestSpeed = speeds.length ? Math.max(...speeds) : null;
        alert('Analysis\n' + '='.repeat(30) + '\nFound: ' + data.length + '\nAvg Ping: ' + Math.round(avgPing) + ' ms' +
              '\nBest IP: ' + best.ip + '\nBest Ping: ' + (best.ping ? Math.round(best.ping) : 'N/A') + ' ms\nBest Score: ' + best.score + '/100' +
              '\nData centers: ' + coloText +
              (bestSpeed ? '\nFastest download: ' + formatSpeed(bestSpeed) : ''));
    });

    loadOperators();
    addLog('INFO', 'CDN IP Scanner V 2.0 ready');
});
