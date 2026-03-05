// ============================================
// TTea_Utility — Notebook Module
// Per-chat notes with floating panel
// Adapted from SillyTavern_NoteBook
// ============================================

const MODULE_NAME = 'SillyTavern_NoteBook';

// ---- Utility ----
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getNotes() {
    const ctx = SillyTavern.getContext();
    if (!ctx.chatMetadata) return [];
    if (!ctx.chatMetadata[MODULE_NAME]) ctx.chatMetadata[MODULE_NAME] = [];
    return ctx.chatMetadata[MODULE_NAME];
}

function setNotes(notes) {
    const ctx = SillyTavern.getContext();
    if (!ctx.chatMetadata) return;
    ctx.chatMetadata[MODULE_NAME] = notes;
}

async function persistNotes() {
    const ctx = SillyTavern.getContext();
    if (ctx.saveMetadata) await ctx.saveMetadata();
}

function isChatActive() {
    const ctx = SillyTavern.getContext();
    return !!(ctx.chatMetadata && (ctx.characterId !== undefined || ctx.groupId));
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ---- Smooth Drag Utility (RAF-based) ----
function makeDraggable(el, handle, options = {}) {
    let isDragging = false;
    let hasMoved = false;
    let startMouseX, startMouseY, startElX, startElY;
    let rafId = null;
    let pendingLeft, pendingTop;
    let posConverted = false;
    const threshold = options.threshold ?? 5;

    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, textarea, select')) return;

        const rect = el.getBoundingClientRect();
        if (!posConverted) {
            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            posConverted = true;
        }

        isDragging = true;
        hasMoved = false;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startElX = parseFloat(el.style.left);
        startElY = parseFloat(el.style.top);

        el.classList.add('uh-notebook-dragging');
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });

    function onMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;
        if (!hasMoved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
            hasMoved = true;
        }
        pendingLeft = startElX + dx;
        pendingTop = startElY + dy;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            el.style.left = pendingLeft + 'px';
            el.style.top = pendingTop + 'px';
            rafId = null;
        });
    }

    function onUp() {
        isDragging = false;
        el.classList.remove('uh-notebook-dragging');
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (!hasMoved && options.onClick) options.onClick();
    }
}

// ---- Create Panel DOM ----
export function createNotebookPanel() {
    const panel = document.createElement('div');
    panel.className = 'uh-notebook-panel';
    panel.innerHTML = `
        <div class="uh-notebook-panel-header">
            <span class="uh-notebook-panel-title">📓 Notebook</span>
            <button class="uh-notebook-close-btn" title="Đóng">✕</button>
        </div>
        <div class="uh-notebook-notes-container"></div>
        <div class="uh-notebook-panel-footer">
            <button class="uh-notebook-add-btn" title="Tạo Note mới">+</button>
        </div>
    `;
    return panel;
}

