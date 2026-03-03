// ============================================
//  Utility Helper — SillyTavern Extension
// ============================================

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'utilityHelper';

/* ---------- Settings ---------- */
const defaultSettings = {
    apiMode: 'main', // 'main' | 'secondary'
    secondaryApiUrl: '',
    secondaryApiKey: '',
    selectedModel: '',
};

function loadSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = {};
    }
    Object.assign(defaultSettings, extension_settings[EXT_NAME]);
    extension_settings[EXT_NAME] = defaultSettings;
}
loadSettings();

function saveSettings() {
    extension_settings[EXT_NAME] = defaultSettings;
    saveSettingsDebounced();
}

/* ============================================
   DOM CREATION
   ============================================ */

// ---------- Heart Bubble (Main) ----------
const heartBubble = document.createElement('div');
heartBubble.className = 'uh-heart-bubble';
heartBubble.innerHTML = '<span class="uh-heart-icon">❤️</span>';

// ---------- Sub-Bubbles Container ----------
const subBubblesContainer = document.createElement('div');
subBubblesContainer.className = 'uh-sub-bubbles';

// ---------- Setting Bubble ----------
const settingBubble = document.createElement('div');
settingBubble.className = 'uh-sub-bubble uh-setting-bubble';
settingBubble.innerHTML = `
    <span class="uh-bubble-icon">⚙️</span>
    <span class="uh-bubble-tooltip">Cài đặt</span>
`;
subBubblesContainer.appendChild(settingBubble);

// ---------- Settings Panel ----------
const settingsPanel = document.createElement('div');
settingsPanel.className = 'uh-settings-panel';
settingsPanel.innerHTML = `
    <div class="uh-panel-content">
        <div class="uh-panel-title">⚙️ Cài đặt API</div>

        <!-- API Toggle -->
        <div class="uh-api-toggle">
            <button class="uh-api-toggle-btn uh-active" data-api="main">
                🔑 API Chính
            </button>
            <button class="uh-api-toggle-btn" data-api="secondary">
                🔗 API Phụ
            </button>
        </div>

        <!-- Secondary API Section -->
        <div class="uh-secondary-section">
            <div class="uh-input-group">
                <label class="uh-input-label">API URL</label>
                <input type="text" class="uh-input-field" id="uh-api-url"
                       placeholder="https://api.example.com/v1" />
            </div>
            <div class="uh-input-group">
                <label class="uh-input-label">API Key</label>
                <input type="password" class="uh-input-field" id="uh-api-key"
                       placeholder="sk-xxxxxxxxxxxxxxxx" />
            </div>
            <div class="uh-input-group">
                <label class="uh-input-label">Model</label>
                <select class="uh-select-field" id="uh-model-select" disabled>
                    <option value="">-- Nhập URL & Key rồi Connect --</option>
                </select>
            </div>
            <button class="uh-connect-btn" id="uh-connect-btn">
                CONNECT
            </button>
            <div class="uh-status-msg" id="uh-status-msg"></div>
        </div>
    </div>
`;

// Append to DOM
document.body.appendChild(heartBubble);
document.body.appendChild(subBubblesContainer);
document.body.appendChild(settingsPanel);

/* ============================================
   STATE
   ============================================ */
let bubblesExpanded = false;
let panelOpen = false;
let isDragging = false;
let dragMoved = false;

// Position state (center-based for heart bubble)
let heartPos = {
    x: window.innerWidth - 30 - 25,
    y: window.innerHeight - 120 - 25,
};
let dragStart = { x: 0, y: 0 };
let dragStartPos = { x: 0, y: 0 };

/* ============================================
   POSITIONING
   ============================================ */
function setHeartPosition(x, y) {
    // Clamp to viewport
    const halfH = 25;
    x = Math.max(halfH, Math.min(window.innerWidth - halfH, x));
    y = Math.max(halfH, Math.min(window.innerHeight - halfH, y));
    heartPos.x = x;
    heartPos.y = y;
    heartBubble.style.left = (x - halfH) + 'px';
    heartBubble.style.top = (y - halfH) + 'px';
    // Remove default right/bottom positioning
    heartBubble.style.right = 'auto';
    heartBubble.style.bottom = 'auto';
    updateSubBubblePositions();
    updatePanelPosition();
}

function updateSubBubblePositions() {
    // When expanded: position sub-bubbles directly above the heart
    // When collapsed: position at heart center (hidden behind)
    const subBubbles = subBubblesContainer.querySelectorAll('.uh-sub-bubble');
    const halfBubble = 21; // half of bubble size
    const gap = 8; // gap between heart and sub-bubble

    subBubbles.forEach((bubble, i) => {
        if (bubblesExpanded) {
            // Stack above heart: each bubble goes higher
            const bx = heartPos.x - halfBubble;
            const by = heartPos.y - 25 - gap - (var_uh_bubble_size()) - (i * (var_uh_bubble_size() + gap)) + halfBubble;
            bubble.style.left = bx + 'px';
            bubble.style.top = by + 'px';
        } else {
            // Hidden behind heart
            positionBubbleAtHeart(bubble);
        }
    });
}

