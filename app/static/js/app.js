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
        app_title: "CDN IP Scanner V 2.0", app_subtitle: "High accuracy \u2022 Ultra fast \u2022 AI powered",
        target: "Target", latency: "Latency", found: "Found", time: "Time",
        settings: "\u2699\uFE0F Settings", mode: "Mode", count: "Count",
        fetch_ranges_btn: "\uD83D\uDCE1 Fetch Ranges", analyze_btn: "\uD83E\uDD16 AI Analyze",
        save_btn: "\uD83D\uDCBE Save", stop_btn: "\u23F9\uFE0F Stop", start_btn: "\uD83D\uDE80 Start Scan",
        export_modal_title: "Choose export format", export_hint: "Select the format for downloading results:",
        export_json: "JSON", export_excel: "Excel", export_text: "Text (IPs only)",
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
        scan_complete: "Done! {found} IPs in {time}s", ip_copied: "IP copied!",
    },
    fa: {
        app_title: "CDN IP Scanner V 2.0", app_subtitle: "\u062F\u0642\u062A \u0628\u0627\u0644\u0627 \u2022 \u0633\u0631\u0639\u062A \u0641\u0648\u0642\u200C\u0627\u0644\u0639\u0627\u062F\u0647 \u2022 \u0642\u062F\u0631\u062A \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC",
        target: "\u0647\u062F\u0641", latency: "\u062A\u0623\u062E\u06CC\u0631", found: "\u06CC\u0627\u0641\u062A \u0634\u062F\u0647", time: "\u0632\u0645\u0627\u0646",
        settings: "\u2699\uFE0F \u062A\u0646\u0638\u06CC\u0645\u0627\u062A", mode: "\u062D\u0627\u0644\u062A", count: "\u062A\u0639\u062F\u0627\u062F",
        fetch_ranges_btn: "\uD83D\uDCE1 \u062F\u0631\u06CC\u0627\u0641\u062A \u0631\u0646\u062C\u200C\u0647\u0627", analyze_btn: "\uD83E\uDD16 \u062A\u062D\u0644\u06CC\u0644 AI",
        save_btn: "\uD83D\uDCBE \u0630\u062E\u06CC\u0631\u0647", stop_btn: "\u23F9\uFE0F \u062A\u0648\u0642\u0641", start_btn: "\uD83D\uDE80 \u0634\u0631\u0648\u0639 \u0627\u0633\u06A9\u0646",
        export_modal_title: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0641\u0631\u0645\u062A \u062E\u0631\u0648\u062C\u06CC", export_hint: "\u0641\u0631\u0645\u062A \u062E\u0631\u0648\u062C\u06CC \u0631\u0627 \u0628\u0631\u0627\u06CC \u062F\u0627\u0646\u0644\u0648\u062F \u0646\u062A\u0627\u06CC\u062C \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F:",
        export_json: "JSON", export_excel: "\u0627\u06A9\u0633\u0644", export_text: "\u062A\u06A9\u0633\u062A (\u0641\u0642\u0637 \u0622\u06CC\u200C\u067E\u06CC)",
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
        scan_complete: "\u0627\u062A\u0645\u0627\u0645! {found} IP \u062F\u0631 {time} \u062B\u0627\u0646\u06CC\u0647", ip_copied: "IP \u06A9\u067E\u06CC \u0634\u062F!",
    },
    zh: {
        app_title: "CDN IP \u626B\u63CF\u5668 V 2.0", app_subtitle: "\u9AD8\u7CBE\u5EA6 \u2022 \u8D85\u5FEB \u2022 AI \u9A71\u52A8",
        target: "\u76EE\u6807", latency: "\u5EF6\u8FDF", found: "\u5DF2\u627E\u5230", time: "\u65F6\u95F4",
        settings: "\u2699\uFE0F \u8BBE\u7F6E", start_btn: "\uD83D\uDE80 \u5F00\u59CB\u626B\u63CF", stop_btn: "\u23F9\uFE0F \u505C\u6B62",
        save_btn: "\uD83D\uDCBE \u4FDD\u5B58", ready_status: "\u51C6\u5907\u5C31\u7EEA",
        results_title: "\u7ED3\u679C", rank_hdr: "\u6392\u540D", ip_hdr: "IP", ping_hdr: "Ping",
        ports_hdr: "\u7AEF\u53E3", score_hdr: "\u5206\u6570", operator_hdr: "\u8FD0\u8425\u5546",
        log_title: "\uD83D\uDCCB \u626B\u63CF\u65E5\u5FD7", download_hdr: "\u4E0B\u8F7D",
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
        app_title: "CDN IP \u0421\u043A\u0430\u043D\u0435\u0440 V 2.0", app_subtitle: "\u0422\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u2022 \u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u2022 \u0418\u0418",
        target: "\u0426\u0435\u043B\u044C", latency: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430", found: "\u041D\u0430\u0439\u0434\u0435\u043D\u043E", time: "\u0412\u0440\u0435\u043C\u044F",
        settings: "\u2699\uFE0F \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438", start_btn: "\uD83D\uDE80 \u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C", stop_btn: "\u23F9\uFE0F \u0421\u0442\u043E\u043F",
        save_btn: "\uD83D\uDCBE \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C", ready_status: "\u0413\u043E\u0442\u043E\u0432",
        results_title: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B", rank_hdr: "\u0420\u0430\u043D\u0433", ip_hdr: "IP", ping_hdr: "Ping",
        ports_hdr: "\u041F\u043E\u0440\u0442\u044B", score_hdr: "\u041E\u0446\u0435\u043D\u043A\u0430", operator_hdr: "\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440",
        log_title: "\uD83D\uDCCB \u041B\u043E\u0433 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F", download_hdr: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C",
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
        const text = t(key);
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

// ===== WebSocket =====
function initSocket() {
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => { addLog('INFO', 'Connected to server'); });
    socket.on('disconnect', () => { addLog('WARN', 'Disconnected from server'); });

    socket.on('scan_progress', data => {
        const bar = document.getElementById('progressBar');
        const status = document.getElementById('progressStatus');
        if (bar) bar.style.width = data.percent + '%';
        if (status) {
            status.textContent = localNum(data.percent) + '% | ' + localNum(data.speed.toFixed(0)) + ' IP/s';
        }
        document.getElementById('statFound').textContent = localNum(resultCount);
    });

    socket.on('scan_result', data => {
        resultCount++;
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
    });

    socket.on('scan_error', data => {
        isScanning = false;
        clearInterval(timerInterval);
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStop').disabled = true;
        document.getElementById('progressStatus').textContent = 'Error: ' + (data.error || 'Unknown');
        addLog('ERROR', 'Scan error: ' + (data.error || 'Unknown'));
    });

    socket.on('scan_log', data => { addLog(data.level, data.message); });
    socket.on('scan_status', data => { addLog('INFO', 'Scan status: ' + data.status + ', total IPs: ' + data.total); });
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

// ===== Results Table =====
function addResultRow(data) {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;
    const row = document.createElement('tr');
    const ports = (data.open_ports || []).map(p => p + '\u2705').join(' ');
    const ping = data.ping ? localNum(Math.round(data.ping)) + ' ms' : '\u2014';
    const score = data.score ? localNum(data.score.toFixed(0)) + '/' + localNum('100') : '\u2014';
    const isV2ray = data.is_v2ray === true;
    const showOperator = currentScanMethod !== 'cloud';
    const operatorText = data.operator || '\u2014';

    let cells =
        '<td>' + localNum('#' + resultCount) + '</td>' +
        '<td class="ip-cell" data-ip="' + data.ip + '">' + data.ip + '</td>' +
        '<td>' + ping + '</td>' +
        '<td>' + (ports || '\u2014') + '</td>' +
        '<td>' + score + '</td>';
    if (showOperator) {
        cells += '<td>' + operatorText + '</td>';
    }
    if (isV2ray) {
        cells += '<td class="download-col"><button type="button" class="btn btn-sm btn-download" data-ip="' + data.ip + '">' + (lang === 'fa' ? '\u062F\u0627\u0646\u0644\u0648\u062F' : 'Download') + '</button></td>';
    }
    row.innerHTML = cells;
    row.querySelector('.ip-cell').addEventListener('click', () => {
        navigator.clipboard?.writeText(data.ip);
        showToast(t('ip_copied') + ' ' + data.ip);
    });
    if (isV2ray) {
        const btn = row.querySelector('.btn-download');
        if (btn) btn.addEventListener('click', () => downloadV2rayConfig(data.ip));
    }
    tbody.appendChild(row);
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
    const s = await api('/settings');
    if (s.mode) document.getElementById('settingMode').value = s.mode;
    if (s.target_count) document.getElementById('settingTarget').value = s.target_count;
    if (s.ping_min) document.getElementById('settingPingMin').value = s.ping_min;
    if (s.ping_max) document.getElementById('settingPingMax').value = s.ping_max;
    if (s.scan_ports) document.getElementById('settingPorts').value = s.scan_ports;
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

async function saveSettings() {
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
        log_enabled: logEnabledVal ? 'true' : 'false',
        debug_enabled: debugEnabledVal ? 'true' : 'false',
        theme: theme,
    });
    document.getElementById('statTarget').textContent = localNum(document.getElementById('settingTarget').value);
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

    isScanning = true;
    resultCount = 0;
    currentScanMethod = method;
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

    // Show/hide operator column
    var thOperator = document.getElementById('thOperator');
    if (thOperator) thOperator.classList.toggle('hidden', method === 'cloud');
    var thDownload = document.getElementById('thDownload');
    if (thDownload) thDownload.classList.toggle('hidden', method !== 'v2ray');

    addLog('INFO', 'Scan started: method=' + method);

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('statTime').textContent = localNum(elapsed) + 's';
    }, 1000);

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
        clear_previous: true,
    });

    if (data.session_id) {
        sessionId = data.session_id;
        addLog('INFO', 'Session created: #' + data.session_id);
    } else if (data.error) {
        addLog('ERROR', data.error);
    }
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
        el.innerHTML = '<strong>Protocol:</strong> ' + data.protocol + '<br>' +
            '<strong>IP:</strong> ' + data.ip + '<br>' +
            '<strong>Port:</strong> ' + data.port + '<br>' +
            '<strong>SNI:</strong> ' + (data.params?.sni || '\u2014') + '<br>' +
            '<strong>Host:</strong> ' + (data.params?.host || '\u2014');
    }
    el.classList.remove('hidden');
}

