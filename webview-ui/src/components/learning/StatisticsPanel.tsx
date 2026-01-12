import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import type { LearningStatistics, ChapterProgress } from "@shared/proto/cline/learning"

interface StatisticsPanelProps {
	statistics: LearningStatistics | null
	isLoading: boolean
	onClose: () => void
	onRefresh: () => void
}

/**
 * Panel displaying learning statistics and progress
 */
export const StatisticsPanel = ({ statistics, isLoading, onClose, onRefresh }: StatisticsPanelProps) => {
	if (isLoading) {
		return (
			<div className="w-80 bg-vscode-editor-background border-l border-vscode-panel-border p-4">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-base font-medium m-0">学習統計</h3>
					<button
						className="text-lg hover:bg-vscode-list-hoverBackground rounded p-1 cursor-pointer"
						onClick={onClose}
						title="閉じる">
						✕
					</button>
				</div>
				<div className="flex items-center justify-center py-8">
					<VSCodeProgressRing />
					<span className="ml-2 text-description">読み込み中...</span>
				</div>
			</div>
		)
	}

	if (!statistics) {
		return (
			<div className="w-80 bg-vscode-editor-background border-l border-vscode-panel-border p-4">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-base font-medium m-0">学習統計</h3>
					<button
						className="text-lg hover:bg-vscode-list-hoverBackground rounded p-1 cursor-pointer"
						onClick={onClose}
						title="閉じる">
						✕
					</button>
				</div>
				<p className="text-description text-sm">統計データがありません</p>
			</div>
		)
	}

	return (
		<div className="w-80 bg-vscode-editor-background border-l border-vscode-panel-border overflow-y-auto">
			{/* Header */}
			<div className="p-4 border-b border-vscode-panel-border sticky top-0 bg-vscode-editor-background">
				<div className="flex justify-between items-center">
					<h3 className="text-base font-medium m-0">学習統計</h3>
					<div className="flex gap-1">
						<button
							className="text-sm hover:bg-vscode-list-hoverBackground rounded p-1 cursor-pointer"
							onClick={onRefresh}
							title="更新">
							🔄
						</button>
						<button
							className="text-lg hover:bg-vscode-list-hoverBackground rounded p-1 cursor-pointer"
							onClick={onClose}
							title="閉じる">
							✕
						</button>
					</div>
				</div>
			</div>

			{/* Overall Progress */}
			<div className="p-4 border-b border-vscode-panel-border">
				<h4 className="text-sm font-medium mb-3">全体進捗</h4>
				<ProgressCircle percentage={statistics.completionPercentage} />
				<div className="mt-4 grid grid-cols-2 gap-2 text-sm">
					<StatItem label="完了" value={statistics.completedTasks} color="var(--vscode-charts-green)" />
					<StatItem label="進行中" value={statistics.inProgressTasks} color="var(--vscode-charts-blue)" />
					<StatItem label="未着手" value={statistics.notStartedTasks} color="var(--vscode-descriptionForeground)" />
					<StatItem label="スキップ" value={statistics.skippedTasks} color="var(--vscode-charts-yellow)" />
				</div>
			</div>

			{/* Time Stats */}
			<div className="p-4 border-b border-vscode-panel-border">
				<h4 className="text-sm font-medium mb-3">学習時間</h4>
				<div className="space-y-2 text-sm">
					<div className="flex justify-between">
						<span className="text-description">推定時間</span>
						<span>{formatMinutes(statistics.estimatedTotalMinutes)}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-description">実際の学習時間</span>
						<span>{formatMinutes(statistics.actualTimeSpentMinutes)}</span>
					</div>
				</div>
			</div>

			{/* Streak */}
			<div className="p-4 border-b border-vscode-panel-border">
				<h4 className="text-sm font-medium mb-3">学習継続</h4>
				<div className="flex items-center gap-2">
					<span className="text-2xl">🔥</span>
					<div>
						<div className="text-lg font-bold">{statistics.streakDays}日</div>
						<div className="text-xs text-description">連続学習</div>
					</div>
				</div>
				{statistics.lastActivityTime && (
					<div className="mt-2 text-xs text-description">
						最終学習: {formatDate(statistics.lastActivityTime)}
					</div>
				)}
			</div>

			{/* Chapter Progress */}
			{statistics.chapterProgress.length > 0 && (
				<div className="p-4">
					<h4 className="text-sm font-medium mb-3">章ごとの進捗</h4>
					<div className="space-y-3">
						{statistics.chapterProgress.map((chapter, index) => (
							<ChapterProgressBar key={chapter.chapterId || index} chapter={chapter} index={index} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * Circular progress indicator
 */
const ProgressCircle = ({ percentage }: { percentage: number }) => {
	const radius = 40
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference - (percentage / 100) * circumference

	return (
		<div className="flex flex-col items-center">
			<svg width="100" height="100" className="transform -rotate-90">
				{/* Background circle */}
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="var(--vscode-editorWidget-background)"
					strokeWidth="8"
				/>
				{/* Progress circle */}
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="var(--vscode-charts-green)"
					strokeWidth="8"
					strokeDasharray={circumference}
					strokeDashoffset={strokeDashoffset}
					strokeLinecap="round"
					className="transition-all duration-500"
				/>
			</svg>
			<div className="absolute flex flex-col items-center justify-center" style={{ marginTop: "25px" }}>
				<span className="text-2xl font-bold">{Math.round(percentage)}%</span>
				<span className="text-xs text-description">完了</span>
			</div>
		</div>
	)
}

/**
 * Single statistic item
 */
const StatItem = ({ label, value, color }: { label: string; value: number; color: string }) => (
	<div className="flex items-center gap-2">
		<div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
		<span className="text-description">{label}</span>
		<span className="font-medium ml-auto">{value}</span>
	</div>
)

/**
 * Chapter progress bar
 */
const ChapterProgressBar = ({ chapter, index }: { chapter: ChapterProgress; index: number }) => (
	<div>
		<div className="flex justify-between text-xs mb-1">
			<span className="truncate" title={chapter.chapterTitle}>
				{index + 1}. {chapter.chapterTitle}
			</span>
			<span className="text-description ml-2">
				{chapter.completedTasks}/{chapter.totalTasks}
			</span>
		</div>
		<div className="h-2 bg-vscode-editorWidget-background rounded-full overflow-hidden">
			<div
				className="h-full bg-green-500 transition-all duration-300"
				style={{ width: `${chapter.progressPercentage}%` }}
			/>
		</div>
	</div>
)

/**
 * Format minutes to human readable string
 */
function formatMinutes(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}分`
	}
	const hours = Math.floor(minutes / 60)
	const mins = minutes % 60
	return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
}

/**
 * Format ISO date string to human readable
 */
function formatDate(isoString: string): string {
	try {
		const date = new Date(isoString)
		return date.toLocaleDateString("ja-JP", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	} catch {
		return isoString
	}
}

export default StatisticsPanel
