import type { CurriculumData, LearningStatisticsData, TaskStatusType } from "./types"

/**
 * Exports curriculum and learning statistics to various formats
 */
export class CurriculumExporter {
	/**
	 * Export curriculum as Markdown format
	 */
	exportAsMarkdown(curriculum: CurriculumData, statistics?: LearningStatisticsData): string {
		const lines: string[] = []

		// Title and description
		lines.push(`# ${curriculum.title}`)
		lines.push("")
		lines.push(curriculum.description)
		lines.push("")

		// Statistics summary if available
		if (statistics) {
			lines.push("## 学習進捗サマリー")
			lines.push("")
			lines.push(`- **完了率**: ${statistics.completionPercentage.toFixed(1)}%`)
			lines.push(
				`- **タスク状況**: 完了 ${statistics.completedTasks} / 進行中 ${statistics.inProgressTasks} / 未着手 ${statistics.notStartedTasks} / スキップ ${statistics.skippedTasks}`,
			)
			lines.push(`- **推定時間**: ${this.formatMinutes(statistics.estimatedTotalMinutes)}`)
			lines.push(`- **実際の学習時間**: ${this.formatMinutes(statistics.actualTimeSpentMinutes)}`)
			lines.push(`- **連続学習日数**: ${statistics.streakDays}日`)
			if (statistics.lastActivityTime) {
				lines.push(`- **最終学習日**: ${this.formatDate(statistics.lastActivityTime)}`)
			}
			lines.push("")
		}

		// Project summary
		if (curriculum.projectSummary) {
			lines.push("## プロジェクト概要")
			lines.push("")
			lines.push(curriculum.projectSummary)
			lines.push("")
		}

		// Chapters
		lines.push("## カリキュラム")
		lines.push("")

		for (const chapter of curriculum.chapters) {
			lines.push(`### 第${chapter.order + 1}章: ${chapter.title}`)
			lines.push("")
			lines.push(chapter.description)
			lines.push("")

			// Tasks
			for (const task of chapter.tasks) {
				const checkbox = this.getCheckbox(task.status)
				lines.push(`${checkbox} **${task.title}**`)
				lines.push(`  - ${task.description}`)
				if (task.estimatedTime) {
					lines.push(`  - 目安時間: ${task.estimatedTime}`)
				}
				if (task.targetFiles.length > 0) {
					lines.push(`  - 関連ファイル: ${task.targetFiles.map((f) => `\`${f}\``).join(", ")}`)
				}
				lines.push("")
			}
		}

		// Metadata
		lines.push("---")
		lines.push("")
		lines.push(`*作成日: ${this.formatDate(curriculum.createdAt)}*`)
		lines.push(`*最終更新: ${this.formatDate(curriculum.updatedAt)}*`)

		return lines.join("\n")
	}

	/**
	 * Export curriculum as JSON format
	 */
	exportAsJson(
		curriculum: CurriculumData,
		statistics?: LearningStatisticsData,
		includeMetadata: boolean = true,
	): string {
		const exportData: Record<string, unknown> = {
			curriculum: {
				id: curriculum.id,
				title: curriculum.title,
				description: curriculum.description,
				projectSummary: curriculum.projectSummary,
				chapters: curriculum.chapters.map((chapter) => ({
					id: chapter.id,
					title: chapter.title,
					description: chapter.description,
					order: chapter.order,
					tasks: chapter.tasks.map((task) => ({
						id: task.id,
						title: task.title,
						description: task.description,
						status: task.status,
						estimatedTime: task.estimatedTime,
						targetFiles: task.targetFiles,
						prerequisites: task.prerequisites,
					})),
				})),
			},
		}

		if (statistics) {
			exportData.statistics = {
				curriculumId: statistics.curriculumId,
				totalTasks: statistics.totalTasks,
				completedTasks: statistics.completedTasks,
				inProgressTasks: statistics.inProgressTasks,
				skippedTasks: statistics.skippedTasks,
				notStartedTasks: statistics.notStartedTasks,
				completionPercentage: statistics.completionPercentage,
				estimatedTotalMinutes: statistics.estimatedTotalMinutes,
				actualTimeSpentMinutes: statistics.actualTimeSpentMinutes,
				streakDays: statistics.streakDays,
				lastActivityTime: statistics.lastActivityTime,
				learningDates: statistics.learningDates,
				taskStats: statistics.taskStats,
			}
		}

		if (includeMetadata) {
			exportData.metadata = {
				exportedAt: new Date().toISOString(),
				createdAt: curriculum.createdAt,
				updatedAt: curriculum.updatedAt,
				version: "1.0",
			}
		}

		return JSON.stringify(exportData, null, 2)
	}

	/**
	 * Get suggested filename for export
	 */
	getSuggestedFilename(curriculum: CurriculumData, format: "markdown" | "json"): string {
		const sanitizedTitle = curriculum.title
			.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "_")
			.replace(/_+/g, "_")
			.substring(0, 50)

		const date = new Date().toISOString().split("T")[0]
		const extension = format === "markdown" ? "md" : "json"

		return `curriculum_${sanitizedTitle}_${date}.${extension}`
	}

	private getCheckbox(status: TaskStatusType): string {
		switch (status) {
			case "completed":
				return "- [x]"
			case "in_progress":
				return "- [~]"
			case "skipped":
				return "- [-]"
			default:
				return "- [ ]"
		}
	}

	private formatMinutes(minutes: number): string {
		if (minutes < 60) {
			return `${minutes}分`
		}
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
	}

	private formatDate(isoString: string): string {
		try {
			const date = new Date(isoString)
			return date.toLocaleDateString("ja-JP", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		} catch {
			return isoString
		}
	}
}
