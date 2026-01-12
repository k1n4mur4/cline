import * as fs from "fs/promises"
import * as path from "path"
import { OnboardingEnvironmentManager } from "./OnboardingEnvironmentManager"
import type { QuizData, QuizAnswerData, QuizResultData } from "./types"
import { Quiz, QuizQuestion, QuizChoice, QuizAnswer, QuizResult } from "../../shared/proto/cline/learning"

const QUIZ_FILENAME = "quiz.json"
const QUIZ_ANSWERS_FILENAME = "quiz-answers.json"
const QUIZ_RESULT_FILENAME = "quiz-result.json"

/**
 * Manages quiz state and persistence
 */
export class QuizManager {
	private workspacePath: string
	private envManager: OnboardingEnvironmentManager
	private currentAnswers: QuizAnswerData[] = []

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
		this.envManager = new OnboardingEnvironmentManager(workspacePath)
	}

	/**
	 * Ensure onboarding directory exists
	 */
	private async ensureOnboardingDir(): Promise<void> {
		const onboardingPath = path.join(this.workspacePath, ".onboarding")
		await fs.mkdir(onboardingPath, { recursive: true })
	}

	/**
	 * Save quiz to file
	 */
	async saveQuiz(quiz: QuizData): Promise<void> {
		await this.ensureOnboardingDir()
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_FILENAME)
		await fs.writeFile(filePath, JSON.stringify(quiz, null, 2), "utf-8")
		// Reset answers when saving a new quiz
		await this.clearAnswers()
	}

	/**
	 * Load quiz from file
	 */
	async loadQuiz(): Promise<{ exists: boolean; quiz?: QuizData }> {
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_FILENAME)
		try {
			await fs.access(filePath)
			const content = await fs.readFile(filePath, "utf-8")
			return { exists: true, quiz: JSON.parse(content) }
		} catch {
			return { exists: false }
		}
	}

	/**
	 * Save answers to file
	 */
	private async saveAnswers(): Promise<void> {
		await this.ensureOnboardingDir()
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_ANSWERS_FILENAME)
		await fs.writeFile(filePath, JSON.stringify(this.currentAnswers, null, 2), "utf-8")
	}

	/**
	 * Load answers from file
	 */
	async loadAnswers(): Promise<void> {
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_ANSWERS_FILENAME)
		try {
			await fs.access(filePath)
			const content = await fs.readFile(filePath, "utf-8")
			this.currentAnswers = JSON.parse(content)
		} catch {
			this.currentAnswers = []
		}
	}

	/**
	 * Record an answer to a question
	 */
	async recordAnswer(answer: QuizAnswerData): Promise<void> {
		// Load latest answers first to ensure we have the current state
		await this.loadAnswers()

		// Replace existing answer for the same question
		const existingIndex = this.currentAnswers.findIndex((a) => a.questionId === answer.questionId)
		if (existingIndex >= 0) {
			this.currentAnswers[existingIndex] = answer
		} else {
			this.currentAnswers.push(answer)
		}

		await this.saveAnswers()
	}

	/**
	 * Get all recorded answers
	 */
	async getAnswers(): Promise<QuizAnswerData[]> {
		await this.loadAnswers()
		return [...this.currentAnswers]
	}

	/**
	 * Clear all recorded answers
	 */
	async clearAnswers(): Promise<void> {
		this.currentAnswers = []
		// Try to delete the file
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_ANSWERS_FILENAME)
		try {
			await fs.unlink(filePath)
		} catch {
			// Ignore if file doesn't exist
		}
	}

	/**
	 * Check if a question was answered correctly
	 */
	async checkAnswer(quizId: string, questionId: string, selectedChoiceId: string): Promise<{
		isCorrect: boolean
		correctChoiceId: string
		explanation: string
	}> {
		const { exists, quiz } = await this.loadQuiz()
		if (!exists || !quiz || quiz.id !== quizId) {
			throw new Error("Quiz not found")
		}

		const question = quiz.questions.find((q) => q.id === questionId)
		if (!question) {
			throw new Error("Question not found")
		}

		const correctChoice = question.choices.find((c) => c.isCorrect)
		const isCorrect = correctChoice?.id === selectedChoiceId

		return {
			isCorrect,
			correctChoiceId: correctChoice?.id || "",
			explanation: question.explanation,
		}
	}

	/**
	 * Save quiz result to file
	 */
	async saveResult(result: QuizResultData): Promise<void> {
		await this.ensureOnboardingDir()
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_RESULT_FILENAME)
		await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf-8")
	}

	/**
	 * Load quiz result from file
	 */
	async loadResult(): Promise<{ exists: boolean; result?: QuizResultData }> {
		const filePath = path.join(this.workspacePath, ".onboarding", QUIZ_RESULT_FILENAME)
		try {
			await fs.access(filePath)
			const content = await fs.readFile(filePath, "utf-8")
			return { exists: true, result: JSON.parse(content) }
		} catch {
			return { exists: false }
		}
	}

	/**
	 * Delete quiz and result files
	 */
	async deleteQuiz(): Promise<void> {
		const quizPath = path.join(this.workspacePath, ".onboarding", QUIZ_FILENAME)
		const resultPath = path.join(this.workspacePath, ".onboarding", QUIZ_RESULT_FILENAME)

		try {
			await fs.unlink(quizPath)
		} catch {
			// File doesn't exist, ignore
		}

		try {
			await fs.unlink(resultPath)
		} catch {
			// File doesn't exist, ignore
		}

		await this.clearAnswers()
	}

	/**
	 * Convert internal QuizData to Proto Quiz
	 */
	toProto(data: QuizData): Quiz {
		return Quiz.create({
			id: data.id,
			questions: data.questions.map((q) => this.questionToProto(q)),
			targetTechnologies: data.targetTechnologies,
			createdAt: data.createdAt,
		})
	}

	/**
	 * Convert internal QuizQuestionData to Proto QuizQuestion
	 */
	private questionToProto(q: QuizData["questions"][0]): QuizQuestion {
		return QuizQuestion.create({
			id: q.id,
			questionNumber: q.questionNumber,
			technology: q.technology,
			difficulty: q.difficulty,
			questionText: q.questionText,
			choices: q.choices.map((c) => this.choiceToProto(c)),
			explanation: q.explanation,
		})
	}

	/**
	 * Convert internal QuizChoiceData to Proto QuizChoice
	 * Note: isCorrect is set to false for client-side to prevent cheating
	 */
	private choiceToProto(c: QuizData["questions"][0]["choices"][0], hideCorrect: boolean = true): QuizChoice {
		return QuizChoice.create({
			id: c.id,
			text: c.text,
			isCorrect: hideCorrect ? false : c.isCorrect,
		})
	}

	/**
	 * Convert Proto Quiz to internal QuizData
	 */
	fromProto(proto: Quiz): QuizData {
		return {
			id: proto.id,
			questions: proto.questions.map((q) => ({
				id: q.id,
				questionNumber: q.questionNumber,
				technology: q.technology,
				difficulty: q.difficulty as "beginner" | "intermediate" | "advanced",
				questionText: q.questionText,
				choices: q.choices.map((c) => ({
					id: c.id,
					text: c.text,
					isCorrect: c.isCorrect,
				})),
				explanation: q.explanation,
			})),
			targetTechnologies: [...proto.targetTechnologies],
			createdAt: proto.createdAt,
		}
	}

	/**
	 * Convert internal QuizResultData to Proto QuizResult
	 */
	resultToProto(data: QuizResultData): QuizResult {
		return QuizResult.create({
			quizId: data.quizId,
			answers: data.answers.map((a) => this.answerToProto(a)),
			proficiencyLevels: data.proficiencyLevels,
			overallLevel: data.overallLevel,
			overallScore: data.overallScore,
			completedAt: data.completedAt,
		})
	}

	/**
	 * Convert internal QuizAnswerData to Proto QuizAnswer
	 */
	private answerToProto(a: QuizAnswerData): QuizAnswer {
		return QuizAnswer.create({
			questionId: a.questionId,
			selectedChoiceId: a.selectedChoiceId,
			isCorrect: a.isCorrect,
			timeSpentSeconds: a.timeSpentSeconds,
		})
	}
}