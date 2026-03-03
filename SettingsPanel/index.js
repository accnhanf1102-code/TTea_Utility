import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';

const EXT_NAME = 'utilityHelper';

export const defaultSettings = {
    apiMode: 'main',
    secondaryApiUrl: '',
    secondaryApiKey: '',
    selectedModel: '',
};

export function loadSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = {};
    }
    Object.assign(defaultSettings, extension_settings[EXT_NAME]);
    extension_settings[EXT_NAME] = defaultSettings;
}

export function saveSettings() {
    extension_settings[EXT_NAME] = defaultSettings;
    saveSettingsDebounced();
}

export function createSettingsPanel() {
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
    return settingsPanel;
}

export function initSettingsPanelLogic(settingsPanel) {
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

    // Expose applySettingsToUI so we can call it when opening panel
    settingsPanel.applySettingsToUI = applySettingsToUI;
}

/* ============================================
   EXPORTED LLM HELPER
   ============================================ */
/**
 * Generates text using the configured LLM API (secondary).
 * Currently assumes an OpenAI-compatible /v1/chat/completions endpoint.
 * @param {string} prompt - The user prompt/instructions.
 * @returns {Promise<string>} The generated content.
 */
export async function generateLLMCompletion(prompt) {
    if (defaultSettings.apiMode !== 'secondary') {
        // Fallback or warning if they try to use MAIN API which we haven't implemented hooking into ST's internal main API yet
        throw new Error('Tính năng Mind Map hiện chỉ hỗ trợ "API Phụ". Vui lòng thiết lập API Phụ trong phần Cài đặt của tiện ích.');
    }

    const url = defaultSettings.secondaryApiUrl;
    const key = defaultSettings.secondaryApiKey;
    const model = defaultSettings.selectedModel;

    if (!url || !key || !model) {
        throw new Error('API Phụ chưa được cấu hình đầy đủ (URL, Key, Model).');
    }

    let completionUrl = url.replace(/\/+$/, '');
    if (!completionUrl.endsWith('/chat/completions')) {
        completionUrl += '/chat/completions';
    }

    const payload = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Low temp for more deterministic formatting
    };

    const response = await fetch(completionUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content;
    }

    throw new Error('Phản hồi từ API không đúng định dạng (thiếu choices[0].message.content).');
}
