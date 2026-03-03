import { generateLLMCompletion } from '../SettingsPanel/index.js';

/* ============================================
   Map Panel Logic — Bubble Mind Map
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
                <label>Worldbook:</label>
                <div class="uh-wb-search-wrap">
                    <input type="text" class="uh-wb-search-input" placeholder="Nhập tên để tìm..." autocomplete="off" />
                    <span class="uh-wb-search-icon">🔍</span>
                    <div class="uh-wb-dropdown"></div>
                </div>
                <select id="uh-worldbook-select" class="uh-worldbook-select" style="display:none;"></select>
            </div>
            <div class="uh-map-content">
                <div class="uh-map-viewport"></div>
                <div class="uh-zoom-controls">
                    <button class="uh-zoom-btn uh-zoom-in" title="Phóng to">+</button>
                    <button class="uh-zoom-btn uh-zoom-out" title="Thu nhỏ">−</button>
                    <button class="uh-zoom-btn uh-zoom-reset" title="Về giữa">⟲</button>
                </div>
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

    const hiddenSelect = panel.querySelector('#uh-worldbook-select');
    const searchInput = panel.querySelector('.uh-wb-search-input');
    const dropdown = panel.querySelector('.uh-wb-dropdown');
    const mapContent = panel.querySelector('.uh-map-content');
    const viewport = panel.querySelector('.uh-map-viewport');

    // =========================================
    //  Searchable Worldbook Dropdown
    // =========================================
    let wbList = []; // cached list of worldbook names
    let selectedWb = '';

    loadWorldbooks(hiddenSelect).then(() => {
        // Extract names from options
        wbList = [];
        for (const opt of hiddenSelect.options) {
            if (opt.value) wbList.push(opt.value);
        }
        renderDropdownItems('');
    });

    function renderDropdownItems(filter) {
        const lowerFilter = filter.toLowerCase();
        const matching = wbList.filter(n => n.toLowerCase().includes(lowerFilter));
        if (matching.length === 0) {
            dropdown.innerHTML = '<div class="uh-wb-dropdown-empty">Không tìm thấy</div>';
        } else {
            dropdown.innerHTML = matching.map(name => {
                const display = name.replace('.json', '');
                const cls = name === selectedWb ? 'uh-wb-dropdown-item uh-wb-selected' : 'uh-wb-dropdown-item';
                return `<div class="${cls}" data-wb="${name}">${display}</div>`;
            }).join('');
        }
    }

    searchInput.addEventListener('focus', () => {
        renderDropdownItems(searchInput.value);
        dropdown.classList.add('uh-wb-dropdown-open');
    });

    searchInput.addEventListener('input', () => {
        renderDropdownItems(searchInput.value);
        dropdown.classList.add('uh-wb-dropdown-open');
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.uh-wb-dropdown-item');
        if (!item) return;
        selectedWb = item.dataset.wb;
        searchInput.value = selectedWb.replace('.json', '');
        dropdown.classList.remove('uh-wb-dropdown-open');
        renderDropdownItems('');
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('uh-wb-dropdown-open');
        }
    });

    // =========================================
    //  Pan & Zoom
    // =========================================
    let scale = 1;
    let panX = 0, panY = 0;
    let isPanning = false;
    let panStartX = 0, panStartY = 0;
    let panStartPanX = 0, panStartPanY = 0;

    function applyTransform() {
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    function zoomTo(newScale, cx, cy) {
        // cx, cy = point in mapContent coords to zoom towards
        const prevScale = scale;
        scale = Math.max(0.2, Math.min(4, newScale));
        const ratio = scale / prevScale;
        panX = cx - ratio * (cx - panX);
        panY = cy - ratio * (cy - panY);
        applyTransform();
    }

    mapContent.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = mapContent.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomTo(scale * delta, cx, cy);
    }, { passive: false });

    mapContent.addEventListener('mousedown', (e) => {
        // Only pan from content area, not from zoom buttons
        if (e.target.closest('.uh-zoom-controls')) return;
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartPanX = panX;
        panStartPanY = panY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = panStartPanX + (e.clientX - panStartX);
        panY = panStartPanY + (e.clientY - panStartY);
        applyTransform();
    });

    document.addEventListener('mouseup', () => { isPanning = false; });

    // Touch support
    mapContent.addEventListener('touchstart', (e) => {
        if (e.target.closest('.uh-zoom-controls')) return;
        if (e.touches.length === 1) {
            isPanning = true;
            panStartX = e.touches[0].clientX;
            panStartY = e.touches[0].clientY;
            panStartPanX = panX;
            panStartPanY = panY;
        }
    }, { passive: true });

    mapContent.addEventListener('touchmove', (e) => {
        if (!isPanning || e.touches.length !== 1) return;
        panX = panStartPanX + (e.touches[0].clientX - panStartX);
        panY = panStartPanY + (e.touches[0].clientY - panStartY);
        applyTransform();
    }, { passive: true });

    mapContent.addEventListener('touchend', () => { isPanning = false; });

    // Zoom buttons
    panel.querySelector('.uh-zoom-in').addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = mapContent.getBoundingClientRect();
        zoomTo(scale * 1.25, rect.width / 2, rect.height / 2);
    });
    panel.querySelector('.uh-zoom-out').addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = mapContent.getBoundingClientRect();
        zoomTo(scale * 0.8, rect.width / 2, rect.height / 2);
    });
    panel.querySelector('.uh-zoom-reset').addEventListener('click', (e) => {
        e.stopPropagation();
        scale = 1; panX = 0; panY = 0;
        applyTransform();
    });

    // =========================================
    //  Close
    // =========================================
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('uh-map-panel-open');
    });

    // =========================================
    //  Create Map
    // =========================================
    createBtn.addEventListener('click', async () => {
        if (!selectedWb) {
            alert('Vui lòng chọn một Worldbook trước.');
            return;
        }

        try {
            createBtn.disabled = true;
            createBtn.textContent = 'Đang phân tích...';
            viewport.innerHTML = '<div style="color:#e2e8f0; padding:20px; text-align:center; position:absolute; width:100%;">Đang lấy dữ liệu Worldbook và gọi AI... Vui lòng đợi.</div>';

            // 1. Fetch detailed worldbook data
            const wbData = await fetchWorldbookData(selectedWb);

            // 2. Prepare prompt for JSON tree
            const prompt = buildBubbleMapPrompt(selectedWb, wbData);

            // 3. Call LLM
            const responseText = await generateLLMCompletion(prompt);

            // 4. Extract JSON tree
            const tree = extractJsonTree(responseText);

            if (!tree) {
                viewport.innerHTML = `<div style="color:#fca5a5; padding:20px;"><b>Không tìm thấy cấu trúc JSON hợp lệ trong phản hồi AI.</b><br><pre style="white-space:pre-wrap;font-size:11px;max-height:200px;overflow:auto;">${responseText}</pre></div>`;
                return;
            }

            // 5. Render bubble map
            // Reset pan/zoom
            scale = 1; panX = 0; panY = 0;
            applyTransform();

            const rect = mapContent.getBoundingClientRect();
            renderBubbleMap(tree, viewport, rect.width, rect.height);

        } catch (err) {
            console.error('[Map Panel] Error generating map:', err);
            viewport.innerHTML = `<div style="color:#fca5a5; padding:20px;">Đã xảy ra lỗi:<br>${err.message}</div>`;
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'Tạo Mind Map';
        }
    });

    // =========================================
    //  Panel Drag
    // =========================================
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', (e) => {
        if (e.target === closeBtn) return;
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        panel.classList.add('uh-dragging-panel');
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;
        x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, x));
        y = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, y));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.classList.remove('uh-dragging-panel');
            document.body.style.userSelect = '';
        }
    });
}

/* ============================================
   Bubble Mind Map Renderer
   ============================================ */

