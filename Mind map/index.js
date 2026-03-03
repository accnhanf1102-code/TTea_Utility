import { generateLLMCompletion } from '../SettingsPanel/index.js';

/* ============================================
   Map Panel Logic
   ============================================ */

export function createMapPanel() {
    const panel = document.createElement('div');
    panel.className = 'uh-map-panel';
    panel.innerHTML = `
        <div class="uh-map-panel-header">
            <div class="uh-map-panel-title">Bản đồ (Mind Map)</div>
            <button class="uh-map-panel-close">✕</button>
        </div>
        <div class="uh-map-panel-body">
            <div class="uh-map-top-bar">
                <label for="uh-worldbook-select">Worldbook:</label>
                <select id="uh-worldbook-select" class="uh-worldbook-select">
                    <option value="">Đang tải...</option>
                </select>
            </div>
            <div class="uh-map-content">
                <!-- Nội dung map sẽ ở đây -->
            </div>
            <div class="uh-map-bottom-bar">
                <button class="uh-btn-create-map">Tạo Mind Map</button>
            </div>
        </div>
    `;
    return panel;
}

export function initMapPanelLogic(panel) {
    const closeBtn = panel.querySelector('.uh-map-panel-close');
    const header = panel.querySelector('.uh-map-panel-header');
    const createBtn = panel.querySelector('.uh-btn-create-map');

    const worldbookSelect = panel.querySelector('#uh-worldbook-select');
    const mapContent = panel.querySelector('.uh-map-content');

    // Load worldbooks on init
    loadWorldbooks(worldbookSelect);

    // Close logic
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('uh-map-panel-open');
    });

    // Create Map logic
    createBtn.addEventListener('click', async () => {
        const selectedWb = worldbookSelect.value;
        if (!selectedWb) {
            alert('Vui lòng chọn một Worldbook trước.');
            return;
        }

        try {
            createBtn.disabled = true;
            createBtn.textContent = 'Đang phân tích...';
            mapContent.innerHTML = '<div style="color:#e2e8f0; padding:20px; text-align:center;">Đang lấy dữ liệu Worldbook và gọi AI... Vui lòng đợi.</div>';

            // 1. Fetch detailed worldbook data
            const wbData = await fetchWorldbookData(selectedWb);

            // 2. Prepare prompt
            const prompt = buildMindMapPrompt(selectedWb, wbData);

            // 3. Call LLM
            const responseText = await generateLLMCompletion(prompt);

            // 4. Extract mermaid code
            const mermaidCode = extractMermaidCode(responseText);

            if (!mermaidCode) {
                mapContent.innerHTML = `<div style="color:#fca5a5; padding:20px;">Không tìm thấy mã Mermaid trong phản hồi của AI.<br><pre style="white-space:pre-wrap;font-size:11px;">${responseText}</pre></div>`;
                return;
            }

            // 5. Render to UI
            // For now, output the raw mermaid block so the user can see it or SillyTavern's markdown parser handles it
            mapContent.innerHTML = `
                <div style="padding:10px; height:100%; overflow:auto;">
                    <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Mermaid Graph Generated:</div>
                    <pre><code class="language-mermaid">${mermaidCode}</code></pre>
                </div>
            `;

            // Note: To actually render it live, we'll need to trigger Mermaid.init or dynamically load mermaid.js 
            // Since ST has mermaid globally, we can try invoking mermaid.run()
            if (typeof mermaid !== 'undefined') {
                setTimeout(() => {
                    try {
                        mermaid.run({
                            nodes: [mapContent.querySelector('code.language-mermaid')]
                        });
                    } catch (err) {
                        console.warn('Mermaid auto-render failed', err);
                    }
                }, 100);
            }

        } catch (err) {
            console.error('[Map Panel] Error generating map:', err);
            mapContent.innerHTML = `<div style="color:#fca5a5; padding:20px;">Đã xảy ra lỗi:<br>${err.message}</div>`;
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'Tạo Mind Map';
        }
    });

    // Drag logic
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (e) => {
        // Prevent dragging if clicking on close button
        if (e.target === closeBtn) return;
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        panel.classList.add('uh-dragging-panel');
        document.body.style.userSelect = 'none'; // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        // Clamp to window
        x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, x));
        y = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, y));

        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.transform = 'none'; // Overwrite default center transform if any
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.classList.remove('uh-dragging-panel');
            document.body.style.userSelect = '';
        }
    });

    // Initial position logic can be set when opening
}

