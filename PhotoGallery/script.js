// 写真データを格納する配列
let photos = [];
let currentImageIndex = 0;
let visiblePhotos = [];
let loadedImages = new Set();
let intersectionObserver = null;

// 定数定義
const BATCH_SIZE = 12;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded イベント発火');
    loadPhotosFromCSV();
});

// CSVから写真データを読み込み（文字コード自動判定・BOM除去対応）
async function loadPhotosFromCSV() {
    try {
        const response = await fetch('data/csv/information.csv');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        let csvText = await detectEncodingAndDecode(arrayBuffer);
        
        console.log('デコード後CSV内容（最初の200文字）:', csvText.substring(0, 200));
        
        // BOMを除去
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.slice(1);
            console.log('BOMを除去しました');
        }
        
        // CSVをパース
        const lines = csvText.trim().split('\n');
        console.log('CSVライン数:', lines.length);
        console.log('ヘッダー行:', lines[0]);
        
        const headers = lines[0].split(',').map(header => header.trim().replace(/[^\w\-_]/g, ''));
        console.log('クリーンアップ後ヘッダー:', headers);
        
        photos = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue; // 空行をスキップ
            
            // CSVの値をパース（カンマ区切り、ただし引用符内のカンマは除外）
            const values = parseCSVLine(lines[i]);
            console.log(`行${i}の値:`, values);
            
            const photo = {};
            
            headers.forEach((header, index) => {
                photo[header] = values[index] ? values[index].trim() : '';
            });
            
            console.log(`写真${i}のオブジェクト:`, photo);
            
            // srcフィールドの確認（一般的な列名も試す）
            let srcValue = photo.src || photo.filename || photo.file || photo.path || photo.image;
            
            if (!srcValue) {
                console.warn(`行${i}: src値が見つかりません。利用可能なフィールド:`, Object.keys(photo));
                continue;
            }
            
            // パスを修正
            if (srcValue && !srcValue.startsWith('data/images/')) {
                photo.src = 'data/images/' + srcValue;
            } else {
                photo.src = srcValue;
            }
            
            // サムネイル用パスを生成（拡張子を.jpgに変更）
            if (photo.src) {
                const filename = photo.src.split('/').pop(); // ファイル名を取得
                const nameWithoutExt = filename.split('.')[0]; // 拡張子を除去
                photo.thumbnail = `data/images/thumbnail/${nameWithoutExt}.jpg`;
                console.log(`写真${i}: src=${photo.src}, thumbnail=${photo.thumbnail}`);
            }
            
            // 必須フィールドのデフォルト値設定
            photo.title = photo.title || `写真 ${i}`;
            photo.description = photo.description || '';
            photo.subject = photo.subject || '';
            
            photos.push(photo);
        }
        
        console.log('読み込まれた写真数:', photos.length);
        console.log('最初の写真データ:', photos[0]);
        
        if (photos.length === 0) {
            throw new Error('有効な写真データが見つかりませんでした');
        }
        
        // 初期化完了後にセットアップ
        setupSearch();
        setupModal();
        setupIntersectionObserver();
        loadGallery();
        
    } catch (error) {
        console.error('CSVファイルの読み込みに失敗しました:', error);
        
        // CSVファイルが見つからない場合のフォールバック
        if (error.message.includes('404')) {
            console.log('CSVファイルが見つかりません。サンプルデータで初期化します。');
            createSampleData();
        } else {
            showErrorMessage(`写真データの読み込みに失敗しました: ${error.message}`);
        }
    }
}

// 文字コードを自動判定してデコード
async function detectEncodingAndDecode(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // BOMの検出
    if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
        console.log('UTF-8 BOM検出');
        return new TextDecoder('utf-8').decode(arrayBuffer);
    }
    
    // Shift_JISの検出（簡易版）
    // 日本語の文字コード範囲をチェック
    let possibleShiftJis = false;
    for (let i = 0; i < Math.min(uint8Array.length, 1000); i++) {
        const byte = uint8Array[i];
        // Shift_JISの2バイト文字の1バイト目の範囲
        if ((byte >= 0x81 && byte <= 0x9F) || (byte >= 0xE0 && byte <= 0xEF)) {
            possibleShiftJis = true;
            break;
        }
    }
    
    if (possibleShiftJis) {
        try {
            console.log('Shift_JISでデコードを試行');
            const decoder = new TextDecoder('shift_jis');
            const text = decoder.decode(arrayBuffer);
            
            // デコード結果をチェック（文字化け文字が少ないかどうか）
            const invalidChars = (text.match(/[�]/g) || []).length;
            if (invalidChars < text.length * 0.05) { // 5%以下なら成功とみなす
                console.log('Shift_JISデコード成功');
                return text;
            }
        } catch (error) {
            console.warn('Shift_JISデコードに失敗:', error);
        }
    }
    
    // UTF-8でデコード（フォールバック）
    console.log('UTF-8でデコード');
    return new TextDecoder('utf-8').decode(arrayBuffer);
}

