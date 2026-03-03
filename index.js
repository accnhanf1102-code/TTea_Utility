// ============================================
//  Utility Helper — SillyTavern Extension
// ============================================

import {
    loadSettings,
    createSettingsPanel,
    initSettingsPanelLogic
} from './SettingsPanel/index.js';

import {
    createMapPanel,
    initMapPanelLogic
} from './Mind%20map/index.js';

loadSettings();

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

// ---------- Map Bubble ----------
const mapBubble = document.createElement('div');
mapBubble.className = 'uh-sub-bubble uh-map-bubble';
mapBubble.innerHTML = `
    <span class="uh-bubble-icon">🗺️</span>
    <span class="uh-bubble-tooltip">Bản đồ</span>
`;
subBubblesContainer.appendChild(mapBubble);

// ---------- Setting Bubble ----------
const settingBubble = document.createElement('div');
settingBubble.className = 'uh-sub-bubble uh-setting-bubble';
settingBubble.innerHTML = `
    <span class="uh-bubble-icon">⚙️</span>
    <span class="uh-bubble-tooltip">Cài đặt</span>
`;
subBubblesContainer.appendChild(settingBubble);

// ---------- Settings Panel ----------
const settingsPanel = createSettingsPanel();
initSettingsPanelLogic(settingsPanel);

// ---------- Map Panel ----------
const mapPanel = createMapPanel();
initMapPanelLogic(mapPanel);

// Append to DOM
document.body.appendChild(heartBubble);
document.body.appendChild(subBubblesContainer);
document.body.appendChild(settingsPanel);
document.body.appendChild(mapPanel);

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

    // Save the current state for the delayed update callback
    const currentX = heartPos.x;
    const currentY = heartPos.y;
    const isExpanded = bubblesExpanded;

    subBubbles.forEach((bubble, i) => {
        // Update positions with a staggered delay so they follow sequentially
        setTimeout(() => {
            if (isExpanded) {
                // Stack above heart: each bubble goes higher
                const bubbleSize = 42;
                const bx = currentX - halfBubble;
                const by = currentY - 50 - gap - bubbleSize - (i * (bubbleSize + gap)) + halfBubble;
                bubble.style.left = bx + 'px';
                bubble.style.top = by + 'px';
            } else {
                // Hidden behind heart
                bubble.style.left = (currentX - halfBubble) + 'px';
                bubble.style.top = (currentY - halfBubble) + 'px';
            }
        }, (i + 1) * 45); // Delay progressively
    });
}

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
    closeMapPanel();
}

/* ---------- Click outside to close ---------- */
document.addEventListener('click', (e) => {
    if (!bubblesExpanded) return;
    // Check if click is on any bubble or the panel
    const isOnBubble =
        heartBubble.contains(e.target) ||
        subBubblesContainer.contains(e.target) ||
        settingsPanel.contains(e.target) ||
        mapPanel.contains(e.target);

    if (!isOnBubble) {
        collapseBubbles();
    }
});

/* ============================================
   MAP BUBBLE ACTIONS
   ============================================ */
let mapPanelOpen = false;

mapBubble.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMapPanel();
});

function toggleMapPanel() {
    mapPanelOpen = !mapPanelOpen;
    if (mapPanelOpen) {
        mapPanel.classList.add('uh-map-panel-open');
    } else {
        closeMapPanel();
    }
}

function closeMapPanel() {
    mapPanelOpen = false;
    mapPanel.classList.remove('uh-map-panel-open');
}

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
        if (typeof settingsPanel.applySettingsToUI === 'function') {
            settingsPanel.applySettingsToUI();
        }
    } else {
        closePanel();
    }
}

function closePanel() {
    panelOpen = false;
    settingsPanel.classList.remove('uh-panel-open');
}

// No more inline settings logic

/* ---------- Resize handler ---------- */
window.addEventListener('resize', () => {
    setHeartPosition(
        Math.min(heartPos.x, window.innerWidth - 25),
        Math.min(heartPos.y, window.innerHeight - 25)
    );
});

console.log('[Utility Helper] Extension loaded!');
