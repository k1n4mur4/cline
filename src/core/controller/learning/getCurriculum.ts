import { GetCurriculumRequest, GetCurriculumResponse } from "@shared/proto/cline/learning"
import { CurriculumManager } from "@core/learning/CurriculumManager"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Gets the curriculum for the current project
 */
export async function getCurriculum(controller: Controller, request: GetCurriculumRequest): Promise<GetCurriculumResponse> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[getCurriculum] No workspace path available")
			return GetCurriculumResponse.create({
				exists: false,
				curriculum: undefined,
			})
		}

		const curriculumManager = new CurriculumManager(workspacePath)
		const { exists, curriculum } = await curriculumManager.loadCurriculum()

		if (exists && curriculum) {
			return GetCurriculumResponse.create({
				exists: true,
				curriculum: curriculumManager.toProto(curriculum),
			})
		}

		return GetCurriculumResponse.create({
			exists: false,
			curriculum: undefined,
		})
	} catch (error) {
		console.error("[getCurriculum] Error getting curriculum:", error)
		return GetCurriculumResponse.create({
			exists: false,
			curriculum: undefined,
		})
	}
}