// CSVの行をパース（引用符対応）
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // エスケープされた引用符
                current += '"';
                i++;
            } else {
                // 引用符の開始/終了
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // フィールドの区切り
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// サンプルデータを作成（CSVファイルが見つからない場合）
function createSampleData() {
    // ディレクトリ構成から推測されるファイル名でサンプルデータを作成
    const sampleFiles = [
        '20250824_1.jpeg',
        '20250824_2.jpeg', 
        '20250824_3.webp',
        '20250824_4.webp',
        '20250824_5.webp',
        '20250824_6.webp',
        '20250824_7.webp',
        '20250914_1.webp',
        '20250914_2.webp',
        '20250914_3.webp',
        '20250927_1.jpeg'
    ];
    
    photos = sampleFiles.map((filename, index) => {
        const nameWithoutExt = filename.split('.')[0];
        return {
            src: `data/images/${filename}`,
            thumbnail: `data/images/thumbnail/${nameWithoutExt}.jpg`,
            title: `写真 ${index + 1}`,
            description: `${filename} の説明`,
            subject: '写真'
        };
    });
    
    console.log('サンプルデータで初期化完了:', photos.length, '件');
    
    // 初期化完了後にセットアップ
    setupSearch();
    setupModal();
    setupIntersectionObserver();
    loadGallery();
}

// Intersection Observer のセットアップ（Lazy Loading）
function setupIntersectionObserver() {
    console.log('setupIntersectionObserver 開始');
    
    // 安全な初期化
    if (!loadedImages) {
        loadedImages = new Set();
    }
    
    const options = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };
    
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target.querySelector('img[data-src]');
                
                if (img && img.dataset.src) {
                    const imageSrc = img.dataset.src;
                    
                    if (!loadedImages.has(imageSrc)) {
                        console.log('画像読み込み開始:', imageSrc);
                        loadImage(img);
                        loadedImages.add(imageSrc);
                    }
                }
                
                // 要素にアニメーション追加
                entry.target.classList.add('visible');
            }
        });
    }, options);
    
    console.log('IntersectionObserver 作成完了');
}

// 画像を遅延読み込み
function loadImage(img) {
    const thumbnailSrc = img.dataset.src;  // サムネイル画像
    const fullSrc = img.dataset.fullSrc;   // フルサイズ画像
    
    console.log('Loading thumbnail:', thumbnailSrc);
    
    // まずサムネイル画像を読み込み
    img.src = thumbnailSrc;
    img.removeAttribute('data-src');
    
    img.onload = function() {
        img.classList.add('loaded');
        console.log('Thumbnail loaded successfully:', thumbnailSrc);
        
        // フルサイズ画像をバックグラウンドでプリロード（必要に応じて）
        if (fullSrc && fullSrc !== thumbnailSrc) {
            const preloadImg = new Image();
            preloadImg.src = fullSrc;
            console.log('Preloading full size image:', fullSrc);
        }
    };
    
    img.onerror = function() {
        console.warn('サムネイル読み込み失敗、フルサイズにフォールバック:', thumbnailSrc);
        // サムネイル読み込み失敗時はフルサイズにフォールバック
        if (fullSrc && img.src !== fullSrc) {
            img.src = fullSrc;
            img.classList.add('fallback-image');
        }
    };
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
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
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

// 写真を表示（遅延読み込み対応・バッチ処理）
function displayPhotos(photosToDisplay) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    visiblePhotos = photosToDisplay;
    
    if (photosToDisplay.length === 0) {
        gallery.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: white;">
                <div style="font-size: 2rem; margin-bottom: 10px;">📷</div>
                <div style="font-size: 1.2rem;">該当する写真がありません</div>
            </div>
        `;
        return;
    }
    
    // バッチ処理で表示
    displayBatch(0, Math.min(BATCH_SIZE, photosToDisplay.length));
    
    // 残りがある場合はスクロール時に追加読み込み
    if (photosToDisplay.length > BATCH_SIZE) {
        setupInfiniteScroll();
    }
}

// バッチ単位で写真を表示
function displayBatch(startIndex, endIndex) {
    const gallery = document.getElementById('gallery');
    const fragment = document.createDocumentFragment();
    
    for (let i = startIndex; i < endIndex && i < visiblePhotos.length; i++) {
        const photo = visiblePhotos[i];
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.setAttribute('data-index', photos.indexOf(photo));
        
        // サムネイルを優先的に使用
        const thumbnailSrc = photo.thumbnail || photo.src;
        
        photoItem.innerHTML = `
            <img data-src="${thumbnailSrc}" data-full-src="${photo.src}" alt="${photo.title}">
            <div class="photo-overlay">
                <div class="photo-title">${photo.title}</div>
                <div class="photo-description">${photo.description}</div>
                <div class="photo-subject">${photo.subject || ''}</div>
            </div>
        `;
        
        // クリックイベントを追加
        photoItem.addEventListener('click', () => openModal(photos.indexOf(photo)));
        
        // Intersection Observer に登録
        if (intersectionObserver) {
            intersectionObserver.observe(photoItem);
        }
        
        fragment.appendChild(photoItem);
    }
    
    gallery.appendChild(fragment);
}

// 無限スクロール設定
function setupInfiniteScroll() {
    let currentBatch = 1;
    let isLoading = false;
    
    const loadMorePhotos = () => {
        if (isLoading) return;
        
        const startIndex = currentBatch * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, visiblePhotos.length);
        
        if (startIndex >= visiblePhotos.length) return;
        
        isLoading = true;
        
        // 少し遅延を加えてスムーズに見せる
        setTimeout(() => {
            displayBatch(startIndex, endIndex);
            currentBatch++;
            isLoading = false;
        }, 100);
    };
    
    // スクロール監視
    const scrollHandler = throttle(() => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
            loadMorePhotos();
        }
    }, 200);
    
    window.addEventListener('scroll', scrollHandler);
}

// スロットル関数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
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