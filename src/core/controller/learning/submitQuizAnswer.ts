import { SubmitQuizAnswerRequest, SubmitQuizAnswerResponse } from "@shared/proto/cline/learning"
import { QuizManager } from "@core/learning/QuizManager"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Submits an answer to a quiz question and returns whether it was correct
 */
export async function submitQuizAnswer(
	controller: Controller,
	request: SubmitQuizAnswerRequest,
): Promise<SubmitQuizAnswerResponse> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[submitQuizAnswer] No workspace path available")
			return SubmitQuizAnswerResponse.create({
				isCorrect: false,
				correctChoiceId: "",
				explanation: "ワークスペースパスが見つかりません",
			})
		}

		const quizManager = new QuizManager(workspacePath)

		// Check the answer and get result
		const result = await quizManager.checkAnswer(request.quizId, request.questionId, request.selectedChoiceId)

		// Record the answer with time spent
		await quizManager.recordAnswer({
			questionId: request.questionId,
			selectedChoiceId: request.selectedChoiceId,
			isCorrect: result.isCorrect,
			timeSpentSeconds: request.timeSpentSeconds,
		})

		console.log("[submitQuizAnswer] Answer result:", result.isCorrect ? "correct" : "incorrect")

		return SubmitQuizAnswerResponse.create({
			isCorrect: result.isCorrect,
			correctChoiceId: result.correctChoiceId,
			explanation: result.explanation,
		})
	} catch (error) {
		console.error("[submitQuizAnswer] Error submitting answer:", error)
		return SubmitQuizAnswerResponse.create({
			isCorrect: false,
			correctChoiceId: "",
			explanation: error instanceof Error ? error.message : "エラーが発生しました",
		})
	}
}
