import { useState, useEffect, useCallback, useRef } from "react"
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { LearningServiceClient, FileServiceClient, TaskServiceClient } from "../../services/grpc-client"
import {
	GetCurriculumRequest,
	GenerateCurriculumRequest,
	UpdateTaskProgressRequest,
	GetLearningStatisticsRequest,
	ExportCurriculumRequest,
	Curriculum,
	Chapter,
	LearningTask,
	TaskStatus,
	CurriculumGenerationProgress,
	LearningStatistics,
} from "@shared/proto/cline/learning"
import { NewTaskRequest } from "@shared/proto/cline/task"
import { StringRequest } from "@shared/proto/cline/common"
import StatisticsPanel from "./StatisticsPanel"

interface CurriculumViewProps {
	onEditProfile?: () => void
	onBack?: () => void
}

// Task status display configuration
const TASK_STATUS_CONFIG = {
	[TaskStatus.TASK_STATUS_NOT_STARTED]: { label: "未着手", color: "var(--vscode-descriptionForeground)" },
	[TaskStatus.TASK_STATUS_IN_PROGRESS]: { label: "進行中", color: "var(--vscode-charts-blue)" },
	[TaskStatus.TASK_STATUS_COMPLETED]: { label: "完了", color: "var(--vscode-charts-green)" },
	[TaskStatus.TASK_STATUS_SKIPPED]: { label: "スキップ", color: "var(--vscode-charts-yellow)" },
	[TaskStatus.UNRECOGNIZED]: { label: "不明", color: "var(--vscode-descriptionForeground)" },
}

