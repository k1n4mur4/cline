# Phase 3: タスク実行支援機能実装

## 概要

学習モードにタスク実行支援機能を追加。タスク詳細表示、ファイルジャンプ、学習統計、エクスポート、コード解説連携の5機能を実装した。

## 実装状況

**Phase 3 完了** ✅

---

## 機能一覧

| # | 機能 | 状態 | 説明 |
|---|------|------|------|
| 1 | タスク詳細ビュー | ✅ 完了 | タスクの詳細パネル表示、ステータス変更ボタン |
| 2 | ファイルジャンプ | ✅ 完了 | 関連ファイルをクリックでVSCodeで開く |
| 3 | 学習統計 | ✅ 完了 | 進捗グラフ、時間記録、連続学習日数 |
| 4 | エクスポート | ✅ 完了 | Markdown/JSON形式でエクスポート |
| 5 | コード解説連携 | ✅ 完了 | Clineチャットにコード解説を依頼 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                         Webview (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  CurriculumView                                                  │
│  ├─ カリキュラム表示・タスク管理                                │
│  ├─ TaskDetailPanel (新規)                                      │
│  │   ├─ ステータス変更ボタン                                    │
│  │   ├─ 関連ファイルリンク                                      │
│  │   └─ 💡 コードを解説 ボタン                                  │
│  ├─ StatisticsPanel (新規)                                      │
│  │   ├─ 章別進捗グラフ                                          │
│  │   ├─ 学習時間統計                                            │
│  │   └─ 連続学習日数                                            │
│  └─ エクスポートメニュー (新規)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ gRPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (TypeScript)                          │
├─────────────────────────────────────────────────────────────────┤
│  LearningService (gRPC)                                          │
│  ├─ getLearningStatistics()   → LearningStatisticsManager        │
│  └─ exportCurriculum()        → CurriculumExporter               │
├─────────────────────────────────────────────────────────────────┤
│  FileService (gRPC)                                              │
│  └─ openFileRelativePath()    → ファイルを開く                   │
├─────────────────────────────────────────────────────────────────┤
│  TaskService (gRPC)                                              │
│  └─ newTask()                 → 新規チャットタスク開始           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. タスク詳細ビュー

### 実装

**ファイル:** `webview-ui/src/components/learning/CurriculumView.tsx`

**TaskDetailPanel コンポーネント:**

```tsx
interface TaskDetailPanelProps {
    task: LearningTask
    onClose: () => void
    onStatusChange: (status: TaskStatus) => void
    onOpenFile: (filePath: string) => void
    onExplainCode?: (taskTitle: string, files: string[]) => void
}
```

**機能:**
- タスクタイトル・説明の表示
- 目安時間の表示
- ステータス変更ボタン（未着手/進行中/完了/スキップ）
- 関連ファイルリスト（クリックでジャンプ）
- コード解説ボタン

---

## 2. ファイルジャンプ

### 実装

**フロントエンド:**

```typescript
const handleOpenFile = async (filePath: string) => {
    try {
        await FileServiceClient.openFileRelativePath(
            OpenFileRelativePathRequest.create({ relativePath: filePath }),
        )
    } catch (err) {
        console.error("Error opening file:", err)
        setError("ファイルを開けませんでした")
    }
}
```

**バックエンド:** `FileServiceClient.openFileRelativePath` を使用

---

## 3. 学習統計

### Proto定義

**ファイル:** `proto/cline/learning.proto`

```protobuf
// 個別タスク統計
message TaskStatistic {
  string task_id = 1;
  string started_at = 2;
  string completed_at = 3;
  int32 time_spent_minutes = 4;
}

// 章別進捗
message ChapterProgress {
  string chapter_id = 1;
  string chapter_title = 2;
  int32 total_tasks = 3;
  int32 completed_tasks = 4;
  float progress_percentage = 5;
}

// 全体統計
message LearningStatistics {
  string curriculum_id = 1;
  int32 total_tasks = 2;
  int32 completed_tasks = 3;
  int32 in_progress_tasks = 4;
  int32 skipped_tasks = 5;
  int32 not_started_tasks = 6;
  int32 estimated_total_minutes = 7;
  int32 actual_time_spent_minutes = 8;
  float completion_percentage = 9;
  string last_activity_time = 10;
  int32 streak_days = 11;
  repeated string learning_dates = 12;
  repeated TaskStatistic task_stats = 13;
  repeated ChapterProgress chapter_progress = 14;
}

// RPC
rpc getLearningStatistics(GetLearningStatisticsRequest) returns (GetLearningStatisticsResponse);
```

### バックエンド

**ファイル:** `src/core/learning/LearningStatisticsManager.ts`

```typescript
class LearningStatisticsManager {
  // 統計取得または初期化
  async getOrCreateStatistics(curriculum: CurriculumData): Promise<LearningStatisticsData>

  // タスク開始記録
  async recordTaskStart(taskId: string): Promise<void>

  // タスク完了記録
  async recordTaskCompletion(taskId: string): Promise<void>

  // 連続学習日数計算
  calculateStreakDays(dates: string[]): number

  // Proto変換
  toProto(data: LearningStatisticsData): LearningStatistics
}
```

**保存場所:** `.onboarding/statistics.json`

### フロントエンド

**ファイル:** `webview-ui/src/components/learning/StatisticsPanel.tsx`

**表示内容:**
- 全体進捗（完了/合計タスク数）
- 完了率（パーセンテージ）
- 学習時間（実績/見積もり）
- 連続学習日数
- 章別進捗バー

---

## 4. エクスポート機能

### Proto定義

**ファイル:** `proto/cline/learning.proto`

```protobuf
message ExportCurriculumRequest {
  Metadata metadata = 1;
  string format = 2;              // "markdown" | "json"
  bool include_statistics = 3;
}

message ExportCurriculumResponse {
  bool success = 1;
  string content = 2;
  string suggested_filename = 3;
  string error_message = 4;
}

rpc exportCurriculum(ExportCurriculumRequest) returns (ExportCurriculumResponse);
```

### バックエンド

**ファイル:** `src/core/learning/CurriculumExporter.ts`

```typescript
class CurriculumExporter {
  // Markdown形式エクスポート
  exportAsMarkdown(curriculum: CurriculumData, statistics?: LearningStatisticsData): string

  // JSON形式エクスポート
  exportAsJson(curriculum: CurriculumData, statistics?: LearningStatisticsData, pretty?: boolean): string

  // ファイル名生成
  getSuggestedFilename(curriculum: CurriculumData, format: "markdown" | "json"): string
}
```

**ファイル:** `src/core/controller/learning/exportCurriculum.ts`

```typescript
export async function exportCurriculum(
    _controller: Controller,
    request: ExportCurriculumRequest,
): Promise<ExportCurriculumResponse>
```

### フロントエンド

**CurriculumView内のエクスポートメニュー:**

```typescript
const handleExport = async (format: "markdown" | "json", includeStats: boolean) => {
    const response = await LearningServiceClient.exportCurriculum(
        ExportCurriculumRequest.create({
            format,
            includeStatistics: includeStats,
        }),
    )

    if (response.success && response.content) {
        // ダウンロード処理
        const blob = new Blob([response.content], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = response.suggestedFilename || `curriculum.${format === "json" ? "json" : "md"}`
        a.click()
    }
}
```

---

## 5. コード解説連携

### 実装

**ファイル:** `webview-ui/src/components/learning/CurriculumView.tsx`

```typescript
const handleExplainCode = async (taskTitle: string, files: string[]) => {
    if (files.length === 0) return

    try {
        const fileList = files.map((f) => `@/${f}`).join("\n")
        const prompt = `学習タスク「${taskTitle}」に関連するコードを解説してください。

以下のファイルを読んで、コードの目的と動作を説明してください：
${fileList}

ポイント：
- コードの全体的な目的
- 主要な関数・クラスの役割
- データフローの流れ
- 初心者が注意すべき点`

        await TaskServiceClient.newTask(
            NewTaskRequest.create({
                text: prompt,
                files: files,
            }),
        )
    } catch (err) {
        console.error("Error explaining code:", err)
        setError("コード解説の開始に失敗しました")
    }
}
```

**動作フロー:**
1. タスク詳細パネルで「💡 コードを解説」ボタンをクリック
2. タスクタイトルと関連ファイルからプロンプトを構築
3. `TaskServiceClient.newTask()` で新しいチャットタスクを開始
4. Clineが関連ファイルを読んで解説を生成

---

## ファイル一覧

### 新規作成ファイル

| パス | 説明 |
|------|------|
| `src/core/learning/LearningStatisticsManager.ts` | 学習統計管理 |
| `src/core/learning/CurriculumExporter.ts` | エクスポートロジック |
| `src/core/controller/learning/getLearningStatistics.ts` | 統計取得RPC |
| `src/core/controller/learning/exportCurriculum.ts` | エクスポートRPC |
| `webview-ui/src/components/learning/StatisticsPanel.tsx` | 統計表示UI |

### 変更ファイル

| パス | 変更内容 |
|------|----------|
| `proto/cline/learning.proto` | 統計・エクスポート関連メッセージ追加 |
| `src/core/learning/types.ts` | TaskStatistic, LearningStatisticsData型追加 |
| `src/core/learning/index.ts` | 新規モジュールのエクスポート追加 |
| `src/core/controller/learning/updateTaskProgress.ts` | 統計更新連携 |
| `webview-ui/src/components/learning/CurriculumView.tsx` | 詳細パネル、ファイルジャンプ、解説連携、エクスポート追加 |

---

## 使用方法

### タスク詳細の表示

1. カリキュラム内のタスクをクリック
2. 詳細パネルが開く
3. ステータス変更、ファイルジャンプ、コード解説が可能

### ファイルジャンプ

1. タスク詳細パネルで関連ファイルをクリック
2. VSCodeでファイルが開く

### 学習統計の確認

1. カリキュラム画面上部の統計パネルを確認
2. 章別進捗、学習時間、連続学習日数を表示

### エクスポート

1. カリキュラム画面の「エクスポート」メニューをクリック
2. 形式（Markdown/JSON）と統計含有を選択
3. ファイルがダウンロードされる

### コード解説

1. タスク詳細パネルで「💡 コードを解説」をクリック
2. 新しいClineチャットが開始
3. AIが関連ファイルを読んで解説を生成

---

## 技術的な決定事項

### 統計データの設計

- タスクごとの開始・完了時刻を記録
- 章別進捗を自動計算
- 連続学習日数（ストリーク）を計算

### エクスポート形式

**Markdown:**
- 人間が読みやすい形式
- 進捗状況をチェックボックス形式で表示
- 統計セクションを末尾に追加可能

**JSON:**
- 他ツールとの連携用
- 完全なデータ構造を保持
- pretty print対応

### コード解説連携

- 既存の `TaskServiceClient.newTask()` を活用
- ファイルメンション形式（`@/path/to/file`）でコンテキスト指定
- 学習タスクに特化したプロンプトテンプレート

---

## 関連ドキュメント

- Phase 1: `.claude/Phase/Phase1.md` (存在する場合)
- Phase 2: `.claude/Phase/Phase2.md`
- 実装計画: `.claude/plans/swirling-snacking-kitten.md`
