import { generateLLMCompletion } from '../SettingsPanel/index.js';
import { setLorebookEntries } from '../lorebook_entry.js';

/* ============================================
   Map Panel Logic — Bubble Mind Map
   ============================================ */

export function createMapPanel() {
    const panel = document.createElement('div');
    panel.className = 'uh-map-panel';
    panel.innerHTML = `
        <div class="uh-map-panel-header">
            <div class="uh-map-panel-title">Bản đồ (Lore map)</div>
            <div class="uh-map-panel-controls">
                <button class="uh-map-panel-btn uh-map-panel-fullscreen" title="Toàn màn hình">🗖</button>
                <button class="uh-map-panel-btn uh-map-panel-close" title="Đóng">✕</button>
            </div>
        </div>
        <div class="uh-map-panel-body">
            <div class="uh-map-content">
                <div class="uh-map-viewport"></div>
                <div class="uh-zoom-controls">
                    <button class="uh-zoom-btn uh-zoom-in" title="Phóng to">+</button>
                    <button class="uh-zoom-btn uh-zoom-out" title="Thu nhỏ">−</button>
                    <button class="uh-zoom-btn uh-zoom-reset" title="Về giữa">⟲</button>
                </div>
            </div>
            <div class="uh-map-hud-top">
                <div class="uh-map-top-bar">
                    <label>Worldbook:</label>
                    <div class="uh-wb-search-wrap">
                        <input type="text" class="uh-wb-search-input" placeholder="Nhập tên để tìm..." autocomplete="off" />
                        <span class="uh-wb-search-icon">🔍</span>
                        <div class="uh-wb-dropdown"></div>
                    </div>
                    <select id="uh-worldbook-select" class="uh-worldbook-select" style="display:none;"></select>
                    <button class="uh-btn-create-map">Tạo Lore map</button>
                    <button class="uh-btn-save-lorebook" style="display:none; background-color: #10b981; margin-left:10px;">Lưu thay đổi</button>
                </div>
            </div>
            <div class="uh-map-info-panel" style="display:none;">
                <div class="uh-map-info-header">
                    <div class="uh-map-info-title">Thông tin Entry</div>
                    <button class="uh-map-info-close">✕</button>
                </div>
                <div class="uh-map-info-body"></div>
                <div class="uh-map-info-footer" style="padding: 6px 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; text-align: right; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.25);">
                    Số dòng [Nội Dung]: <span class="uh-map-line-count-value" style="font-weight: bold; color: #e2e8f0;">0</span>
                </div>
            </div>
        </div>
    `;
    return panel;
}

