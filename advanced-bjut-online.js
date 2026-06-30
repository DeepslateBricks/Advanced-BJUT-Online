// ==UserScript==
// @name         Advanced BJUT Online
// @description  更好的北京工业大学教务 / 门户使用体验
// @match        https://webvpn.bjut.edu.cn/*
// @match        https://jwglxt.bjut.edu.cn/*
// @grant        GM_notification
// @grant        GM_cookie
// @icon         http://cdn.urongda.com/images/normal/medium/beijing-university-of-technology-logo-1024px.png
// @version      0.1.0
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
// 5. 全局通用优化
//      - 隐藏教务首页照片
//      - 教务系统点击左上角页面名称可退回主页
//      - 个人信息页表格可拖拽调整高度
//      - 延长 WebVPN Cookies 有效期
//        此功能在 Tampermonkey BETA 下可用，可以避免退出浏览器登陆状态丢失，但是数小时无操作导致的自动退出登录暂无法避免。
//        若需要查成绩，请使用成绩监测功能，该功能可以保持会话活跃、避免自动退出登录。

(function () {
    "use strict";
    const disableOptimizedScorePanel = false;

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const action = (mode, condition, action, timeoutMs = 15000) => {
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

    try {
        GM_cookie.list({ name: "wengine_vpn_ticketwebvpn_bjut_edu_cn" }, (cookies, error) => {
            if (!cookies?.length) return;
            const cookie = cookies[0];
            console.log(cookie);
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
    } catch (err) {}

    if (!location.pathname.includes('xtgl')) {
        document.querySelectorAll('#topButton.navbar-brand')?.forEach((el) => { el.setAttribute('onclick', "location.href = '..'"); });
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
            let history = (() => {
                try {
                    return JSON.parse(localStorage.getItem('betterBJUTOnline_score_history') ?? '[]');
                } catch { return []; }
            })();
            let currentDate = new Date().toISOString().split('T')[0];

            if (!isNaN(avgScore)) {
                if (history.length) {
                    if (history[history.length - 1][0] == currentDate) history[history.length - 1][1] = avgScore;
                    else if (Math.abs(history[history.length - 1][1] - avgScore) > 0.0001) history.push([currentDate, avgScore]);
                } else history.push([currentDate, avgScore]);
            }

            localStorage.setItem('betterBJUTOnline_score_history', JSON.stringify(history));

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
.fluent-title { font-size: 20px; font-weight: 600; color: #242424; margin: 0 0 14px 0; }
.fluent-avg-display { font-size: 13px; color: #004578; background: #f0f7ff; padding: 12px 16px; border-radius: 4px; border-left: 4px solid #0f6cbd; font-weight: 400; line-height: 1.5; }
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
                renderFluentDialog(courses);
            });
        });

        function renderFluentDialog(courses) {
            const backdrop = document.createElement('div');
            backdrop.className = 'fluent-backdrop';

            const dialog = document.createElement('div');
            dialog.className = 'fluent-dialog';

            const header = document.createElement('div');
            header.className = 'fluent-header';

            const title = document.createElement('h3');
            title.className = 'fluent-title';
            title.textContent = '加权平均分试算面板';

            const avgDisplay = document.createElement('div');
            avgDisplay.className = 'fluent-avg-display';

            header.appendChild(title);
            header.appendChild(avgDisplay);
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
            closeBtn.addEventListener('click', () => backdrop.remove());

            footer.appendChild(closeBtn);
            dialog.appendChild(footer);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            function updateWeightedAverage() {
                let totalWeightedScore = 0;
                let totalCredits = 0;
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
                        }
                    }
                });

                if (totalCredits > 0) {
                    const avg = (totalWeightedScore / totalCredits).toFixed(2);
                    avgDisplay.innerHTML = `加权平均分：<strong style="color: #0f6cbd; font-size: 15px;">${avg}</strong>（当前计入总学分: ${totalCredits}）`;
                } else {
                    avgDisplay.innerHTML = `加权平均分：<span style="color: #c52530; font-weight: 600;">暂无有效存在成绩的计算科目</span>`;
                }
            }

            tbody.addEventListener('input', (e) => {
                if (e.target.classList.contains('fluent-score-input')) {
                    updateWeightedAverage();
                }
            });

            updateWeightedAverage();
        }
    }

    if (location.pathname.endsWith("/xsxxxggl/xsgrxxwh_cxXsgrxx.html")) {
        putStyleRule(`.ui-jqgrid-bdiv { resize: vertical; }`);
    }

    if (location.pathname.endsWith("/kbcx/xskbcx_cxXskbcxIndex.html")) {
        const btnElement = $('button#shcPDF');
        if (!btnElement) return;
        btnElement.parentNode.replaceChild(btnElement.cloneNode(true), btnElement);
        $('button#shcPDF').innerText = ' 输出更好的PDF';
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
})();