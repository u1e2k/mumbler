import { App, Modal, Notice, Plugin, TFile, moment } from 'obsidian';

export default class MumblerPlugin extends Plugin {
  async onload(): Promise<void> {
    // 1. コマンドパレットに「つぶやきを投稿」コマンドを登録
    // (Obsidianの仕様上、コマンドパレットには「Mumbler: つぶやきを投稿」と表示されます)
    this.addCommand({
      id: 'post-mumble',
      name: 'つぶやきを投稿',
      callback: () => {
        new MumblerModal(this.app, this).open();
      },
    });

    // 2. 左リボンメニューにアイコンを追加
    this.addRibbonIcon('message-square', 'Mumbler: つぶやきを投稿', () => {
      new MumblerModal(this.app, this).open();
    });
  }

  onunload(): void {
    // クリーンアップ処理が必要な場合はここに記述
  }

  /**
   * つぶやきを今日のデイリーノートに追記する
   */
  async postMumble(content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) {
      new Notice('Mumbler: テキストが入力されていません');
      return;
    }

    // 現在の日付と時刻を取得
    const now = moment();
    const dateStr = now.format('YYYY-MM-DD');
    const timeStr = now.format('HH:mm');

    const folderPath = 'Daily';
    const filePath = `${folderPath}/${dateStr}.md`;

    // 1. フォルダの存在確認・作成
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }

    // 2. ファイルの存在確認・新規作成
    let targetFile = this.app.vault.getAbstractFileByPath(filePath);
    if (!targetFile) {
      // ファイルが存在しない場合は空ファイルで新規作成
      targetFile = await this.app.vault.create(filePath, '');
    }

    if (!(targetFile instanceof TFile)) {
      new Notice(`Mumbler エラー: ${filePath} は通常のファイルではありません`);
      return;
    }

    // 3. つぶやきのフォーマット整形
    // 1行目: - **HH:mm** <テキスト1行目>
    // 2行目以降: 先頭にスペース2つインデントを付与
    const lines = trimmed.split(/\r?\n/);
    const firstLine = `- **${timeStr}** ${lines[0]}`;
    const restLines = lines.slice(1).map((line) => `  ${line}`);
    const formattedEntry = [firstLine, ...restLines].join('\n');

    // 4. app.vault.process を使用した安全な追記処理
    const headingText = '## つぶやき';

    await this.app.vault.process(targetFile, (data: string) => {
      const fileLines = data.split(/\r?\n/);
      const headingIndex = fileLines.findIndex((line) => line.trim() === headingText);

      if (headingIndex !== -1) {
        // すでに「## つぶやき」が存在する場合:
        // 見出し行の直下に挿入（上が最新になる逆時系列）
        fileLines.splice(headingIndex + 1, 0, formattedEntry);
        return fileLines.join('\n');
      } else {
        // まだ存在しない場合: ノート末尾に ## つぶやき 見出しを作成し、その直下に挿入
        const trimmedData = data.trimEnd();
        const separator = trimmedData.length > 0 ? '\n\n' : '';
        return `${trimmedData}${separator}${headingText}\n${formattedEntry}\n`;
      }
    });

    // 5. 投稿後のアクション
    // デイリーノートをアクティブ表示にする
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(targetFile);

    // 完了通知
    new Notice('Mumbler: つぶやきを記録しました');
  }
}

/**
 * つぶやき入力用モーダル
 */
class MumblerModal extends Modal {
  private plugin: MumblerPlugin;
  private textareaEl!: HTMLTextAreaElement;

  constructor(app: App, plugin: MumblerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    // モーダルタイトル
    this.titleEl.setText('いま何してる？');

    // コンテナスタイル調整
    contentEl.addClass('mumbler-modal-container');

    // テキストエリア作成
    this.textareaEl = contentEl.createEl('textarea', {
      cls: 'mumbler-textarea',
      attr: {
        placeholder: 'いまの思考やメモを入力… (Cmd/Ctrl + Enterで投稿)',
        rows: '4',
      },
    });

    // スタイル適用（ Obsidian 標準テーマに調和するデザイン）
    this.textareaEl.style.width = '100%';
    this.textareaEl.style.minHeight = '110px';
    this.textareaEl.style.boxSizing = 'border-box';
    this.textareaEl.style.padding = '10px';
    this.textareaEl.style.fontSize = 'var(--font-ui-medium)';
    this.textareaEl.style.lineHeight = '1.5';
    this.textareaEl.style.borderRadius = 'var(--radius-m)';
    this.textareaEl.style.border = '1px solid var(--background-modifier-border)';
    this.textareaEl.style.backgroundColor = 'var(--background-secondary)';
    this.textareaEl.style.color = 'var(--text-normal)';
    this.textareaEl.style.resize = 'vertical';
    this.textareaEl.style.fontFamily = 'var(--font-text)';

    // キーボードショートカット: Cmd + Enter / Ctrl + Enter で送信
    this.textareaEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });

    // ボタン領域
    const buttonBar = contentEl.createDiv({ cls: 'mumbler-button-bar' });
    buttonBar.style.display = 'flex';
    buttonBar.style.justifyContent = 'flex-end';
    buttonBar.style.gap = '10px';
    buttonBar.style.marginTop = '12px';

    // キャンセルボタン
    const cancelBtn = buttonBar.createEl('button', {
      text: 'キャンセル',
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    // 投稿するボタン
    const submitBtn = buttonBar.createEl('button', {
      text: '投稿する',
      cls: 'mod-cta',
    });
    submitBtn.addEventListener('click', () => {
      this.submit();
    });

    // iPad / モバイル等のソフトウェアキーボード表示遅延に対応するためのタイマー付きフォーカス
    setTimeout(() => {
      this.textareaEl.focus();
    }, 50);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async submit(): Promise<void> {
    const text = this.textareaEl.value;
    if (!text.trim()) {
      new Notice('Mumbler: つぶやきを入力してください');
      return;
    }

    this.close();
    await this.plugin.postMumble(text);
  }
}