export function initMapPanelLogic(panel) {
    const closeBtn = panel.querySelector('.uh-map-panel-close');
    const header = panel.querySelector('.uh-map-panel-header');
    const createBtn = panel.querySelector('.uh-btn-create-map');
    const saveLorebookBtn = panel.querySelector('.uh-btn-save-lorebook');

    const hiddenSelect = panel.querySelector('#uh-worldbook-select');
    const searchInput = panel.querySelector('.uh-wb-search-input');
    const dropdown = panel.querySelector('.uh-wb-dropdown');
    const mapContent = panel.querySelector('.uh-map-content');
    const viewport = panel.querySelector('.uh-map-viewport');
    const infoPanel = panel.querySelector('.uh-map-info-panel');
    const infoCloseBtn = panel.querySelector('.uh-map-info-close');
    const infoBody = panel.querySelector('.uh-map-info-body');

    const fullscreenBtn = panel.querySelector('.uh-map-panel-fullscreen');

    let currentWbEntries = [];
    let editedEntries = {};

    saveLorebookBtn.addEventListener('click', async () => {
        if (!selectedWb || Object.keys(editedEntries).length === 0) return;
        try {
            saveLorebookBtn.disabled = true;
            saveLorebookBtn.textContent = 'Đang lưu...';
            const entriesToSave = Object.values(editedEntries);
            await setLorebookEntries(selectedWb, entriesToSave);
            editedEntries = {};
            saveLorebookBtn.style.display = 'none';
            alert('Đã lưu các thay đổi vào Lorebook thành công!');
        } catch (err) {
            console.error('[Map Panel] Error saving lorebook entries:', err);
            alert('Lỗi khi lưu vào Lorebook: ' + err.message);
        } finally {
            saveLorebookBtn.disabled = false;
            saveLorebookBtn.textContent = 'Lưu thay đổi';
        }
    });

    infoCloseBtn.addEventListener('click', () => {
        infoPanel.style.display = 'none';
    });

    fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('uh-map-panel-fullscreen');
        const isFullscreen = panel.classList.contains('uh-map-panel-fullscreen');
        fullscreenBtn.textContent = isFullscreen ? '🗗' : '🗖';
        fullscreenBtn.title = isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình';
    });

    // Stop propagation on info panel to prevent panning
    infoPanel.addEventListener('mousedown', (e) => e.stopPropagation());
    infoPanel.addEventListener('click', (e) => e.stopPropagation());

    // Collapsible section toggle delegation
    infoBody.addEventListener('click', (e) => {
        const toggle = e.target.closest('.uh-info-toggle');
        if (!toggle) return;
        const isOpen = toggle.dataset.open === 'true';
        toggle.dataset.open = isOpen ? 'false' : 'true';
        const body = toggle.nextElementSibling;
        if (body) {
            body.style.display = isOpen ? 'none' : 'block';
        }
        const arrow = toggle.querySelector('.uh-info-arrow');
        if (arrow) {
            arrow.textContent = isOpen ? '▸' : '▾';
        }
    });

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
        e.stopPropagation(); // Prevent bubbling to document collapse handler
        const item = e.target.closest('.uh-wb-dropdown-item');
        if (!item) return;
        selectedWb = item.dataset.wb;
        searchInput.value = selectedWb.replace('.json', '');
        dropdown.classList.remove('uh-wb-dropdown-open');
        renderDropdownItems('');
    });

    // Prevent clicks on top-bar from bubbling to document collapse handler
    panel.querySelector('.uh-map-top-bar').addEventListener('click', (e) => {
        e.stopPropagation();
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
    let rafId = null;

    function applyTransform() {
        viewport.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
        panel.style.backgroundPosition = `${panX}px ${panY}px`;
        panel.style.backgroundSize = `${60 * scale}px ${60 * scale}px`;
    }

    function scheduleTransform() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            applyTransform();
            rafId = null;
        });
    }

    function zoomTo(newScale, cx, cy) {
        const prevScale = scale;
        scale = Math.max(0.1, Math.min(5, newScale));
        const ratio = scale / prevScale;
        panX = cx - ratio * (cx - panX);
        panY = cy - ratio * (cy - panY);
        scheduleTransform();
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
        if (e.target.closest('.uh-zoom-controls')) return;
        if (e.target.closest('.uh-map-hud-top')) return;
        if (e.target.closest('.uh-map-info-panel')) return;
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartPanX = panX;
        panStartPanY = panY;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = panStartPanX + (e.clientX - panStartX);
        panY = panStartPanY + (e.clientY - panStartY);
        scheduleTransform();
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
        const rect = mapContent.getBoundingClientRect();
        scale = 1;
        panX = (rect.width / 2) - 7500;
        panY = (rect.height / 2) - 7500;
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

            // Reset edits
            editedEntries = {};
            saveLorebookBtn.style.display = 'none';

            // 1. Fetch detailed worldbook data
            const wbData = await fetchWorldbookData(selectedWb);
            currentWbEntries = wbData && wbData.entries ? Object.values(wbData.entries) : [];

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

            // 5. Render mind map
            const rect = mapContent.getBoundingClientRect();

            // Căn giữa bản đồ với kích thước Canvas 15.000 x 15.000 mới
            scale = 1;
            panX = (rect.width / 2) - 7500;
            panY = (rect.height / 2) - 7500;
            applyTransform();

            renderMindMap(tree, viewport, rect.width, rect.height, {
                entries: currentWbEntries,
                onNodeClick: (entry, entryName, entryId) => {
                    if (!entry) {
                        infoBody.innerHTML = `<div style="color: #fca5a5;">Lỗi: Không tìm thấy dữ liệu cho entry ID ${entryId}</div>`;
                        const lineCntEl = infoPanel.querySelector('.uh-map-line-count-value');
                        if (lineCntEl) lineCntEl.textContent = 0;
                        infoPanel.style.display = 'flex';
                        return;
                    }
                    openEntryInfo(entry, entryName, entryId);
                }
            });

        } catch (err) {
            console.error('[Map Panel] Error generating map:', err);
            viewport.innerHTML = `<div style="color:#fca5a5; padding:20px;">Đã xảy ra lỗi:<br>${err.message}</div>`;
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'Tạo Lore map';
        }
    });

    // =========================================
    //  Info Panel Logic
    // =========================================
    function openEntryInfo(entry, entryName, entryId) {
        // Use edited data if exists
        const displayEntry = editedEntries[entry.uid] ? { ...entry, ...editedEntries[entry.uid] } : entry;

        const keys = displayEntry.key ? displayEntry.key.join(', ') : '';
        const secKeys = displayEntry.keysecondary ? displayEntry.keysecondary.join(', ') : '';
        const content = displayEntry.content || '';

        let contentHtml = `
            <div class="uh-info-section">
                <div class="uh-info-section-label">📌 TÊN ENTRY</div>
                <div class="uh-info-section-content">${entryName}</div>
            </div>
            
            <div class="uh-info-section uh-info-collapsible">
                <div class="uh-info-section-label uh-info-toggle" data-open="true">🔑 KEY <span class="uh-info-arrow">▾</span></div>
                <div class="uh-info-section-content uh-info-collapse-body">
                    <input type="text" class="uh-edit-input uh-edit-key" value="${keys.replace(/"/g, '&quot;')}" disabled style="width:100%; padding:5px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff;" />
                </div>
            </div>
            
            <div class="uh-info-section uh-info-collapsible">
                <div class="uh-info-section-label uh-info-toggle" data-open="true">🔗 SECONDARY KEY <span class="uh-info-arrow">▾</span></div>
                <div class="uh-info-section-content uh-info-collapse-body">
                    <input type="text" class="uh-edit-input uh-edit-seckey" value="${secKeys.replace(/"/g, '&quot;')}" disabled style="width:100%; padding:5px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff;" />
                </div>
            </div>
            
            <div class="uh-info-section uh-info-collapsible">
                <div class="uh-info-section-label uh-info-toggle" data-open="true">📄 NỘI DUNG <span class="uh-info-arrow">▾</span></div>
                <div class="uh-info-section-content uh-info-collapse-body">
                    <textarea class="uh-edit-input uh-edit-content" spellcheck="false" disabled style="width:100%; padding:5px; height:150px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff; resize:vertical; font-family:inherit;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
            </div>
            
            <div class="uh-info-action-btns" style="margin-top: 15px; display:flex; gap: 10px; justify-content: flex-end;">
                <button class="uh-btn-edit-entry" style="padding: 5px 15px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Chỉnh sửa</button>
                <button class="uh-btn-save-temp" style="display:none; padding: 5px 15px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">Lưu tạm thời</button>
                <button class="uh-btn-cancel-edit" style="display:none; padding: 5px 15px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Hủy</button>
            </div>
        `;

        infoBody.innerHTML = contentHtml;
        const lineCntEl = infoPanel.querySelector('.uh-map-line-count-value');
        if (lineCntEl) lineCntEl.textContent = content ? content.split(/\\r\\n|\\r|\\n/).length : 0;
        infoPanel.style.display = 'flex';

        // Setup listeners
        const editBtn = infoBody.querySelector('.uh-btn-edit-entry');
        const saveTempBtn = infoBody.querySelector('.uh-btn-save-temp');
        const cancelBtn = infoBody.querySelector('.uh-btn-cancel-edit');
        const inputs = infoBody.querySelectorAll('.uh-edit-input');
        const keyInput = infoBody.querySelector('.uh-edit-key');
        const secKeyInput = infoBody.querySelector('.uh-edit-seckey');
        const contentInput = infoBody.querySelector('.uh-edit-content');

        editBtn.addEventListener('click', () => {
            inputs.forEach(i => { i.disabled = false; i.style.background = 'rgba(255,255,255,0.1)'; });
            editBtn.style.display = 'none';
            saveTempBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            contentInput.focus();
        });

        cancelBtn.addEventListener('click', () => {
            openEntryInfo(entry, entryName, entryId);
        });

        saveTempBtn.addEventListener('click', () => {
            editedEntries[entry.uid] = {
                uid: entry.uid,
                key: keyInput.value.split(',').map(s => s.trim()).filter(Boolean),
                keysecondary: secKeyInput.value.split(',').map(s => s.trim()).filter(Boolean),
                content: contentInput.value
            };

            saveLorebookBtn.style.display = 'inline-block';
            openEntryInfo(entry, entryName, entryId);
        });

        contentInput.addEventListener('input', () => {
            if (lineCntEl) {
                lineCntEl.textContent = contentInput.value ? contentInput.value.split(/\\r\\n|\\r|\\n/).length : 0;
            }
        });
    }

    // =========================================
    //  Panel Drag
    // =========================================
    let isDraggingPanel = false;
    let dragStartX = 0, dragStartY = 0;
    let panelInitialX = 0, panelInitialY = 0;
    let panelTransformX = 0, panelTransformY = 0;

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.uh-map-panel-btn')) return;
        if (panel.classList.contains('uh-map-panel-fullscreen')) return;

        isDraggingPanel = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panelInitialX = panelTransformX;
        panelInitialY = panelTransformY;

        panel.classList.add('uh-dragging-panel');
        document.body.style.userSelect = 'none';

        // Remove transitions during drag
        panel.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingPanel) return;

        panelTransformX = panelInitialX + (e.clientX - dragStartX);
        panelTransformY = panelInitialY + (e.clientY - dragStartY);

        panel.style.transform = `translate3d(${panelTransformX}px, ${panelTransformY}px, 0)`;
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingPanel) {
            isDraggingPanel = false;
            panel.classList.remove('uh-dragging-panel');
            document.body.style.userSelect = '';

            // Restore transitions
            panel.style.transition = '';
        }
    });
}

