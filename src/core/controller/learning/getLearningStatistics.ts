import { CurriculumManager, LearningStatisticsManager } from "@core/learning"
import { getCwd } from "@utils/path"
import type { Controller } from "../index"
import type {
	GetLearningStatisticsRequest,
	GetLearningStatisticsResponse,
	LearningStatistics,
	TaskStatistic,
	ChapterProgress,
} from "@shared/proto/cline/learning"
import {
	LearningStatistics as LearningStatisticsProto,
	GetLearningStatisticsResponse as GetLearningStatisticsResponseProto,
	TaskStatistic as TaskStatisticProto,
	ChapterProgress as ChapterProgressProto,
} from "@shared/proto/cline/learning"
import type { LearningStatisticsData, TaskStatistic as TaskStatisticData } from "@core/learning/types"

/**
 * Get learning statistics for the current curriculum
 */
export async function getLearningStatistics(
	_controller: Controller,
	_request: GetLearningStatisticsRequest,
): Promise<GetLearningStatisticsResponse> {
	const workspacePath = await getCwd()
	const curriculumManager = new CurriculumManager(workspacePath)
	const statisticsManager = new LearningStatisticsManager(workspacePath)

	// Load curriculum first
	const { exists: curriculumExists, curriculum } = await curriculumManager.loadCurriculum()

	if (!curriculumExists || !curriculum) {
		return GetLearningStatisticsResponseProto.create({ exists: false })
	}

	// Get or create statistics
	const statistics = await statisticsManager.getOrCreateStatistics(curriculum)

	// Get chapter progress
	const chapterProgress = statisticsManager.getChapterProgress(curriculum)

	// Convert to Proto format
	const statisticsProto = toProto(statistics, chapterProgress)

	return GetLearningStatisticsResponseProto.create({
		exists: true,
		statistics: statisticsProto,
	})
}

/**
 * Convert internal statistics data to Proto message
 */
function toProto(
	data: LearningStatisticsData,
	chapterProgress: Array<{
		chapterId: string
		chapterTitle: string
		totalTasks: number
		completedTasks: number
		progressPercentage: number
	}>,
): LearningStatistics {
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
		taskStats: data.taskStats.map((ts) => taskStatToProto(ts)),
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

/**
 * Convert task statistic to Proto message
 */
function taskStatToProto(data: TaskStatisticData): TaskStatistic {
	return TaskStatisticProto.create({
		taskId: data.taskId,
		startedAt: data.startedAt || "",
		completedAt: data.completedAt || "",
		timeSpentMinutes: data.timeSpentMinutes,
	})
}