function var_uh_bubble_size() { return 42; }

function positionBubbleAtHeart(bubble) {
    const halfBubble = 21;
    bubble.style.left = (heartPos.x - halfBubble) + 'px';
    bubble.style.top = (heartPos.y - halfBubble) + 'px';
}

function updatePanelPosition() {
    // Place panel to the left of the heart bubble, or right if near left edge
    const panelWidth = 340;
    const panelGap = 16;
    let px, py;

    if (heartPos.x > panelWidth + panelGap + 30) {
        px = heartPos.x - panelWidth - panelGap - 25;
    } else {
        px = heartPos.x + 25 + panelGap;
    }

    py = heartPos.y - 80;
    // Keep panel in viewport
    py = Math.max(10, Math.min(window.innerHeight - 490, py));
    px = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, px));

    settingsPanel.style.left = px + 'px';
    settingsPanel.style.top = py + 'px';
}

// Initialize position — place sub-bubbles behind heart
setHeartPosition(heartPos.x, heartPos.y);
subBubblesContainer.querySelectorAll('.uh-sub-bubble').forEach(b => positionBubbleAtHeart(b));

/* ============================================
   DRAG BEHAVIOR
   ============================================ */
function onDragStart(e) {
    e.preventDefault();
    isDragging = true;
    dragMoved = false;
    const point = e.touches ? e.touches[0] : e;
    dragStart.x = point.clientX;
    dragStart.y = point.clientY;
    dragStartPos.x = heartPos.x;
    dragStartPos.y = heartPos.y;
    heartBubble.classList.add('uh-dragging');

    // Add following class to sub-bubbles for smooth follow
    subBubblesContainer.querySelectorAll('.uh-sub-bubble').forEach(b => {
        b.classList.add('uh-following');
    });

    document.addEventListener('mousemove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - dragStart.x;
    const dy = point.clientY - dragStart.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved = true;
    }

    setHeartPosition(dragStartPos.x + dx, dragStartPos.y + dy);
}

function onDragEnd() {
    isDragging = false;
    heartBubble.classList.remove('uh-dragging');

    // Remove following class after a brief delay
    setTimeout(() => {
        subBubblesContainer.querySelectorAll('.uh-sub-bubble').forEach(b => {
            b.classList.remove('uh-following');
        });
    }, 400);

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
}

heartBubble.addEventListener('mousedown', onDragStart);
heartBubble.addEventListener('touchstart', onDragStart, { passive: false });

/* ============================================
   BUBBLE TOGGLE (Click)
   ============================================ */
heartBubble.addEventListener('click', (e) => {
    // Ignore if we were dragging
    if (dragMoved) return;
    e.stopPropagation();
    toggleBubbles();
});

function toggleBubbles() {
    bubblesExpanded = !bubblesExpanded;
    const subBubbles = subBubblesContainer.querySelectorAll('.uh-sub-bubble');

    if (bubblesExpanded) {
        // Slide sub-bubbles up above heart
        updateSubBubblePositions();
        subBubbles.forEach((bubble, i) => {
            setTimeout(() => {
                bubble.classList.add('uh-visible');
            }, i * 60);
        });
    } else {
        collapseBubbles();
    }
}

function collapseBubbles() {
    bubblesExpanded = false;
    const subBubbles = subBubblesContainer.querySelectorAll('.uh-sub-bubble');
    subBubbles.forEach((bubble, i) => {
        bubble.classList.remove('uh-visible');
        // Slide back behind heart
        positionBubbleAtHeart(bubble);
    });
    // Also close panel
    closePanel();
}

/* ---------- Click outside to close ---------- */
document.addEventListener('click', (e) => {
    if (!bubblesExpanded) return;
    // Check if click is on any bubble or the panel
    const isOnBubble =
        heartBubble.contains(e.target) ||
        subBubblesContainer.contains(e.target) ||
        settingsPanel.contains(e.target);

    if (!isOnBubble) {
        collapseBubbles();
    }
});

/* ============================================
   SETTINGS PANEL
   ============================================ */
settingBubble.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
});

function togglePanel() {
    panelOpen = !panelOpen;
    if (panelOpen) {
        updatePanelPosition();
        settingsPanel.classList.add('uh-panel-open');
        applySettingsToUI();
    } else {
        closePanel();
    }
}

