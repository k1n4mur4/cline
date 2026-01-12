import * as fs from "fs/promises"
import * as path from "path"
import { Curriculum, Chapter, LearningTask, TaskStatus } from "../../shared/proto/cline/learning"
import type { CurriculumData, ChapterData, TaskData, TaskStatusType } from "./types"

const CURRICULUM_FILENAME = "curriculum.json"

/**
 * Manages curriculum data persistence
 * Handles saving and loading curriculum from the .onboarding directory
 */
export class CurriculumManager {
	private workspacePath: string

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Get the path to the curriculum file
	 */
	private getCurriculumPath(): string {
		return path.join(this.workspacePath, ".onboarding", CURRICULUM_FILENAME)
	}

	/**
	 * Save curriculum to disk
	 */
	async saveCurriculum(curriculum: CurriculumData): Promise<void> {
		const curriculumPath = this.getCurriculumPath()
		const dirPath = path.dirname(curriculumPath)

		// Ensure directory exists
		await fs.mkdir(dirPath, { recursive: true })

		// Write curriculum data
		await fs.writeFile(curriculumPath, JSON.stringify(curriculum, null, 2), "utf-8")
		console.log(`[CurriculumManager] Saved curriculum to ${curriculumPath}`)
	}

	/**
	 * Load curriculum from disk
	 */
	async loadCurriculum(): Promise<{ exists: boolean; curriculum?: CurriculumData }> {
		const curriculumPath = this.getCurriculumPath()

		try {
			const data = await fs.readFile(curriculumPath, "utf-8")
			const curriculum: CurriculumData = JSON.parse(data)
			console.log(`[CurriculumManager] Loaded curriculum from ${curriculumPath}`)
			return { exists: true, curriculum }
		} catch (error) {
			console.log(`[CurriculumManager] Curriculum not found at ${curriculumPath}:`, error)
			return { exists: false }
		}
	}

	/**
	 * Update the status of a specific task
	 */
	async updateTaskStatus(taskId: string, status: TaskStatusType): Promise<CurriculumData | null> {
		const { exists, curriculum } = await this.loadCurriculum()
		if (!exists || !curriculum) {
			return null
		}

		// Find and update the task
		for (const chapter of curriculum.chapters) {
			const task = chapter.tasks.find((t) => t.id === taskId)
			if (task) {
				task.status = status
				curriculum.updatedAt = new Date().toISOString()
				await this.saveCurriculum(curriculum)
				return curriculum
			}
		}

		return null
	}

	/**
	 * Check if a curriculum exists
	 */
	async curriculumExists(): Promise<boolean> {
		const curriculumPath = this.getCurriculumPath()

		try {
			await fs.access(curriculumPath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Delete curriculum
	 */
	async deleteCurriculum(): Promise<void> {
		const curriculumPath = this.getCurriculumPath()

		try {
			await fs.unlink(curriculumPath)
		} catch {
			// Curriculum doesn't exist, ignore
		}
	}

	/**
	 * Convert internal data to Proto message
	 */
	toProto(data: CurriculumData): Curriculum {
		return Curriculum.create({
			id: data.id,
			title: data.title,
			description: data.description,
			chapters: data.chapters.map((ch) => this.chapterToProto(ch)),
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
			projectSummary: data.projectSummary,
		})
	}

	/**
	 * Convert Proto message to internal data
	 */
	fromProto(proto: Curriculum): CurriculumData {
		return {
			id: proto.id,
			title: proto.title,
			description: proto.description,
			chapters: proto.chapters.map((ch) => this.chapterFromProto(ch)),
			createdAt: proto.createdAt,
			updatedAt: proto.updatedAt,
			projectSummary: proto.projectSummary,
		}
	}

	private chapterToProto(data: ChapterData): Chapter {
		return Chapter.create({
			id: data.id,
			title: data.title,
			description: data.description,
			order: data.order,
			tasks: data.tasks.map((t) => this.taskToProto(t)),
		})
	}

	private chapterFromProto(proto: Chapter): ChapterData {
		return {
			id: proto.id,
			title: proto.title,
			description: proto.description,
			order: proto.order,
			tasks: proto.tasks.map((t) => this.taskFromProto(t)),
		}
	}

	private taskToProto(data: TaskData): LearningTask {
		return LearningTask.create({
			id: data.id,
			title: data.title,
			description: data.description,
			status: this.statusToProto(data.status),
			targetFiles: data.targetFiles,
			estimatedTime: data.estimatedTime,
			prerequisites: data.prerequisites,
		})
	}

	private taskFromProto(proto: LearningTask): TaskData {
		return {
			id: proto.id,
			title: proto.title,
			description: proto.description,
			status: this.statusFromProto(proto.status),
			targetFiles: proto.targetFiles,
			estimatedTime: proto.estimatedTime,
			prerequisites: proto.prerequisites,
		}
	}

	private statusToProto(status: TaskStatusType): TaskStatus {
		const map: Record<TaskStatusType, TaskStatus> = {
			not_started: TaskStatus.TASK_STATUS_NOT_STARTED,
			in_progress: TaskStatus.TASK_STATUS_IN_PROGRESS,
			completed: TaskStatus.TASK_STATUS_COMPLETED,
			skipped: TaskStatus.TASK_STATUS_SKIPPED,
		}
		return map[status]
	}

	private statusFromProto(status: TaskStatus): TaskStatusType {
		const map: Record<TaskStatus, TaskStatusType> = {
			[TaskStatus.TASK_STATUS_NOT_STARTED]: "not_started",
			[TaskStatus.TASK_STATUS_IN_PROGRESS]: "in_progress",
			[TaskStatus.TASK_STATUS_COMPLETED]: "completed",
			[TaskStatus.TASK_STATUS_SKIPPED]: "skipped",
			[TaskStatus.UNRECOGNIZED]: "not_started",
		}
		return map[status] || "not_started"
	}
}