export const CurriculumView = ({ onEditProfile, onBack }: CurriculumViewProps) => {
	const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [generationProgress, setGenerationProgress] = useState<CurriculumGenerationProgress | null>(null)
	const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
	const [error, setError] = useState<string | null>(null)
	const [selectedTask, setSelectedTask] = useState<LearningTask | null>(null)
	const [showStatistics, setShowStatistics] = useState(false)
	const [statistics, setStatistics] = useState<LearningStatistics | null>(null)
	const [isLoadingStatistics, setIsLoadingStatistics] = useState(false)
	const [showExportMenu, setShowExportMenu] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const exportMenuRef = useRef<HTMLDivElement>(null)

	// Open file in editor
	const handleOpenFile = async (filePath: string) => {
		try {
			await FileServiceClient.openFileRelativePath(StringRequest.create({ value: filePath }))
		} catch (err) {
			console.error("Error opening file:", err)
		}
	}

	// Close task detail panel
	const handleCloseTaskDetail = () => {
		setSelectedTask(null)
	}

	// Load statistics
	const loadStatistics = async () => {
		setIsLoadingStatistics(true)
		try {
			const response = await LearningServiceClient.getLearningStatistics(
				GetLearningStatisticsRequest.create({}),
			)
			if (response.exists && response.statistics) {
				setStatistics(response.statistics)
			}
		} catch (err) {
			console.error("Error loading statistics:", err)
		} finally {
			setIsLoadingStatistics(false)
		}
	}

	// Toggle statistics panel
	const handleToggleStatistics = () => {
		if (!showStatistics) {
			loadStatistics()
		}
		setShowStatistics(!showStatistics)
	}

	// Close statistics panel
	const handleCloseStatistics = () => {
		setShowStatistics(false)
	}

	// Export curriculum
	const handleExport = async (format: "markdown" | "json", includeStatistics: boolean) => {
		setIsExporting(true)
		setShowExportMenu(false)
		try {
			const response = await LearningServiceClient.exportCurriculum(
				ExportCurriculumRequest.create({
					format,
					includeStatistics,
				}),
			)
			if (response.success && response.content) {
				// Create download
				const blob = new Blob([response.content], {
					type: format === "json" ? "application/json" : "text/markdown",
				})
				const url = URL.createObjectURL(blob)
				const a = document.createElement("a")
				a.href = url
				a.download = response.suggestedFilename || `curriculum.${format === "json" ? "json" : "md"}`
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
				URL.revokeObjectURL(url)
			} else {
				setError(response.errorMessage || "エクスポートに失敗しました")
			}
		} catch (err) {
			console.error("Error exporting curriculum:", err)
			setError("エクスポートに失敗しました")
		} finally {
			setIsExporting(false)
		}
	}

	// Close export menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
				setShowExportMenu(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	// Explain code with Cline
	const handleExplainCode = async (taskTitle: string, files: string[]) => {
		if (files.length === 0) return

		try {
			// Build prompt with file mentions
			const fileList = files.map((f) => `@/${f}`).join("\n")
			const prompt = `学習タスク「${taskTitle}」に関連するコードを解説してください。

以下のファイルを読んで、コードの目的と動作を説明してください：
${fileList}

ポイント：
- コードの全体的な目的
- 主要な関数・クラスの役割
- データフローの流れ
- 初心者が注意すべき点`

			// Start new task
			await TaskServiceClient.newTask(
				NewTaskRequest.create({
					text: prompt,
					files: files,
				}),
			)
		} catch (err) {
			console.error("Error explaining code:", err)
			setError("コード解説の開始に失敗しました")
		}
	}

	// Load existing curriculum on mount
	useEffect(() => {
		loadCurriculum()
	}, [])

	const loadCurriculum = async () => {
		setIsLoading(true)
		setError(null)
		try {
			const response = await LearningServiceClient.getCurriculum(GetCurriculumRequest.create({}))
			if (response.exists && response.curriculum) {
				setCurriculum(response.curriculum)
				// Expand first chapter by default
				if (response.curriculum.chapters.length > 0) {
					setExpandedChapters(new Set([response.curriculum.chapters[0].id]))
				}
			}
		} catch (err) {
			console.error("Error loading curriculum:", err)
			setError("カリキュラムの読み込みに失敗しました")
		} finally {
			setIsLoading(false)
		}
	}

	const handleGenerateCurriculum = useCallback((forceRegenerate: boolean = false) => {
		setIsGenerating(true)
		setError(null)
		setGenerationProgress(null)

		const unsubscribe = LearningServiceClient.generateCurriculum(
			GenerateCurriculumRequest.create({ forceRegenerate }),
			{
				onResponse: (progress: CurriculumGenerationProgress) => {
					setGenerationProgress(progress)

					if (progress.phase === "completed" && progress.partialCurriculum) {
						setCurriculum(progress.partialCurriculum)
						// Expand first chapter by default
						if (progress.partialCurriculum.chapters.length > 0) {
							setExpandedChapters(new Set([progress.partialCurriculum.chapters[0].id]))
						}
					}

					if (progress.phase === "error") {
						setError(progress.errorMessage || "カリキュラムの生成に失敗しました")
					}
				},
				onError: (err: Error) => {
					console.error("Error generating curriculum:", err)
					setError("カリキュラムの生成に失敗しました")
					setIsGenerating(false)
					setGenerationProgress(null)
				},
				onComplete: () => {
					setIsGenerating(false)
					setGenerationProgress(null)
				},
			},
		)

		// Return cleanup function for potential use
		return unsubscribe
	}, [])

	const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
		try {
			const response = await LearningServiceClient.updateTaskProgress(
				UpdateTaskProgressRequest.create({
					taskId,
					status: newStatus,
				}),
			)
			if (response.success && response.curriculum) {
				setCurriculum(response.curriculum)
			}
		} catch (err) {
			console.error("Error updating task status:", err)
		}
	}

	const toggleChapter = (chapterId: string) => {
		setExpandedChapters((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(chapterId)) {
				newSet.delete(chapterId)
			} else {
				newSet.add(chapterId)
			}
			return newSet
		})
	}

	const getNextStatus = (currentStatus: TaskStatus): TaskStatus => {
		switch (currentStatus) {
			case TaskStatus.TASK_STATUS_NOT_STARTED:
				return TaskStatus.TASK_STATUS_IN_PROGRESS
			case TaskStatus.TASK_STATUS_IN_PROGRESS:
				return TaskStatus.TASK_STATUS_COMPLETED
			case TaskStatus.TASK_STATUS_COMPLETED:
				return TaskStatus.TASK_STATUS_NOT_STARTED
			default:
				return TaskStatus.TASK_STATUS_NOT_STARTED
		}
	}

	const calculateProgress = (chapters: Chapter[]): { completed: number; total: number } => {
		let completed = 0
		let total = 0
		for (const chapter of chapters) {
			for (const task of chapter.tasks) {
				total++
				if (task.status === TaskStatus.TASK_STATUS_COMPLETED) {
					completed++
				}
			}
		}
		return { completed, total }
	}

	// Loading state
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8">
				<VSCodeProgressRing />
				<p className="text-description mt-4">読み込み中...</p>
			</div>
		)
	}

	// Generating state
	if (isGenerating && generationProgress) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8">
				<VSCodeProgressRing />
				<p className="text-description mt-4">{generationProgress.currentStep}</p>
				<div className="w-64 h-2 bg-gray-700 rounded-full mt-4 overflow-hidden">
					<div
						className="h-full bg-blue-500 transition-all duration-300"
						style={{ width: `${generationProgress.progressPercent}%` }}
					/>
				</div>
				<p className="text-sm text-description mt-2">{generationProgress.progressPercent}%</p>
			</div>
		)
	}

	// No curriculum state
	if (!curriculum) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8">
				<div className="text-center max-w-md">
					<h3 className="text-lg font-medium mb-2">カリキュラムがありません</h3>
					<p className="text-description mb-6">
						プロジェクトを分析して、あなた専用の学習カリキュラムを生成しましょう。
					</p>
					{error && <p className="text-red-500 text-sm mb-4">{error}</p>}
					<div className="flex gap-3 justify-center">
						<VSCodeButton onClick={() => handleGenerateCurriculum(false)}>カリキュラムを生成</VSCodeButton>
						{onEditProfile && (
							<VSCodeButton appearance="secondary" onClick={onEditProfile}>
								プロファイル編集
							</VSCodeButton>
						)}
					</div>
				</div>
			</div>
		)
	}

	// Curriculum display
	const progress = calculateProgress(curriculum.chapters)

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="p-4 border-b border-vscode-panel-border">
				<div className="flex justify-between items-start">
					<div>
						<h2 className="text-lg font-medium m-0">{curriculum.title}</h2>
						<p className="text-description text-sm mt-1 mb-0">{curriculum.description}</p>
					</div>
					<div className="flex gap-2">
						<VSCodeButton
							appearance={showStatistics ? "primary" : "secondary"}
							onClick={handleToggleStatistics}
							title="学習統計を表示">
							📊 統計
						</VSCodeButton>
						{/* Export dropdown */}
						<div className="relative" ref={exportMenuRef}>
							<VSCodeButton
								appearance="secondary"
								onClick={() => setShowExportMenu(!showExportMenu)}
								disabled={isExporting}
								title="カリキュラムをエクスポート">
								{isExporting ? "..." : "⬇️ エクスポート"}
							</VSCodeButton>
							{showExportMenu && (
								<div
									className="absolute right-0 top-full mt-1 rounded shadow-lg z-10 min-w-48"
									style={{
										backgroundColor: "var(--vscode-dropdown-background)",
										border: "1px solid var(--vscode-dropdown-border)",
									}}>
									<button
										className="w-full px-3 py-2 text-left text-sm cursor-pointer border-none"
										style={{
											backgroundColor: "transparent",
											color: "var(--vscode-foreground)",
										}}
										onMouseEnter={(e) =>
											(e.currentTarget.style.backgroundColor =
												"var(--vscode-list-hoverBackground)")
										}
										onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
										onClick={() => handleExport("markdown", false)}>
										📄 Markdown形式
									</button>
									<button
										className="w-full px-3 py-2 text-left text-sm cursor-pointer border-none"
										style={{
											backgroundColor: "transparent",
											color: "var(--vscode-foreground)",
										}}
										onMouseEnter={(e) =>
											(e.currentTarget.style.backgroundColor =
												"var(--vscode-list-hoverBackground)")
										}
										onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
										onClick={() => handleExport("markdown", true)}>
										📄 Markdown形式（統計含む）
									</button>
									<div style={{ borderTop: "1px solid var(--vscode-dropdown-border)" }} />
									<button
										className="w-full px-3 py-2 text-left text-sm cursor-pointer border-none"
										style={{
											backgroundColor: "transparent",
											color: "var(--vscode-foreground)",
										}}
										onMouseEnter={(e) =>
											(e.currentTarget.style.backgroundColor =
												"var(--vscode-list-hoverBackground)")
										}
										onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
										onClick={() => handleExport("json", false)}>
										📋 JSON形式
									</button>
									<button
										className="w-full px-3 py-2 text-left text-sm cursor-pointer border-none"
										style={{
											backgroundColor: "transparent",
											color: "var(--vscode-foreground)",
										}}
										onMouseEnter={(e) =>
											(e.currentTarget.style.backgroundColor =
												"var(--vscode-list-hoverBackground)")
										}
										onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
										onClick={() => handleExport("json", true)}>
										📋 JSON形式（統計含む）
									</button>
								</div>
							)}
						</div>
						{onEditProfile && (
							<VSCodeButton appearance="secondary" onClick={onEditProfile}>
								プロファイル
							</VSCodeButton>
						)}
						<VSCodeButton appearance="secondary" onClick={() => handleGenerateCurriculum(true)}>
							再生成
						</VSCodeButton>
					</div>
				</div>

				{/* Progress bar */}
				<div className="mt-4">
					<div className="flex justify-between text-sm mb-1">
						<span>進捗</span>
						<span>
							{progress.completed} / {progress.total} タスク完了
						</span>
					</div>
					<div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
						<div
							className="h-full bg-green-500 transition-all duration-300"
							style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
						/>
					</div>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex-1 flex overflow-hidden">
				{/* Chapters list */}
				<div
					className={`overflow-y-auto p-4 ${
						selectedTask || showStatistics ? "flex-1 border-r border-vscode-panel-border" : "w-full"
					}`}>
					{error && <p className="text-red-500 text-sm mb-4">{error}</p>}

					{curriculum.chapters.map((chapter, index) => (
						<ChapterSection
							key={chapter.id}
							chapter={chapter}
							index={index}
							isExpanded={expandedChapters.has(chapter.id)}
							onToggle={() => toggleChapter(chapter.id)}
							onTaskStatusChange={handleTaskStatusChange}
							onTaskSelect={setSelectedTask}
							selectedTaskId={selectedTask?.id}
							getNextStatus={getNextStatus}
							onOpenFile={handleOpenFile}
						/>
					))}
				</div>

				{/* Task detail panel */}
				{selectedTask && !showStatistics && (
					<TaskDetailPanel
						task={selectedTask}
						onClose={handleCloseTaskDetail}
						onStatusChange={(status) => handleTaskStatusChange(selectedTask.id, status)}
						onOpenFile={handleOpenFile}
						onExplainCode={handleExplainCode}
					/>
				)}

				{/* Statistics panel */}
				{showStatistics && (
					<StatisticsPanel
						statistics={statistics}
						isLoading={isLoadingStatistics}
						onClose={handleCloseStatistics}
						onRefresh={loadStatistics}
					/>
				)}
			</div>
		</div>
	)
}