function closePanel() {
    panelOpen = false;
    settingsPanel.classList.remove('uh-panel-open');
}

/* ---------- API Toggle ---------- */
const apiToggleBtns = settingsPanel.querySelectorAll('.uh-api-toggle-btn');
const secondarySection = settingsPanel.querySelector('.uh-secondary-section');

apiToggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.api;
        defaultSettings.apiMode = mode;
        saveSettings();
        updateApiToggleUI();
    });
});

function updateApiToggleUI() {
    apiToggleBtns.forEach(btn => {
        btn.classList.toggle('uh-active', btn.dataset.api === defaultSettings.apiMode);
    });

    if (defaultSettings.apiMode === 'secondary') {
        secondarySection.classList.add('uh-show');
    } else {
        secondarySection.classList.remove('uh-show');
    }
}

/* ---------- Apply stored settings to UI ---------- */
function applySettingsToUI() {
    const urlInput = settingsPanel.querySelector('#uh-api-url');
    const keyInput = settingsPanel.querySelector('#uh-api-key');
    const modelSelect = settingsPanel.querySelector('#uh-model-select');

    urlInput.value = defaultSettings.secondaryApiUrl || '';
    keyInput.value = defaultSettings.secondaryApiKey || '';

    if (defaultSettings.selectedModel) {
        // Re-populate if we have a cached model
        const opt = modelSelect.querySelector(`option[value="${defaultSettings.selectedModel}"]`);
        if (opt) {
            modelSelect.value = defaultSettings.selectedModel;
        }
    }

    updateApiToggleUI();
}

/* ---------- Input change listeners ---------- */
settingsPanel.querySelector('#uh-api-url').addEventListener('input', (e) => {
    defaultSettings.secondaryApiUrl = e.target.value.trim();
    saveSettings();
});

settingsPanel.querySelector('#uh-api-key').addEventListener('input', (e) => {
    defaultSettings.secondaryApiKey = e.target.value.trim();
    saveSettings();
});

settingsPanel.querySelector('#uh-model-select').addEventListener('change', (e) => {
    defaultSettings.selectedModel = e.target.value;
    saveSettings();
});

/* ---------- Connect Button ---------- */
const connectBtn = settingsPanel.querySelector('#uh-connect-btn');
const statusMsg = settingsPanel.querySelector('#uh-status-msg');

connectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = defaultSettings.secondaryApiUrl;
    const key = defaultSettings.secondaryApiKey;

    if (!url || !key) {
        showStatus('⚠️ Vui lòng nhập API URL và API Key', 'error');
        return;
    }

    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span class="uh-spinner"></span> Đang kết nối...';
    showStatus('', '');

    try {
        // Try OpenAI-compatible /v1/models endpoint
        let modelsUrl = url.replace(/\/+$/, '');
        if (!modelsUrl.endsWith('/models')) {
            modelsUrl += '/models';
        }

        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const models = data.data || data.models || [];

        if (!models.length) {
            throw new Error('Không tìm thấy model nào');
        }

        // Populate dropdown
        const modelSelect = settingsPanel.querySelector('#uh-model-select');
        modelSelect.innerHTML = '<option value="">-- Chọn Model --</option>';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id || m.name || m;
            opt.textContent = m.id || m.name || m;
            modelSelect.appendChild(opt);
        });
        modelSelect.disabled = false;

        // Restore previously selected model if available
        if (defaultSettings.selectedModel) {
            const existing = modelSelect.querySelector(`option[value="${defaultSettings.selectedModel}"]`);
            if (existing) {
                modelSelect.value = defaultSettings.selectedModel;
            }
        }

        showStatus(`✅ Kết nối thành công! (${models.length} models)`, 'success');
    } catch (err) {
        console.error('[Utility Helper] Connect error:', err);
        showStatus(`❌ Lỗi: ${err.message}`, 'error');

        const modelSelect = settingsPanel.querySelector('#uh-model-select');
        modelSelect.innerHTML = '<option value="">-- Nhập URL & Key rồi Connect --</option>';
        modelSelect.disabled = true;
    } finally {
        connectBtn.disabled = false;
        connectBtn.innerHTML = 'CONNECT';
    }
});

function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = 'uh-status-msg';
    if (type) {
        statusMsg.classList.add(`uh-${type}`);
    }
}

/* ---------- Stop click propagation on panel ---------- */
settingsPanel.addEventListener('click', (e) => {
    e.stopPropagation();
});

/* ---------- Resize handler ---------- */
window.addEventListener('resize', () => {
    setHeartPosition(
        Math.min(heartPos.x, window.innerWidth - 25),
        Math.min(heartPos.y, window.innerHeight - 25)
    );
});

console.log('[Utility Helper] Extension loaded!');