/* ============================================
   Helpers
   ============================================ */

function _getST() {
    return typeof window !== 'undefined' && window.SillyTavern ? window.SillyTavern : (window.parent && window.parent.SillyTavern);
}

function _getTH() {
    return typeof window !== 'undefined' && window.TavernHelper ? window.TavernHelper : (window.parent && window.parent.TavernHelper);
}

/**
 * Get ST extension context - the standard way for native ST extensions to access internal APIs.
 * SillyTavern.getContext() returns the extension API context which exposes:
 * - world_names (array of worldbook names from @sillytavern/scripts/world-info)
 * - getWorldNames() in some versions
 * - and many other utilities
 */
function _getSTContext() {
    try {
        const ST = _getST();
        if (ST && typeof ST.getContext === 'function') {
            return ST.getContext();
        }
    } catch (e) { }
    return null;
}

async function loadWorldbooks(selectEl) {
    try {
        const TavernHelper = _getTH();
        const SillyTavern = _getST();
        const context = _getSTContext();

        let bookList = [];
        let debugInfo = '';

        // ====================================================================
        // STRATEGY 1: Direct SillyTavern extension context (native extensions)
        // The getContext() API is the standard way for ST extensions to access
        // internal data. world_names is from @sillytavern/scripts/world-info
        // ====================================================================
        if (context) {
            // Try multiple known paths for world names in the context object
            if (Array.isArray(context.world_names) && context.world_names.length > 0) {
                bookList = [...context.world_names];
                debugInfo = `ctx.world_names(${bookList.length})`;
            } else if (typeof context.getWorldNames === 'function') {
                bookList = context.getWorldNames() || [];
                debugInfo = `ctx.getWorldNames(${bookList.length})`;
            }
        }

        // ====================================================================
        // STRATEGY 2: TavernHelper (for Tampermonkey / JS-Slash-Runner scripts)
        // ====================================================================
        if (bookList.length === 0 && TavernHelper) {
            if (typeof TavernHelper.getLorebooks === 'function') {
                bookList = await Promise.resolve(TavernHelper.getLorebooks()) || [];
                debugInfo = `TH.getLorebooks(${bookList.length})`;
            } else if (typeof TavernHelper.getWorldbookNames === 'function') {
                bookList = await Promise.resolve(TavernHelper.getWorldbookNames()) || [];
                debugInfo = `TH.getWorldbookNames(${bookList.length})`;
            }
        }

        // ====================================================================
        // STRATEGY 3: window globals (JS-Slash-Runner might inject these)
        // ====================================================================
        if (bookList.length === 0) {
            if (typeof window.getWorldbookNames === 'function') {
                bookList = await Promise.resolve(window.getWorldbookNames()) || [];
                debugInfo = `win.getWorldbookNames(${bookList.length})`;
            } else if (typeof window.getLorebooks === 'function') {
                bookList = await Promise.resolve(window.getLorebooks()) || [];
                debugInfo = `win.getLorebooks(${bookList.length})`;
            }
        }

        // ====================================================================
        // STRATEGY 4: jQuery DOM scraping from ST's own world_info select element
        // SillyTavern has a <select id="world_info"> that lists all worldbooks
        // ====================================================================
        if (bookList.length === 0) {
            try {
                const $ = window.jQuery || window.$;
                if ($) {
                    const options = $('#world_info option');
                    if (options && options.length > 0) {
                        options.each(function () {
                            const text = $(this).text().trim();
                            if (text && text !== 'None' && text !== '' && $(this).val() !== '') {
                                bookList.push(text);
                            }
                        });
                        debugInfo = `jQuery_#world_info(${bookList.length})`;
                    }
                }
            } catch (e) {
                console.warn('[Map] jQuery fallback failed', e);
            }
        }

        // ====================================================================
        // STRATEGY 5: Fetch from SillyTavern server API with proper headers
        // ====================================================================
        if (bookList.length === 0) {
            try {
                const headers = context && typeof context.getRequestHeaders === 'function'
                    ? context.getRequestHeaders()
                    : { 'Content-Type': 'application/json' };

                const res = await fetch('/api/worldinfo/get', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({})
                });
                if (res.ok) {
                    const data = await res.json();
                    bookList = Array.isArray(data) ? data : Object.keys(data || {});
                    debugInfo = `fetch_api(${bookList.length})`;
                }
            } catch (e) {
                console.warn('[Map] fetch /api/worldinfo/get failed', e);
            }
        }

        // ====================================================================
        // DEBUG: If still empty, dump available keys for diagnosis
        // ====================================================================
        if (bookList.length === 0 && !debugInfo) {
            const ctxKeys = context ? Object.keys(context).filter(k =>
                k.toLowerCase().includes('world') || k.toLowerCase().includes('lore')
            ).join(',') : 'no_ctx';
            const stKeys = SillyTavern ? Object.keys(SillyTavern).slice(0, 15).join(',') : 'no_ST';
            debugInfo = `empty|ctx_world_keys:[${ctxKeys}]|ST_keys:[${stKeys}]`;
        }

        // ====================================================================
        // Render dropdown
        // ====================================================================
        selectEl.innerHTML = '<option value="">-- Chọn Worldbook --</option>';

        if (bookList && bookList.length > 0) {
            bookList.forEach(item => {
                const name = typeof item === 'string' ? item : item.name;
                if (name && !name.startsWith('.')) {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name.replace('.json', '');
                    selectEl.appendChild(opt);
                }
            });
        } else {
            const debugOpt = document.createElement('option');
            debugOpt.value = "";
            debugOpt.textContent = `[Trống] Debug: ${debugInfo}`;
            selectEl.appendChild(debugOpt);
        }
    } catch (err) {
        console.error('[Map Panel] Could not load Worldbooks', err);
        selectEl.innerHTML = `<option value="">-- Lỗi tải: ${err.message} --</option>`;
    }
}