interface ChapterSectionProps {
	chapter: Chapter
	index: number
	isExpanded: boolean
	onToggle: () => void
	onTaskStatusChange: (taskId: string, status: TaskStatus) => void
	onTaskSelect: (task: LearningTask) => void
	selectedTaskId?: string
	getNextStatus: (status: TaskStatus) => TaskStatus
	onOpenFile: (filePath: string) => void
}

const ChapterSection = ({
	chapter,
	index,
	isExpanded,
	onToggle,
	onTaskStatusChange,
	onTaskSelect,
	selectedTaskId,
	getNextStatus,
	onOpenFile,
}: ChapterSectionProps) => {
	const completedTasks = chapter.tasks.filter((t) => t.status === TaskStatus.TASK_STATUS_COMPLETED).length

	return (
		<div className="mb-4 border border-vscode-panel-border rounded-lg overflow-hidden">
			{/* Chapter header */}
			<button
				className="w-full p-3 flex justify-between items-center bg-vscode-sideBar-background hover:bg-vscode-list-hoverBackground cursor-pointer text-left"
				onClick={onToggle}>
				<div className="flex items-center gap-3">
					<span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
					<div>
						<h3 className="text-base font-medium m-0">
							第{index + 1}章: {chapter.title}
						</h3>
						<p className="text-description text-sm m-0 mt-1">{chapter.description}</p>
					</div>
				</div>
				<span className="text-sm text-description">
					{completedTasks}/{chapter.tasks.length}
				</span>
			</button>

			{/* Tasks */}
			{isExpanded && (
				<div className="border-t border-vscode-panel-border">
					{chapter.tasks.map((task) => (
						<TaskItem
							key={task.id}
							task={task}
							isSelected={task.id === selectedTaskId}
							onSelect={() => onTaskSelect(task)}
							onStatusChange={(status) => onTaskStatusChange(task.id, status)}
							getNextStatus={getNextStatus}
							onOpenFile={onOpenFile}
						/>
					))}
				</div>
			)}
		</div>
	)
}

