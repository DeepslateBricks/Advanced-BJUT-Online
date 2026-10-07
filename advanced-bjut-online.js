// ==UserScript==
// @name         Advanced BJUT Online
// @description  更好的北京工业大学教务 / 门户使用体验
// @match        https://webvpn.bjut.edu.cn/*
// @match        https://jwglxt.bjut.edu.cn/*
// @match        https://*.chaoxing.com/*
// @grant        GM_notification
// @grant        GM_cookie
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @icon         http://cdn.urongda.com/images/normal/medium/beijing-university-of-technology-logo-1024px.png
// @version      0.3.1
// @updateURL    https://cdn.jsdelivr.net/gh/DeepslateBricks/Advanced-BJUT-Online/advanced-bjut-online.js
// @downloadURL  https://cdn.jsdelivr.net/gh/DeepslateBricks/Advanced-BJUT-Online/advanced-bjut-online.js
// ==/UserScript==

// 使用方式：安装 Tampermonkey（https://www.tampermonkey.net/index.php?locale=zh_cn）后将本脚本添加到 Tampermonkey 中。
// 功能：
// 1. 教务系统 - 学生学业情况查询
//      - 优化修读情况显示
//      - 记录并展示学分加权平均分历史
//      - 提供加权平均分试算面板
// 2. 教务系统 - 学生成绩查询
//      - 添加成绩更新监测按钮，变更时桌面通知
// 3. 教务系统 - 学生课表查询
//      - 提供优化的 PDF 打印样式
// 4. 校门户站首页
//      - 优化左下角工具区域排列顺序
// 5. 教务系统 - 隐藏教务首页照片
// 6. 教务系统 - 点击左上角页面名称可退回主页
// 7. 教务系统 - 个人信息页
//      - 表格可拖拽调整高度
// 8. WebVPN 功能
//      - WebVPN 首页左下角添加“保持会话活跃”按钮
//        Note: 可以避免长时间不操作导致退出登录；使用成绩监测功能也可以保持会话活跃
//      - 延长 WebVPN Cookies 有效期
//        Note: 此功能在 Tampermonkey BETA 下可用，可以避免退出浏览器后登陆状态丢失

