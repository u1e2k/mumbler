// 日本語ローカル辞書
export default {
  // コマンド & リボン
  COMMAND_POST_MUMBLE: 'つぶやきを投稿',
  RIBBON_TOOLTIP: 'つぶやきを投稿',

  // モーダル
  MODAL_TITLE: 'いま何してる？',
  MODAL_PLACEHOLDER: 'いまの思考やメモを入力…',
  MODAL_SHORTCUT_HINT: 'Cmd/Ctrl+Enter: 投稿 | Alt+Enter: 連続投稿',
  MODAL_CANCEL_BUTTON: 'キャンセル',
  MODAL_POST_BUTTON: '投稿する',

  // 通知（Notices）
  NOTICE_EMPTY_CONTENT: 'Mumbler: テキストが入力されていません',
  NOTICE_INVALID_FILE: 'Mumbler エラー: {filePath} は通常のファイルではありません',
  NOTICE_POST_SUCCESS: 'Mumbler: つぶやきを記録しました',

  // 設定（Settings）
  SETTINGS_TITLE: 'Mumbler 設定',
  SETTINGS_USE_DAILY_NOTES_NAME: 'コアプラグインの設定を使用する',
  SETTINGS_USE_DAILY_NOTES_DESC:
    'Obsidian標準の「デイリーノート」コアプラグインの設定（保存先フォルダ・日付書式）を自動で使用します。',
  SETTINGS_FOLDER_NAME: 'フォルダ名',
  SETTINGS_FOLDER_DESC: 'デイリーノート（またはログファイル）を保存するフォルダパス。',
  SETTINGS_DATE_FORMAT_NAME: '日付フォーマット',
  SETTINGS_DATE_FORMAT_DESC:
    'ファイル名に使用する日付フォーマット（moment.js形式）。例: YYYY-MM-DD',
  SETTINGS_HEADING_SECTION_TITLE: '見出し設定',
  SETTINGS_HEADING_LEVEL_NAME: '見出しレベル',
  SETTINGS_HEADING_LEVEL_DESC:
    '追記先見出しのMarkdownヘッダーレベル（H1〜H6）。',
  SETTINGS_HEADING_TEXT_NAME: '見出し名',
  SETTINGS_HEADING_TEXT_DESC: '追記先見出しのテキスト（# を除いた名前）。',
  SETTINGS_DEFAULT_HEADING_TEXT: 'つぶやき',
};
