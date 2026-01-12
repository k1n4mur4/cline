import { v4 as uuidv4 } from "uuid"
import { buildApiHandler } from "../api"
import type { ApiConfiguration } from "../../shared/api"
import type { QuizData, QuizQuestionData, QuizChoiceData, QuizDifficulty } from "./types"
import { TechStackDetector } from "./TechStackDetector"
import { ProjectAnalyzer } from "./ProjectAnalyzer"

/**
 * Progress update during quiz generation
 */
export interface QuizGenerationProgress {
	phase: "detecting" | "generating" | "completed" | "error"
	progressPercent: number
	currentStep: string
	partialQuiz?: QuizData
	error?: string
}

/**
 * Generates quiz questions based on selected technologies
 */
export class QuizGenerator {
	private workspacePath: string
	private apiConfig: ApiConfiguration

	constructor(workspacePath: string, apiConfig: ApiConfiguration) {
		this.workspacePath = workspacePath
		this.apiConfig = apiConfig
	}

	/**
	 * Generate quiz with streaming progress updates
	 * @param technologies Target technologies for quiz (empty = auto-detect)
	 * @param useProjectContext Whether to reference project code for questions
	 */
	async *generate(
		technologies: string[],
		useProjectContext: boolean = false,
	): AsyncGenerator<QuizGenerationProgress> {
		try {
			let targetTechnologies = technologies

			// Phase 1: Technology detection (if not provided)
			if (targetTechnologies.length === 0) {
				yield {
					phase: "detecting",
					progressPercent: 10,
					currentStep: "プロジェクトの技術スタックを検出中...",
				}

				const techDetector = new TechStackDetector(this.workspacePath)
				targetTechnologies = await techDetector.detectTechnologies()

				// Limit to top 5 technologies
				targetTechnologies = targetTechnologies.slice(0, 5)
			}

			if (targetTechnologies.length === 0) {
				throw new Error("診断する技術が見つかりませんでした。技術を選択してください。")
			}

			yield {
				phase: "detecting",
				progressPercent: 20,
				currentStep: `対象技術: ${targetTechnologies.join(", ")}`,
			}

			// Get project context if requested
			let projectContext = ""
			if (useProjectContext) {
				yield {
					phase: "detecting",
					progressPercent: 30,
					currentStep: "プロジェクトコンテキストを取得中...",
				}

				const analyzer = new ProjectAnalyzer(this.workspacePath)
				const analysis = await analyzer.analyze()
				projectContext = analysis.summary
			}

			// Phase 2: AI generation
			yield {
				phase: "generating",
				progressPercent: 40,
				currentStep: "クイズを生成中...",
			}

			const prompt = this.buildPrompt(targetTechnologies, projectContext)
			const apiHandler = buildApiHandler(this.apiConfig, "act")

			let fullResponse = ""

			for await (const chunk of apiHandler.createMessage(this.getSystemPrompt(), [
				{ role: "user", content: prompt },
			])) {
				if (chunk.type === "text") {
					fullResponse += chunk.text
					yield {
						phase: "generating",
						progressPercent: Math.min(85, 40 + Math.floor(fullResponse.length / 30)),
						currentStep: "クイズを生成中...",
					}
				}
			}

			// Phase 3: Parsing (use "generating" phase for proto compatibility)
			yield {
				phase: "generating",
				progressPercent: 90,
				currentStep: "レスポンスを解析中...",
			}

			const quiz = this.parseResponse(fullResponse, targetTechnologies)

			yield {
				phase: "completed",
				progressPercent: 100,
				currentStep: "完了",
				partialQuiz: quiz,
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
	 * Get system prompt for quiz generation
	 */
	private getSystemPrompt(): string {
		return `あなたは技術力診断の専門家です。
開発者の技術レベルを正確に測定するための診断クイズを作成してください。
問題は実務で本当に役立つ知識を問うものにしてください。
出力は必ず指定されたJSON形式で返してください。`
	}

	/**
	 * Build user prompt for AI
	 */
	private buildPrompt(technologies: string[], projectContext: string): string {
		const contextSection = projectContext
			? `
## プロジェクトコンテキスト
${projectContext}
`
			: ""

		return `以下の技術に関する診断クイズを生成してください。

## 対象技術
${technologies.join(", ")}
${contextSection}
## 要件
1. 合計5問を生成
2. 各技術から最低1問ずつ出題（技術数が5より多い場合は重要な技術を優先）
3. 難易度を段階的に上げる：
   - 1-2問目: beginner（基礎的な概念）
   - 3-4問目: intermediate（実践的な知識）
   - 5問目: advanced（応用・ベストプラクティス）
4. 各問題に4つの選択肢（A, B, C, D）を設定
5. 実務で役立つ知識を問う（トリビアは避ける）
6. 各問題に簡潔な解説を付ける

## 出力形式
以下のJSON形式で出力してください。JSONは必ず\`\`\`json と \`\`\` で囲んでください：

\`\`\`json
{
  "questions": [
    {
      "technology": "React",
      "difficulty": "beginner",
      "questionText": "問題文をここに記載",
      "choices": [
        { "id": "A", "text": "選択肢Aのテキスト", "isCorrect": false },
        { "id": "B", "text": "選択肢Bのテキスト", "isCorrect": true },
        { "id": "C", "text": "選択肢Cのテキスト", "isCorrect": false },
        { "id": "D", "text": "選択肢Dのテキスト", "isCorrect": false }
      ],
      "explanation": "正解はBです。理由は..."
    }
  ]
}
\`\`\`

## 注意事項
- 正解は1つだけ設定してください
- 選択肢は紛らわしすぎず、かつ明確な違いがあるものにしてください
- 解説は2-3文で簡潔に記載してください`
	}

	/**
	 * Parse AI response and extract quiz data
	 */
	private parseResponse(response: string, targetTechnologies: string[]): QuizData {
		// Extract JSON block
		const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
		if (!jsonMatch) {
			throw new Error("JSONブロックが見つかりません")
		}

		const parsed = JSON.parse(jsonMatch[1])
		const now = new Date().toISOString()

		if (!parsed.questions || !Array.isArray(parsed.questions)) {
			throw new Error("問題リストが見つかりません")
		}

		const questions: QuizQuestionData[] = parsed.questions.map((q: any, idx: number) => {
			const choices: QuizChoiceData[] = (q.choices || []).map((c: any) => ({
				id: c.id || "",
				text: c.text || "",
				isCorrect: c.isCorrect === true,
			}))

			// Validate that exactly one choice is correct
			const correctCount = choices.filter((c) => c.isCorrect).length
			if (correctCount !== 1) {
				// Fix by making the first choice correct if none are, or keeping only the first correct one
				if (correctCount === 0 && choices.length > 0) {
					choices[0].isCorrect = true
				} else if (correctCount > 1) {
					let foundFirst = false
					for (const choice of choices) {
						if (choice.isCorrect) {
							if (foundFirst) {
								choice.isCorrect = false
							} else {
								foundFirst = true
							}
						}
					}
				}
			}

			return {
				id: uuidv4(),
				questionNumber: idx + 1,
				technology: q.technology || targetTechnologies[0] || "General",
				difficulty: this.validateDifficulty(q.difficulty),
				questionText: q.questionText || "",
				choices,
				explanation: q.explanation || "",
			}
		})

		// Ensure we have exactly 5 questions
		while (questions.length < 5) {
			questions.push(this.createPlaceholderQuestion(questions.length + 1, targetTechnologies))
		}

		return {
			id: uuidv4(),
			questions: questions.slice(0, 5),
			targetTechnologies,
			createdAt: now,
		}
	}

	/**
	 * Validate and normalize difficulty level
	 */
	private validateDifficulty(difficulty: string): QuizDifficulty {
		const validDifficulties: QuizDifficulty[] = ["beginner", "intermediate", "advanced"]
		if (validDifficulties.includes(difficulty as QuizDifficulty)) {
			return difficulty as QuizDifficulty
		}
		return "intermediate"
	}

	/**
	 * Create a placeholder question if AI generates fewer than 5
	 */
	private createPlaceholderQuestion(questionNumber: number, technologies: string[]): QuizQuestionData {
		const tech = technologies[questionNumber % technologies.length] || "General"
		return {
			id: uuidv4(),
			questionNumber,
			technology: tech,
			difficulty: questionNumber <= 2 ? "beginner" : questionNumber <= 4 ? "intermediate" : "advanced",
			questionText: `${tech}に関する質問${questionNumber}`,
			choices: [
				{ id: "A", text: "選択肢A", isCorrect: true },
				{ id: "B", text: "選択肢B", isCorrect: false },
				{ id: "C", text: "選択肢C", isCorrect: false },
				{ id: "D", text: "選択肢D", isCorrect: false },
			],
			explanation: "この問題は自動生成されたプレースホルダーです。",
		}
	}
}
