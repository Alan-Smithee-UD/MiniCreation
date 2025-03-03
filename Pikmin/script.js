const PIKMIN_ORG =
`ＸＸＸ
ＸＸＸＸ
　ＸＸＸ
　　　　Ｘ
　　　　Ｘ　　hogeピクミンは
　   ＸＸＸ　　何があっても
　ＸＸＸＸＸ　　＂絶対に＂
　Ｘ⚫ＸＸ⚫
　ＸＸＸＸＸ　『fuga』
　　ＸＸＸ
　　  ＸＸ
　ＸＸＸＸ
Ｘ　ＸＸＸＸ
Ｘ　ＸＸＸ　Ｘ
ＸＸＸＸＸ　Ｘ
ＸＸＸＸＸ　Ｘ
　Ｘ　　Ｘ
　 Ｘ　  Ｘ`;

document.addEventListener("DOMContentLoaded", function () {
    const inputText = document.getElementById("inputText");
    const convertButton = document.getElementById("convertButton");
    const copyButton = document.getElementById("copyButton");

    // フォーカスアウト時に全角1文字に変換
    inputText.addEventListener("blur", function () {
        let text = inputText.value.trim(); // 前後の空白を除去
        if (text.length > 0) {
            inputText.value = toFullWidth(text[0]); // 最初の1文字を全角に変換
        } else {
            inputText.value = ""; // 空ならそのまま
        }
    });

    // 変換ボタンを押したとき
    convertButton.addEventListener("click", function () {
        const inputValue = inputText.value;
        const outputText = PIKMIN_ORG.replaceAll('Ｘ',inputValue);
        document.getElementById("outputText").value = outputText;
    });

    // コピー
    copyButton.addEventListener("click", function () {
        const outputText = document.getElementById("outputText");
        outputText.select();
        document.execCommand("copy");
        alert("コピーしました！");
    });

    // 半角→全角変換関数
    function toFullWidth(char) {
        return char.replace(/[A-Za-z0-9]/g, function (s) {
            return String.fromCharCode(s.charCodeAt(0) + 65248);
        });
    }
});
