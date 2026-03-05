// ============================================
// TTea_Utility — System Store Module
// AI-powered in-game store from Lorebook data
// ============================================

import { generateLLMCompletion } from '../SettingsPanel/index.js';

// ---- SillyTavern context helpers (same as Mind map) ----
function _getSTContext() {
    try { return SillyTavern.getContext(); } catch { return null; }
}

function _getTH() {
    try { return window.TavernHelper || window.tavernHelper || null; } catch { return null; }
}

// ---- Lorebook helpers ----

/** Load all worldbook names (reuses strategies from Mind map) */
async function loadAllWorldbookNames() {
    const context = _getSTContext();
    const TavernHelper = _getTH();
    let bookList = [];

    // Strategy 1: SillyTavern context
    if (context) {
        if (typeof context.getWorldNames === 'function') {
            bookList = context.getWorldNames() || [];
        }
    }

    // Strategy 2: TavernHelper
    if (bookList.length === 0 && TavernHelper) {
        if (typeof TavernHelper.getLorebooks === 'function') {
            bookList = await Promise.resolve(TavernHelper.getLorebooks()) || [];
        } else if (typeof TavernHelper.getWorldbookNames === 'function') {
            bookList = await Promise.resolve(TavernHelper.getWorldbookNames()) || [];
        }
    }

    // Strategy 3: window globals
    if (bookList.length === 0 && typeof window.getWorldbookNames === 'function') {
        bookList = await Promise.resolve(window.getWorldbookNames()) || [];
    }

    // Strategy 4: jQuery DOM scraping
    if (bookList.length === 0) {
        try {
            const $ = window.jQuery || window.$;
            if ($) {
                $('#world_info option').each(function () {
                    const text = $(this).text().trim();
                    if (text && text !== 'None' && text !== '' && $(this).val() !== '') {
                        bookList.push(text);
                    }
                });
            }
        } catch (e) { }
    }

    // Strategy 5: Fetch API
    if (bookList.length === 0) {
        try {
            const headers = context && typeof context.getRequestHeaders === 'function'
                ? context.getRequestHeaders()
                : { 'Content-Type': 'application/json' };
            const res = await fetch('/api/worldinfo/get', {
                method: 'POST', headers, body: JSON.stringify({})
            });
            if (res.ok) {
                const data = await res.json();
                bookList = Array.isArray(data) ? data : Object.keys(data || {});
            }
        } catch (e) { }
    }

    return bookList.map(item => typeof item === 'string' ? item : item.name).filter(Boolean);
}

/** Fetch entries of a specific worldbook */
async function fetchWorldbookData(name) {
    const context = _getSTContext();
    const TavernHelper = _getTH();

    if (typeof window.getWorldbook === 'function') {
        let entries = await window.getWorldbook(name);
        return { entries: entries || [] };
    } else if (TavernHelper && typeof TavernHelper.getLorebookEntries === 'function') {
        let entries = await TavernHelper.getLorebookEntries(name);
        return { entries: entries || [] };
    }

    const headers = context && typeof context.getRequestHeaders === 'function'
        ? context.getRequestHeaders()
        : { 'Content-Type': 'application/json' };

    const res = await fetch(`/api/worldinfo/get`, {
        method: 'POST', headers, body: JSON.stringify({ name })
    });
    if (res.ok) {
        return await res.json();
    }

    throw new Error('Không thể tải entries. Kiểm tra console.');
}

// ---- Keywords to search in lorebook ----
const STORE_KEYWORDS = [
    'cửa hàng', 'economic', 'kinh tế', 'giá cả', 'hệ thống',
    'shop', 'store', 'price', 'inventory', 'merchant', 'thương nhân',
    'mua bán', 'vật phẩm', 'item', 'currency', 'tiền tệ'
];

/** Search lorebook entries for store-related keywords */
function filterStoreEntries(entries) {
    const entryList = Array.isArray(entries) ? entries : Object.values(entries || {});
    return entryList.filter(entry => {
        const searchText = [
            entry.comment || '',
            entry.content || '',
            ...(entry.key || []),
            ...(entry.keysecondary || [])
        ].join(' ').toLowerCase();

        return STORE_KEYWORDS.some(kw => searchText.includes(kw.toLowerCase()));
    });
}

