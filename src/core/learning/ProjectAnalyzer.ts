import * as fs from "fs/promises"
import * as path from "path"
import type { ProjectAnalysis, DirectoryNode, ArchitecturePattern, CodingConvention } from "./types"

// Directories to exclude from analysis
const EXCLUDED_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"__pycache__",
	".venv",
	"venv",
	".idea",
	".vscode",
	"coverage",
	".nyc_output",
	".onboarding",
]

const MAX_DEPTH = 4
const MAX_FILES_PER_DIR = 50
const MAX_TOTAL_FILES = 500

/**
 * Analyzes project structure and patterns for curriculum generation
 */
export class ProjectAnalyzer {
	private workspacePath: string
	private totalFiles: number = 0

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Main analysis method - analyzes project structure, patterns, and conventions
	 */
	async analyze(): Promise<ProjectAnalysis> {
		this.totalFiles = 0

		const structure = await this.analyzeStructure(this.workspacePath, 0)
		const entryPoints = await this.detectEntryPoints()
		const patterns = await this.detectPatterns()
		const conventions = await this.detectConventions()
		const keyFiles = await this.findKeyFiles()
		const summary = this.generateSummary(structure, entryPoints, patterns, keyFiles)

		return { structure, entryPoints, patterns, conventions, keyFiles, summary }
	}

	/**
	 * Analyze directory structure recursively
	 */
	private async analyzeStructure(dirPath: string, depth: number): Promise<DirectoryNode> {
		const name = path.basename(dirPath) || dirPath
		const node: DirectoryNode = { name, path: dirPath, type: "directory", children: [] }

		if (depth >= MAX_DEPTH || this.totalFiles >= MAX_TOTAL_FILES) {
			return node
		}

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			let fileCount = 0

			// Sort entries: directories first, then files
			const sortedEntries = entries.sort((a, b) => {
				if (a.isDirectory() && !b.isDirectory()) return -1
				if (!a.isDirectory() && b.isDirectory()) return 1
				return a.name.localeCompare(b.name)
			})

			for (const entry of sortedEntries) {
				if (EXCLUDED_DIRS.includes(entry.name)) continue
				if (entry.name.startsWith(".") && !entry.name.startsWith(".env")) continue
				if (fileCount >= MAX_FILES_PER_DIR) break
				if (this.totalFiles >= MAX_TOTAL_FILES) break

				const entryPath = path.join(dirPath, entry.name)

				if (entry.isDirectory()) {
					const child = await this.analyzeStructure(entryPath, depth + 1)
					node.children!.push(child)
				} else {
					node.children!.push({ name: entry.name, path: entryPath, type: "file" })
					fileCount++
					this.totalFiles++
				}
			}
		} catch {
			// Access permission errors are ignored
		}

