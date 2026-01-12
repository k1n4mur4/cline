import { Empty } from "@shared/proto/cline/common"
import { InitEnvironmentRequest } from "@shared/proto/cline/learning"
import { OnboardingEnvironmentManager } from "@core/learning"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Initializes the onboarding environment
 * Creates .onboarding directory with necessary files
 */
export async function initEnvironment(controller: Controller, request: InitEnvironmentRequest): Promise<Empty> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[initEnvironment] No workspace path available")
			return Empty.create({})
		}

		const envManager = new OnboardingEnvironmentManager(workspacePath)

		if (await envManager.environmentExists()) {
			console.log("[initEnvironment] Environment already exists")
			return Empty.create({})
		}

		await envManager.initializeEnvironment()
		console.log("[initEnvironment] Environment initialized successfully")

		return Empty.create({})
	} catch (error) {
		console.error("[initEnvironment] Error initializing environment:", error)
		return Empty.create({})
	}
}
