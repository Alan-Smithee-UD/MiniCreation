// 写真データを格納する配列（CSVから読み込み）
let photos = [];

let currentImageIndex = 0;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    loadPhotosFromCSV();
    setupModal();
});

// CSVから写真データを読み込み（Shift_JIS対応 - 改良版）
async function loadPhotosFromCSV() {
    try {
        const response = await fetch('data/csv/information.csv');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        let csvText;
        
        // まずShift_JISで試行
        try {
            const decoder = new TextDecoder('shift_jis');
            csvText = decoder.decode(arrayBuffer);
            
            // 文字化けチェック（疑問符が多い場合は文字化けの可能性）
            const questionMarks = (csvText.match(/\?/g) || []).length;
            if (questionMarks > csvText.length * 0.1) {
                throw new Error('Shift_JIS decoding failed');
            }
        } catch (sjisError) {
            console.warn('Shift_JIS読み込みに失敗、UTF-8で再試行:', sjisError);
            // UTF-8で再試行
            const utf8Decoder = new TextDecoder('utf-8');
            csvText = utf8Decoder.decode(arrayBuffer);
        }
        
        // CSVをパース
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        photos = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            const photo = {};
            
            headers.forEach((header, index) => {
                photo[header] = values[index] || '';
            });
            
            // パスを修正とサムネイルパス生成
            if (photo.src && !photo.src.startsWith('data/images/')) {
                photo.src = 'data/images/' + photo.src;
            }
            
            // サムネイル用パスを生成（拡張子を.jpgに変更）
            if (photo.src) {
                const filename = photo.src.split('/').pop(); // ファイル名を取得
                const nameWithoutExt = filename.split('.')[0]; // 拡張子を除去
                photo.thumbnail = `data/images/thumbnail/${nameWithoutExt}.jpg`;
            }
            
            photos.push(photo);
        }
        
        loadGallery();
    } catch (error) {
        console.error('CSVファイルの読み込みに失敗しました:', error);
        showErrorMessage('写真データの読み込みに失敗しました。');
    }
}

// CSVから写真データを読み込み
async function loadPhotosFromCSV() {
    try {
        const response = await fetch('data/csv/information.csv');
        const csvText = await response.text();
        
        // CSVをパース
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        photos = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            const photo = {};
            
            headers.forEach((header, index) => {
                photo[header] = values[index] || '';
            });
            
            // パスを修正（data/images/からの相対パス）
            if (photo.src && !photo.src.startsWith('data/images/')) {
                photo.src = 'data/images/' + photo.src;
            }
            
            photos.push(photo);
        }
        
        setupSearch();
        loadGallery();
    } catch (error) {
        console.error('CSVファイルの読み込みに失敗しました:', error);
        showErrorMessage('写真データの読み込みに失敗しました。');
    }
}

// 検索機能のセットアップ
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    // リアルタイム検索
    searchInput.addEventListener('input', performSearch);
    searchBtn.addEventListener('click', performSearch);
    clearBtn.addEventListener('click', clearSearch);
    
    // Enterキーで検索
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // フィルタータグを生成
    generateFilterTags();
}

// フィルタータグを生成
function generateFilterTags() {
    const filterTags = document.getElementById('filterTags');
    const allSubjects = new Set();
    
    // 全ての被写体を収集
    photos.forEach(photo => {
        if (photo.subject) {
            photo.subject.split('・').forEach(subject => {
                allSubjects.add(subject.trim());
            });
        }
    });
    
    // タグを生成
    allSubjects.forEach(subject => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = subject;
        tag.addEventListener('click', () => filterByTag(subject, tag));
        filterTags.appendChild(tag);
    });
}

// タグによるフィルタリング
function filterByTag(subject, tagElement) {
    const searchInput = document.getElementById('searchInput');
    
    // タグの状態を切り替え
    tagElement.classList.toggle('active');
    
    // アクティブなタグを収集
    const activeTags = Array.from(document.querySelectorAll('.tag.active'))
        .map(tag => tag.textContent);
    
    if (activeTags.length > 0) {
        searchInput.value = activeTags.join(' ');
    } else {
        searchInput.value = '';
    }
    
    performSearch();
}

// 検索実行
function performSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const searchResults = document.getElementById('searchResults');
    
    if (!query) {
        displayPhotos(photos);
        searchResults.textContent = '';
        return;
    }
    
    const filteredPhotos = photos.filter(photo => {
        const title = photo.title ? photo.title.toLowerCase() : '';
        const description = photo.description ? photo.description.toLowerCase() : '';
        const subject = photo.subject ? photo.subject.toLowerCase() : '';
        
        return title.includes(query) || 
               description.includes(query) || 
               subject.includes(query);
    });
    
    displayPhotos(filteredPhotos);
    
    // 検索結果を表示
    if (filteredPhotos.length === 0) {
        searchResults.textContent = `"${query}" に一致する写真が見つかりませんでした。`;
    } else {
        searchResults.textContent = `${filteredPhotos.length}件の写真が見つかりました。`;
    }
}

// 検索をクリア
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    searchInput.value = '';
    searchResults.textContent = '';
    
    // アクティブなタグをクリア
    document.querySelectorAll('.tag.active').forEach(tag => {
        tag.classList.remove('active');
    });
    
    displayPhotos(photos);
}

