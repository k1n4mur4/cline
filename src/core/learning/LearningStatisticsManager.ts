import * as fs from "fs/promises"
import * as path from "path"
import type { CurriculumData, LearningStatisticsData, TaskStatistic, TaskStatusType } from "./types"

const STATS_FILENAME = "learning-stats.json"

/**
 * Manages learning statistics data persistence and calculation
 * Tracks task progress, time spent, and learning streaks
 */
export class LearningStatisticsManager {
	private workspacePath: string

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	/**
	 * Get the path to the statistics file
	 */
	private getStatsPath(): string {
		return path.join(this.workspacePath, ".onboarding", STATS_FILENAME)
	}

	/**
	 * Load statistics from disk
	 */
	async loadStatistics(): Promise<{ exists: boolean; statistics?: LearningStatisticsData }> {
		const statsPath = this.getStatsPath()

		try {
			const data = await fs.readFile(statsPath, "utf-8")
			const statistics: LearningStatisticsData = JSON.parse(data)
			return { exists: true, statistics }
		} catch {
			return { exists: false }
		}
	}

	/**
	 * Save statistics to disk
	 */
	async saveStatistics(statistics: LearningStatisticsData): Promise<void> {
		const statsPath = this.getStatsPath()
		const dirPath = path.dirname(statsPath)

		// Ensure directory exists
		await fs.mkdir(dirPath, { recursive: true })

		// Write statistics data
		await fs.writeFile(statsPath, JSON.stringify(statistics, null, 2), "utf-8")
	}

	/**
	 * Calculate statistics from curriculum data
	 */
	calculateFromCurriculum(curriculum: CurriculumData): LearningStatisticsData {
		const allTasks = curriculum.chapters.flatMap((ch) => ch.tasks)

		const completedTasks = allTasks.filter((t) => t.status === "completed").length
		const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length
		const skippedTasks = allTasks.filter((t) => t.status === "skipped").length
		const notStartedTasks = allTasks.filter((t) => t.status === "not_started").length
		const totalTasks = allTasks.length

		// Parse estimated time (e.g., "30分" -> 30)
		const estimatedTotalMinutes = allTasks.reduce((sum, task) => {
			const match = task.estimatedTime.match(/(\d+)/)
			return sum + (match ? parseInt(match[1], 10) : 30) // Default 30 minutes
		}, 0)

		const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

		return {
			curriculumId: curriculum.id,
			totalTasks,
			completedTasks,
			inProgressTasks,
			skippedTasks,
			notStartedTasks,
			estimatedTotalMinutes,
			actualTimeSpentMinutes: 0, // Will be updated from existing stats
			taskStats: [],
			lastActivityTime: curriculum.updatedAt,
			completionPercentage,
			streakDays: 0,
			learningDates: [],
		}
	}

	/**
	 * Update statistics when task status changes
	 */
	async updateTaskStatistics(
		curriculumId: string,
		taskId: string,
		oldStatus: TaskStatusType,
		newStatus: TaskStatusType,
		curriculum: CurriculumData,
	): Promise<LearningStatisticsData> {
		const { exists, statistics } = await this.loadStatistics()

		// Calculate fresh statistics from curriculum
		const freshStats = this.calculateFromCurriculum(curriculum)

		// Merge with existing statistics if available
		if (exists && statistics) {
			freshStats.taskStats = [...statistics.taskStats]
			freshStats.actualTimeSpentMinutes = statistics.actualTimeSpentMinutes
			freshStats.learningDates = [...statistics.learningDates]
		}

		const now = new Date().toISOString()
		const today = now.split("T")[0]

		// Find or create task statistic
		let taskStat = freshStats.taskStats.find((ts) => ts.taskId === taskId)
		if (!taskStat) {
			taskStat = {
				taskId,
				timeSpentMinutes: 0,
			}
			freshStats.taskStats.push(taskStat)
		}

		// Update task timing based on status change
		if (newStatus === "in_progress" && oldStatus !== "in_progress") {
			// Starting a task
			taskStat.startedAt = now
		} else if (newStatus === "completed" && oldStatus === "in_progress") {
			// Completing a task - calculate time spent
			taskStat.completedAt = now
			if (taskStat.startedAt) {
				const startTime = new Date(taskStat.startedAt).getTime()
				const endTime = new Date(now).getTime()
				const minutesSpent = Math.round((endTime - startTime) / 60000)
				taskStat.timeSpentMinutes += minutesSpent
				freshStats.actualTimeSpentMinutes += minutesSpent
			}
		}

		// Update learning dates and streak
		if (!freshStats.learningDates.includes(today)) {
			freshStats.learningDates.push(today)
			freshStats.learningDates.sort()
		}
		freshStats.streakDays = this.calculateStreak(freshStats.learningDates)
		freshStats.lastActivityTime = now

		// Save updated statistics
		await this.saveStatistics(freshStats)

		return freshStats
	}

	/**
	 * Calculate learning streak (consecutive days)
	 */
	private calculateStreak(dates: string[]): number {
		if (dates.length === 0) return 0

		const sortedDates = [...dates].sort().reverse()
		const today = new Date().toISOString().split("T")[0]
		const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

		// Check if the most recent activity was today or yesterday
		if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
			return 0 // Streak broken
		}

		let streak = 1
		for (let i = 0; i < sortedDates.length - 1; i++) {
			const currentDate = new Date(sortedDates[i])
			const prevDate = new Date(sortedDates[i + 1])
			const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / 86400000)

			if (diffDays === 1) {
				streak++
			} else {
				break
			}
		}

		return streak
	}

	/**
	 * Get or create statistics for a curriculum
	 */
	async getOrCreateStatistics(curriculum: CurriculumData): Promise<LearningStatisticsData> {
		const { exists, statistics } = await this.loadStatistics()

		if (exists && statistics && statistics.curriculumId === curriculum.id) {
			// Recalculate counts from curriculum but keep timing data
			const freshStats = this.calculateFromCurriculum(curriculum)
			freshStats.taskStats = statistics.taskStats
			freshStats.actualTimeSpentMinutes = statistics.actualTimeSpentMinutes
			freshStats.learningDates = statistics.learningDates
			freshStats.streakDays = this.calculateStreak(statistics.learningDates)
			return freshStats
		}

		// Create new statistics
		const newStats = this.calculateFromCurriculum(curriculum)
		await this.saveStatistics(newStats)
		return newStats
	}

	/**
	 * Record a learning activity (e.g., opening the learning view)
	 */
	async recordActivity(curriculum: CurriculumData): Promise<LearningStatisticsData> {
		const stats = await this.getOrCreateStatistics(curriculum)
		const today = new Date().toISOString().split("T")[0]

		if (!stats.learningDates.includes(today)) {
			stats.learningDates.push(today)
			stats.streakDays = this.calculateStreak(stats.learningDates)
			stats.lastActivityTime = new Date().toISOString()
			await this.saveStatistics(stats)
		}

		return stats
	}

	/**
	 * Get chapter-level progress statistics
	 */
	getChapterProgress(
		curriculum: CurriculumData,
	): Array<{
		chapterId: string
		chapterTitle: string
		totalTasks: number
		completedTasks: number
		progressPercentage: number
	}> {
		return curriculum.chapters.map((chapter) => {
			const totalTasks = chapter.tasks.length
			const completedTasks = chapter.tasks.filter((t) => t.status === "completed").length
			return {
				chapterId: chapter.id,
				chapterTitle: chapter.title,
				totalTasks,
				completedTasks,
				progressPercentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
			}
		})
	}
}
