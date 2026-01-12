import { GetAvailableTechnologiesRequest, GetAvailableTechnologiesResponse } from "@shared/proto/cline/learning"
import { TechStackDetector } from "@core/learning"
import { TECHNOLOGY_CATEGORIES } from "@core/learning/types"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Gets available technologies for quiz
 * Returns both auto-detected technologies (if project exists) and predefined list
 */
export async function getAvailableTechnologies(
	controller: Controller,
	request: GetAvailableTechnologiesRequest,
): Promise<GetAvailableTechnologiesResponse> {
	try {
		const workspacePath = await getCwd()

		// Get all predefined technologies
		const allTechnologies: string[] = []
		for (const category of Object.values(TECHNOLOGY_CATEGORIES)) {
			for (const tech of category) {
				if (!allTechnologies.includes(tech.name)) {
					allTechnologies.push(tech.name)
				}
			}
		}

		// Try to detect technologies from project
		let detectedTechnologies: string[] = []
		let hasProject = false

		if (workspacePath) {
			const detector = new TechStackDetector(workspacePath)
			detectedTechnologies = await detector.detectTechnologies()
			hasProject = detectedTechnologies.length > 0
		}

		console.log("[getAvailableTechnologies] Available:", allTechnologies.length, "Detected:", detectedTechnologies)

		return GetAvailableTechnologiesResponse.create({
			technologies: allTechnologies,
			hasProject,
			detectedTechnologies,
		})
	} catch (error) {
		console.error("[getAvailableTechnologies] Error:", error)
		return GetAvailableTechnologiesResponse.create({
			technologies: [],
			hasProject: false,
			detectedTechnologies: [],
		})
	}
}