/* ============================================
   Bubble Mind Map Renderer
   ============================================ */

function renderMindMap(tree, container, areaW, areaH, context) {
    if (!tree._initialized) {
        // init state
        let nextId = 1;
        function initNode(n, depth) {
            n._id = 'node_' + (nextId++);
            if (depth === 0) {
                n._expanded = false;
                n._side = 0; // 0 = center
            }
            if (n.children) {
                n.children.forEach((c, i) => {
                    if (depth === 0) {
                        c._side = (i % 2 === 0) ? 1 : -1; // 1 = right, -1 = left
                    } else {
                        c._side = n._side;
                    }
                    c._expanded = false;
                    initNode(c, depth + 1);
                });
            }
        }
        initNode(tree, 0);
        tree._initialized = true;
    }

    function update() {
        container.innerHTML = '';
        const ns = 'http://www.w3.org/2000/svg';

        // Kích thước vô cực để không bị cắt (SVG vector không tốn VRAM như Canvas)
        const svgW = 15000;
        const svgH = 15000;
        const cx = svgW / 2;
        const cy = svgH / 2;

        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'uh-mindmap-svg');
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        // Chỉnh trực tiếp style width/height = viewbox để khi scale bằng transform không bị mờ
        svg.style.width = svgW + 'px';
        svg.style.height = svgH + 'px';

        // Tính toán thông số layout (Scale 200%)
        const NODE_W = 280;   // originally 140
        const NODE_H = 72;    // originally 36
        const LEVEL_GAP_X = 200; // originally 100
        const NODE_GAP_Y = 30;    // originally 15

        // calc height recursively for visible nodes
        function calcSubtree(n) {
            if (!n.children || n.children.length === 0 || !n._expanded) {
                n._boxH = NODE_H;
                return n._boxH;
            }
            let totalH = 0;
            n.children.forEach(c => {
                totalH += calcSubtree(c) + NODE_GAP_Y;
            });
            totalH -= NODE_GAP_Y;
            n._boxH = Math.max(NODE_H, totalH);
            return n._boxH;
        }

        // Divide root children into left and right sets
        let leftChildren = [];
        let rightChildren = [];
        if (tree._expanded && tree.children) {
            tree.children.forEach(c => {
                if (c._side === -1) leftChildren.push(c);
                else rightChildren.push(c);
            });
        }

        const leftH = leftChildren.reduce((sum, c) => sum + calcSubtree(c) + NODE_GAP_Y, 0) - NODE_GAP_Y;
        const rightH = rightChildren.reduce((sum, c) => sum + calcSubtree(c) + NODE_GAP_Y, 0) - NODE_GAP_Y;

        // Bố trí gốc (Root)
        tree.x = cx;
        tree.y = cy;

        const nodesToDraw = [];
        const edgesToDraw = [];

        function layoutSubtree(nodes, parentX, parentY, totalH, signX, depth) {
            let startY = parentY - totalH / 2;
            nodes.forEach(c => {
                const childH = c._boxH;
                const nodeCenterY = startY + childH / 2;

                c.x = parentX + signX * (NODE_W + LEVEL_GAP_X);
                c.y = nodeCenterY;

                edgesToDraw.push({
                    from: { x: parentX, y: parentY, side: signX },
                    to: { x: c.x, y: c.y, side: signX }
                });

                nodesToDraw.push(c);

                if (c._expanded && c.children && c.children.length > 0) {
                    layoutSubtree(c.children, c.x, c.y, childH, signX, depth + 1);
                }

                startY += childH + NODE_GAP_Y;
            });
        }

        nodesToDraw.push(tree); // Add root

        if (tree._expanded) {
            layoutSubtree(leftChildren, cx, cy, Math.max(0, leftH), -1, 1);
            layoutSubtree(rightChildren, cx, cy, Math.max(0, rightH), 1, 1);
        }

        // Draw edges
        edgesToDraw.forEach(e => {
            const path = document.createElementNS(ns, 'path');
            const dx = Math.abs(e.to.x - e.from.x);
            const startX = e.from.x + e.from.side * (NODE_W / 2);
            const endX = e.to.x - e.to.side * (NODE_W / 2);

            // smooth bezier
            const cpX1 = startX + e.from.side * 80;
            const cpX2 = endX - e.to.side * 80;

            path.setAttribute('d', `M ${startX} ${e.from.y} C ${cpX1} ${e.from.y}, ${cpX2} ${e.to.y}, ${endX} ${e.to.y}`);
            path.setAttribute('class', 'uh-mindmap-link');
            svg.appendChild(path);
        });

        // Draw nodes
        nodesToDraw.forEach(n => {
            const g = document.createElementNS(ns, 'g');
            g.setAttribute('class', 'uh-mindmap-node' + (n._expanded ? ' expanded' : ''));
            // transform
            g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
            g.style.cursor = 'pointer';

            const rect = document.createElementNS(ns, 'rect');
            rect.setAttribute('x', -NODE_W / 2);
            rect.setAttribute('y', -NODE_H / 2);
            rect.setAttribute('width', NODE_W);
            rect.setAttribute('height', NODE_H);
            rect.setAttribute('rx', 12);
            rect.setAttribute('class', 'uh-mindmap-rect');
            g.appendChild(rect);

            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', 0);
            text.setAttribute('y', 0);
            text.setAttribute('class', 'uh-mindmap-text');

            const label = n.label.length > 30 ? n.label.slice(0, 29) + '…' : n.label;
            text.textContent = label;
            g.appendChild(text);

            if (n.children && n.children.length > 0) {
                // draw a small indicator circle for expand/collapse
                const circle = document.createElementNS(ns, 'circle');
                const signX = n._side !== 0 ? n._side : 1;
                // for root, maybe double indicator, or right indicator
                circle.setAttribute('cx', (NODE_W / 2) * signX);
                circle.setAttribute('cy', 0);
                circle.setAttribute('r', 10);
                circle.setAttribute('class', 'uh-mindmap-indicator');
                g.appendChild(circle);

                const countText = document.createElementNS(ns, 'text');
                countText.setAttribute('x', (NODE_W / 2) * signX);
                countText.setAttribute('y', 0);
                countText.setAttribute('class', 'uh-mindmap-count');
                countText.textContent = n.children.length;
                g.appendChild(countText);
            }

            g.addEventListener('click', (e) => {
                e.stopPropagation();
                if (n.children && n.children.length > 0) {
                    n._expanded = !n._expanded;
                    update();
                } else if (n.id !== undefined && context && context.onNodeClick) {
                    const entry = context.entries[n.id] || null;
                    context.onNodeClick(entry, n.label || 'Unknown', n.id);
                }
            });

            svg.appendChild(g);
        });

        container.appendChild(svg);
    }

    update();
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
        const entriesToUse = Object.values(wbData.entries).slice(0, 50);
        entriesToUse.forEach((entry, idx) => {
            const keys = entry.key ? entry.key.join(', ') : entry.keysecondary ? entry.keysecondary.join(', ') : 'Unknown';
            const contentSnippet = typeof entry.content === 'string'
                ? entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '')
                : '';
            entriesStr += `Entry ID: ${idx}\n- Keys: ${keys}\n  Content: ${contentSnippet}\n\n`;
        });
    } else {
        entriesStr = JSON.stringify(wbData, null, 2).substring(0, 3000);
    }

    return `I provide you with some entries from a fictional Lorebook called "${name}":

${entriesStr}

Your task is to generate a mind map structure as a **JSON tree**.
Your task is to generate a mind map structure as a **JSON tree**.
Rules:
- The root node label should be "${name}".
- Group entries into logical categories. You MUST use categories like: "Địa điểm" (Locations), "Nhân vật" (Characters), "Logic".
- **CRITICAL REQUIREMENT**: You MUST create a separate category called "MVU" IF there are any entries containing the exact string "[Initvar]" or "[mvu_update]" (case-insensitive) in their Name/Keys. ALL such entries must be placed inside this "MVU" category.
- Each node has: { "label": "Name", "id": <Entry ID if leaf node>, "children": [...] }
- Maximum 3 levels deep. Leaf nodes (the entries themselves) MUST contain the exact "id" corresponding to the "Entry ID" provided above.
- Do NOT output any explanations or text outside of the JSON code block.

Output format (pure JSON, wrapped in \`\`\`json code block):
\`\`\`json
{
  "label": "${name}",
  "children": [
    {
      "label": "Nhân vật",
      "children": [
        { "label": "Alice", "id": 0 },
        { "label": "Bob", "id": 1 }
      ]
    },
    {
      "label": "Địa điểm",
      "children": [
        { "label": "City A", "id": 2 },
        { "label": "Building X", "id": 3 }
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