(function () {
    "use strict";
    const disableOptimizedScorePanel = false;

    /**
     * @param {string} s
     * @returns {HTMLElement | null}
     */
    const $ = (s) => document.querySelector(s);
    /**
     * @param {string} s
     * @returns {NodeListOf<HTMLElement>}
     */
    const $$ = (s) => document.querySelectorAll(s);

    const action = (mode, condition, action, timeoutMs = 30000) => {
        const startTime = Date.now();
        let interval = setInterval(() => {
            if (Date.now() - startTime > timeoutMs) {
                clearInterval(interval);
                console.warn(`action 轮询超时（${timeoutMs}ms），已自动终止`);
                return;
            }
            if (condition()) {
                action();
                if (mode == "until") clearInterval(interval);
            }
        }, 100);
    };

    const styleSheet = new CSSStyleSheet();
    document.adoptedStyleSheets.push(styleSheet);
    const putStyleRule = (rule) => styleSheet.insertRule(rule);
    const putStyles = (styles) => {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = styles;
        document.body.append(styleElement);
    };

    // putStyleRule(`#Tips { display: none; }`);

    if (location.pathname.endsWith("/page/site/index")) {
        putStyleRule(`.sIndex_bottom_left { display: flex; flex-direction: column-reverse; gap: 2em; }`);
        putStyleRule(`.sIndex_bottom_left > * { margin: 0 !important; }`);
    }

    if (location.pathname.endsWith("/xtgl/index_initMenu.html")) {
        putStyleRule(`.media-object { width: 0 !important; }`);
    }

    if (location.pathname.endsWith("/cjcx/cjcx_cxDgXscj.html")) {
        $("#search_go")?.insertAdjacentHTML(
            "beforebegin",
            `<button type="button"class="btn btn-default"id="observeNew"style="margin-right: 0.5em;font-family: ui-monospace;">监测</button>`,
        );
        let onObserve = false;
        $("#observeNew")?.addEventListener("click", () => {
            if (onObserve) return;
            onObserve = true;
            $("#observeNew")?.setAttribute("disabled");
            $("title") && ($("title").innerText = "🤖 学生成绩查询");
            let worker = null;
            try {
                worker = new Worker(
                    "data:application/javascript;base64," +
                    btoa(
                        `const refresh=()=>{self.postMessage('tick');setTimeout(refresh,(3+Math.random()*4)*60*1000)};refresh();`,
                    ),
                );
            } catch (err) {
                console.warn("Web Worker 创建失败（可能被 CSP 拦截），降级为主线程轮询", err);
            }

            const doObserveTick = () => {
                if ($("#observeNew")) $("#observeNew").innerText =
                    `监测(${new Date().toLocaleTimeString()})`;
                const countBeforeRefresh = $(".ui-paging-info")?.innerText || '';
                $("#search_go")?.click();
                action(
                    "until",
                    () => $(".loading")?.style.display == "none",
                    () => {
                        setTimeout(() => {
                            const countAfterRefresh =
                                  $(".ui-paging-info")?.innerText || '';
                            console.log(
                                `[${new Date().toLocaleTimeString()}] ${countBeforeRefresh} => ${countAfterRefresh}`,
                            );
                            if (
                                countBeforeRefresh !== countAfterRefresh &&
                                !countBeforeRefresh.includes("无")
                            ) {
                                GM_notification({
                                    text: "我们发现了一个成绩更新！",
                                    title: "成绩更新",
                                });
                                showToast('成绩更新', '我们检测到了一个成绩更新');
                            }
                        }, 1000);
                    },
                );
            };

            if (worker) {
                worker.onmessage = doObserveTick;
            } else {
                const fallbackTick = () => {
                    doObserveTick();
                    setTimeout(fallbackTick, (3 + Math.random() * 4) * 60 * 1000);
                };
                fallbackTick();
            }
        });
    }

    putStyles(`
.score-update-toast { position: fixed; bottom: 24px; right: 24px; z-index: 999999; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 4px rgba(0, 0, 0, 0.08); padding: 16px 20px; max-width: 320px; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; transform: translateX(calc(100% + 40px)); opacity: 0; transition: transform 0.35s cubic-bezier(0,0,0,1), opacity 0.25s ease; cursor: pointer; will-change: transform; }
.score-update-toast.visible { transform: translateX(0); opacity: 1; }
.score-update-toast-title { font-size: 14px; font-weight: 600; color: #323130; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.score-update-toast-title::before { content: ""; display: inline-block; width: 3px; height: 14px; background-color: #0078d4; border-radius: 2px; }
.score-update-toast-message { font-size: 13px; color: #605e5c; line-height: 1.4; }
`);

    function showToast(title = '', content = '', timeout = 2000) {
        const existing = document.querySelector('.score-update-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'score-update-toast';
        toast.innerHTML = `
            <div class="score-update-toast-title">${title}</div>
            <div class="score-update-toast-message">${content}</div>
        `;
        document.body.append(toast);

        let hideTimer = null;

        const cancelAutoHide = () => {
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        };

        const hide = () => {
            cancelAutoHide();
            toast.classList.remove('visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        };

        const onShow = () => {
            document.removeEventListener('visibilitychange', onShow);
            hideTimer = setTimeout(hide, Math.max(timeout, 3000));
        };

        toast.addEventListener('click', hide);

        requestAnimationFrame(() => toast.classList.add('visible'));

        if (document.visibilityState === 'visible') {
            hideTimer = setTimeout(hide, timeout);
        } else {
            document.addEventListener('visibilitychange', onShow);
        }
    }

    try {
        GM_cookie.list({ name: "wengine_vpn_ticketwebvpn_bjut_edu_cn" }, (cookies, error) => {
            if (error) { console.warn('GM_cookie.list 失败', error); return; }
            if (!cookies?.length) return;
            const cookie = cookies[0];
            GM_cookie.delete(cookie);
            GM_cookie.set({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || "/",
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
                url: location.href
            });
        });
    } catch (err) { console.warn('Cookie 持久化失败', err); }

    if (!location.pathname.includes('xtgl')) {
        document.querySelectorAll('#topButton.navbar-brand')?.forEach((el) => {
            el.setAttribute('onclick', "location.href = '..'");
            el.setAttribute('href', '..');
        });
    }

    if (location.pathname.endsWith("/xsxy/xsxyqk_cxXsxyqkIndex.html")) {
        (function () {
            "use strict";

            const alertBox = document.getElementById('alertBox');
            if (!alertBox || disableOptimizedScorePanel) return;

            let avgScore = (() => {
                try {
                    const el = $('#alertBox font:nth-child(2) font');
                    return el ? Number(el.innerText) : NaN;
                } catch { return NaN; }
            })();
            /**
             * @type {Array<[string, number]>}
             * @description [DateString, AvgScore][]
             */
            let history = (() => {
                try {
                    let fromLocalStorage = localStorage.getItem('betterBJUTOnline_score_history');
                    if (fromLocalStorage) {
                        localStorage.removeItem('betterBJUTOnline_score_history');
                        let parsed = JSON.parse(fromLocalStorage);
                        if (Array.isArray(parsed)) {
                            GM_setValue('betterBJUTOnline_score_history', parsed);
                        }
                    }
                    let value = GM_getValue('betterBJUTOnline_score_history', []);
                    if (Array.isArray(value)) return value;
                    else return [];
                } catch { return []; }
            })();
            /**
             * @type {string}
             * @description YYYY-MM-DD
             */
            let currentDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

            if (!isNaN(avgScore)) {
                if (history.length) {
                    if (history[history.length - 1][0] == currentDate) history[history.length - 1][1] = avgScore;
                    else if (Math.abs(history[history.length - 1][1] - avgScore) > 0.0001) history.push([currentDate, avgScore]);
                } else history.push([currentDate, avgScore]);
            }

            GM_setValue('betterBJUTOnline_score_history', history);

            const groupHistory = (history) => {
                if (!history.length) return [];
                const sorted = [...history].sort((a, b) => new Date(a[0]) - new Date(b[0]));
                const groups = [];
                let i = sorted.length - 1;
                while (i >= 0) {
                    const root = sorted[i];
                    const group = [root];
                    const rootDate = new Date(root[0]);
                    let j = i - 1;
                    while (j >= 0) {
                        if ((rootDate - new Date(sorted[j][0])) / (1000 * 60 * 60 * 24) <= 14) {
                            group.unshift(sorted[j]);
                            j--;
                        } else break;
                    }
                    groups.unshift(group);
                    i = j;
                }
                return groups;
            };

            const groups = groupHistory(history);
            let itemsHtml = groups.map(group => {
                const hasSubEntries = group.length > 1;
                return `
        <li class="score-history-item${hasSubEntries ? ' score-history-group' : ''}">
            ${group.map((h, idx) => {
                    const isRoot = idx === group.length - 1;
                    return `<div class="score-history-entry${isRoot ? ' root-entry' : ' sub-entry'}">
                    <span class="score-history-date">${isRoot ? (hasSubEntries ? '> ' : '- ') : '&nbsp;'} ${h[0]}</span>
                    <span class="score-history-value">${h[1]}</span>
                </div>`;
                }).join('')}
        </li>`;
            }).join('');

            $('form#form')?.insertAdjacentHTML('afterend', `
        <div class="score-history-card">
            <div class="score-history-title">分数历史</div>
            <ul class="score-history-list">
                ${itemsHtml}
            </ul>
        </div>
    `);

            $('.score-history-list')?.addEventListener('click', (e) => {
                const li = e.target.closest('.score-history-group');
                if (li) li.classList.toggle('expanded');
            });

            let data = {
                name: "-",
                time: "-",
                gpa: "-",
                total: "-",
                passed: "-",
                failed: "-",
                unstudied: "-",
                studying: "-",
                extraPassed: "-",
                extraFailed: "-"
            };

            try {
                const text = alertBox.innerText || alertBox.textContent;
                const nameMatch = text.match(/(.*?)同学/);
                const timeMatch = text.match(/统计时间\s*([^之前有效]+)/);
                const gpaMatch = text.match(/学分加权平均分\s*([\d.]+)/);
                const totalMatch = text.match(/计划总课程\s*(\d+)/);
                const passedMatch = text.match(/通过\s*(\d+)/);
                const failedMatch = text.match(/未通过\s*(\d+)/);
                const unstudiedMatch = text.match(/未修\s*(\d+)/);
                const studyingMatch = text.match(/在读\s*(\d+)/);

                if (nameMatch) data.name = nameMatch[1].trim();
                if (timeMatch) data.time = timeMatch[1].trim();
                if (gpaMatch) data.gpa = gpaMatch[1];
                if (totalMatch) data.total = totalMatch[1];
                if (passedMatch) data.passed = passedMatch[1];
                if (failedMatch) data.failed = failedMatch[1];
                if (unstudiedMatch) data.unstudied = unstudiedMatch[1];
                if (studyingMatch) data.studying = studyingMatch[1];

                const parts = text.split('计划外');
                if (parts.length > 1) {
                    const epMatch = parts[1].match(/通过\s*(\d+)/);
                    const efMatch = parts[1].match(/未通过\s*(\d+)/);
                    if (epMatch) data.extraPassed = epMatch[1];
                    if (efMatch) data.extraFailed = efMatch[1];
                }
            } catch (e) {
                console.warn("解析数据失败，使用预设结构渲染", e);
            }

            const styleElement = document.createElement('style');
            styleElement.innerHTML = `
.academic-status-card { margin: 24px auto; padding: 20px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.08); font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; max-width: 800px; }
.academic-status-title { font-size: 15px; font-weight: 600; color: #323130; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
.academic-status-title::before { content: ""; display: inline-block; width: 3px; height: 14px; background-color: #0078d4; border-radius: 2px; }
.academic-status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; list-style: none; padding: 0; margin: 0; }
@media (max-width: 640px) { .academic-status-grid { grid-template-columns: repeat(2, 1fr); } }
.academic-status-item { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 4px; transition: all 0.15s ease; }
.academic-status-item:hover { background-color: #f3f2f1; border-color: #e0e0e0; }
.academic-status-label { color: #605e5c; font-size: 12px; }
.academic-status-value { color: #201f1e; font-weight: 600; font-size: 16px; }
.academic-status-time { font-size: 11px; color: #a19f9d; font-weight: normal; margin-left: auto; }
`;
            document.body.append(styleElement);

            alertBox.outerHTML = `
        <div class="academic-status-card">
            <div class="academic-status-title">
                <span>${data.name} 同学，您的课程修读情况（供参考）</span>
                <span class="academic-status-time">截止：${data.time}</span>
            </div>
            <ul class="academic-status-grid">
                <li class="academic-status-item">
                    <span class="academic-status-label">学分加权平均分</span>
                    <span class="academic-status-value" style="color: #0078d4; font-size: 18px;">${data.gpa}</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">计划总课程</span>
                    <span class="academic-status-value">${data.total} 门</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">计划内通过</span>
                    <span class="academic-status-value" style="color: #107c41;">${data.passed} 门</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">计划内未通过</span>
                    <span class="academic-status-value" ${Number(data.failed) > 0 ? 'style="color: #d83b01;"' : ''}>${data.failed} 门</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">未修课程</span>
                    <span class="academic-status-value">${data.unstudied} 门</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">在读课程</span>
                    <span class="academic-status-value" style="color: #f2994a;">${data.studying} 门</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">计划外通过</span>
                    <span class="academic-status-value">${data.extraPassed} 门</span>
                </li>
                <li class="academic-status-item">
                    <span class="academic-status-label">计划外未通过</span>
                    <span class="academic-status-value" ${Number(data.extraFailed) > 0 ? 'style="color: #d83b01;"' : ''}>${data.extraFailed} 门</span>
                </li>
            </ul>
        </div>
    `;
        })();

        putStyles(`
.score-history-card { margin: 24px auto; padding: 20px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.08); font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; max-width: 500px; }
.score-history-title { font-size: 15px; font-weight: 600; color: #323130; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.score-history-title::before { content: ""; display: inline-block; width: 3px; height: 14px; background-color: #0078d4; border-radius: 2px; }
.score-history-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; max-height: 25em; }
.score-history-item { display: flex; flex-direction: column; padding: 0; border-radius: 4px; transition: background-color 0.15s ease; }
.score-history-item:hover { background-color: #f3f2f1; }
.score-history-entry { display: flex; justify-content: space-between; align-items: center; }
.score-history-entry.root-entry { padding: 10px 12px; }
.score-history-entry.sub-entry { display: none; padding: 10px 12px; opacity: 0.5; font-size: 0.9em; }
.score-history-group { cursor: pointer; }
.score-history-group.expanded .score-history-entry.sub-entry { display: flex; }
.score-history-date { color: #605e5c; font-size: 13px; font-family: 'JetBrains Mono', ui-monospace; }
.score-history-value { color: #201f1e; font-weight: 600; font-size: 14px; }
.fluent-btn-main { background: #0f6cbd; color: #ffffff; border: none; padding: 10px 24px; font-size: 14px; font-weight: 600; border-radius: 4px; cursor: pointer; transition: background-color 0.1s ease, box-shadow 0.1s ease; margin: 16px auto 24px auto; display: block; width: 100%; max-width: 500px; text-align: center; font-family: inherit; }
.fluent-btn-main:hover { background: #115ea3; }
.fluent-btn-main:active { background: #0f4c81; }
.fluent-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.2); backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.fluent-dialog { background: #ffffff; border: 1px solid #d1d1d1; border-radius: 8px; box-shadow: 0 32px 64px rgba(0,0,0,0.14), 0 2px 21px rgba(0,0,0,0.1); width: 90%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; animation: fluentScaleUp 0.15s cubic-bezier(0,0,0,1); }
@keyframes fluentScaleUp { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
.fluent-header { padding: 24px 24px 16px 24px; background: #ffffff; }
.fluent-avg-card { margin: 0; padding: 20px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; }
.fluent-avg-card-title { font-size: 15px; font-weight: 600; color: #323130; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.fluent-avg-card-title::before { content: ""; display: inline-block; width: 3px; height: 14px; background-color: #0078d4; border-radius: 2px; }
.fluent-avg-card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; list-style: none; padding: 0; margin: 0; }
@media (max-width: 480px) { .fluent-avg-card-grid { grid-template-columns: repeat(1, 1fr); } }
.fluent-avg-card-item { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 4px; transition: all 0.15s ease; }
.fluent-avg-card-item:hover { background-color: #f3f2f1; border-color: #e0e0e0; }
.fluent-avg-card-label { color: hsl(30, 2%, 16%); font-size: 12px; }
.fluent-avg-card-value { color: #0078d4; font-weight: 600; font-size: 16px; }
.fluent-body { padding: 0 24px; overflow-y: auto; flex: 1; }
.fluent-dialog-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
.fluent-dialog-table th { position: sticky; top: 0; background: #ffffff; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #616161; text-align: left; border-bottom: 1px solid #e0e0e0; z-index: 2; }
.fluent-dialog-table td { padding: 0.5em !important; font-size: 13px; color: #242424; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
.fluent-dialog-table tr:hover td { background: #f5f5f5; }
.fluent-score-input { width: 85px; padding: 5px 8px; border: 1px solid #d1d1d1; border-bottom: 2px solid #61616188; border-radius: 4px; background: #ffffff; font-size: 13px; color: #242424; box-sizing: border-box; transition: border-color 0.1s ease, border-bottom-color 0.1s ease; }
.fluent-score-input:focus { border-color: #0f6cbd; border-bottom: 2px solid #0f6cbd; outline: none; }
.fluent-score-input::placeholder { color: #707070; font-style: normal; }
.fluent-footer { padding: 24px; background: #ffffff; display: flex; justify-content: flex-end; border-top: 1px solid #f0f0f0; }
.fluent-btn-close { background: #ffffff; color: #242424; border: 1px solid #d1d1d1; padding: 6px 16px; font-size: 14px; border-radius: 4px; cursor: pointer; transition: background-color 0.1s, border-color 0.1s; }
.fluent-btn-close:hover { background: #f5f5f5; border-color: #a1a1a1; }
.fluent-btn-close:active { background: #eaeaea; }
.fluent-score-input.status-studying::placeholder { color: #d1b06b; }
.fluent-score-input.status-passed::placeholder { color: #79a68a; }
`);

        let dialogExists = false;

        action("until", () => document.querySelectorAll('table.table tbody tr').length > 0 && !!$('.score-history-card'), () => {
            const tableRows = document.querySelectorAll('table.table tbody tr');
            const courses = [];

            tableRows.forEach(row => {
                const cells = row.cells;
                if (cells && cells.length >= 13) {
                    const kcmcEl = row.querySelector('td[name="kcmc"]');
                    const xfEl = row.querySelector('td[name="xf"]');
                    const statusEl = row.querySelector('.png_ico_tjxk');

                    const name = kcmcEl ? kcmcEl.textContent.trim() : (cells[5] ? cells[5].textContent.trim() : '');
                    const nature = cells[7] ? cells[7].textContent.trim() : '';
                    const credit = xfEl ? parseFloat(xfEl.textContent.trim()) : (cells[8] ? parseFloat(cells[8].textContent.trim()) : 0);
                    const scoreText = cells[12] ? cells[12].textContent.trim() : '';
                    const status = statusEl ? statusEl.title : '';

                    if (name) {
                        courses.push({
                            name: name,
                            nature: nature,
                            credit: isNaN(credit) ? 0 : credit,
                            score: scoreText === '' ? null : parseFloat(scoreText),
                            status: status
                        });
                    }
                }
            });

            const mainBtn = document.createElement('button');
            mainBtn.className = 'fluent-btn-main';
            mainBtn.textContent = '加权平均分计算面板';

            const targetCard = $('.score-history-card');
            if (!targetCard) return;
            targetCard.parentNode.insertBefore(mainBtn, targetCard.nextSibling);

            mainBtn.addEventListener('click', () => {
                if (!dialogExists) {
                    renderFluentDialog(courses);
                }
            });
        });

        function renderFluentDialog(courses) {
            dialogExists = true;

            const backdrop = document.createElement('div');
            backdrop.className = 'fluent-backdrop';

            const dialog = document.createElement('div');
            dialog.className = 'fluent-dialog';

            const header = document.createElement('div');
            header.className = 'fluent-header';

            const avgCard = document.createElement('div');
            avgCard.className = 'fluent-avg-card';
            avgCard.innerHTML = `
                <div class="fluent-avg-card-title">加权平均分试算</div>
                <div class="fluent-avg-card-grid">
                    <div class="fluent-avg-card-item">
                        <span class="fluent-avg-card-label">加权平均分</span>
                        <span class="fluent-avg-card-value" id="avg-primary">-</span>
                    </div>
                    <div class="fluent-avg-card-item" style="cursor: pointer;" id="avg-excluded-card">
                        <span class="fluent-avg-card-label">
                            排除通识教育选修课
                            <span class="glyphicon glyphicon-info-sign" style="opacity: 0.5"></span>
                        </span>
                        <span class="fluent-avg-card-value" id="avg-excluded">-</span>
                    </div>
                    <div class="fluent-avg-card-item">
                        <span class="fluent-avg-card-label">计入总学分</span>
                        <span class="fluent-avg-card-value" id="avg-credits">-</span>
                    </div>
                </div>
            `;

            header.appendChild(avgCard);
            dialog.appendChild(header);


            const body = document.createElement('div');
            body.className = 'fluent-body';

            const table = document.createElement('table');
            table.className = 'fluent-dialog-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>课程名称</th>
                        <th>课程性质</th>
                        <th>学分</th>
                        <th>成绩</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');

            courses.forEach(course => {
                const tr = document.createElement('tr');
                tr.dataset.credit = course.credit;
                tr.dataset.nature = course.nature;

                const initScore = course.score !== null ? course.score : '';
                const isExcluded = (course.nature === '校选修课' || course.nature === '自主课程');
                const natureContent = isExcluded
                    ? `${course.nature} <span style="font-size: 11px; font-weight: 600;">(不计入加权)</span>`
                    : `<span style="color: #616161;">${course.nature}</span>`;

                let inputBg = '';
                let inputClass = 'fluent-score-input';
                if (course.status === '在修') { inputClass += ' status-studying'; inputBg = 'background-color: #fffdf5; border-color: #f2994a;'; }
                else if (course.status === '已修') { inputClass += ' status-passed'; inputBg = 'background-color: #f3fbf5; border-color: #107c41;'; }

                tr.innerHTML = `
                    <td><strong>${course.name}</strong></td>
                    <td>${natureContent}</td>
                    <td>${course.credit}</td>
                    <td>
                        <input class="${inputClass}" value="${initScore}" placeholder="未录入" min="0" max="100" step="any" style="${inputBg}">
                    </td>
                `;
                if (isExcluded) tr.style.opacity = 0.5;
                tbody.appendChild(tr);
            });

            body.appendChild(table);
            dialog.appendChild(body);

            const footer = document.createElement('div');
            footer.className = 'fluent-footer';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'fluent-btn-close';
            closeBtn.textContent = '关闭面板';
            closeBtn.addEventListener('click', () => {
                backdrop.remove()
                dialogExists = false;
            });

            footer.appendChild(closeBtn);
            dialog.appendChild(footer);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            function updateWeightedAverage() {
                let totalWeightedScore = 0;
                let totalCredits = 0;
                let totalWeightedScoreExcluded = 0;
                let totalCreditsExcluded = 0;
                const inputRows = tbody.querySelectorAll('tr');

                inputRows.forEach(row => {
                    const nature = row.dataset.nature;
                    if (nature === '校选修课' || nature === '自主课程') return;

                    const credit = parseFloat(row.dataset.credit) || 0;
                    const input = row.querySelector('.fluent-score-input');
                    const valueStr = input.value.trim();

                    if (valueStr !== '') {
                        const score = parseFloat(valueStr);
                        if (!isNaN(score) && score >= 0 && score <= 100) {
                            totalWeightedScore += score * credit;
                            totalCredits += credit;
                            if (nature !== '通识教育选修课') {
                                totalWeightedScoreExcluded += score * credit;
                                totalCreditsExcluded += credit;
                            }
                        }
                    }
                });

                const avgPrimary = document.getElementById('avg-primary');
                const avgExcludedEl = document.getElementById('avg-excluded');
                const avgCreditsEl = document.getElementById('avg-credits');

                if (totalCredits > 0) {
                    const avg = (totalWeightedScore / totalCredits).toFixed(2);
                    const avgExcluded = totalCreditsExcluded > 0 ? (totalWeightedScoreExcluded / totalCreditsExcluded).toFixed(2) : avg;
                    avgPrimary.textContent = avg;
                    avgExcludedEl.textContent = avgExcluded;
                    avgCreditsEl.textContent = totalCredits;
                } else {
                    avgPrimary.textContent = '暂无有效成绩';
                    avgExcludedEl.textContent = '暂无有效成绩';
                    avgCreditsEl.textContent = '0';
                }
            }

            tbody.addEventListener('input', (e) => {
                if (e.target.classList.contains('fluent-score-input')) {
                    updateWeightedAverage();
                }
            });

            $('#avg-excluded-card')?.addEventListener('click', () => {
                showToast('排除通识教育选修课的加权平均分', '根据<b>《北京工业大学推荐优秀应届本科毕业生免试攻读研究生的实施办法》</b>（2025 年 7 月）<p style="text-align: center; font-family: 宋体; margin: 0.5em">从2024级开始，通识教育选修课不纳入推免加权平均分计算。</p>但需要注意的是，这些课程仍会对专业排名、成绩单等产生影响。以上提示仅供参考，请以学校最新政策为准。', 30000);
            });
            try {
                unsafeWindow.$('#avg-excluded-card .fluent-avg-card-label').popover({ content: `单击查看详情`, trigger: 'hover', placement: 'bottom' });
            } catch (e) { }

            updateWeightedAverage();
        }
    }

    if (location.pathname.endsWith("/xsxxxggl/xsgrxxwh_cxXsgrxx.html")) {
        putStyleRule(`.ui-jqgrid-bdiv { resize: vertical; }`);
    }

    if (location.pathname.endsWith("/kbcx/xskbcx_cxXskbcxIndex.html")) {
        // 隐藏无课程天
        $('#innerContainer > div.row.sl_add_btn > div > div.pull-left').outerHTML = `
<div class="pull-left" style="margin-left: 10px; margin-top: 5px;">
    <input type="checkbox" id="doSimplify" name="doSimplify" style="margin: 0 0 0.5em 0;">
    <label for="doSimplify" style="user-select: none; cursor: pointer;">隐藏无课程的天</label>
</div>
        `;
        const simplifyCheckbox = $('#doSimplify');
        const simplifyStyles = document.createElement('style');
        simplifyCheckbox.addEventListener('change', () => {
            if (simplifyCheckbox.checked) {
                for (let i = 1; i <= 7; i++) {
                    let hasClass = 0;
                    document.querySelectorAll(`#kbgrid_table_0  td[id^="${i}-"]`).forEach(el => hasClass += el.children.length);
                    if (!hasClass) {
                        // #kbgrid_table_0  td[id^="7"], #kbgrid_table_0 tbody > tr:nth-child(2) > td:nth-child(9)
                        simplifyStyles.innerHTML += `#kbgrid_table_0  td[id^="${i}"], #kbgrid_table_0 tbody > tr:nth-child(2) > td:nth-child(${i + 2}) { display: none; }`;
                    }
                }
                document.head.appendChild(simplifyStyles);
            } else {
                simplifyStyles.innerHTML = '';
            }
        });
        document.body.appendChild(simplifyStyles);
        $('#search_go').addEventListener('click', () => {
            if (simplifyCheckbox.checked) {
                simplifyStyles.innerHTML = '';
                simplifyCheckbox.checked = false;
            }
        });

        // 生成模拟数据：document.querySelectorAll(".timetable_con .title font").forEach((el)=>(el.innerText="课程 "+Math.floor(Math.random()*256).toString(16).toUpperCase().padStart(2,"0")),);document.querySelectorAll(".timetable_con > *:nth-child(2) font:nth-child(2)").forEach((el)=>(el.innerText=el.innerText.replace(/\d+-\d+周/g,"1-16周")),);document.querySelectorAll(".timetable_con > *:nth-child(3) font:nth-child(2)").forEach((el)=>(el.innerText=` 本部 ${Math.floor(Math.random()*3)+1}教${Math.floor(Math.random()*3)+1}${(Math.floor(Math.random()*20)+1).toString().padStart(2,"0")}`),);document.querySelectorAll(".timetable_con > *:nth-child(5) font:nth-child(2)").forEach((el)=>(el.innerText=" 教师 "+Math.floor(Math.random()*256).toString(16).toUpperCase().padStart(2,"0")),);
        const btnElement = $('button#shcPDF');
        if (!btnElement) return;
        btnElement.parentNode.replaceChild(btnElement.cloneNode(true), btnElement);
        $('button#shcPDF').innerHTML = '<span class="bigger-120 glyphicon glyphicon-print"></span> <b>打印</b>';
        $('button#shcPDF').addEventListener('click', () => {
            const kbTable = $('table#kbgrid_table_0');
            if (!kbTable) return;
            document.body.append(kbTable);
            putStyles(`
.timetable_con> :nth-child(n+6) { display: none }
.timetable_con> :first-child { color: #000; font-size: 1.1em !important; }
.timetable_con> :nth-child(n+2) { font-weight: 500; opacity: 0.8 }
.timetable_con * { color: #333 }
table#kbgrid_table_0 * { font-family: Noto Sans SC }
#kbgrid_table_0 > tbody > tr:last-child > td > div.timetable_title { display: flex; align-items: center; justify-content: center; opacity: 0.8; }
#kbgrid_table_0 > tbody > tr:last-child > td > div.timetable_title * { font-family: Noto Sans SC !important; font-size: 1.6rem !important; }
table#kbgrid_table_0 tr:first-child { display: none }
table#kbgrid_table_0 td { padding: 4px 8px }
table#kbgrid_table_0 { background: #fff; height: 100%; left: 0; margin: 0!important; top: 0; width: 100% !important }
body> :not(#kbgrid_table_0) { display: none }
td[rowspan="4"]:has(span.time) { display: none }
tbody>tr:nth-child(2)>td:first-child { display: none }
`);
            $$('span.title > font').forEach(el => {
                const typeToColor = { "★": "#1565C0", "○": "#00695C", "●": "#00838F", "◇": "#EF6C00", "◆": "#6A1B9A" };
                for (let type in typeToColor) {
                    if (el.innerText.includes(type)) {
                        el.setAttribute('style', `color: ${typeToColor[type]} !important`);
                        el.innerText = el.innerText.replace(type, '');
                    }
                }
            });
            window.print();
        });
    }

    if (1 || GM_getValue("hideTips", false)) {
        putStyleRule(`#Tips { display: none; }`);
    }

    if (location.pathname == '/' && location.host == 'webvpn.bjut.edu.cn') {
        putStyles(`
.el-scrollbar__wrap {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

button.btn-keep-active {
  margin: 0.5em 1em;
  font-size: 14px;
  padding: 6px 16px;
  border-radius: 4px; /* Fluent 标准圆角 */
  border: 1px solid #d2d0ce; /* 灰框 */
  background-color: #ffffff; /* 白底 */
  color: #323130; /* Fluent 深灰文本 */
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.1s;
}

button.btn-keep-active:hover {
  background-color: #f3f2f1;
}

button.btn-keep-active:active {
  background-color: #f5f4f3;
}

button.btn-keep-active:disabled {
  background-color: #ffffff;
  opacity: 0.75;
  cursor: default;
  box-shadow: none;
}
`);
        const btnKeepActive = document.createElement('button');
        btnKeepActive.className = 'btn-keep-active';
        btnKeepActive.textContent = '保持会话活跃';
        btnKeepActive.addEventListener('click', () => {
            let keepActiveWorker = null;
            try {
                keepActiveWorker = new Worker(
                    "data:application/javascript;base64," +
                    btoa(
                        `const tick=()=>{postMessage(null);setTimeout(tick,(25+Math.random()*10)*60*1000)};tick();`,
                    ),
                );
                keepActiveWorker.onmessage = () => {
                    fetch("https://webvpn.bjut.edu.cn/user/recent?isPortal=true&_t=" + new Date().getTime(), { method: 'GET', credentials: 'include' });
                    btnKeepActive.textContent = `保持会话活跃中`;
                };
                btnKeepActive.disabled = true;
                showToast('保持会话活跃中', '这个功能可以避免长时间不操作导致失去登陆状态，请不要关闭此页面', 10000);
            } catch (err) {
                btnKeepActive.disabled = true;
                btnKeepActive.textContent = '保持会话活跃功能不可用';
            }
        });
        action("until", () => $('.el-scrollbar__wrap'), () => {
            $('.el-scrollbar__wrap').appendChild(btnKeepActive);
        });
    }

    if (location.href.startsWith(`https://i.chaoxing.com/base`) || location.href.startsWith(`https://mooc2-ans.chaoxing.com/visit/interaction`)) {
        action("until", () => $('.user-popup > ul > #exit'), () => {
            $('.user-popup > ul > #exit').insertAdjacentHTML('beforeBegin', `<li id="switchUserscript">${GM_getValue('enableInXuexitong', true) ? '禁用' : '启用'}插件</li>`);
            $('#switchUserscript').addEventListener('click', () => {
                if (GM_getValue('enableInXuexitong', true) == false) GM_setValue('enableInXuexitong', true);
                else GM_setValue('enableInXuexitong', false);
                window.location.reload();
            });
        });
        if (GM_getValue('enableInXuexitong', true)) {
            const iconUrl = 'data:image/webp;base64,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';
            document.head.insertAdjacentHTML('beforeend', `<link rel="icon" type="image/png" href="${iconUrl}">`);
            putStyles(`
 .course-list .learnCourse {
    display: flex;
    height: fit-content;
    margin-bottom: 1.5em;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.2);
    margin: 1em !important;
}
.course-list .course-cover {
    position: absolute;
    height: 100%;
    width: 100%;
    overflow: hidden;
}
.course-list .course-modules {
    position: absolute;
    bottom: -3em;
    transform: translateY(50%);
    width: calc(100% - 4em);
    background: #fff;
    padding: 0.5em 1em;
    z-index: 99999;
    margin: 0 1em;
    border: 1px solid #ccc;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
    display: flex;
    justify-content: space-around;
    opacity: 0;
    transform: translateY(0%);
    transition: opacity 0.2s, transform 0.2s;
}
.course:hover .course-modules {
    opacity: 1;
    transform: translateY(50%);
    cursor: default;
}
.course-list .course-modules a {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #000;
    opacity: 0.5;
    transition: opacity 0.2s;
    cursor: pointer;
}
.course-list .course-modules a:hover {
    opacity: 1;
}
.svg-icon-20-000 {
    width: 20px;
    fill: #000;
}
.course-list .course-cover>a img {
    height: fit-content;
}
.course-list .course-info {
    backdrop-filter: blur(10px);
    background: linear-gradient(90deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.75));
    width: 100%;
    padding: 1em;
}
.course-list .course-info a {
    transition: color 0.2s;
}
div#courseList {
    width: auto !important;
}
.path-box.clear {
    position: absolute;
}
.course-list > * {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-evenly;
}
.course-list {
    overflow: unset !important;
}
.course-list .course-cover .hanlde-list {
    opacity: 0;
    border-radius: 0 !important;
    filter: grayscale(1);
    transition: opacity 0.2s;
}
.course-list .course-cover .hanlde-list:hover {
    opacity: 0.8;
}
.course-tab .tab-item.current::after {
    background: #4D58B5;
    width: 64px;
}
a#addCourse {
    background: #4D58B5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border-radius: 4px;
}
a#addFolder, a.fr.assistantBtn, .dataSearch_input {
    border-radius: 4px !important;
}
.space-con {
    background: #fff;
    color: #000;
}
.con-left.con-left-float.showIcon {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
}
.space-unit {
    background: #fff !important;
    color: #000 !important;
}
.user-popup {
    background: #fff !important;
    color: #000 !important;
}
.header, .header > * {
    height: 5em !important;
}
.user-popup {
    top: 5em !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
}
div#to_top {
    display: none;
}
.svg-icon-20-fff {
    width: 20px;
    fill: #fff;
}
.style3 .right-con .bodyBg {
    background: #fff !important;
}
.header {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16) !important;
}
`);
            setInterval(() => {
                $$('.course-list .course:not(.p)').forEach(el => {
                    const targetUrl = el.querySelector('.course-info h3 a').href;
                    el.querySelector('.course-info').addEventListener('click', () => el.querySelector('.course-info h3 a').click());
                    const createIcon = path => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg-icon-20-000"><path d="${path}"></path></svg>`;
                    el.insertAdjacentHTML('beforeEnd', `
<div class="course-modules">
    <a href="${targetUrl}&pageHeader=8" target="_blank">
    ${createIcon("M3,7V5H5V4C5,2.89 5.9,2 7,2H13V9L15.5,7.5L18,9V2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M7,11H5V13H7V11M7,7V5H5V7H7M7,19V17H5V19H7Z")}
    作业
    </a>
    <a href="${targetUrl}&pageHeader=1" target="_blank">
    ${createIcon("M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M7 7H9V9H7V7M7 11H9V13H7V11M7 15H9V17H7V15M17 17H11V15H17V17M17 13H11V11H17V13M17 9H11V7H17V9Z")}
    章节
    </a>
    <a href="${targetUrl}&pageHeader=3" target="_blank">
    ${createIcon("M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z")}
    资料
    </a>
    <a href="${targetUrl}&pageHeader=9" target="_blank">
    ${createIcon("M4 2V8H2V2H4M2 22V16H4V22H2M5 12C5 13.11 4.11 14 3 14C1.9 14 1 13.11 1 12C1 10.9 1.9 10 3 10C4.11 10 5 10.9 5 12M16 4C20.42 4 24 7.58 24 12C24 16.42 20.42 20 16 20C12.4 20 9.36 17.62 8.35 14.35L6 12L8.35 9.65C9.36 6.38 12.4 4 16 4M15 13L19.53 15.79L20.33 14.5L16.5 12.2V7H15V13Z")}
    考试
    </a>
</div>
`);
                    el.classList.add('p');
                });
            }, 200);
            const putMenuItem = (name, url, id, icon) => $('.menu-list-ul > *:first-child')?.insertAdjacentHTML('afterEnd', `
<li level="1" parent-id="" table-type="1" parent-type="" data-id="${id}">
    <div role="menuitem" level="1" focus_element="0" tabindex="-1" name="${name}" id="first${id}" onclick="setUrl('${id}','${url}',this,'0','${name}');" imgname="icon-home" dataurl="https://mooc1-api.chaoxing.com/work/stu-work" class="label-item" aria-label="作业菜单项已访问">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon-space iconfont svg-icon-20-fff"><path d="${icon}"></path></svg>
        <h3 title="${name}">${name}</h3>
        <span class="slide-arrow iconfont icon-down2 hide"></span>
    </div>
</li>
            `);
            putMenuItem('考试', 'https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode', 22345, 'M4 2V8H2V2H4M2 22V16H4V22H2M5 12C5 13.11 4.11 14 3 14C1.9 14 1 13.11 1 12C1 10.9 1.9 10 3 10C4.11 10 5 10.9 5 12M16 4C20.42 4 24 7.58 24 12C24 16.42 20.42 20 16 20C12.4 20 9.36 17.62 8.35 14.35L6 12L8.35 9.65C9.36 6.38 12.4 4 16 4M15 13L19.53 15.79L20.33 14.5L16.5 12.2V7H15V13Z');
            putMenuItem('作业', 'https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/all-task', 12345, 'M3,7V5H5V4C5,2.89 5.9,2 7,2H13V9L15.5,7.5L18,9V2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M7,11H5V13H7V11M7,7V5H5V7H7M7,19V17H5V19H7Z');
        }
    }
    if (location.href.startsWith(`https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/all-task`) || location.href.startsWith(`https://mooc2-ans.chaoxing.com/visit/interaction`)) {
        putStyles(`
            .stuStatus { margin-left: 10px !important; margin-right: 6px !important; }
            .content { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16) !important; }
            body, #divbox.box { background: transparent !important; }
            .box { padding-top: 20px; }
        `);
    }
    if (location.href.startsWith(`https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode`)) {
        const toExamUrl = raw => {
            const p = new URL(raw, location.href).searchParams;
            const g = k => p.get(k) || '';
            return `https://mooc1-api.chaoxing.com/exam-ans/exam/test/examcode/examnotes?courseId=${g('courseId')}&classId=${g('classId')}&examId=${g('taskrefId')}`;
        };
        setInterval(() => {
            $$('.ks_list > li[data]:not(li.p)').forEach(el => {
                el.classList.add('p');
                el.setAttribute('onclick', '');
                el.addEventListener('click', () => GM_openInTab(toExamUrl(el.getAttribute('data')), { active: true }));
            });
        }, 200);
        putStyles(`
body { zoom: 0.5 !important; }
.seacherDiv { display: none; }
.ks_list > li { cursor: pointer; }
    `);
    }
})();