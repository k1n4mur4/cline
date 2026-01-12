import { DetectTechStackRequest, DetectedTechStack } from "@shared/proto/cline/learning"
import { TechStackDetector } from "@core/learning"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Detects the tech stack used in the current project
 */
export async function detectTechStack(controller: Controller, request: DetectTechStackRequest): Promise<DetectedTechStack> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[detectTechStack] No workspace path available")
			return DetectedTechStack.create({
				technologies: [],
			})
		}

		const detector = new TechStackDetector(workspacePath)
		const technologies = await detector.detectTechnologies()

		console.log("[detectTechStack] Detected technologies:", technologies)

		return DetectedTechStack.create({
			technologies: technologies,
		})
	} catch (error) {
		console.error("[detectTechStack] Error detecting tech stack:", error)
		return DetectedTechStack.create({
			technologies: [],
		})
	}
}