		return node
	}

	/**
	 * Detect main entry points of the project
	 */
	private async detectEntryPoints(): Promise<string[]> {
		const candidates = [
			"src/index.ts",
			"src/index.js",
			"src/main.ts",
			"src/main.js",
			"src/App.tsx",
			"src/App.jsx",
			"src/app.ts",
			"src/app.js",
			"index.ts",
			"index.js",
			"main.py",
			"app.py",
			"main.go",
			"cmd/main.go",
			"src/extension.ts",
			"lib/index.ts",
			"lib/index.js",
		]

		const found: string[] = []

		for (const candidate of candidates) {
			const fullPath = path.join(this.workspacePath, candidate)
			try {
				await fs.access(fullPath)
				found.push(candidate)
			} catch {
				// File doesn't exist
			}
		}

		return found
	}

	/**
	 * Detect architecture patterns used in the project
	 */
	private async detectPatterns(): Promise<ArchitecturePattern[]> {
		const patterns: ArchitecturePattern[] = []

		// MVC pattern detection
		const mvcIndicators = ["controllers", "models", "views", "routes"]
		const mvcFound = await this.checkDirectoriesExist(mvcIndicators)
		if (mvcFound.length >= 2) {
			patterns.push({
				name: "MVC",
				confidence: mvcFound.length / mvcIndicators.length,
				indicators: mvcFound,
			})
		}

		// Clean Architecture detection
		const cleanIndicators = ["domain", "usecases", "infrastructure", "presentation", "application"]
		const cleanFound = await this.checkDirectoriesExist(cleanIndicators)
		if (cleanFound.length >= 2) {
			patterns.push({
				name: "Clean Architecture",
				confidence: cleanFound.length / cleanIndicators.length,
				indicators: cleanFound,
			})
		}

		// Feature-based / Module-based detection
		const featureIndicators = ["features", "modules"]
		const featureFound = await this.checkDirectoriesExist(featureIndicators)
		if (featureFound.length >= 1) {
			patterns.push({
				name: "Feature-based",
				confidence: 0.7,
				indicators: featureFound,
			})
		}

		// Component-based (React/Vue) detection
		const componentIndicators = ["components", "pages", "layouts", "hooks"]
		const componentFound = await this.checkDirectoriesExist(componentIndicators)
		if (componentFound.length >= 2) {
			patterns.push({
				name: "Component-based",
				confidence: componentFound.length / componentIndicators.length,
				indicators: componentFound,
			})
		}

		// Service-based detection
		const serviceIndicators = ["services", "repositories", "providers"]
		const serviceFound = await this.checkDirectoriesExist(serviceIndicators)
		if (serviceFound.length >= 2) {
			patterns.push({
				name: "Service-based",
				confidence: serviceFound.length / serviceIndicators.length,
				indicators: serviceFound,
			})
		}

		return patterns
	}

	/**
	 * Detect coding conventions from config files
	 */
	private async detectConventions(): Promise<CodingConvention[]> {
		const conventions: CodingConvention[] = []

		// Check for ESLint
		const eslintFiles = [".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", "eslint.config.js"]
		for (const file of eslintFiles) {
			try {
				await fs.access(path.join(this.workspacePath, file))
				conventions.push({
					category: "linting",
					description: "ESLint is configured for code quality",
					examples: [file],
				})
				break
			} catch {
				// File doesn't exist
			}
		}

		// Check for Prettier
		const prettierFiles = [".prettierrc", ".prettierrc.js", ".prettierrc.json", "prettier.config.js"]
		for (const file of prettierFiles) {
			try {
				await fs.access(path.join(this.workspacePath, file))
				conventions.push({
					category: "formatting",
					description: "Prettier is configured for code formatting",
					examples: [file],
				})
				break
			} catch {
				// File doesn't exist
			}
		}

		// Check for TypeScript
		try {
			await fs.access(path.join(this.workspacePath, "tsconfig.json"))
			conventions.push({
				category: "typing",
				description: "TypeScript is used for type safety",
				examples: ["tsconfig.json"],
			})
		} catch {
			// File doesn't exist
		}

		// Check for Biome
		try {
			await fs.access(path.join(this.workspacePath, "biome.json"))
			conventions.push({
				category: "linting",
				description: "Biome is configured for linting and formatting",
				examples: ["biome.json"],
			})
		} catch {
			// File doesn't exist
		}

		return conventions
	}

	/**
	 * Find key project files
	 */
	private async findKeyFiles(): Promise<string[]> {
		const keyFileNames = [
			"README.md",
			"package.json",
			"tsconfig.json",
			".env.example",
			"Dockerfile",
			"docker-compose.yml",
			"docker-compose.yaml",
			"Makefile",
			"CONTRIBUTING.md",
			"ARCHITECTURE.md",
		]

		const found: string[] = []

		for (const name of keyFileNames) {
			const fullPath = path.join(this.workspacePath, name)
			try {
				await fs.access(fullPath)
				found.push(name)
			} catch {
				// File doesn't exist
			}
		}

		return found
	}

	/**
	 * Generate summary text for AI consumption
	 */
	private generateSummary(
		structure: DirectoryNode,
		entryPoints: string[],
		patterns: ArchitecturePattern[],
		keyFiles: string[],
	): string {
		const lines: string[] = []

		lines.push("## Project Structure")
		lines.push("```")
		lines.push(this.formatStructureTree(structure, 0))
		lines.push("```")
		lines.push("")

		if (entryPoints.length > 0) {
			lines.push("## Entry Points")
			lines.push(entryPoints.map((e) => `- ${e}`).join("\n"))
			lines.push("")
		}

		if (patterns.length > 0) {
			lines.push("## Detected Patterns")
			lines.push(patterns.map((p) => `- ${p.name} (confidence: ${Math.round(p.confidence * 100)}%)`).join("\n"))
			lines.push("")
		}

		if (keyFiles.length > 0) {
			lines.push("## Key Files")
			lines.push(keyFiles.map((f) => `- ${f}`).join("\n"))
			lines.push("")
		}

		return lines.join("\n")
	}

	/**
	 * Format directory structure as tree text
	 */
	private formatStructureTree(node: DirectoryNode, indent: number): string {
		const prefix = "  ".repeat(indent)
		const icon = node.type === "directory" ? "📁" : "📄"
		let result = `${prefix}${icon} ${node.name}\n`

		if (node.children) {
			const maxDisplay = 15
			for (const child of node.children.slice(0, maxDisplay)) {
				result += this.formatStructureTree(child, indent + 1)
			}
			if (node.children.length > maxDisplay) {
				result += `${prefix}  ... and ${node.children.length - maxDisplay} more\n`
			}
		}

		return result
	}

	/**
	 * Check which directories exist from a list of candidates
	 */
	private async checkDirectoriesExist(names: string[]): Promise<string[]> {
		const found: string[] = []

		for (const name of names) {
			// Check in src/ directory first
			try {
				const stat = await fs.stat(path.join(this.workspacePath, "src", name))
				if (stat.isDirectory()) {
					found.push(`src/${name}`)
					continue
				}
			} catch {
				// Directory doesn't exist in src/
			}

			// Check in root directory
			try {
				const stat = await fs.stat(path.join(this.workspacePath, name))
				if (stat.isDirectory()) {
					found.push(name)
				}
			} catch {
				// Directory doesn't exist
			}
		}

		return found
	}
}
