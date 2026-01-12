import {
	UpdateTaskProgressRequest,
	UpdateTaskProgressResponse,
	TaskStatus,
	LearningStatistics as LearningStatisticsProto,
	TaskStatistic as TaskStatisticProto,
	ChapterProgress as ChapterProgressProto,
} from "@shared/proto/cline/learning"
import { CurriculumManager, LearningStatisticsManager } from "@core/learning"
import type { TaskStatusType, LearningStatisticsData, TaskStatistic as TaskStatisticData } from "@core/learning/types"
import { Controller } from ".."
import { getCwd } from "@/utils/path"

/**
 * Updates the progress status of a learning task
 */
export async function updateTaskProgress(
	controller: Controller,
	request: UpdateTaskProgressRequest,
): Promise<UpdateTaskProgressResponse> {
	try {
		const workspacePath = await getCwd()

		if (!workspacePath) {
			console.error("[updateTaskProgress] No workspace path available")
			return UpdateTaskProgressResponse.create({
				success: false,
				curriculum: undefined,
			})
		}

		if (!request.taskId) {
			console.error("[updateTaskProgress] No task ID provided")
			return UpdateTaskProgressResponse.create({
				success: false,
				curriculum: undefined,
			})
		}

		const curriculumManager = new CurriculumManager(workspacePath)
		const statisticsManager = new LearningStatisticsManager(workspacePath)

		// Get old status before updating
		const { curriculum: oldCurriculum } = await curriculumManager.loadCurriculum()
		let oldStatus: TaskStatusType = "not_started"
		if (oldCurriculum) {
			for (const chapter of oldCurriculum.chapters) {
				const task = chapter.tasks.find((t) => t.id === request.taskId)
				if (task) {
					oldStatus = task.status
					break
				}
			}
		}

		// Convert proto TaskStatus to internal TaskStatusType
		const statusMap: Record<TaskStatus, TaskStatusType> = {
			[TaskStatus.TASK_STATUS_NOT_STARTED]: "not_started",
			[TaskStatus.TASK_STATUS_IN_PROGRESS]: "in_progress",
			[TaskStatus.TASK_STATUS_COMPLETED]: "completed",
			[TaskStatus.TASK_STATUS_SKIPPED]: "skipped",
			[TaskStatus.UNRECOGNIZED]: "not_started",
		}

		const newStatus = statusMap[request.status] || "not_started"
		const updatedCurriculum = await curriculumManager.updateTaskStatus(request.taskId, newStatus)

		if (updatedCurriculum) {
			// Update statistics
			const statistics = await statisticsManager.updateTaskStatistics(
				updatedCurriculum.id,
				request.taskId,
				oldStatus,
				newStatus,
				updatedCurriculum,
			)

			// Get chapter progress
			const chapterProgress = statisticsManager.getChapterProgress(updatedCurriculum)

			return UpdateTaskProgressResponse.create({
				success: true,
				curriculum: curriculumManager.toProto(updatedCurriculum),
				statistics: toStatisticsProto(statistics, chapterProgress),
			})
		}

		return UpdateTaskProgressResponse.create({
			success: false,
			curriculum: undefined,
		})
	} catch (error) {
		console.error("[updateTaskProgress] Error updating task progress:", error)
		return UpdateTaskProgressResponse.create({
			success: false,
			curriculum: undefined,
		})
	}
}

/**
 * Convert internal statistics data to Proto message
 */
function toStatisticsProto(
	data: LearningStatisticsData,
	chapterProgress: Array<{
		chapterId: string
		chapterTitle: string
		totalTasks: number
		completedTasks: number
		progressPercentage: number
	}>,
): LearningStatisticsProto {
	return LearningStatisticsProto.create({
		curriculumId: data.curriculumId,
		totalTasks: data.totalTasks,
		completedTasks: data.completedTasks,
		inProgressTasks: data.inProgressTasks,
		skippedTasks: data.skippedTasks,
		notStartedTasks: data.notStartedTasks,
		estimatedTotalMinutes: data.estimatedTotalMinutes,
		actualTimeSpentMinutes: data.actualTimeSpentMinutes,
		completionPercentage: data.completionPercentage,
		lastActivityTime: data.lastActivityTime,
		streakDays: data.streakDays,
		learningDates: data.learningDates,
		taskStats: data.taskStats.map((ts) =>
			TaskStatisticProto.create({
				taskId: ts.taskId,
				startedAt: ts.startedAt || "",
				completedAt: ts.completedAt || "",
				timeSpentMinutes: ts.timeSpentMinutes,
			}),
		),
		chapterProgress: chapterProgress.map((cp) =>
			ChapterProgressProto.create({
				chapterId: cp.chapterId,
				chapterTitle: cp.chapterTitle,
				totalTasks: cp.totalTasks,
				completedTasks: cp.completedTasks,
				progressPercentage: cp.progressPercentage,
			}),
		),
	})
}