const BUBBLE_COLORS = [
    ['#6366f1', '#818cf8'], // indigo
    ['#8b5cf6', '#a78bfa'], // violet
    ['#ec4899', '#f472b6'], // pink
    ['#f59e0b', '#fbbf24'], // amber
    ['#10b981', '#34d399'], // emerald
    ['#06b6d4', '#22d3ee'], // cyan
    ['#f97316', '#fb923c'], // orange
    ['#ef4444', '#f87171'], // red
    ['#14b8a6', '#2dd4bf'], // teal
    ['#84cc16', '#a3e635'], // lime
];

function renderBubbleMap(tree, container, areaW, areaH) {
    container.innerHTML = '';

    const ns = 'http://www.w3.org/2000/svg';
    // Use a large fixed canvas so pan/zoom works well
    const svgW = Math.max(2000, areaW * 3);
    const svgH = Math.max(1600, areaH * 3);

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'uh-bubble-svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);

    // Flatten tree into nodes/edges for layout
    const nodes = [];
    const edges = [];
    let idCounter = 0;

    function walkTree(node, parentId, depth, angleStart, angleEnd) {
        const id = idCounter++;
        const r = depth === 0 ? 55 : (depth === 1 ? 38 : 26);
        const fontSize = depth === 0 ? 14 : (depth === 1 ? 11 : 9);
        nodes.push({ id, label: node.label || '?', depth, r, fontSize, x: 0, y: 0, colorIdx: id % BUBBLE_COLORS.length });

        if (parentId !== null) {
            edges.push({ from: parentId, to: id });
        }

        const children = node.children || [];
        if (children.length === 0) return;

        const angleRange = angleEnd - angleStart;
        const angleStep = angleRange / children.length;

        children.forEach((child, i) => {
            const childAngleStart = angleStart + i * angleStep;
            const childAngleEnd = childAngleStart + angleStep;
            walkTree(child, id, depth + 1, childAngleStart, childAngleEnd);
        });
    }

    walkTree(tree, null, 0, 0, 2 * Math.PI);

    // Layout: radial from center
    const cx = svgW / 2;
    const cy = svgH / 2;

    // Place root at center
    nodes[0].x = cx;
    nodes[0].y = cy;

    // For each node, compute position radially from parent
    function layoutRadial(nodeId, parentX, parentY, depth, angleStart, angleEnd) {
        const node = nodes[nodeId];
        const childEdges = edges.filter(e => e.from === nodeId);
        if (childEdges.length === 0) return;

        const radius = depth === 0 ? 200 : (depth === 1 ? 150 : 110);
        const angleRange = angleEnd - angleStart;
        const angleStep = angleRange / childEdges.length;

        childEdges.forEach((edge, i) => {
            const angle = angleStart + (i + 0.5) * angleStep;
            const child = nodes[edge.to];
            child.x = parentX + Math.cos(angle) * radius;
            child.y = parentY + Math.sin(angle) * radius;

            layoutRadial(edge.to, child.x, child.y, depth + 1, angle - angleStep * 0.4, angle + angleStep * 0.4);
        });
    }

    layoutRadial(0, cx, cy, 0, 0, 2 * Math.PI);

    // Draw edges first (behind nodes)
    edges.forEach(e => {
        const from = nodes[e.from];
        const to = nodes[e.to];

        const path = document.createElementNS(ns, 'path');
        // Curved line
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        // Slight curve perpendicular
        const cpx = mx + dy * 0.1;
        const cpy = my - dx * 0.1;
        path.setAttribute('d', `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`);
        path.setAttribute('class', 'uh-bubble-link');
        svg.appendChild(path);
    });

    // Draw nodes
    nodes.forEach(node => {
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'uh-bubble-node');

        const [c1, c2] = BUBBLE_COLORS[node.colorIdx];

        // Gradient
        const gradId = `bgrad-${node.id}`;
        const defs = svg.querySelector('defs') || (() => {
            const d = document.createElementNS(ns, 'defs');
            svg.insertBefore(d, svg.firstChild);
            return d;
        })();

        const grad = document.createElementNS(ns, 'radialGradient');
        grad.id = gradId;
        const stop1 = document.createElementNS(ns, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', c2);
        stop1.setAttribute('stop-opacity', '0.9');
        const stop2 = document.createElementNS(ns, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', c1);
        stop2.setAttribute('stop-opacity', '0.85');
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);

        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', node.r);
        circle.setAttribute('fill', `url(#${gradId})`);
        circle.setAttribute('class', 'uh-bubble-circle');
        circle.setAttribute('stroke', 'rgba(255,255,255,0.15)');
        circle.setAttribute('stroke-width', '1.5');
        g.appendChild(circle);

        // Text (word-wrap by truncation)
        const label = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label;
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y);
        text.setAttribute('class', 'uh-bubble-text');
        text.setAttribute('font-size', node.fontSize);
        text.textContent = label;
        g.appendChild(text);

        // Tooltip via <title>
        const title = document.createElementNS(ns, 'title');
        title.textContent = node.label;
        g.appendChild(title);

        svg.appendChild(g);
    });

    container.appendChild(svg);
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

        // STRATEGY 1: SillyTavern.getContext()
        if (context) {
            if (Array.isArray(context.world_names) && context.world_names.length > 0) {
                bookList = [...context.world_names];
                debugInfo = `ctx.world_names(${bookList.length})`;
            } else if (typeof context.getWorldNames === 'function') {
                bookList = context.getWorldNames() || [];
                debugInfo = `ctx.getWorldNames(${bookList.length})`;
            }
        }

        // STRATEGY 2: TavernHelper
        if (bookList.length === 0 && TavernHelper) {
            if (typeof TavernHelper.getLorebooks === 'function') {
                bookList = await Promise.resolve(TavernHelper.getLorebooks()) || [];
                debugInfo = `TH.getLorebooks(${bookList.length})`;
            } else if (typeof TavernHelper.getWorldbookNames === 'function') {
                bookList = await Promise.resolve(TavernHelper.getWorldbookNames()) || [];
                debugInfo = `TH.getWorldbookNames(${bookList.length})`;
            }
        }

        // STRATEGY 3: window globals
        if (bookList.length === 0) {
            if (typeof window.getWorldbookNames === 'function') {
                bookList = await Promise.resolve(window.getWorldbookNames()) || [];
                debugInfo = `win.getWorldbookNames(${bookList.length})`;
            }
        }

        // STRATEGY 4: jQuery DOM scraping
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
            } catch (e) { }
        }

        // STRATEGY 5: Fetch API
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
                    debugInfo = `fetch_api(${bookList.length})`;
                }
            } catch (e) { }
        }

        // DEBUG
        if (bookList.length === 0 && !debugInfo) {
            const ctxKeys = context ? Object.keys(context).filter(k =>
                k.toLowerCase().includes('world') || k.toLowerCase().includes('lore')
            ).join(',') : 'no_ctx';
            const stKeys = SillyTavern ? Object.keys(SillyTavern).slice(0, 15).join(',') : 'no_ST';
            debugInfo = `empty|ctx_keys:[${ctxKeys}]|ST_keys:[${stKeys}]`;
        }

        // Populate hidden select for data
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