async function fetchWorldbookData(name) {
    // Strategy 1: SillyTavern context - loadWorldInfoData or similar
    const context = _getSTContext();
    const TavernHelper = _getTH();

    // Strategy 2: TavernHelper / window globals
    if (typeof window.getWorldbook === 'function') {
        let entries = await window.getWorldbook(name);
        return { entries: entries || [] };
    } else if (TavernHelper && typeof TavernHelper.getLorebookEntries === 'function') {
        let entries = await TavernHelper.getLorebookEntries(name);
        return { entries: entries || [] };
    }

    // Strategy 3: Fetch from SillyTavern server with proper auth headers
    const headers = context && typeof context.getRequestHeaders === 'function'
        ? context.getRequestHeaders()
        : { 'Content-Type': 'application/json' };

    const res = await fetch(`/api/worldinfo/get`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name: name })
    });
    if (res.ok) {
        const data = await res.json();
        return data;
    }

    throw new Error('Không thể tải entries. Kiểm tra console để xem chi tiết.');
}

function buildMindMapPrompt(name, wbData) {
    // Extract entries to make the prompt smaller and concise
    let entriesStr = '';

    if (wbData && wbData.entries) {
        // Iterate only over top 50 entries to prevent context limits, or map them out
        const entriesToUse = Object.values(wbData.entries).slice(0, 30);
        entriesToUse.forEach(entry => {
            const keys = entry.key ? entry.key.join(', ') : entry.keysecondary ? entry.keysecondary.join(', ') : 'Unknown';
            const contentSnippet = typeof entry.content === 'string'
                ? entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '')
                : '';

            entriesStr += `- Keys: ${keys}\n  Content: ${contentSnippet}\n\n`;
        });
    } else {
        entriesStr = JSON.stringify(wbData, null, 2).substring(0, 3000);
    }

    return `I provide you with some entries from a fictional Lorebook called "${name}":

${entriesStr}

Your task is to generate a comprehensive Mermaid mindmap based on the relationship between these keys and their descriptions.
- Use Mermaid's mindmap syntax.
- Extract the core concepts, characters, locations, or elements mentioned.
- Group them logically (e.g., Characters, Locations, Lore, etc.) as the root nodes.
- Do NOT output any explanations or markdown outside of the \`\`\`mermaid code block.

Example format:
\`\`\`mermaid
mindmap
  root((World))
    Characters
      Alice
      Bob
    Locations
      City A
        Building X
\`\`\`

Now generate the mermaid mindmap for "${name}":`;
}

function extractMermaidCode(text) {
    const regex = /```mermaid([\s\S]*?)```/i;
    const match = text.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }
    // Fallback: if no markdown, just check if starts with mindmap or graph
    if (text.trim().startsWith('mindmap') || text.trim().startsWith('graph')) {
        return text.trim();
    }
    return null;
}
