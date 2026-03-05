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

// ---- Chat active check ----
function isChatActive() {
    const ctx = _getSTContext();
    return !!(ctx && ctx.chatMetadata && (ctx.characterId !== undefined || ctx.groupId));
}

// ---- Lorebook helpers ----

/** Get lorebooks linked to the current character card */
async function getCardLinkedLorebooks() {
    const context = _getSTContext();
    if (!context) return [];

    const linkedBooks = [];

    try {
        // Strategy 1: Character's linked world (character card extension data)
        if (context.characterId !== undefined && context.characters) {
            const char = context.characters[context.characterId];
            if (char && char.data && char.data.extensions && char.data.extensions.world) {
                linkedBooks.push(char.data.extensions.world);
            }
        }

        // Strategy 2: Chat metadata world info
        if (context.chatMetadata && context.chatMetadata.world_info) {
            const wi = context.chatMetadata.world_info;
            if (typeof wi === 'string' && wi && !linkedBooks.includes(wi)) {
                linkedBooks.push(wi);
            }
        }

        // Strategy 3: jQuery DOM — read selected worldbooks from the UI
        try {
            const $ = window.jQuery || window.$;
            if ($) {
                // Character-linked lorebook
                const charWb = $('#character_world').val();
                if (charWb && !linkedBooks.includes(charWb)) {
                    linkedBooks.push(charWb);
                }
                // Global lorebooks (selected in world_info dropdown)
                const selectedWi = $('#world_info').val();
                if (selectedWi && !linkedBooks.includes(selectedWi)) {
                    linkedBooks.push(selectedWi);
                }
            }
        } catch (e) { }

    } catch (e) {
        console.warn('[Store] Error reading card-linked lorebooks:', e);
    }

    return linkedBooks.filter(Boolean);
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

    // ---- Helper: update loading status ----
    function showLoadingStatus(message) {
        contentArea.innerHTML = `
            <div class="uh-store-tab-content active" data-tab="loading">
                <div class="uh-store-empty-state">
                    <div class="uh-store-empty-icon uh-store-spin">🔄</div>
                    <div>${message}</div>
                </div>
            </div>`;
        tabBar.innerHTML = '<button class="uh-store-tab active" data-tab="loading">Đang tải...</button>';
    }

    // ---- Generate Store ----
    generateBtn.addEventListener('click', async () => {
        // Check if a card/chat is active
        if (!isChatActive()) {
            toastr.warning('Vui lòng chọn một nhân vật hoặc bắt đầu trò chuyện trước.');
            return;
        }

        try {
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Đang tạo...';

            // 1. Get lorebooks linked to current card
            showLoadingStatus('🔍 Đang tìm Lorebook liên kết với card hiện tại...');
            const linkedBooks = await getCardLinkedLorebooks();

            if (linkedBooks.length === 0) {
                toastr.warning('Không tìm thấy Lorebook nào liên kết với card hiện tại.');
                contentArea.innerHTML = `
                    <div class="uh-store-tab-content active" data-tab="default">
                        <div class="uh-store-empty-state">
                            <div class="uh-store-empty-icon">📚</div>
                            <div>Không tìm thấy Lorebook liên kết với card hiện tại.<br/>
                            <small style="color: rgba(125, 211, 252, 0.5);">Hãy gắn Lorebook vào nhân vật trong phần Character Editor.</small></div>
                        </div>
                    </div>`;
                tabBar.innerHTML = '<button class="uh-store-tab active" data-tab="default">Cửa hàng</button>';
                return;
            }

            // 2. Scan linked lorebooks for store-related entries
            let allMatchedEntries = [];
            let totalEntries = 0;

            for (let i = 0; i < linkedBooks.length; i++) {
                const name = String(linkedBooks[i]);
                showLoadingStatus(
                    `📖 Đang quét Lorebook: <strong>${name.replace('.json', '')}</strong><br/>` +
                    `<small>(${i + 1}/${linkedBooks.length} lorebook)</small>`
                );

                try {
                    const wbData = await fetchWorldbookData(name);
                    const entries = wbData.entries || {};
                    const entryList = Array.isArray(entries) ? entries : Object.values(entries);
                    totalEntries += entryList.length;
                    const matched = filterStoreEntries(entries);
                    allMatchedEntries.push(...matched);
                } catch (e) {
                    console.warn(`[Store] Skipping lorebook "${name}":`, e.message);
                }
            }

            console.log(`[Store] Found ${allMatchedEntries.length} store-related entries across ${linkedBooks.length} linked lorebooks.`);

            // 3. Show scan results
            showLoadingStatus(
                `✅ Quét xong ${linkedBooks.length} Lorebook (${totalEntries} entries tổng cộng)<br/>` +
                `<strong>🔑 Tìm thấy ${allMatchedEntries.length} entry có từ khóa liên quan</strong><br/><br/>` +
                `<small>🤖 Đang gửi dữ liệu cho AI tạo cửa hàng...</small>`
            );

            // 4. Build prompt
            const userPrompt = promptInput.value.trim();
            const prompt = buildStorePrompt(allMatchedEntries, userPrompt);

            // 5. Call LLM
            let responseText;
            try {
                responseText = await generateLLMCompletion(prompt);
            } catch (llmErr) {
                const hint = llmErr.message.includes('Failed to fetch')
                    ? 'Không thể kết nối API Phụ. Hãy kiểm tra URL và Key trong ⚙️ Cài đặt → API Phụ.'
                    : llmErr.message;
                throw new Error(hint);
            }

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
