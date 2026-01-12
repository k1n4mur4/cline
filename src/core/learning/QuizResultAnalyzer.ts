import type {
	QuizData,
	QuizAnswerData,
	QuizResultData,
	ProficiencyLevel,
	OverallLevel,
} from "./types"
import { UserProfile } from "../../shared/proto/cline/learning"

/**
 * Analyzes quiz results and determines proficiency levels
 */
export class QuizResultAnalyzer {
	/**
	 * Analyze quiz answers and generate result
	 */
	analyze(quiz: QuizData, answers: QuizAnswerData[]): QuizResultData {
		// Calculate proficiency per technology
		const proficiencyLevels = this.calculateProficiencyLevels(quiz, answers)

		// Calculate overall score
		const overallScore = this.calculateOverallScore(answers)

		// Determine overall level
		const overallLevel = this.determineOverallLevel(overallScore)

		return {
			quizId: quiz.id,
			answers,
			proficiencyLevels,
			overallLevel,
			overallScore,
			completedAt: new Date().toISOString(),
		}
	}

	/**
	 * Calculate proficiency level for each technology
	 */
	private calculateProficiencyLevels(
		quiz: QuizData,
		answers: QuizAnswerData[],
	): Record<string, ProficiencyLevel> {
		// Group questions by technology
		const techQuestions: Record<string, { total: number; correct: number }> = {}

		for (const question of quiz.questions) {
			const tech = question.technology
			if (!techQuestions[tech]) {
				techQuestions[tech] = { total: 0, correct: 0 }
			}
			techQuestions[tech].total++

			const answer = answers.find((a) => a.questionId === question.id)
			if (answer?.isCorrect) {
				techQuestions[tech].correct++
			}
		}

		// Convert to proficiency levels
		const proficiencyLevels: Record<string, ProficiencyLevel> = {}

		for (const [tech, stats] of Object.entries(techQuestions)) {
			const ratio = stats.correct / stats.total
			proficiencyLevels[tech] = this.ratioToProficiency(ratio)
		}

		return proficiencyLevels
	}

	/**
	 * Convert correct answer ratio to proficiency level
	 */
	private ratioToProficiency(ratio: number): ProficiencyLevel {
		if (ratio >= 0.9) {
			return "expert"
		} else if (ratio >= 0.6) {
			return "practical"
		} else if (ratio >= 0.3) {
			return "basic"
		} else {
			return "no_experience"
		}
	}

	/**
	 * Calculate overall score (0.0 - 1.0)
	 */
	private calculateOverallScore(answers: QuizAnswerData[]): number {
		if (answers.length === 0) {
			return 0
		}

		const correctCount = answers.filter((a) => a.isCorrect).length
		return correctCount / answers.length
	}

	/**
	 * Determine overall level from score
	 */
	private determineOverallLevel(score: number): OverallLevel {
		if (score >= 0.7) {
			return "advanced"
		} else if (score >= 0.4) {
			return "intermediate"
		} else {
			return "beginner"
		}
	}

	/**
	 * Generate a suggested user profile based on quiz results
	 */
	generateSuggestedProfile(result: QuizResultData): UserProfile {
		// Determine experience level from overall level
		const experienceLevel = this.overallLevelToExperience(result.overallLevel)

		// Determine primary role from technologies (simple heuristic)
		const primaryRole = this.determinePrimaryRole(Object.keys(result.proficiencyLevels))

		return UserProfile.create({
			experienceLevel,
			primaryRole,
			techStackProficiency: result.proficiencyLevels,
			learningGoal: "overview", // Default
			learningStyle: "hands_on", // Default
		})
	}

	/**
	 * Convert overall level to experience level
	 */
	private overallLevelToExperience(level: OverallLevel): string {
		switch (level) {
			case "advanced":
				return "3_to_5_years"
			case "intermediate":
				return "1_to_3_years"
			case "beginner":
			default:
				return "less_than_1_year"
		}
	}

	/**
	 * Determine primary role from technologies
	 */
	private determinePrimaryRole(technologies: string[]): string {
		const lowerTechs = technologies.map((t) => t.toLowerCase())

		// Check for frontend technologies
		const frontendTechs = ["react", "vue", "angular", "nextjs", "svelte", "css", "html"]
		const hasFrontend = frontendTechs.some((t) => lowerTechs.some((lt) => lt.includes(t)))

		// Check for backend technologies
		const backendTechs = ["node", "python", "go", "java", "rust", "django", "express", "spring"]
		const hasBackend = backendTechs.some((t) => lowerTechs.some((lt) => lt.includes(t)))

		// Check for mobile technologies
		const mobileTechs = ["react native", "flutter", "swift", "kotlin", "ios", "android"]
		const hasMobile = mobileTechs.some((t) => lowerTechs.some((lt) => lt.includes(t)))

		// Check for DevOps technologies
		const devopsTechs = ["docker", "kubernetes", "aws", "gcp", "azure", "terraform", "ci/cd"]
		const hasDevOps = devopsTechs.some((t) => lowerTechs.some((lt) => lt.includes(t)))

		if (hasFrontend && hasBackend) {
			return "fullstack"
		} else if (hasFrontend) {
			return "frontend"
		} else if (hasBackend) {
			return "backend"
		} else if (hasMobile) {
			return "mobile"
		} else if (hasDevOps) {
			return "devops"
		} else {
			return "other"
		}
	}

	/**
	 * Get human-readable proficiency level
	 */
	static getProficiencyLabel(level: ProficiencyLevel): string {
		switch (level) {
			case "expert":
				return "エキスパート"
			case "practical":
				return "実践レベル"
			case "basic":
				return "基礎レベル"
			case "no_experience":
			default:
				return "未経験"
		}
	}

	/**
	 * Get human-readable overall level
	 */
	static getOverallLevelLabel(level: OverallLevel): string {
		switch (level) {
			case "advanced":
				return "上級者"
			case "intermediate":
				return "中級者"
			case "beginner":
			default:
				return "初級者"
		}
	}
}
