document.addEventListener("DOMContentLoaded", function () {
    // Detect font loading to prevent FOUT (Flash of Unstyled Text)
    if (document.fonts) {
        document.fonts.load('1em "Material Symbols Outlined"').then(() => {
            document.body.classList.add('fonts-loaded');
        });
        // Fallback in case loading takes too long
        setTimeout(() => document.body.classList.add('fonts-loaded'), 2000);
    } else {
        document.body.classList.add('fonts-loaded');
    }

    const input = document.getElementById('url');
    const btn = document.getElementById('btn-download');
    const videoContainer = document.getElementById('video-container');
    const downloadsContainer = document.getElementById('downloads-container');
    const btnSettings = document.getElementById('btn-settings');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    // --- SESIÓN Y CONFIGURACIÓN ---

    function checkSession() {
        window.api.checkSession();
    }

    window.api.onSessionStatus((status) => {
        if (status.active) {
            statusDot.classList.remove('red');
            statusDot.classList.add('green');
            statusText.textContent = `Conectado: ${status.browser}`;
        } else {
            statusDot.classList.remove('green');
            statusDot.classList.add('red');
            
            if (status.browser) {
                statusText.textContent = `Sin Sesión: ${status.browser}`;
            } else {
                statusText.textContent = 'Configurar Navegador';
                promptBrowserSelection();
            }
        }
    });

    btnSettings.onclick = () => promptSettings();

    async function promptSettings() {
        // Obtener valores actuales
        window.api.getBrowser();
        window.api.getSetting("downloads_path");

        let currentBrowser = 'chrome';
        let currentPath = '';

        // Esperar brevemente las respuestas (o usar una promesa mejor)
        const browserPromise = new Promise(resolve => {
            window.api.onBrowserGet((b) => resolve(b));
            setTimeout(() => resolve('chrome'), 500);
        });
        const pathPromise = new Promise(resolve => {
            window.api.onSettingGet((res) => {
                if (res.key === "downloads_path") resolve(res.value || '');
            });
            setTimeout(() => resolve(''), 500);
        });

        currentBrowser = await browserPromise;
        currentPath = await pathPromise;

        const { value: formValues } = await Swal.fire({
            title: 'Configuración General',
            html: `
                <div style="text-align: left; margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #aaa;">Navegador para Cookies:</label>
                    <select id="swal-browser" class="swal2-select" style="width: 100%; margin: 0;">
                        <option value="chrome" ${currentBrowser === 'chrome' ? 'selected' : ''}>Google Chrome</option>
                        <option value="firefox" ${currentBrowser === 'firefox' ? 'selected' : ''}>Firefox</option>
                        <option value="brave" ${currentBrowser === 'brave' ? 'selected' : ''}>Brave</option>
                        <option value="edge" ${currentBrowser === 'edge' ? 'selected' : ''}>Microsoft Edge</option>
                        <option value="opera" ${currentBrowser === 'opera' ? 'selected' : ''}>Opera</option>
                    </select>
                </div>
                <div style="text-align: left;">
                    <label style="display: block; margin-bottom: 5px; color: #aaa;">Carpeta de Descargas:</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input id="swal-path" class="swal2-input" style="margin: 0; flex: 1; font-size: 0.8rem;" readonly value="${currentPath || 'Preguntar en cada descarga'}">
                        <button id="btn-browse" class="btn-icon" style="background: var(--primary); width: 40px; height: 40px;">
                            <span class="material-symbols-outlined">folder_open</span>
                        </button>
                    </div>
                    ${currentPath ? '<button id="btn-clear-path" style="background: transparent; border: none; color: var(--error); font-size: 0.7rem; margin-top: 5px; cursor: pointer;">Limpiar Carpeta Fija</button>' : ''}
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            confirmButtonColor: '#ff0000',
            background: '#1a1a1a',
            color: '#f1f1f1',
            didOpen: () => {
                const browseBtn = document.getElementById('btn-browse');
                const clearBtn = document.getElementById('btn-clear-path');
                const pathInput = document.getElementById('swal-path');

                browseBtn.onclick = () => {
                    window.api.selectDirectory();
                };

                if (clearBtn) {
                    clearBtn.onclick = () => {
                        pathInput.value = 'Preguntar en cada descarga';
                        window.api.setSetting("downloads_path", "");
                        showToast("Carpeta fija eliminada");
                        Swal.close();
                    };
                }
            },
            preConfirm: () => {
                return {
                    browser: document.getElementById('swal-browser').value,
                    path: document.getElementById('swal-path').value
                }
            }
        });

        if (formValues) {
            window.api.setBrowser(formValues.browser);
            if (formValues.path !== 'Preguntar en cada descarga') {
                window.api.setSetting("downloads_path", formValues.path);
            }
            showToast("Configuración guardada");
            checkSession();
        }
    }

    window.api.onBrowserSet((response) => {
        if (response.success) {
            checkSession();
        }
    });

    // Escuchar selección de directorio globalmente
    window.api.onDirectorySelected((path) => {
        const pathInput = document.getElementById('swal-path');
        if (pathInput) {
            pathInput.value = path;
        }
    });

    // Set initial button content
    btn.innerHTML = '<span class="material-symbols-outlined">search</span> Buscar';

    // Create toast container
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconName = 'check_circle';
        if (type === 'error') iconName = 'error';
        if (type === 'warning') iconName = 'warning';

        toast.innerHTML = `<span class="material-symbols-outlined">${iconName}</span><span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    let originalHTML = videoContainer.innerHTML;
    let currentVideoUrl = '';
    let currentVideoData = null;

    // --- LÓGICA DE CARGA E HISTORIAL ---

    function loadDownloads(page = 1) {
        window.api.getAllData({ page: page, limit: 10 });
    }

    window.api.onAllData((result) => {
        const { data, pagination } = result;
        renderDownloadList(data, pagination);
    });

    const videoModal = document.getElementById('video-modal');
    const player = document.getElementById('player');
    const closeModal = document.getElementById('close-modal');
    let currentPlayingId = null;
    let positionInterval = null;

    function renderDownloadList(items, pagination) {
        let html = `
            <div class="list-header">
                <h2>Historial</h2>
                <button class="btn-reset" id="btn-reset-list">
                    <span class="material-symbols-outlined">delete_sweep</span>
                    Limpiar Lista
                </button>
            </div>
            <div class="download-list">
        `;

        if (items.length === 0) {
            html += '<p style="color: #666; text-align: center; padding: 20px;">No hay descargas registradas.</p>';
        } else {
            items.forEach(item => {
                html += `
                    <div class="download-item">
                        <img src="${item.thumbnail}" class="item-thumb">
                        <div class="item-content">
                            <div class="item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                            <div class="item-date">${item.channel} • ${new Date(item.downloaded_at).toLocaleDateString()}</div>
                        </div>
                        <div class="item-actions">
                            <button class="btn-icon play-video" data-id="${item.id}" title="Reproducir">
                                <span class="material-symbols-outlined">play_arrow</span>
                            </button>
                            <button class="btn-icon re-download" data-url="${item.url}" title="Redescargar">
                                <span class="material-symbols-outlined">refresh</span>
                            </button>
                            <button class="btn-icon delete" data-id="${item.id}" title="Eliminar">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`; // Close download-list
        // ... rest of pagination and reset listeners ...

        if (items.length > 0) {
            html += `
                <div class="pagination">
                    <button class="btn-page" id="prevPage" ${pagination.currentPage <= 1 ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">navigate_before</span>
                    </button>
                    <span style="color: #aaa; font-size: 0.85rem;">${pagination.currentPage} / ${pagination.totalPages}</span>
                    <button class="btn-page" id="nextPage" ${!pagination.hasNextPage ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">navigate_next</span>
                    </button>
                </div>
            `;
        }

        downloadsContainer.innerHTML = html;

        // Pagination Listeners
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.onclick = () => loadDownloads(pagination.currentPage - 1);
        if (nextBtn) nextBtn.onclick = () => loadDownloads(pagination.currentPage + 1);

        // Reset Listener
        const resetBtn = document.getElementById('btn-reset-list');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm("¿Deseas quitar todos los elementos de la lista?")) {
                    window.api.resetDownloads();
                }
            };
        }

        // Action Listeners
        document.querySelectorAll('.play-video').forEach(el => {
            el.onclick = () => {
                const id = parseInt(el.getAttribute('data-id'));
                window.api.checkVideoFile(id);
            };
        });

        document.querySelectorAll('.re-download').forEach(el => {
            el.onclick = () => {
                const url = el.getAttribute('data-url');
                input.value = url;
                el.innerHTML = '<span class="material-symbols-outlined">progress_activity</span>';
                btn.click();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        });

        document.querySelectorAll('.btn-icon.delete').forEach(el => {
            el.onclick = () => {
                const id = el.getAttribute('data-id');
                if (confirm("¿Eliminar este video del historial y del disco?")) {
                    window.api.deleteVideo(parseInt(id));
                }
            };
        });
    }

    // --- LÓGICA DE BÚSQUEDA ---

    btn.addEventListener('click', () => {
        const url = input.value.trim();
        if (!url) {
            showToast('Ingresá una URL', 'warning');
            return;
        }

        btn.classList.add('loading');
        btn.innerHTML = '<span class="material-symbols-outlined spin">progress_activity</span> Buscando...';
        btn.disabled = true;
        window.api.sendUrl(url);
    });

    window.api.onVideoDetails((video) => {
        btn.classList.remove('loading');
        btn.innerHTML = '<span class="material-symbols-outlined">search</span> Buscar';
        btn.disabled = false;
        currentVideoUrl = video.url;
        currentVideoData = video;

        videoContainer.innerHTML = `
            <div class="video-card">
                <img class="video-thumb" src="${video.thumbnail}" alt="Thumbnail">
                <div class="video-info">
                    <h3 class="video-title">${escapeHtml(video.title)}</h3>
                    <div class="video-meta">
                        <span>📺 ${escapeHtml(video.channel)}</span>
                        <span>⏱️ ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}</span>
                        <span>👁️ ${formatNumber(video.views)}</span>
                    </div>
                    <div class="video-description">${escapeHtml(video.description)}</div>
                    <div class="action-buttons">
                        <button id="btn-descargar">
                            <span class="material-symbols-outlined">download</span> Descargar Video
                        </button>
                        <button id="btn-descartar">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-descartar').onclick = () => {
            videoContainer.innerHTML = originalHTML;
            input.value = '';
            currentVideoUrl = '';
            currentVideoData = null;
        };

        document.getElementById('btn-descargar').onclick = () => startDownload();
    });

    window.api.onVideoError((error) => {
        btn.classList.remove('loading');
        btn.innerHTML = '<span class="material-symbols-outlined">search</span> Buscar';
        btn.disabled = false;
        showToast('Error: ' + error, 'error');
    });

    // --- LÓGICA DE DESCARGA ---

    function startDownload() {
        if (!currentVideoUrl) return;

        videoContainer.innerHTML = `
            <div style="padding: 24px; text-align: center; background: #111; border-radius: 12px;">
                <div style="margin-bottom: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span class="material-symbols-outlined spin" id="progress-icon">downloading</span> 
                    <span id="progress-text">Preparando descarga...</span>
                </div>
                <div style="height: 10px; background: #333; border-radius: 10px; overflow: hidden; position: relative;">
                    <div id="progress-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.3s ease;"></div>
                </div>
                <p id="progress-percent" style="margin-top: 12px; font-size: 1rem; font-weight: bold; color: var(--primary);">0%</p>
            </div>
        `;

        btn.classList.add('loading');
        btn.innerHTML = '<span class="material-symbols-outlined spin">downloading</span> Descargando...';
        btn.disabled = true;

        window.api.downloadVideo(currentVideoUrl);
    }

    // --- RESPUESTAS DE API ---

    window.api.onDownloadProgress((data) => {
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar && progressPercent) {
            if (data.status === 'processing') {
                progressBar.style.width = `100%`;
                progressBar.style.background = `var(--success)`; // Cambia a verde en consolidación
                progressPercent.textContent = `100%`;
                if (progressText) progressText.textContent = 'Consolidando archivo...';
            } else {
                progressBar.style.width = `${data.percent}%`;
                progressPercent.textContent = `${data.percent.toFixed(1)}%`;
                if (progressText && progressText.textContent === 'Preparando descarga...') {
                    progressText.textContent = 'Descargando...';
                }
            }
        }
    });

    window.api.onDownloadComplete((data) => {
        if (currentVideoData) {
            // Guardamos el path completo específico de este video
            currentVideoData.file_path = data.fullPath;
            window.api.saveVideoData(currentVideoData);
        }
        
        showToast('¡Descarga completada!');
        videoContainer.innerHTML = originalHTML;
        btn.classList.remove('loading');
        btn.innerHTML = '<span class="material-symbols-outlined">search</span> Buscar';
        btn.disabled = false;
        input.value = '';

        // Refrescar el estado de sesión para asegurar que seguimos conectados
        checkSession();
    });

    window.api.onDownloadError((error) => {
        showToast('Error en la descarga', 'error');
        btn.classList.remove('loading');
        btn.innerHTML = '<span class="material-symbols-outlined">search</span> Buscar';
        btn.disabled = false;
        videoContainer.innerHTML = originalHTML;
    });

    window.api.onCheckVideoFile((response) => {
        if (response.exists) {
            currentPlayingId = response.id;
            // Usar el protocolo media:// para cargar el video
            player.src = `media://${response.fullPath}`;
            videoModal.classList.add('active');
            
            // Saltar a la última posición
            player.onloadedmetadata = () => {
                if (response.lastPosition > 0 && response.lastPosition < player.duration) {
                    player.currentTime = response.lastPosition;
                }
                player.play();
            };

            // Guardar posición cada 5 segundos
            positionInterval = setInterval(() => {
                if (!player.paused) {
                    window.api.updatePosition(currentPlayingId, player.currentTime);
                }
            }, 5000);

        } else {
            Swal.fire({
                title: 'Video no encontrado',
                text: `El archivo "${response.title || 'seleccionado'}" ya no existe en la carpeta de descargas.`,
                icon: 'error',
                confirmButtonColor: '#ff0000',
                background: '#1a1a1a',
                color: '#f1f1f1'
            });
        }
    });

    closeModal.onclick = () => {
        if (currentPlayingId) {
            window.api.updatePosition(currentPlayingId, player.currentTime);
        }
        clearInterval(positionInterval);
        player.pause();
        player.src = '';
        videoModal.classList.remove('active');
    };

    // Cerrar con Escape
    window.onkeydown = (e) => {
        if (e.key === 'Escape' && videoModal.classList.contains('active')) {
            closeModal.onclick();
        }
    };

    window.api.onSaveSuccess(() => loadDownloads(1));
    window.api.onResetSuccess(() => {
        showToast('Historial limpiado');
        loadDownloads(1);
    });
    
    window.api.onDeleteSuccess((msg) => {
        showToast(msg);
        loadDownloads(1);
    });

    window.api.onDeleteWarning((msg) => {
        showToast(msg, 'warning');
        loadDownloads(1);
    });

    window.api.onDeleteError((err) => showToast(err, 'error'));

    // Inicialización
    loadDownloads(1);
    checkSession();
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}