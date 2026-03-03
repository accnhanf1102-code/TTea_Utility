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

async function loadWorldbooks(selectEl) {
    try {
        const res = await fetch('/api/worldinfo/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!res.ok) throw new Error('API /api/worldinfo/get error');

        const data = await res.json();

        selectEl.innerHTML = '<option value="">-- Chọn Worldbook --</option>';
        if (data && typeof data === 'object') {
            // data is usually an array of strings (names) or objects
            // SillyTavern usually returns an array of names from this endpoint
            const list = Array.isArray(data) ? data : Object.keys(data);
            list.forEach(item => {
                const name = typeof item === 'string' ? item : item.name;
                // Exclude system/hidden extensions if necessary
                if (name && !name.startsWith('.')) {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name.replace('.json', '');
                    selectEl.appendChild(opt);
                }
            });
        }
    } catch (err) {
        console.error('[Map Panel] Could not load Worldbooks', err);
        selectEl.innerHTML = '<option value="">-- Lỗi tải Worldbook --</option>';
    }
}

async function fetchWorldbookData(name) {
    // API endpoint to get specific worldbook data
    const res = await fetch('/api/worldinfo/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    });

    if (!res.ok) throw new Error('Failed to fetch worldbook data');
    const data = await res.json();
    return data;
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
