import * as fs from "fs/promises"
import * as path from "path"

interface PackageJson {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

/**
 * Detects the technology stack used in a project
 */
export class TechStackDetector {
	private workspacePath: string

	// Known technology patterns
	private static readonly TECH_PATTERNS: Record<string, string[]> = {
		TypeScript: ["typescript"],
		JavaScript: [], // Detected by file extension or package.json presence
		React: ["react", "react-dom"],
		Vue: ["vue"],
		Angular: ["@angular/core"],
		Svelte: ["svelte"],
		"Next.js": ["next"],
		"Nuxt.js": ["nuxt"],
		"Node.js": ["express", "fastify", "koa", "hapi"],
		NestJS: ["@nestjs/core"],
		Python: [], // Detected by requirements.txt or pyproject.toml
		Django: ["django"],
		Flask: ["flask"],
		FastAPI: ["fastapi"],
		Go: [], // Detected by go.mod
		Rust: [], // Detected by Cargo.toml
		Java: [], // Detected by pom.xml or build.gradle
		Spring: ["spring-boot"],
		Kotlin: [], // Detected by build.gradle.kts
		Docker: [], // Detected by Dockerfile
		PostgreSQL: ["pg", "postgres", "postgresql"],
		MySQL: ["mysql", "mysql2"],
		MongoDB: ["mongodb", "mongoose"],
		Redis: ["redis", "ioredis"],
		GraphQL: ["graphql", "apollo-server", "@apollo/client"],
		Prisma: ["prisma", "@prisma/client"],
		Tailwind: ["tailwindcss"],
		"Styled Components": ["styled-components"],
		Jest: ["jest"],
		Vitest: ["vitest"],
		Mocha: ["mocha"],
		Webpack: ["webpack"],
		Vite: ["vite"],
		esbuild: ["esbuild"],
	}

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Detect all technologies used in the project
	 */
	async detectTechnologies(): Promise<string[]> {
		const technologies = new Set<string>()

		// Check package.json for Node.js/JavaScript projects
		await this.detectFromPackageJson(technologies)

		// Check for language-specific files
		await this.detectFromFiles(technologies)

		return Array.from(technologies).sort()
	}

	/**
	 * Detect technologies from package.json
	 */
	private async detectFromPackageJson(technologies: Set<string>): Promise<void> {
		const packageJsonPath = path.join(this.workspacePath, "package.json")

		try {
			const content = await fs.readFile(packageJsonPath, "utf-8")
			const packageJson: PackageJson = JSON.parse(content)

			const allDeps = {
				...packageJson.dependencies,
				...packageJson.devDependencies,
			}

			// Add JavaScript by default if package.json exists
			technologies.add("JavaScript")

			// Check for each technology pattern
			for (const [tech, patterns] of Object.entries(TechStackDetector.TECH_PATTERNS)) {
				for (const pattern of patterns) {
					if (allDeps[pattern]) {
						technologies.add(tech)
						break
					}
				}
			}
		} catch {
			// package.json doesn't exist or is invalid
		}
	}

	/**
	 * Detect technologies from file presence
	 */
	private async detectFromFiles(technologies: Set<string>): Promise<void> {
		const fileChecks: Array<{ file: string; tech: string }> = [
			{ file: "tsconfig.json", tech: "TypeScript" },
			{ file: "requirements.txt", tech: "Python" },
			{ file: "pyproject.toml", tech: "Python" },
			{ file: "go.mod", tech: "Go" },
			{ file: "Cargo.toml", tech: "Rust" },
			{ file: "pom.xml", tech: "Java" },
			{ file: "build.gradle", tech: "Java" },
			{ file: "build.gradle.kts", tech: "Kotlin" },
			{ file: "Dockerfile", tech: "Docker" },
			{ file: "docker-compose.yml", tech: "Docker" },
			{ file: "docker-compose.yaml", tech: "Docker" },
			{ file: ".dockerignore", tech: "Docker" },
		]

		for (const check of fileChecks) {
			const filePath = path.join(this.workspacePath, check.file)
			try {
				await fs.access(filePath)
				technologies.add(check.tech)
			} catch {
				// File doesn't exist
			}
		}
	}

	/**
	 * Get a brief summary of the detected tech stack
	 */
	async getTechStackSummary(): Promise<string> {
		const technologies = await this.detectTechnologies()

		if (technologies.length === 0) {
			return "No technologies detected"
		}

		return technologies.join(", ")
	}
}