// 写真を表示（検索結果対応・サムネイル使用）
function displayPhotos(photosToDisplay) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    
    if (photosToDisplay.length === 0) {
        gallery.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: white;">
                <div style="font-size: 2rem; margin-bottom: 10px;">📷</div>
                <div style="font-size: 1.2rem;">該当する写真がありません</div>
            </div>
        `;
        return;
    }
    
    photosToDisplay.forEach((photo, index) => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.setAttribute('data-index', photos.indexOf(photo)); // 元の配列のインデックス
        
        // サムネイル画像を使用、フォールバックでオリジナル画像
        const thumbnailSrc = photo.thumbnail || photo.src;
        
        photoItem.innerHTML = `
            <img src="${thumbnailSrc}" alt="${photo.title}" loading="lazy" onerror="this.src='${photo.src}'; this.classList.add('fallback-image');">
            <div class="photo-overlay">
                <div class="photo-title">${photo.title}</div>
                <div class="photo-description">${photo.description}</div>
                <div class="photo-subject">${photo.subject || ''}</div>
            </div>
        `;
        
        // クリックイベントを追加
        photoItem.addEventListener('click', () => openModal(photos.indexOf(photo)));
        
        gallery.appendChild(photoItem);
    });
    
    // アニメーション効果
    setTimeout(() => {
        const items = document.querySelectorAll('.photo-item');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }, 50);
}
// エラーメッセージを表示
function showErrorMessage(message) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: white;">
            <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
            <div style="font-size: 1.2rem;">${message}</div>
            <div style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
                data/csv/information.csv ファイルを確認してください
            </div>
        </div>
    `;
}

// ギャラリーを動的に生成
function loadGallery() {
    if (photos.length === 0) {
        showErrorMessage('表示する写真がありません。');
        return;
    }
    
    displayPhotos(photos);
}

// モーダルの設定
function setupModal() {
    const modal = document.getElementById('imageModal');
    const closeBtn = document.querySelector('.close');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // 閉じるボタン
    closeBtn.addEventListener('click', closeModal);
    
    // 背景クリックで閉じる
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // キーボードナビゲーション
    document.addEventListener('keydown', function(e) {
        if (modal.style.display === 'block') {
            switch(e.key) {
                case 'Escape':
                    closeModal();
                    break;
                case 'ArrowLeft':
                    showPrevImage();
                    break;
                case 'ArrowRight':
                    showNextImage();
                    break;
            }
        }
    });
    
    // ナビゲーションボタン
    prevBtn.addEventListener('click', showPrevImage);
    nextBtn.addEventListener('click', showNextImage);
}

// モーダルを開く
function openModal(index) {
    const modal = document.getElementById('imageModal');
    currentImageIndex = index;
    showImage(index);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // スクロールを無効化
}

// モーダルを閉じる
function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // スクロールを有効化
}

// 指定された画像を表示（フルサイズ画像使用）
function showImage(index) {
    const modalImg = document.getElementById('modalImg');
    const modalCaption = document.getElementById('modalCaption');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    const photo = photos[index];
    
    // モーダルではフルサイズ画像を使用
    modalImg.src = photo.src;
    modalImg.alt = photo.title;
    modalCaption.innerHTML = `<strong>${photo.title}</strong><br>${photo.description}<br><em>${photo.subject || ''}</em>`;
    
    // ローディング状態を表示
    modalImg.style.opacity = '0';
    
    // 画像読み込み完了時の処理
    modalImg.onload = function() {
        modalImg.style.opacity = '1';
    };
    
    // 画像読み込みエラー時の処理
    modalImg.onerror = function() {
        modalCaption.innerHTML += '<br><span style="color: #ff6b6b;">フルサイズ画像の読み込みに失敗しました</span>';
        modalImg.style.opacity = '1';
    };
    
    // ナビゲーションボタンの状態を更新
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === photos.length - 1;
}

// 前の画像を表示
function showPrevImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        showImage(currentImageIndex);
    }
}

// 次の画像を表示
function showNextImage() {
    if (currentImageIndex < photos.length - 1) {
        currentImageIndex++;
        showImage(currentImageIndex);
    }
}

// 画像読み込みエラーハンドリング（サムネイル対応）
document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && !e.target.classList.contains('fallback-image')) {
        // サムネイル読み込み失敗時の処理は onerror 属性で処理済み
        console.warn('サムネイル画像の読み込みに失敗、オリジナル画像にフォールバック:', e.target.src);
    } else if (e.target.tagName === 'IMG' && e.target.classList.contains('fallback-image')) {
        // オリジナル画像も読み込み失敗の場合
        e.target.style.display = 'none';
        const photoItem = e.target.closest('.photo-item');
        if (photoItem) {
            photoItem.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666; background: rgba(255,255,255,0.9); border-radius: 15px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">📷</div>
                    <div>画像を読み込めませんでした</div>
                </div>
            `;
        }
    }
}, true);

// 初期状態で写真アイテムを非表示にして、スクロール時にアニメーション
document.addEventListener('DOMContentLoaded', function() {
    // この機能はdisplayPhotos関数内で実装済み
});