import { GetProfileRequest, GetProfileResponse, UserProfile } from "@shared/proto/cline/learning"
import { UserProfileManager } from "@core/learning"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Gets the user's learning profile
 */
export async function getProfile(controller: Controller, request: GetProfileRequest): Promise<GetProfileResponse> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[getProfile] No workspace path available")
			return GetProfileResponse.create({
				exists: false,
				profile: undefined,
			})
		}

		const profileManager = new UserProfileManager(workspacePath)
		const profile = await profileManager.loadProfile()

		if (profile) {
			return GetProfileResponse.create({
				exists: true,
				profile: profile,
			})
		}

		return GetProfileResponse.create({
			exists: false,
			profile: undefined,
		})
	} catch (error) {
		console.error("[getProfile] Error getting profile:", error)
		return GetProfileResponse.create({
			exists: false,
			profile: undefined,
		})
	}
}