interface TaskItemProps {
	task: LearningTask
	isSelected?: boolean
	onSelect: () => void
	onStatusChange: (status: TaskStatus) => void
	getNextStatus: (status: TaskStatus) => TaskStatus
	onOpenFile: (filePath: string) => void
}

const TaskItem = ({ task, isSelected, onSelect, onStatusChange, getNextStatus, onOpenFile }: TaskItemProps) => {
	const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG[TaskStatus.UNRECOGNIZED]

	return (
		<div
			className={`p-3 border-b border-vscode-panel-border last:border-b-0 hover:bg-vscode-list-hoverBackground cursor-pointer ${
				isSelected ? "bg-vscode-list-activeSelectionBackground" : ""
			}`}
			onClick={onSelect}>
			<div className="flex items-start gap-3">
				{/* Status checkbox */}
				<button
					className="mt-1 w-5 h-5 flex items-center justify-center border rounded cursor-pointer flex-shrink-0"
					style={{
						borderColor: statusConfig.color,
						backgroundColor:
							task.status === TaskStatus.TASK_STATUS_COMPLETED ? statusConfig.color : "transparent",
					}}
					onClick={(e) => {
						e.stopPropagation()
						onStatusChange(getNextStatus(task.status))
					}}
					title={`クリックして状態を変更: ${statusConfig.label}`}>
					{task.status === TaskStatus.TASK_STATUS_COMPLETED && (
						<span className="text-white text-xs">✓</span>
					)}
					{task.status === TaskStatus.TASK_STATUS_IN_PROGRESS && (
						<span style={{ color: statusConfig.color }}>●</span>
					)}
				</button>

				{/* Task content */}
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h4 className="text-sm font-medium m-0">{task.title}</h4>
						<span
							className="text-xs px-2 py-0.5 rounded"
							style={{
								backgroundColor: `${statusConfig.color}20`,
								color: statusConfig.color,
							}}>
							{statusConfig.label}
						</span>
						{task.estimatedTime && (
							<span className="text-xs text-description">⏱ {task.estimatedTime}</span>
						)}
					</div>
					<p className="text-sm text-description m-0 mt-1 line-clamp-2">{task.description}</p>

					{/* Target files */}
					{task.targetFiles.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{task.targetFiles.slice(0, 3).map((file, idx) => (
								<button
									key={idx}
									className="text-xs px-1.5 py-0.5 rounded bg-vscode-textBlockQuote-background text-vscode-textLink-foreground hover:underline cursor-pointer"
									onClick={(e) => {
										e.stopPropagation()
										onOpenFile(file)
									}}
									title={`${file} を開く`}>
									📄 {file.split("/").pop()}
								</button>
							))}
							{task.targetFiles.length > 3 && (
								<span className="text-xs text-description">+{task.targetFiles.length - 3} more</span>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// Task Detail Panel Component
interface TaskDetailPanelProps {
	task: LearningTask
	onClose: () => void
	onStatusChange: (status: TaskStatus) => void
	onOpenFile: (filePath: string) => void
	onExplainCode?: (taskTitle: string, files: string[]) => void
}

const TaskDetailPanel = ({ task, onClose, onStatusChange, onOpenFile, onExplainCode }: TaskDetailPanelProps) => {
	const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG[TaskStatus.UNRECOGNIZED]

	return (
		<div className="w-1/2 overflow-y-auto bg-vscode-editor-background">
			{/* Header */}
			<div className="p-4 border-b border-vscode-panel-border sticky top-0 bg-vscode-editor-background">
				<div className="flex justify-between items-start">
					<h3 className="text-base font-medium m-0 flex-1">{task.title}</h3>
					<button
						className="text-lg hover:bg-vscode-list-hoverBackground rounded p-1 cursor-pointer"
						onClick={onClose}
						title="閉じる">
						✕
					</button>
				</div>
				<div className="flex items-center gap-2 mt-2">
					<span
						className="text-xs px-2 py-0.5 rounded"
						style={{
							backgroundColor: `${statusConfig.color}20`,
							color: statusConfig.color,
						}}>
						{statusConfig.label}
					</span>
					{task.estimatedTime && <span className="text-xs text-description">⏱ {task.estimatedTime}</span>}
				</div>
			</div>

			{/* Content */}
			<div className="p-4">
				{/* Description */}
				<section className="mb-6">
					<h4 className="text-sm font-medium mb-2">説明</h4>
					<p className="text-sm text-description m-0 whitespace-pre-wrap">{task.description}</p>
				</section>

				{/* Target Files */}
				{task.targetFiles.length > 0 && (
					<section className="mb-6">
						<h4 className="text-sm font-medium mb-2">関連ファイル</h4>
						<div className="flex flex-col gap-1">
							{task.targetFiles.map((file, idx) => (
								<button
									key={idx}
									className="text-sm px-2 py-1.5 rounded bg-vscode-textBlockQuote-background text-vscode-textLink-foreground hover:bg-vscode-list-hoverBackground cursor-pointer text-left flex items-center gap-2"
									onClick={() => onOpenFile(file)}
									title={`${file} を開く`}>
									<span>📄</span>
									<span className="flex-1">{file}</span>
									<span className="text-xs text-description">開く →</span>
								</button>
							))}
						</div>
						{/* Explain code button */}
						{onExplainCode && (
							<div className="mt-3">
								<VSCodeButton
									appearance="secondary"
									onClick={() => onExplainCode(task.title, task.targetFiles)}
									title="Clineに関連ファイルのコード解説を依頼">
									💡 コードを解説
								</VSCodeButton>
							</div>
						)}
					</section>
				)}

				{/* Prerequisites */}
				{task.prerequisites.length > 0 && (
					<section className="mb-6">
						<h4 className="text-sm font-medium mb-2">前提タスク</h4>
						<ul className="text-sm text-description m-0 pl-4">
							{task.prerequisites.map((prereq, idx) => (
								<li key={idx}>{prereq}</li>
							))}
						</ul>
					</section>
				)}

				{/* Status Actions */}
				<section className="mt-8 pt-4 border-t border-vscode-panel-border">
					<h4 className="text-sm font-medium mb-3">ステータス変更</h4>
					<div className="flex flex-wrap gap-2">
						<VSCodeButton
							appearance={task.status === TaskStatus.TASK_STATUS_NOT_STARTED ? "primary" : "secondary"}
							onClick={() => onStatusChange(TaskStatus.TASK_STATUS_NOT_STARTED)}>
							未着手
						</VSCodeButton>
						<VSCodeButton
							appearance={task.status === TaskStatus.TASK_STATUS_IN_PROGRESS ? "primary" : "secondary"}
							onClick={() => onStatusChange(TaskStatus.TASK_STATUS_IN_PROGRESS)}>
							進行中
						</VSCodeButton>
						<VSCodeButton
							appearance={task.status === TaskStatus.TASK_STATUS_COMPLETED ? "primary" : "secondary"}
							onClick={() => onStatusChange(TaskStatus.TASK_STATUS_COMPLETED)}>
							完了
						</VSCodeButton>
						<VSCodeButton
							appearance={task.status === TaskStatus.TASK_STATUS_SKIPPED ? "primary" : "secondary"}
							onClick={() => onStatusChange(TaskStatus.TASK_STATUS_SKIPPED)}>
							スキップ
						</VSCodeButton>
					</div>
				</section>
			</div>
		</div>
	)
}

export default CurriculumView
