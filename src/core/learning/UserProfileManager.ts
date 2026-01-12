import * as fs from "fs/promises"
import * as path from "path"
import { UserProfile } from "../../shared/proto/cline/learning"

export interface UserProfileData {
	experienceLevel: string
	primaryRole: string
	techStackProficiency: Record<string, string>
	learningGoal: string
	learningStyle: string
}

/**
 * Manages user learning profiles
 * Handles saving and loading profile data from the .onboarding directory
 */
export class UserProfileManager {
	private workspacePath: string
	private profileFileName = "user_profile.json"

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Get the path to the profile file
	 */
	private getProfilePath(): string {
		return path.join(this.workspacePath, ".onboarding", this.profileFileName)
	}

	/**
	 * Save user profile to disk
	 */
	async saveProfile(profile: UserProfile): Promise<void> {
		const profileData: UserProfileData = {
			experienceLevel: profile.experienceLevel,
			primaryRole: profile.primaryRole,
			techStackProficiency: profile.techStackProficiency,
			learningGoal: profile.learningGoal,
			learningStyle: profile.learningStyle,
		}

		const profilePath = this.getProfilePath()
		const dirPath = path.dirname(profilePath)

		// Ensure directory exists
		await fs.mkdir(dirPath, { recursive: true })

		// Write profile data
		await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2), "utf-8")
	}

	/**
	 * Load user profile from disk
	 * Returns null if profile doesn't exist
	 */
	async loadProfile(): Promise<UserProfile | null> {
		const profilePath = this.getProfilePath()

		try {
			const data = await fs.readFile(profilePath, "utf-8")
			const profileData: UserProfileData = JSON.parse(data)

			return UserProfile.create({
				experienceLevel: profileData.experienceLevel,
				primaryRole: profileData.primaryRole,
				techStackProficiency: profileData.techStackProficiency,
				learningGoal: profileData.learningGoal,
				learningStyle: profileData.learningStyle,
			})
		} catch {
			// Profile doesn't exist or is invalid
			return null
		}
	}

	/**
	 * Check if a profile exists
	 */
	async profileExists(): Promise<boolean> {
		const profilePath = this.getProfilePath()

		try {
			await fs.access(profilePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Delete user profile
	 */
	async deleteProfile(): Promise<void> {
		const profilePath = this.getProfilePath()

		try {
			await fs.unlink(profilePath)
		} catch {
			// Profile doesn't exist, ignore
		}
	}
}
