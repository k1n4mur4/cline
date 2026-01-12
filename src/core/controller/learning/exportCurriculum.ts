import { CurriculumManager, LearningStatisticsManager, CurriculumExporter } from "@core/learning"
import { getCwd } from "@utils/path"
import type { Controller } from "../index"
import type { ExportCurriculumRequest, ExportCurriculumResponse } from "@shared/proto/cline/learning"
import { ExportCurriculumResponse as ExportCurriculumResponseProto } from "@shared/proto/cline/learning"

/**
 * Export curriculum to Markdown or JSON format
 */
export async function exportCurriculum(
	_controller: Controller,
	request: ExportCurriculumRequest,
): Promise<ExportCurriculumResponse> {
	try {
		const workspacePath = await getCwd()
		const curriculumManager = new CurriculumManager(workspacePath)
		const statisticsManager = new LearningStatisticsManager(workspacePath)
		const exporter = new CurriculumExporter()

		// Load curriculum
		const { exists: curriculumExists, curriculum } = await curriculumManager.loadCurriculum()

		if (!curriculumExists || !curriculum) {
			return ExportCurriculumResponseProto.create({
				success: false,
				errorMessage: "カリキュラムが見つかりません。先にカリキュラムを生成してください。",
			})
		}

		// Load statistics if requested
		let statistics = undefined
		if (request.includeStatistics) {
			statistics = await statisticsManager.getOrCreateStatistics(curriculum)
		}

		// Determine format
		const format = request.format === "json" ? "json" : "markdown"

		// Generate content
		let content: string
		if (format === "json") {
			content = exporter.exportAsJson(curriculum, statistics, true)
		} else {
			content = exporter.exportAsMarkdown(curriculum, statistics)
		}

		// Get suggested filename
		const suggestedFilename = exporter.getSuggestedFilename(curriculum, format)

		return ExportCurriculumResponseProto.create({
			success: true,
			content,
			suggestedFilename,
		})
	} catch (error) {
		console.error("[exportCurriculum] Error:", error)
		return ExportCurriculumResponseProto.create({
			success: false,
			errorMessage: error instanceof Error ? error.message : "エクスポート中にエラーが発生しました",
		})
	}
}