// ===== Operators =====
async function loadOperators() {
    const country = document.getElementById('operatorCountry')?.value || 'ir';
    const data = await api('/ranges/operators?country=' + country);
    const select = document.getElementById('operatorSelect');
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
                '<p style="font-size:1rem;margin-bottom:1rem">' + t('update_confirm').replace('{v}', version) + '</p>' +
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
    initSocket();
    loadSettings();

    // Event listeners
    document.getElementById('btnCheckUpdate')?.addEventListener('click', checkForUpdate);
    document.getElementById('btnTheme')?.addEventListener('click', toggleTheme);
    document.getElementById('btnStart')?.addEventListener('click', startScan);
    document.getElementById('btnStop')?.addEventListener('click', stopScan);
    document.getElementById('btnAddRange')?.addEventListener('click', addRange);
    document.getElementById('btnReset')?.addEventListener('click', resetData);
    document.getElementById('scanMethod')?.addEventListener('change', onScanMethodChange);
    document.getElementById('btnParseConfig')?.addEventListener('click', parseV2RayConfig);
    document.getElementById('operatorCountry')?.addEventListener('change', loadOperators);
    document.getElementById('btnFetchAllOps')?.addEventListener('click', fetchAllOperators);

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
        alert('AI Analysis\n' + '='.repeat(30) + '\nFound: ' + data.length + '\nAvg Ping: ' + Math.round(avgPing) + ' ms\nBest IP: ' + best.ip + '\nBest Ping: ' + (best.ping ? Math.round(best.ping) : 'N/A') + ' ms\nBest Score: ' + best.score + '/100');
    });

    loadOperators();
    addLog('INFO', 'CDN IP Scanner V 2.0 ready');
});