/* ============================================
   LLM Prompt — JSON Tree for Bubble Map
   ============================================ */

function buildBubbleMapPrompt(name, wbData) {
    let entriesStr = '';

    if (wbData && wbData.entries) {
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

Your task is to generate a mind map structure as a **JSON tree**.
Rules:
- The root node label should be "${name}".
- Group entries into logical categories (Characters, Locations, Lore, Items, Events, etc.).
- Each node has: { "label": "Name", "children": [...] }
- Maximum 3 levels deep.
- Do NOT output any explanations or text outside of the JSON code block.

Output format (pure JSON, wrapped in \`\`\`json code block):
\`\`\`json
{
  "label": "${name}",
  "children": [
    {
      "label": "Characters",
      "children": [
        { "label": "Alice" },
        { "label": "Bob" }
      ]
    },
    {
      "label": "Locations",
      "children": [
        { "label": "City A", "children": [{ "label": "Building X" }] }
      ]
    }
  ]
}
\`\`\`

Now generate the JSON mind map tree for "${name}":`;
}

function extractJsonTree(text) {
    // Try to extract from ```json code block
    const jsonBlockRegex = /```json\s*([\s\S]*?)```/i;
    const match = text.match(jsonBlockRegex);
    let jsonStr = match ? match[1].trim() : null;

    if (!jsonStr) {
        // Try bare JSON object
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonStr = braceMatch[0];
    }

    if (!jsonStr) return null;

    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.label) return parsed;
        return null;
    } catch (e) {
        console.warn('[Map] JSON parse error:', e);
        return null;
    }
}
