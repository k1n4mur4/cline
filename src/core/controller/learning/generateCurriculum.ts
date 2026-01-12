import { GenerateCurriculumRequest, CurriculumGenerationProgress } from "@shared/proto/cline/learning"
import { CurriculumManager } from "@core/learning/CurriculumManager"
import { CurriculumGenerator } from "@core/learning/CurriculumGenerator"
import { Controller } from ".."
import { getCwd } from "@/utils/path"
import { StreamingResponseHandler, getRequestRegistry } from "../grpc-handler"

/**
 * Generates a curriculum based on project analysis and user profile
 * This is a streaming RPC that sends progress updates
 */
export async function generateCurriculum(
	controller: Controller,
	request: GenerateCurriculumRequest,
	responseStream: StreamingResponseHandler<CurriculumGenerationProgress>,
	requestId?: string,
): Promise<void> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			await responseStream(
				CurriculumGenerationProgress.create({
					phase: "error",
					progressPercent: 0,
					currentStep: "ワークスペースパスが見つかりません",
					errorMessage: "No workspace path available",
				}),
				true,
			)
			return
		}

		// Check if we should delete existing curriculum
		const curriculumManager = new CurriculumManager(workspacePath)
		if (request.forceRegenerate) {
			await curriculumManager.deleteCurriculum()
		} else {
			// Check if curriculum already exists
			const exists = await curriculumManager.curriculumExists()
			if (exists) {
				const { curriculum } = await curriculumManager.loadCurriculum()
				if (curriculum) {
					await responseStream(
						CurriculumGenerationProgress.create({
							phase: "completed",
							progressPercent: 100,
							currentStep: "既存のカリキュラムを読み込みました",
							partialCurriculum: curriculumManager.toProto(curriculum),
						}),
						true,
					)
					return
				}
			}
		}

		// Get API configuration from controller
		const apiConfig = controller.stateManager.getApiConfiguration()
		if (!apiConfig) {
			await responseStream(
				CurriculumGenerationProgress.create({
					phase: "error",
					progressPercent: 0,
					currentStep: "API設定が見つかりません",
					errorMessage: "No API configuration available",
				}),
				true,
			)
			return
		}

		// Create generator
		const generator = new CurriculumGenerator(workspacePath, apiConfig)

		// Register cleanup if request is cancelled
		if (requestId) {
			getRequestRegistry().registerRequest(
				requestId,
				() => {
					console.log("[generateCurriculum] Request cancelled")
				},
				{ type: "curriculum_generation" },
				responseStream,
			)
		}

		// Generate curriculum with progress updates
		for await (const progress of generator.generate()) {
			const protoProgress = CurriculumGenerationProgress.create({
				phase: progress.phase,
				progressPercent: progress.progressPercent,
				currentStep: progress.currentStep,
				partialCurriculum: progress.partialCurriculum ? curriculumManager.toProto(progress.partialCurriculum) : undefined,
				errorMessage: progress.error,
			})

			const isLast = progress.phase === "completed" || progress.phase === "error"

			// Save curriculum when completed
			if (progress.phase === "completed" && progress.partialCurriculum) {
				await curriculumManager.saveCurriculum(progress.partialCurriculum)
			}

			await responseStream(protoProgress, isLast)

			if (isLast) {
				break
			}
		}
	} catch (error) {
		console.error("[generateCurriculum] Error generating curriculum:", error)
		await responseStream(
			CurriculumGenerationProgress.create({
				phase: "error",
				progressPercent: 0,
				currentStep: "エラーが発生しました",
				errorMessage: error instanceof Error ? error.message : String(error),
			}),
			true,
		)
	}
}
