import * as fs from "fs/promises"
import * as path from "path"

/**
 * Manages the onboarding environment
 * Creates and maintains the .onboarding directory structure
 */
export class OnboardingEnvironmentManager {
	private workspacePath: string
	private onboardingDir = ".onboarding"

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Get the path to the onboarding directory
	 */
	getOnboardingPath(): string {
		return path.join(this.workspacePath, this.onboardingDir)
	}

	/**
	 * Initialize the onboarding environment
	 * Creates .onboarding directory with necessary files
	 */
	async initializeEnvironment(): Promise<void> {
		const onboardingPath = this.getOnboardingPath()

		// Create .onboarding directory
		await fs.mkdir(onboardingPath, { recursive: true })

		// Create .gitignore
		await this.createGitignore()

		// Create README.md
		await this.createReadme()
	}

	/**
	 * Create .gitignore file to exclude personal data
	 */
	private async createGitignore(): Promise<void> {
		const gitignorePath = path.join(this.getOnboardingPath(), ".gitignore")
		const gitignoreContent = `# Onboarding personal data - do not commit
user_profile.json
user_progress.json

# Generated files
*.log
`

		await fs.writeFile(gitignorePath, gitignoreContent, "utf-8")
	}

	/**
	 * Create README.md explaining the onboarding directory
	 */
	private async createReadme(): Promise<void> {
		const readmePath = path.join(this.getOnboardingPath(), "README.md")
		const readmeContent = `# Onboarding Environment

This directory is used by the Cline Onboarding Assistant for learning activities.

## Contents

- \`user_profile.json\` - Your learning profile (not committed to git)
- \`user_progress.json\` - Your learning progress (not committed to git)

## Purpose

This sandbox environment allows you to practice coding exercises without affecting the main codebase.

## Note

Personal data files are excluded from git via \`.gitignore\`.
`

		await fs.writeFile(readmePath, readmeContent, "utf-8")
	}

	/**
	 * Check if the onboarding environment exists
	 */
	async environmentExists(): Promise<boolean> {
		const onboardingPath = this.getOnboardingPath()

		try {
			const stat = await fs.stat(onboardingPath)
			return stat.isDirectory()
		} catch {
			return false
		}
	}

	/**
	 * Clean up the onboarding environment
	 */
	async cleanup(): Promise<void> {
		const onboardingPath = this.getOnboardingPath()

		try {
			await fs.rm(onboardingPath, { recursive: true, force: true })
		} catch {
			// Directory doesn't exist, ignore
		}
	}
}