/** Build the LLM prompt */
function buildStorePrompt(matchedEntries, userPrompt) {
    let entriesStr = '';
    matchedEntries.forEach((entry, idx) => {
        const name = entry.comment || (entry.key ? entry.key.join(', ') : `Entry ${idx}`);
        const content = typeof entry.content === 'string'
            ? entry.content.substring(0, 500) + (entry.content.length > 500 ? '...' : '')
            : '';
        entriesStr += `--- Entry: ${name} ---\n${content}\n\n`;
    });

    let prompt = `You are a game store generator for a role-playing game. I will provide you with lorebook entries that describe the game's economy, shops, items, prices, and systems.

Your task: Based on these lorebook entries, generate a visually formatted **store/shop display** as HTML.

${userPrompt ? `Additional user request: "${userPrompt}"\n\n` : ''}

**Lorebook Entries found:**
${entriesStr || '(No specific entries found — generate a basic placeholder store)'}

**Output rules:**
1. Output a JSON object wrapped in a \`\`\`json code block with this structure:
\`\`\`json
{
  "tabs": [
    { "id": "tab1", "label": "Tab Name 1" },
    { "id": "tab2", "label": "Tab Name 2" }
  ],
  "contents": {
    "tab1": "<div>...HTML for tab1...</div>",
    "tab2": "<div>...HTML for tab2...</div>"
  }
}
\`\`\`

2. Each tab's HTML should contain product cards styled with inline styles.
3. Each product card should show: name, description, price, and a visual icon/emoji. The card's styling should include rounded corners, subtle border, soft background color, and icon/emoji.
4. Use the lorebook data to determine categories, product names, prices, descriptions, and currency. Create tabs based on logical groupings (e.g., "Vũ Khí", "Thuốc", "Vật Liệu").
5. If the lorebook entries mention specific items, prices, or categories, use them EXACTLY.
6. Design should be dark-theme friendly (light text on transparent/dark backgrounds).
7. If no lorebook entries are provided, generate a sample fantasy shop with 1–2 tabs and a few items each.

Now generate the store JSON:`;

    return prompt;
}

/** Extract JSON from AI response */
function extractStoreJson(text) {
    const jsonBlockRegex = /```json\s*([\s\S]*?)```/i;
    const match = text.match(jsonBlockRegex);
    let jsonStr = match ? match[1].trim() : null;

    if (!jsonStr) {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonStr = braceMatch[0];
    }

    if (!jsonStr) return null;

    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.tabs && parsed.contents) return parsed;
        return null;
    } catch (e) {
        console.warn('[Store] JSON parse error:', e);
        return null;
    }
}

// ---- Create Panel DOM ----
export function createStorePanel() {
    const panel = document.createElement('div');
    panel.className = 'uh-store-panel';
    panel.innerHTML = `
        <div class="uh-store-panel-header">
            <span class="uh-store-panel-title">🏪 Cửa Hàng</span>
            <button class="uh-store-close-btn" title="Đóng">✕</button>
        </div>
        <div class="uh-store-tab-bar">
            <div class="uh-store-tabs-list">
                <button class="uh-store-tab active" data-tab="default">Cửa hàng</button>
            </div>
        </div>
        <div class="uh-store-content-area">
            <div class="uh-store-tab-content active" data-tab="default">
                <div class="uh-store-empty-state">
                    <div class="uh-store-empty-icon">🏪</div>
                    <div>Bấm <strong>Xem Sản Phẩm</strong> để AI tạo cửa hàng<br/>từ dữ liệu Lorebook</div>
                </div>
            </div>
        </div>
        <div class="uh-store-panel-footer">
            <input type="text" class="uh-store-prompt-input" placeholder="Yêu cầu thêm cho AI (tuỳ chọn)..." />
            <button class="uh-store-generate-btn">🛒 Xem Sản Phẩm</button>
        </div>
    `;
    return panel;
}

