import { Empty } from "@shared/proto/cline/common"
import { SaveProfileRequest } from "@shared/proto/cline/learning"
import { UserProfileManager } from "@core/learning"
import { OnboardingEnvironmentManager } from "@core/learning"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Saves the user's learning profile
 * Also initializes the onboarding environment if it doesn't exist
 */
export async function saveProfile(controller: Controller, request: SaveProfileRequest): Promise<Empty> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[saveProfile] No workspace path available")
			return Empty.create({})
		}

		if (!request.profile) {
			console.error("[saveProfile] No profile provided in request")
			return Empty.create({})
		}

		// Initialize environment if needed
		const envManager = new OnboardingEnvironmentManager(workspacePath)
		if (!(await envManager.environmentExists())) {
			await envManager.initializeEnvironment()
		}

		// Save profile
		const profileManager = new UserProfileManager(workspacePath)
		await profileManager.saveProfile(request.profile)

		console.log("[saveProfile] Profile saved successfully")
		return Empty.create({})
	} catch (error) {
		console.error("[saveProfile] Error saving profile:", error)
		return Empty.create({})
	}
}
