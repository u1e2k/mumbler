import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  moment,
  normalizePath,
} from 'obsidian';
import { t } from './src/lang/helpers';

/**
 * プラグイン設定のインターフェース
 */
interface MumblerSettings {
  useDailyNotesSettings: boolean;
  customFolder: string;
  customDateFormat: string;
  headingLevel: number;
  headingText: string;
}

/**
 * 設定のデフォルト値
 */
const DEFAULT_SETTINGS: MumblerSettings = {
  useDailyNotesSettings: true,
  customFolder: '',
  customDateFormat: 'YYYY-MM-DD',
  headingLevel: 2,
  headingText: t('SETTINGS_DEFAULT_HEADING_TEXT'),
};

export default class MumblerPlugin extends Plugin {
  settings!: MumblerSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 1. コマンドパレットに「つぶやきを投稿」コマンドを登録
    this.addCommand({
      id: 'post-mumble',
      name: t('COMMAND_POST_MUMBLE'),
      callback: () => {
        new MumblerModal(this.app, this).open();
      },
    });

    // 2. 左リボンメニューにアイコンを追加（左クリック: 入力モーダル表示 / 右クリック: 設定画面表示）
    let isRightClicking = false;

    const ribbonIconEl = this.addRibbonIcon(
      'message-square',
      t('RIBBON_TOOLTIP'),
      (evt: MouseEvent) => {
        // 右クリック時（または右クリック直後）は投稿用モーダルを開かない
        if (isRightClicking || evt.button === 2) {
          return;
        }
        new MumblerModal(this.app, this).open();
      }
    );

    // 右クリック時にデフォルト動作を抑止してMumbler設定画面を直接開く
    ribbonIconEl.addEventListener('contextmenu', (evt: MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation();
      evt.stopImmediatePropagation();

      isRightClicking = true;
      setTimeout(() => {
        isRightClicking = false;
      }, 300);

      const setting = (this.app as any).setting;
      if (setting) {
        setting.open();
        setting.openTabById('mumbler');
      }
    });