// ---- Init Panel Logic ----
export function initNotebookPanelLogic(panel) {
    let isPanelVisible = false;

    const panelHeader = panel.querySelector('.uh-notebook-panel-header');
    const closeBtn = panel.querySelector('.uh-notebook-close-btn');
    const addBtn = panel.querySelector('.uh-notebook-add-btn');
    const container = panel.querySelector('.uh-notebook-notes-container');

    // Make panel draggable by header
    makeDraggable(panel, panelHeader, { threshold: 5 });

    // ---- Rendering ----
    function renderNotes() {
        if (!container) return;

        if (!isChatActive()) {
            container.innerHTML = `<div class="uh-notebook-empty-state">
                <div class="uh-notebook-empty-icon">💬</div>
                <div>Chọn một nhân vật hoặc bắt đầu trò chuyện<br/>để sử dụng Notebook</div>
            </div>`;
            return;
        }

        const notes = getNotes();
        if (notes.length === 0) {
            container.innerHTML = `<div class="uh-notebook-empty-state">
                <div class="uh-notebook-empty-icon">📝</div>
                <div>Chưa có note nào<br/>Bấm <strong>+</strong> để tạo note mới</div>
            </div>`;
            return;
        }

        container.innerHTML = notes.map(note => `
            <div class="uh-notebook-note-card" data-note-id="${note.id}">
                <div class="uh-notebook-note-header" data-note-id="${note.id}">
                    <span class="uh-notebook-note-title">${escapeHtml(note.title)}</span>
                    <div class="uh-notebook-note-header-right">
                        <button class="uh-notebook-note-delete-btn" data-note-id="${note.id}" title="Xóa note">×</button>
                        <span class="uh-notebook-note-arrow">▲</span>
                    </div>
                </div>
                <div class="uh-notebook-note-body">
                    <div class="uh-notebook-note-body-inner">
                        <!-- VIEW MODE -->
                        <div class="uh-notebook-view-mode">
                            <div class="uh-notebook-note-content-display">${escapeHtml(note.content || '(Không có nội dung)')}</div>
                            <div class="uh-notebook-note-actions">
                                <button class="uh-notebook-btn-edit" data-note-id="${note.id}">✏️ Chỉnh sửa</button>
                            </div>
                        </div>
                        <!-- EDIT MODE -->
                        <div class="uh-notebook-edit-mode">
                            <div>
                                <div class="uh-notebook-field-label">Tên</div>
                                <input type="text" class="uh-notebook-title-input" value="${escapeHtml(note.title)}" data-note-id="${note.id}" />
                            </div>
                            <div>
                                <div class="uh-notebook-field-label">Nội dung</div>
                                <textarea class="uh-notebook-content-input" data-note-id="${note.id}">${escapeHtml(note.content || '')}</textarea>
                            </div>
                            <div class="uh-notebook-note-actions">
                                <button class="uh-notebook-btn-save" data-note-id="${note.id}">💾 Lưu</button>
                                <button class="uh-notebook-btn-cancel" data-note-id="${note.id}">↩️ Hủy</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`).join('');
    }

    // ---- Panel Show/Hide ----
    function showPanel() {
        isPanelVisible = true;
        panel.classList.remove('uh-notebook-hiding');
        panel.offsetHeight; // force reflow
        panel.classList.add('uh-notebook-visible');
        renderNotes();
    }

    function hidePanel() {
        isPanelVisible = false;
        panel.classList.remove('uh-notebook-visible');
        panel.classList.add('uh-notebook-hiding');
        setTimeout(() => {
            if (panel.classList.contains('uh-notebook-hiding')) {
                panel.classList.remove('uh-notebook-hiding');
            }
        }, 350);
    }

    // Expose show/hide on the panel element for external control
    panel.showPanel = showPanel;
    panel.hidePanel = hidePanel;
    panel.isVisible = () => isPanelVisible;

    // ---- Note CRUD ----
    function createNote() {
        if (!isChatActive()) {
            toastr.warning('Vui lòng chọn một nhân vật trước.');
            return;
        }

        const newNote = {
            id: generateId(),
            title: 'Note mới',
            content: '',
            createdAt: new Date().toISOString(),
        };

        const notes = getNotes();
        notes.push(newNote);
        setNotes(notes);
        renderNotes();
        persistNotes();

        // Auto-expand the new note and enter edit mode
        requestAnimationFrame(() => {
            const card = container.querySelector(`.uh-notebook-note-card[data-note-id="${newNote.id}"]`);
            if (card) {
                card.classList.add('uh-notebook-expanded');
                card.classList.add('uh-notebook-editing');
                const titleInput = card.querySelector('.uh-notebook-title-input');
                if (titleInput) { titleInput.focus(); titleInput.select(); }
            }
            container.scrollTop = container.scrollHeight;
        });
    }

    function saveNoteInline(noteId) {
        const card = container.querySelector(`.uh-notebook-note-card[data-note-id="${noteId}"]`);
        if (!card) return;

        const titleInput = card.querySelector('.uh-notebook-title-input');
        const contentInput = card.querySelector('.uh-notebook-content-input');
        const title = (titleInput?.value || '').trim();
        const content = (contentInput?.value || '').trim();

        if (!title) {
            toastr.warning('Tên note không được để trống.');
            titleInput?.focus();
            return;
        }

        const notes = getNotes();
        const idx = notes.findIndex(n => n.id === noteId);
        if (idx !== -1) {
            notes[idx].title = title;
            notes[idx].content = content;
            notes[idx].updatedAt = new Date().toISOString();
        }

        setNotes(notes);
        persistNotes();

        // Update visible elements
        const headerTitle = card.querySelector('.uh-notebook-note-title');
        if (headerTitle) headerTitle.textContent = title;
        const contentDisplay = card.querySelector('.uh-notebook-note-content-display');
        if (contentDisplay) contentDisplay.textContent = content || '(Không có nội dung)';

        card.classList.remove('uh-notebook-editing');
        toastr.success('Đã lưu note.');
    }

    function cancelNoteEdit(noteId) {
        const notes = getNotes();
        const note = notes.find(n => n.id === noteId);
        const card = container.querySelector(`.uh-notebook-note-card[data-note-id="${noteId}"]`);
        if (!card || !note) return;

        const titleInput = card.querySelector('.uh-notebook-title-input');
        const contentInput = card.querySelector('.uh-notebook-content-input');
        if (titleInput) titleInput.value = note.title;
        if (contentInput) contentInput.value = note.content || '';

        card.classList.remove('uh-notebook-editing');
    }

    function deleteNote(noteId) {
        const notes = getNotes();
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        if (!confirm(`Xóa note "${note.title}"?`)) return;

        setNotes(notes.filter(n => n.id !== noteId));
        renderNotes();
        persistNotes();
        toastr.info('Đã xóa note.');
    }

    function toggleNoteExpand(noteId) {
        const card = container.querySelector(`.uh-notebook-note-card[data-note-id="${noteId}"]`);
        if (!card) return;

        const wasExpanded = card.classList.contains('uh-notebook-expanded');
        card.classList.toggle('uh-notebook-expanded');

        if (wasExpanded) {
            card.classList.remove('uh-notebook-editing');
        }
    }

    // ---- Event Delegation ----
    container.addEventListener('click', (e) => {
        // Delete button
        const deleteBtn = e.target.closest('.uh-notebook-note-delete-btn');
        if (deleteBtn) { e.stopPropagation(); deleteNote(deleteBtn.dataset.noteId); return; }

        // Edit button
        const editBtn = e.target.closest('.uh-notebook-btn-edit');
        if (editBtn) {
            const card = editBtn.closest('.uh-notebook-note-card');
            if (card) card.classList.add('uh-notebook-editing');
            return;
        }

        // Save button
        const saveBtn = e.target.closest('.uh-notebook-btn-save');
        if (saveBtn) { saveNoteInline(saveBtn.dataset.noteId); return; }

        // Cancel button
        const cancelBtn = e.target.closest('.uh-notebook-btn-cancel');
        if (cancelBtn) { cancelNoteEdit(cancelBtn.dataset.noteId); return; }

        // Header click → toggle expand
        const header = e.target.closest('.uh-notebook-note-header');
        if (header) { toggleNoteExpand(header.dataset.noteId); return; }
    });

    // ---- Buttons ----
    closeBtn.addEventListener('click', () => hidePanel());
    addBtn.addEventListener('click', () => createNote());

    // ---- Chat Changed ----
    function onChatChanged() {
        if (isPanelVisible) renderNotes();
    }

    const ctx = SillyTavern.getContext();
    if (ctx.eventSource && ctx.event_types) {
        ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, onChatChanged);
    }

    console.log('[TTea_Utility] Notebook module loaded.');
}
