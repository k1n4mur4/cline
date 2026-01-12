# Phase 2: カリキュラム生成機能実装

## 概要

学習モードにカリキュラム生成機能を追加。プロジェクト分析とユーザープロファイルに基づいて、AIによる動的カリキュラム生成とタスク進捗管理を実装した。

## 実装期間

Phase 2 完了

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                         Webview (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  LearningView                                                    │
│  ├─ ProfileSetupView (既存)  ← プロファイル未設定時             │
│  └─ CurriculumView (新規)    ← プロファイル設定済み時           │
│      ├─ 生成ボタン / プログレス表示                             │
│      ├─ 章一覧（展開・折りたたみ）                              │
│      └─ タスク一覧（進捗状態表示）                              │
└─────────────────────────────────────────────────────────────────┘
                              │ gRPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (TypeScript)                          │
├─────────────────────────────────────────────────────────────────┤
│  LearningService (gRPC)                                          │
│  ├─ getCurriculum()           → CurriculumManager                │
│  ├─ generateCurriculum()      → CurriculumGenerator (streaming)  │
│  └─ updateTaskProgress()      → CurriculumManager                │
├─────────────────────────────────────────────────────────────────┤
│  Core Components                                                 │
│  ├─ CurriculumManager     - .onboarding/curriculum.json 永続化  │
│  ├─ CurriculumGenerator   - AI API呼び出し + パース             │
│  └─ ProjectAnalyzer       - ディレクトリ構造・パターン分析      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI API (Anthropic)                            │
│  ├─ buildApiHandler() でプロバイダー取得                         │
│  ├─ createMessage() でストリーミング生成                         │
│  └─ ApiStreamChunk で逐次レスポンス処理                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## バックエンド実装

### 1. Proto定義拡張

**ファイル:** `proto/cline/learning.proto`

#### 新規メッセージ定義

```protobuf
// タスク進捗状態
enum TaskStatus {
  TASK_STATUS_NOT_STARTED = 0;
  TASK_STATUS_IN_PROGRESS = 1;
  TASK_STATUS_COMPLETED = 2;
  TASK_STATUS_SKIPPED = 3;
}

// 課題
message LearningTask {
  string id = 1;
  string title = 2;
  string description = 3;
  TaskStatus status = 4;
  repeated string target_files = 5;      // 関連ファイルパス
  string estimated_time = 6;             // 目安時間
  repeated string prerequisites = 7;     // 前提タスクID
}

// 章
message Chapter {
  string id = 1;
  string title = 2;
  string description = 3;
  repeated LearningTask tasks = 4;
  int32 order = 5;
}

// カリキュラム全体
message Curriculum {
  string id = 1;
  string title = 2;
  string description = 3;
  repeated Chapter chapters = 4;
  string created_at = 5;
  string updated_at = 6;
  string project_summary = 7;
}

// 生成プログレス
message CurriculumGenerationProgress {
  string phase = 1;                      // "analyzing" | "generating" | "completed" | "error"
  int32 progress_percent = 2;            // 0-100
  string current_step = 3;
  Curriculum partial_curriculum = 4;
  string error_message = 5;
}
```

#### 新規RPC

```protobuf
service LearningService {
  // 既存RPC...

  // カリキュラム取得
  rpc getCurriculum(GetCurriculumRequest) returns (GetCurriculumResponse);

  // カリキュラム生成（ストリーミング）
  rpc generateCurriculum(GenerateCurriculumRequest) returns (stream CurriculumGenerationProgress);

  // タスク進捗更新
  rpc updateTaskProgress(UpdateTaskProgressRequest) returns (UpdateTaskProgressResponse);
}
```

---

### 2. 型定義

**ファイル:** `src/core/learning/types.ts`

```typescript
// カリキュラム関連
export type TaskStatusType = "not_started" | "in_progress" | "completed" | "skipped"

export interface TaskData {
  id: string
  title: string
  description: string
  status: TaskStatusType
  targetFiles: string[]
  estimatedTime: string
  prerequisites: string[]
}

export interface ChapterData {
  id: string
  title: string
  description: string
  tasks: TaskData[]
  order: number
}

export interface CurriculumData {
  id: string
  title: string
  description: string
  chapters: ChapterData[]
  createdAt: string
  updatedAt: string
  projectSummary: string
}

// プロジェクト分析関連
export interface DirectoryNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: DirectoryNode[]
}

export interface ArchitecturePattern {
  name: string       // "MVC", "Clean Architecture", etc.
  confidence: number // 0-1
  indicators: string[]
}

export interface ProjectAnalysis {
  structure: DirectoryNode
  entryPoints: string[]
  patterns: ArchitecturePattern[]
  conventions: CodingConvention[]
  keyFiles: string[]
  summary: string
}
```

---

### 3. CurriculumManager

**ファイル:** `src/core/learning/CurriculumManager.ts`

カリキュラムデータの永続化を管理。

```typescript
class CurriculumManager {
  // カリキュラム保存
  async saveCurriculum(curriculum: CurriculumData): Promise<void>

  // カリキュラム読み込み
  async loadCurriculum(): Promise<{ exists: boolean; curriculum?: CurriculumData }>

  // タスク進捗更新
  async updateTaskStatus(taskId: string, status: TaskStatusType): Promise<CurriculumData | null>

  // Proto型変換
  toProto(data: CurriculumData): Curriculum
  fromProto(proto: Curriculum): CurriculumData
}
```

**保存場所:** `.onboarding/curriculum.json`

---

### 4. ProjectAnalyzer

**ファイル:** `src/core/learning/ProjectAnalyzer.ts`

プロジェクトの構造とパターンを分析。

```typescript
class ProjectAnalyzer {
  // メイン分析メソッド
  async analyze(): Promise<ProjectAnalysis>

  // 分析機能
  - analyzeStructure()     // ディレクトリ構造
  - detectEntryPoints()    // エントリーポイント検出
  - detectPatterns()       // アーキテクチャパターン検出
  - detectConventions()    // コーディング規約検出
  - findKeyFiles()         // 重要ファイル検出
  - generateSummary()      // AI用サマリー生成
}
```

**検出パターン:**
- MVC
- Clean Architecture
- Feature-based
- Component-based
- Service-based

---

### 5. CurriculumGenerator

**ファイル:** `src/core/learning/CurriculumGenerator.ts`

AIによるカリキュラム生成。

```typescript
class CurriculumGenerator {
  // ストリーミング生成
  async *generate(): AsyncGenerator<GenerationProgress>
}

interface GenerationProgress {
  phase: "analyzing" | "generating" | "parsing" | "completed" | "error"
  progressPercent: number
  currentStep: string
  partialCurriculum?: CurriculumData
  error?: string
}
```

**生成フロー:**
1. プロジェクト構造分析 (10-30%)
2. 技術スタック検出 (30-40%)
3. ユーザープロファイル読み込み (40-50%)
4. AI カリキュラム生成 (50-90%)
5. レスポンスパース (90-95%)
6. 完了 (100%)

---

### 6. gRPCハンドラー

| ファイル | 機能 |
|---------|------|
| `src/core/controller/learning/getCurriculum.ts` | カリキュラム取得 |
| `src/core/controller/learning/generateCurriculum.ts` | カリキュラム生成（ストリーミング） |
| `src/core/controller/learning/updateTaskProgress.ts` | タスク進捗更新 |

---

## フロントエンド実装

### 1. LearningView

**ファイル:** `webview-ui/src/components/learning/LearningView.tsx`

ProfileSetupViewとCurriculumViewを統合する親コンポーネント。

**ロジック:**
- プロファイル未設定 → ProfileSetupView表示
- プロファイル設定済み → CurriculumView表示

---

### 2. CurriculumView

**ファイル:** `webview-ui/src/components/learning/CurriculumView.tsx`

カリキュラム表示・管理UI。

**機能:**
- カリキュラム一覧表示
- 章の展開・折りたたみ
- タスク進捗管理（チェックボックス）
- 生成プログレス表示
- 進捗バー
- 再生成ボタン

**タスクステータス:**
| ステータス | 表示 | 色 |
|-----------|------|-----|
| NOT_STARTED | 未着手 | グレー |
| IN_PROGRESS | 進行中 | 青 |
| COMPLETED | 完了 | 緑 |
| SKIPPED | スキップ | 黄 |

---

### 3. App.tsx変更

**変更内容:**
- `ProfileSetupView` → `LearningView` に変更
- 学習モード表示時にLearningViewを使用

```tsx
{showLearning && <LearningView onDone={hideLearning} />}
```

---

## ファイル一覧

### 新規作成ファイル

| パス | 説明 |
|------|------|
| `src/core/learning/types.ts` | カリキュラム・分析型定義 |
| `src/core/learning/CurriculumManager.ts` | カリキュラム永続化 |
| `src/core/learning/ProjectAnalyzer.ts` | プロジェクト分析 |
| `src/core/learning/CurriculumGenerator.ts` | AI生成ロジック |
| `src/core/controller/learning/getCurriculum.ts` | gRPCハンドラー |
| `src/core/controller/learning/generateCurriculum.ts` | gRPCハンドラー（ストリーミング） |
| `src/core/controller/learning/updateTaskProgress.ts` | gRPCハンドラー |
| `webview-ui/src/components/learning/CurriculumView.tsx` | カリキュラムUI |
| `webview-ui/src/components/learning/LearningView.tsx` | 統合ビュー |

### 変更ファイル

| パス | 変更内容 |
|------|----------|
| `proto/cline/learning.proto` | カリキュラム関連メッセージ・RPC追加 |
| `src/core/learning/index.ts` | エクスポート追加 |
| `webview-ui/src/App.tsx` | LearningView統合 |

---

## 使用方法

### 学習モード起動

| 方法 | 操作 |
|------|------|
| キーボードショートカット | `Cmd/Ctrl + Shift + L` |
| サイドバーボタン | 🎓 アイコンをクリック |
| コマンドパレット | `Learning Mode` を実行 |

### カリキュラム生成

1. 学習モードを起動
2. プロファイル未設定の場合、ProfileSetupViewでプロファイルを設定
3. 「カリキュラムを生成」ボタンをクリック
4. 生成完了後、カリキュラムが表示される

### タスク管理

- チェックボックスをクリックして状態を変更
  - 未着手 → 進行中 → 完了 → 未着手
- 進捗バーで全体の進捗を確認

---

## 技術的な決定事項

### ストリーミング実装

**コールバックベースのgRPC:**
```typescript
LearningServiceClient.generateCurriculum(request, {
  onResponse: (progress) => { /* 進捗更新 */ },
  onError: (err) => { /* エラー処理 */ },
  onComplete: () => { /* 完了処理 */ },
})
```

### AI プロンプト設計

- プロジェクト構造のサマリーを含む
- ユーザーの経験レベル・役割を考慮
- JSON形式での出力を要求
- 3-5章、各章3-5タスクの構成を指定

### データ永続化

- カリキュラムは `.onboarding/curriculum.json` に保存
- タスク進捗はカリキュラム内で管理
- 更新時に `updatedAt` を更新

---

## 次のステップ (Phase 3)

Phase 3ではタスク実行支援機能を実装予定:

1. タスク詳細ビュー
2. 関連ファイルへのリンク・ジャンプ
3. コード解説機能との連携
4. 学習履歴・統計
5. エクスポート機能

---

## 関連ドキュメント

- Phase 1: `.claude/Phase/Phase1.md`
- 実装計画: `.claude/plans/swirling-snacking-kitten.md`
