import { v4 as uuidv4 } from "uuid"
import { buildApiHandler } from "../api"
import type { ApiConfiguration } from "../../shared/api"
import type { UserProfile } from "../../shared/proto/cline/learning"
import type { CurriculumData, ProjectAnalysis } from "./types"
import { ProjectAnalyzer } from "./ProjectAnalyzer"
import { TechStackDetector } from "./TechStackDetector"
import { UserProfileManager } from "./UserProfileManager"

/**
 * Progress update during curriculum generation
 */
export interface GenerationProgress {
	phase: "analyzing" | "generating" | "completed" | "error"
	progressPercent: number
	currentStep: string
	partialCurriculum?: CurriculumData
	error?: string
}

/**
 * Generates curriculum based on project analysis and user profile
 */
export class CurriculumGenerator {
	private workspacePath: string
	private apiConfig: ApiConfiguration

	constructor(workspacePath: string, apiConfig: ApiConfiguration) {
		this.workspacePath = workspacePath
		this.apiConfig = apiConfig
	}

	/**
	 * Generate curriculum with streaming progress updates
	 */
	async *generate(): AsyncGenerator<GenerationProgress> {
		try {
			// Phase 1: Project analysis
			yield {
				phase: "analyzing",
				progressPercent: 10,
				currentStep: "プロジェクト構造を分析中...",
			}

			const analyzer = new ProjectAnalyzer(this.workspacePath)
			const projectAnalysis = await analyzer.analyze()

			yield {
				phase: "analyzing",
				progressPercent: 30,
				currentStep: "技術スタックを検出中...",
			}

			const techDetector = new TechStackDetector(this.workspacePath)
			const technologies = await techDetector.detectTechnologies()

			yield {
				phase: "analyzing",
				progressPercent: 40,
				currentStep: "ユーザープロファイルを読み込み中...",
			}

			const profileManager = new UserProfileManager(this.workspacePath)
			const profile = await profileManager.loadProfile()

			// Phase 2: AI generation
			yield {
				phase: "generating",
				progressPercent: 50,
				currentStep: "カリキュラムを生成中...",
			}

			const prompt = this.buildPrompt(projectAnalysis, technologies, profile ?? undefined)
			const apiHandler = buildApiHandler(this.apiConfig, "act")

			let fullResponse = ""

			for await (const chunk of apiHandler.createMessage(this.getSystemPrompt(), [
				{ role: "user", content: prompt },
			])) {
				if (chunk.type === "text") {
					fullResponse += chunk.text
					yield {
						phase: "generating",
						progressPercent: Math.min(90, 50 + Math.floor(fullResponse.length / 50)),
						currentStep: "カリキュラムを生成中...",
					}
				}
			}

			// Phase 3: Parsing (use "generating" phase for proto compatibility)
			yield {
				phase: "generating",
				progressPercent: 95,
				currentStep: "レスポンスを解析中...",
			}

			const curriculum = this.parseResponse(fullResponse, projectAnalysis.summary)

			yield {
				phase: "completed",
				progressPercent: 100,
				currentStep: "完了",
				partialCurriculum: curriculum,
			}
		} catch (error) {
			yield {
				phase: "error",
				progressPercent: 0,
				currentStep: "エラーが発生しました",
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Get system prompt for curriculum generation
	 */
	private getSystemPrompt(): string {
		return `あなたは経験豊富なソフトウェアエンジニアで、新しいチームメンバーのオンボーディングを担当しています。
プロジェクトの構造と技術スタック、そしてユーザーの経験レベルに基づいて、効果的な学習カリキュラムを作成してください。
出力は必ず指定されたJSON形式で返してください。`
	}

	/**
	 * Build user prompt for AI
	 */
	private buildPrompt(analysis: ProjectAnalysis, technologies: string[], profile?: UserProfile): string {
		return `以下のプロジェクト情報とユーザープロファイルに基づいて、段階的な学習カリキュラムを日本語で作成してください。

## プロジェクト情報
${analysis.summary}

## 使用技術
${technologies.length > 0 ? technologies.join(", ") : "検出されませんでした"}

## ユーザープロファイル
- エンジニア歴: ${this.translateExperienceLevel(profile?.experienceLevel)}
- 主な役割: ${this.translateRole(profile?.primaryRole)}
- 学習ゴール: ${this.translateLearningGoal(profile?.learningGoal)}
- 学習スタイル: ${this.translateLearningStyle(profile?.learningStyle)}

## 出力形式
以下のJSON形式で出力してください。JSONは必ず\`\`\`json と \`\`\` で囲んでください：

\`\`\`json
{
  "title": "カリキュラムタイトル",
  "description": "カリキュラムの概要説明（2-3文）",
  "chapters": [
    {
      "title": "章タイトル",
      "description": "章の説明（1-2文）",
      "tasks": [
        {
          "title": "タスクタイトル",
          "description": "具体的なタスク内容と学習ポイント（3-5文）",
          "targetFiles": ["関連するファイルパス"],
          "estimatedTime": "30分",
          "prerequisites": []
        }
      ]
    }
  ]
}
\`\`\`

## 要件
1. ユーザーの経験レベルに合わせた難易度設定
2. 3-5章程度、各章3-5タスク
3. プロジェクト固有のファイルやパターンを参照
4. 段階的に理解が深まる順序
5. 実際にコードを読む・動かすタスクを含める
6. 各タスクには具体的なファイルパスを含める（可能な場合）`
	}

	/**
	 * Parse AI response and extract curriculum data
	 */
	private parseResponse(response: string, projectSummary: string): CurriculumData {
		// Extract JSON block
		const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
		if (!jsonMatch) {
			throw new Error("JSONブロックが見つかりません")
		}

		const parsed = JSON.parse(jsonMatch[1])
		const now = new Date().toISOString()

		return {
			id: uuidv4(),
			title: parsed.title || "学習カリキュラム",
			description: parsed.description || "",
			chapters: (parsed.chapters || []).map((ch: any, chIdx: number) => ({
				id: uuidv4(),
				title: ch.title || `第${chIdx + 1}章`,
				description: ch.description || "",
				order: chIdx,
				tasks: (ch.tasks || []).map((t: any) => ({
					id: uuidv4(),
					title: t.title || "タスク",
					description: t.description || "",
					status: "not_started" as const,
					targetFiles: t.targetFiles || [],
					estimatedTime: t.estimatedTime || "30分",
					prerequisites: t.prerequisites || [],
				})),
			})),
			createdAt: now,
			updatedAt: now,
			projectSummary,
		}
	}

	/**
	 * Translate experience level to Japanese
	 */
	private translateExperienceLevel(level?: string): string {
		const map: Record<string, string> = {
			less_than_1_year: "1年未満",
			"1_to_3_years": "1〜3年",
			"3_to_5_years": "3〜5年",
			more_than_5_years: "5年以上",
		}
		return map[level || ""] || "不明"
	}

	/**
	 * Translate role to Japanese
	 */
	private translateRole(role?: string): string {
		const map: Record<string, string> = {
			frontend: "フロントエンド",
			backend: "バックエンド",
			fullstack: "フルスタック",
			mobile: "モバイル",
			devops: "DevOps",
			other: "その他",
		}
		return map[role || ""] || "不明"
	}

	/**
	 * Translate learning goal to Japanese
	 */
	private translateLearningGoal(goal?: string): string {
		const map: Record<string, string> = {
			overview: "全体像の把握",
			feature_development: "機能追加・修正が可能になる",
			architecture: "アーキテクチャ理解",
			code_review: "コードレビュー参加",
		}
		return map[goal || ""] || "全体像の把握"
	}

	/**
	 * Translate learning style to Japanese
	 */
	private translateLearningStyle(style?: string): string {
		const map: Record<string, string> = {
			theory: "理論重視",
			hands_on: "実践（ハンズオン）重視",
			sample_code: "サンプルコード重視",
		}
		return map[style || ""] || "実践重視"
	}
}