    // 3. 設定画面タブの登録
    this.addSettingTab(new MumblerSettingTab(this.app, this));
  }

  onunload(): void {
    // アンロード時のクリーンアップ処理
  }

  async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    // 旧バージョン（heading: string）からのデータ移行
    if (loadedData && typeof (loadedData as any).heading === 'string') {
      const rawHeading = (loadedData as any).heading.trim();
      const match = rawHeading.match(/^(#{1,6})\s*(.*)$/);
      if (match) {
        this.settings.headingLevel = match[1].length;
        this.settings.headingText =
          match[2].trim() || t('SETTINGS_DEFAULT_HEADING_TEXT');
      } else if (rawHeading) {
        this.settings.headingText = rawHeading;
      }
      delete (this.settings as any).heading;
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * 設定値から完全な見出し文字列（例: "## つぶやき"）を生成する
   */
  getTargetHeadingString(): string {
    const level = Math.min(Math.max(Number(this.settings.headingLevel) || 2, 1), 6);
    const rawText = (this.settings.headingText || '').trim();
    // ユーザー入力に # が含まれている場合は除去して正規化
    const cleanText =
      rawText.replace(/^#+\s*/, '').trim() || t('SETTINGS_DEFAULT_HEADING_TEXT');
    const prefix = '#'.repeat(level);
    return `${prefix} ${cleanText}`;
  }

  /**
   * 階層フォルダが存在することを確認し、なければ順次作成する
   */
  async ensureFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    if (!normalized || normalized === '.') return;

    const parts = normalized.split('/');
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const fileOrFolder = this.app.vault.getAbstractFileByPath(currentPath);
      if (!fileOrFolder) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  /**
   * 今日のデイリーノート（対象ファイル）のパスを取得する
   */
  getTargetFilePath(): string {
    const now = moment();
    let folder = '';
    let format = 'YYYY-MM-DD';

    if (this.settings.useDailyNotesSettings) {
      // コアプラグイン「デイリーノート」の設定を取得
      const dailyNotesPlugin = (this.app as any).internalPlugins?.getPluginById?.('daily-notes');
      if (dailyNotesPlugin && dailyNotesPlugin.enabled && dailyNotesPlugin.instance?.options) {
        const options = dailyNotesPlugin.instance.options;
        folder = (options.folder || '').trim();
        format = (options.format || '').trim() || 'YYYY-MM-DD';
      } else {
        // デイリーノートが無効または取得失敗時のフォールバック
        folder = (this.settings.customFolder || '').trim();
        format = (this.settings.customDateFormat || '').trim() || 'YYYY-MM-DD';
      }
    } else {
      // ユーザー設定のカスタムフォルダ・書式を使用
      folder = (this.settings.customFolder || '').trim();
      format = (this.settings.customDateFormat || '').trim() || 'YYYY-MM-DD';
    }

    const filename = now.format(format);
    const rawPath = folder ? `${folder}/${filename}` : filename;
    const normalized = normalizePath(rawPath);

    return normalized.endsWith('.md') ? normalized : `${normalized}.md`;
  }

  /**
   * つぶやきを今日のデイリーノートに追記する
   * @param content つぶやきの内容
   * @param activateLeaf ノートをアクティブタブとして開くかどうか
   */
  async postMumble(content: string, activateLeaf: boolean = true): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) {
      new Notice(t('NOTICE_EMPTY_CONTENT'));
      return;
    }

    const now = moment();
    const timeStr = now.format('HH:mm');
    const filePath = this.getTargetFilePath();

    // 1. 親フォルダの存在確認・自動作成
    const lastSlashIndex = filePath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      const parentFolder = filePath.slice(0, lastSlashIndex);
      await this.ensureFolder(parentFolder);
    }

    // 2. ファイルの存在確認・空ファイル新規作成
    let targetFile = this.app.vault.getAbstractFileByPath(filePath);
    if (!targetFile) {
      targetFile = await this.app.vault.create(filePath, '');
    }

    if (!(targetFile instanceof TFile)) {
      new Notice(t('NOTICE_INVALID_FILE', { filePath }));
      return;
    }

    // 3. つぶやきのフォーマット整形
    // 1行目: - **HH:mm** <テキスト1行目>
    // 2行目以降: 先頭にスペース2つインデントを付与して子要素化
    const lines = trimmed.split(/\r?\n/);
    const firstLine = `- **${timeStr}** ${lines[0]}`;
    const restLines = lines.slice(1).map((line) => `  ${line}`);
    const formattedEntry = [firstLine, ...restLines].join('\n');

    // 4. 見出しの解決
    const targetHeading = this.getTargetHeadingString();

    // 5. app.vault.process を使用した安全な追記処理
    await this.app.vault.process(targetFile, (data: string) => {
      const fileLines = data.split(/\r?\n/);
      const headingIndex = fileLines.findIndex((line) => line.trim() === targetHeading);

      if (headingIndex !== -1) {
        // すでに指定の見出しが存在する場合:
        // 見出し行の直下に挿入（上が最新になる逆時系列）
        fileLines.splice(headingIndex + 1, 0, formattedEntry);
        return fileLines.join('\n');
      } else {
        // まだ存在しない場合: ノート末尾に見出しを作成し、その直下に挿入
        const trimmedData = data.trimEnd();
        const separator = trimmedData.length > 0 ? '\n\n' : '';
        return `${trimmedData}${separator}${targetHeading}\n${formattedEntry}\n`;
      }
    });

    // 6. 投稿後のアクション
    if (activateLeaf) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(targetFile);
    }

    new Notice(t('NOTICE_POST_SUCCESS'));
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
    this.titleEl.setText(t('MODAL_TITLE'));

    // コンテナスタイル調整
    contentEl.addClass('mumbler-modal-container');

    // テキストエリア作成
    this.textareaEl = contentEl.createEl('textarea', {
      cls: 'mumbler-textarea',
      attr: {
        placeholder: t('MODAL_PLACEHOLDER'),
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

    // キーボードショートカット:
    // - Alt + Enter (Option + Enter): モーダルを閉じずに連続投稿
    // - Cmd + Enter / Ctrl + Enter: 投稿してモーダルを閉じる
    this.textareaEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.altKey) {
          e.preventDefault();
          this.submit(true);
        } else if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          this.submit(false);
        }
      }
    });

    // ボタン領域
    const buttonBar = contentEl.createDiv({ cls: 'mumbler-button-bar' });
    buttonBar.style.display = 'flex';
    buttonBar.style.justifyContent = 'flex-end';
    buttonBar.style.alignItems = 'center';
    buttonBar.style.gap = '10px';
    buttonBar.style.marginTop = '12px';

    // ショートカットキーのヒント表示
    const hintEl = buttonBar.createDiv({ cls: 'mumbler-shortcut-hint' });
    hintEl.setText(t('MODAL_SHORTCUT_HINT'));
    hintEl.style.fontSize = 'var(--font-ui-smaller)';
    hintEl.style.color = 'var(--text-muted)';
    hintEl.style.marginRight = 'auto';

    // キャンセルボタン
    const cancelBtn = buttonBar.createEl('button', {
      text: t('MODAL_CANCEL_BUTTON'),
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    // 投稿するボタン
    const submitBtn = buttonBar.createEl('button', {
      text: t('MODAL_POST_BUTTON'),
      cls: 'mod-cta',
    });
    submitBtn.addEventListener('click', () => {
      this.submit(false);
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

  private async submit(keepOpen: boolean = false): Promise<void> {
    const text = this.textareaEl.value;
    if (!text.trim()) {
      new Notice(t('NOTICE_EMPTY_CONTENT'));
      return;
    }

    if (keepOpen) {
      // 連続投稿: テキストエリアをクリアし、モーダルを開いたまま追記
      this.textareaEl.value = '';
      await this.plugin.postMumble(text, false);
      this.textareaEl.focus();
    } else {
      // 通常投稿: モーダルを閉じてデイリーノートをアクティブ表示
      this.close();
      await this.plugin.postMumble(text, true);
    }
  }
}

/**
 * プラグイン設定画面タブ
 */
class MumblerSettingTab extends PluginSettingTab {
  plugin: MumblerPlugin;

  constructor(app: App, plugin: MumblerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: t('SETTINGS_TITLE') });

    // 1. コアプラグイン設定の使用トグル
    new Setting(containerEl)
      .setName(t('SETTINGS_USE_DAILY_NOTES_NAME'))
      .setDesc(t('SETTINGS_USE_DAILY_NOTES_DESC'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useDailyNotesSettings)
          .onChange(async (value) => {
            this.plugin.settings.useDailyNotesSettings = value;
            await this.plugin.saveSettings();
            this.display(); // 設定変更時にカスタム項目の表示/無効状態を再描画
          })
      );

    const isCustomDisabled = this.plugin.settings.useDailyNotesSettings;

    // 2. カスタムフォルダ名
    new Setting(containerEl)
      .setName(t('SETTINGS_FOLDER_NAME'))
      .setDesc(t('SETTINGS_FOLDER_DESC'))
      .addText((text) =>
        text
          .setPlaceholder('Daily')
          .setValue(this.plugin.settings.customFolder)
          .setDisabled(isCustomDisabled)
          .onChange(async (value) => {
            this.plugin.settings.customFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // 3. カスタム日付フォーマット
    new Setting(containerEl)
      .setName(t('SETTINGS_DATE_FORMAT_NAME'))
      .setDesc(t('SETTINGS_DATE_FORMAT_DESC'))
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.customDateFormat)
          .setDisabled(isCustomDisabled)
          .onChange(async (value) => {
            this.plugin.settings.customDateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl('h3', { text: t('SETTINGS_HEADING_SECTION_TITLE') });

    // 4. 見出しレベル（Dropdown: H1〜H6）
    new Setting(containerEl)
      .setName(t('SETTINGS_HEADING_LEVEL_NAME'))
      .setDesc(t('SETTINGS_HEADING_LEVEL_DESC'))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            '1': 'H1 (#)',
            '2': 'H2 (##)',
            '3': 'H3 (###)',
            '4': 'H4 (####)',
            '5': 'H5 (#####)',
            '6': 'H6 (######)',
          })
          .setValue(String(this.plugin.settings.headingLevel || 2))
          .onChange(async (value) => {
            this.plugin.settings.headingLevel = Number(value) || 2;
            await this.plugin.saveSettings();
          })
      );

    // 5. 見出し名（Text）
    new Setting(containerEl)
      .setName(t('SETTINGS_HEADING_TEXT_NAME'))
      .setDesc(t('SETTINGS_HEADING_TEXT_DESC'))
      .addText((text) =>
        text
          .setPlaceholder(t('SETTINGS_DEFAULT_HEADING_TEXT'))
          .setValue(this.plugin.settings.headingText)
          .onChange(async (value) => {
            this.plugin.settings.headingText = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
