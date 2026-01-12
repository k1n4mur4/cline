import { GenerateQuizRequest, QuizGenerationProgress } from "@shared/proto/cline/learning"
import { QuizGenerator } from "@core/learning/QuizGenerator"
import { QuizManager } from "@core/learning/QuizManager"
import { Controller } from ".."
import { getCwd } from "@/utils/path"
import { StreamingResponseHandler, getRequestRegistry } from "../grpc-handler"

/**
 * Generates a quiz based on selected technologies
 * This is a streaming RPC that sends progress updates
 */
export async function generateQuiz(
	controller: Controller,
	request: GenerateQuizRequest,
	responseStream: StreamingResponseHandler<QuizGenerationProgress>,
	requestId?: string,
): Promise<void> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			await responseStream(
				QuizGenerationProgress.create({
					phase: "error",
					progressPercent: 0,
					currentStep: "ワークスペースパスが見つかりません",
					errorMessage: "No workspace path available",
				}),
				true,
			)
			return
		}

		// Get API configuration from controller
		const apiConfig = controller.stateManager.getApiConfiguration()
		if (!apiConfig) {
			await responseStream(
				QuizGenerationProgress.create({
					phase: "error",
					progressPercent: 0,
					currentStep: "API設定が見つかりません",
					errorMessage: "No API configuration available",
				}),
				true,
			)
			return
		}

		// Create generator and manager
		const generator = new QuizGenerator(workspacePath, apiConfig)
		const quizManager = new QuizManager(workspacePath)

		// Register cleanup if request is cancelled
		if (requestId) {
			getRequestRegistry().registerRequest(
				requestId,
				() => {
					console.log("[generateQuiz] Request cancelled")
				},
				{ type: "quiz_generation" },
				responseStream,
			)
		}

		// Get target technologies from request or auto-detect
		const targetTechnologies = request.technologies || []
		const useProjectContext = request.useProjectContext || false

		// Generate quiz with progress updates
		for await (const progress of generator.generate(targetTechnologies, useProjectContext)) {
			const protoProgress = QuizGenerationProgress.create({
				phase: progress.phase,
				progressPercent: progress.progressPercent,
				currentStep: progress.currentStep,
				partialQuiz: progress.partialQuiz ? quizManager.toProto(progress.partialQuiz) : undefined,
				errorMessage: progress.error,
			})

			const isLast = progress.phase === "completed" || progress.phase === "error"

			// Save quiz when completed
			if (progress.phase === "completed" && progress.partialQuiz) {
				await quizManager.saveQuiz(progress.partialQuiz)
			}

			await responseStream(protoProgress, isLast)

			if (isLast) {
				break
			}
		}
	} catch (error) {
		console.error("[generateQuiz] Error generating quiz:", error)
		await responseStream(
			QuizGenerationProgress.create({
				phase: "error",
				progressPercent: 0,
				currentStep: "エラーが発生しました",
				errorMessage: error instanceof Error ? error.message : String(error),
			}),
			true,
		)
	}
}
