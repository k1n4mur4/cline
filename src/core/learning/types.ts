// ============ Curriculum-related types ============

export type TaskStatusType = "not_started" | "in_progress" | "completed" | "skipped"

export interface TaskData {
	id: string
	title: string
	description: string
	status: TaskStatusType
	targetFiles: string[]
	estimatedTime: string
	prerequisites: string[]
}

export interface ChapterData {
	id: string
	title: string
	description: string
	tasks: TaskData[]
	order: number
}

export interface CurriculumData {
	id: string
	title: string
	description: string
	chapters: ChapterData[]
	createdAt: string
	updatedAt: string
	projectSummary: string
}

// ============ Project analysis types ============

export interface DirectoryNode {
	name: string
	path: string
	type: "file" | "directory"
	children?: DirectoryNode[]
}

export interface ArchitecturePattern {
	name: string // "MVC", "Clean Architecture", etc.
	confidence: number // 0-1
	indicators: string[] // Detection evidence
}

export interface CodingConvention {
	category: string // "naming", "formatting", "structure"
	description: string
	examples: string[]
}

export interface ProjectAnalysis {
	structure: DirectoryNode
	entryPoints: string[] // Main entry points
	patterns: ArchitecturePattern[]
	conventions: CodingConvention[]
	keyFiles: string[] // Important files (README, config, etc.)
	summary: string // Summary text for AI
}

// ============ Learning statistics types ============

export interface TaskStatistic {
	taskId: string
	startedAt?: string // When status changed to in_progress
	completedAt?: string // When status changed to completed
	timeSpentMinutes: number // Accumulated time
}

export interface LearningStatisticsData {
	curriculumId: string
	totalTasks: number
	completedTasks: number
	inProgressTasks: number
	skippedTasks: number
	notStartedTasks: number
	estimatedTotalMinutes: number
	actualTimeSpentMinutes: number
	taskStats: TaskStatistic[]
	lastActivityTime: string
	completionPercentage: number
	streakDays: number // Consecutive learning days
	learningDates: string[] // Dates when learning activity occurred (YYYY-MM-DD)
}

// ============ Quiz-related types ============

export type ProficiencyLevel = "no_experience" | "basic" | "practical" | "expert"
export type QuizDifficulty = "beginner" | "intermediate" | "advanced"
export type OverallLevel = "beginner" | "intermediate" | "advanced"

export interface QuizChoiceData {
	id: string // "A" | "B" | "C" | "D"
	text: string
	isCorrect: boolean
}

export interface QuizQuestionData {
	id: string
	questionNumber: number
	technology: string
	difficulty: QuizDifficulty
	questionText: string
	choices: QuizChoiceData[]
	explanation: string
}

export interface QuizData {
	id: string
	questions: QuizQuestionData[]
	targetTechnologies: string[]
	createdAt: string
}

export interface QuizAnswerData {
	questionId: string
	selectedChoiceId: string
	isCorrect: boolean
	timeSpentSeconds: number
}

export interface QuizResultData {
	quizId: string
	answers: QuizAnswerData[]
	proficiencyLevels: Record<string, ProficiencyLevel>
	overallLevel: OverallLevel
	overallScore: number
	completedAt: string
}

// Available technologies for quiz selection
export interface AvailableTechnology {
	id: string
	name: string
	category: string // "frontend", "backend", "infrastructure", etc.
}

// Predefined technology categories for selection UI
export const TECHNOLOGY_CATEGORIES: Record<string, AvailableTechnology[]> = {
	"JavaScript/TypeScript": [
		{ id: "react", name: "React", category: "frontend" },
		{ id: "vue", name: "Vue.js", category: "frontend" },
		{ id: "angular", name: "Angular", category: "frontend" },
		{ id: "nextjs", name: "Next.js", category: "frontend" },
		{ id: "nodejs", name: "Node.js", category: "backend" },
		{ id: "typescript", name: "TypeScript", category: "language" },
		{ id: "javascript", name: "JavaScript", category: "language" },
	],
	Backend: [
		{ id: "python", name: "Python", category: "language" },
		{ id: "go", name: "Go", category: "language" },
		{ id: "java", name: "Java", category: "language" },
		{ id: "rust", name: "Rust", category: "language" },
		{ id: "csharp", name: "C#", category: "language" },
	],
	"Infrastructure/DevOps": [
		{ id: "docker", name: "Docker", category: "infrastructure" },
		{ id: "kubernetes", name: "Kubernetes", category: "infrastructure" },
		{ id: "aws", name: "AWS", category: "cloud" },
		{ id: "gcp", name: "GCP", category: "cloud" },
		{ id: "terraform", name: "Terraform", category: "infrastructure" },
	],
	Database: [
		{ id: "postgresql", name: "PostgreSQL", category: "database" },
		{ id: "mysql", name: "MySQL", category: "database" },
		{ id: "mongodb", name: "MongoDB", category: "database" },
		{ id: "redis", name: "Redis", category: "database" },
	],
}