// ---- Init Panel Logic ----
export function initStorePanelLogic(panel) {
    let isPanelVisible = false;

    const closeBtn = panel.querySelector('.uh-store-close-btn');
    const generateBtn = panel.querySelector('.uh-store-generate-btn');
    const promptInput = panel.querySelector('.uh-store-prompt-input');
    const tabBar = panel.querySelector('.uh-store-tabs-list');
    const contentArea = panel.querySelector('.uh-store-content-area');

    // ---- Panel Show/Hide ----
    function showPanel() {
        isPanelVisible = true;
        panel.classList.remove('uh-store-hiding');
        panel.offsetHeight;
        panel.classList.add('uh-store-visible');
    }

    function hidePanel() {
        isPanelVisible = false;
        panel.classList.remove('uh-store-visible');
        panel.classList.add('uh-store-hiding');
        setTimeout(() => {
            if (panel.classList.contains('uh-store-hiding')) {
                panel.classList.remove('uh-store-hiding');
            }
        }, 350);
    }

    panel.showPanel = showPanel;
    panel.hidePanel = hidePanel;
    panel.isVisible = () => isPanelVisible;

    // ---- Draggable panel ----
    const panelHeader = panel.querySelector('.uh-store-panel-header');
    let isDragging = false;
    let hasMoved = false;
    let startMouseX, startMouseY, startElX, startElY;
    let rafId = null;
    let posConverted = false;

    panelHeader.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        const rect = panel.getBoundingClientRect();
        if (!posConverted) {
            panel.style.left = rect.left + 'px';
            panel.style.top = rect.top + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            posConverted = true;
        }
        isDragging = true;
        hasMoved = false;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startElX = parseFloat(panel.style.left);
        startElY = parseFloat(panel.style.top);
        panel.classList.add('uh-store-dragging');
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;
        if (!hasMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) hasMoved = true;
        const pendingLeft = startElX + dx;
        const pendingTop = startElY + dy;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            panel.style.left = pendingLeft + 'px';
            panel.style.top = pendingTop + 'px';
            rafId = null;
        });
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.classList.remove('uh-store-dragging');
            document.body.style.userSelect = '';
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        }
    });

    // ---- Tab switching ----
    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.uh-store-tab');
        if (!tab) return;
        const tabId = tab.dataset.tab;

        tabBar.querySelectorAll('.uh-store-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        contentArea.querySelectorAll('.uh-store-tab-content').forEach(c => c.classList.toggle('active', c.dataset.tab === tabId));
    });

    // ---- Render store data ----
    function renderStore(storeData) {
        // Update tabs
        tabBar.innerHTML = '';
        storeData.tabs.forEach((tab, i) => {
            const btn = document.createElement('button');
            btn.className = 'uh-store-tab' + (i === 0 ? ' active' : '');
            btn.dataset.tab = tab.id;
            btn.textContent = tab.label;
            tabBar.appendChild(btn);
        });

        // Update content
        contentArea.innerHTML = '';
        storeData.tabs.forEach((tab, i) => {
            const div = document.createElement('div');
            div.className = 'uh-store-tab-content' + (i === 0 ? ' active' : '');
            div.dataset.tab = tab.id;
            div.innerHTML = storeData.contents[tab.id] || '<p>Không có dữ liệu</p>';
            contentArea.appendChild(div);
        });
    }

    // ---- Generate Store ----
    generateBtn.addEventListener('click', async () => {
        try {
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Đang tạo...';

            // 1. Load all worldbooks
            const wbNames = await loadAllWorldbookNames();

            // 2. Search all worldbooks for store-related entries
            let allMatchedEntries = [];
            for (const name of wbNames) {
                try {
                    const wbData = await fetchWorldbookData(name);
                    const entries = wbData.entries || {};
                    const matched = filterStoreEntries(entries);
                    allMatchedEntries.push(...matched);
                } catch (e) {
                    console.warn(`[Store] Skipping worldbook "${name}":`, e.message);
                }
            }

            console.log(`[Store] Found ${allMatchedEntries.length} store-related entries across ${wbNames.length} worldbooks.`);

            // 3. Build prompt
            const userPrompt = promptInput.value.trim();
            const prompt = buildStorePrompt(allMatchedEntries, userPrompt);

            // 4. Show loading state
            contentArea.innerHTML = `
                <div class="uh-store-tab-content active" data-tab="loading">
                    <div class="uh-store-empty-state">
                        <div class="uh-store-empty-icon uh-store-spin">🔄</div>
                        <div>AI đang phân tích Lorebook và tạo cửa hàng...<br/>
                        <small>Tìm thấy ${allMatchedEntries.length} entry liên quan</small></div>
                    </div>
                </div>`;
            tabBar.innerHTML = '<button class="uh-store-tab active" data-tab="loading">Đang tải...</button>';

            // 5. Call LLM
            const responseText = await generateLLMCompletion(prompt);

            // 6. Parse response
            const storeData = extractStoreJson(responseText);

            if (!storeData) {
                // Fallback: show raw response
                tabBar.innerHTML = '<button class="uh-store-tab active" data-tab="raw">Kết quả</button>';
                contentArea.innerHTML = `
                    <div class="uh-store-tab-content active" data-tab="raw">
                        <div style="padding: 16px; color: #fca5a5; font-size: 13px;">
                            <b>⚠️ Không thể phân tích JSON từ AI.</b><br/>
                            <pre style="white-space: pre-wrap; margin-top: 10px; color: #d1d5db; font-size: 12px; max-height: 300px; overflow: auto;">${responseText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                        </div>
                    </div>`;
                return;
            }

            // 7. Render store
            renderStore(storeData);

        } catch (err) {
            console.error('[Store] Error:', err);
            tabBar.innerHTML = '<button class="uh-store-tab active" data-tab="error">Lỗi</button>';
            contentArea.innerHTML = `
                <div class="uh-store-tab-content active" data-tab="error">
                    <div class="uh-store-empty-state">
                        <div class="uh-store-empty-icon">❌</div>
                        <div style="color: #fca5a5;">${err.message}</div>
                    </div>
                </div>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '🛒 Xem Sản Phẩm';
        }
    });

    // ---- Close ----
    closeBtn.addEventListener('click', () => hidePanel());

    console.log('[TTea_Utility] System Store module loaded.');
}
