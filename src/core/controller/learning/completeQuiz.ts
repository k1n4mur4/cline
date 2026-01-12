import { CompleteQuizRequest, CompleteQuizResponse, UserProfile } from "@shared/proto/cline/learning"
import { QuizManager } from "@core/learning/QuizManager"
import { QuizResultAnalyzer } from "@core/learning/QuizResultAnalyzer"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Completes the quiz and returns results with suggested profile
 */
export async function completeQuiz(controller: Controller, request: CompleteQuizRequest): Promise<CompleteQuizResponse> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[completeQuiz] No workspace path available")
			return CompleteQuizResponse.create({
				result: undefined,
				suggestedProfile: undefined,
			})
		}

		const quizManager = new QuizManager(workspacePath)
		const analyzer = new QuizResultAnalyzer()

		// Load the quiz
		const { exists, quiz } = await quizManager.loadQuiz()
		if (!exists || !quiz) {
			console.error("[completeQuiz] Quiz not found")
			return CompleteQuizResponse.create({
				result: undefined,
				suggestedProfile: undefined,
			})
		}

		// Get all recorded answers
		const answers = await quizManager.getAnswers()
		if (answers.length === 0) {
			console.error("[completeQuiz] No answers recorded")
			return CompleteQuizResponse.create({
				result: undefined,
				suggestedProfile: undefined,
			})
		}

		// Analyze results
		const resultData = analyzer.analyze(quiz, answers)

		// Save result
		await quizManager.saveResult(resultData)

		// Generate suggested profile
		const suggestedProfileData = analyzer.generateSuggestedProfile(resultData)

		// Convert to proto
		const result = quizManager.resultToProto(resultData)
		const suggestedProfile = UserProfile.create({
			experienceLevel: suggestedProfileData.experienceLevel,
			primaryRole: suggestedProfileData.primaryRole,
			techStackProficiency: suggestedProfileData.techStackProficiency,
			learningGoal: suggestedProfileData.learningGoal,
			learningStyle: suggestedProfileData.learningStyle,
		})

		console.log("[completeQuiz] Quiz completed. Overall level:", resultData.overallLevel, "Score:", resultData.overallScore)

		return CompleteQuizResponse.create({
			result,
			suggestedProfile,
		})
	} catch (error) {
		console.error("[completeQuiz] Error completing quiz:", error)
		return CompleteQuizResponse.create({
			result: undefined,
			suggestedProfile: undefined,
		})
	}
}
