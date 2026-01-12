import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import type { QuizResult, UserProfile } from "@shared/proto/cline/learning"

interface QuizResultViewProps {
	result: QuizResult
	suggestedProfile?: UserProfile
	onGoToProfile: () => void
	onGoToCurriculum: () => void
}

// Human-readable proficiency labels
const PROFICIENCY_LABELS: Record<string, string> = {
	no_experience: "未経験",
	basic: "基礎レベル",
	practical: "実践レベル",
	expert: "エキスパート",
}

// Human-readable overall level labels
const OVERALL_LEVEL_LABELS: Record<string, string> = {
	beginner: "初級者",
	intermediate: "中級者",
	advanced: "上級者",
}

// Color for proficiency level bars
const getProficiencyColor = (level: string): string => {
	switch (level) {
		case "expert":
			return "var(--vscode-testing-iconPassed)"
		case "practical":
			return "var(--vscode-charts-blue)"
		case "basic":
			return "var(--vscode-charts-yellow)"
		default:
			return "var(--vscode-disabledForeground)"
	}
}

// Width percentage for proficiency level
const getProficiencyWidth = (level: string): number => {
	switch (level) {
		case "expert":
			return 100
		case "practical":
			return 75
		case "basic":
			return 50
		default:
			return 25
	}
}

export const QuizResultView = ({
	result,
	suggestedProfile,
	onGoToProfile,
	onGoToCurriculum,
}: QuizResultViewProps) => {
	const scorePercent = Math.round(result.overallScore * 100)
	const correctCount = result.answers.filter((a) => a.isCorrect).length
	const totalCount = result.answers.length

	return (
		<div className="p-5">
			{/* Header */}
			<div className="text-center mb-8">
				<h2 className="text-xl font-bold mb-2">診断完了!</h2>
				<p className="text-description">あなたの技術力を分析しました</p>
			</div>

			{/* Overall Score */}
			<div
				className="p-6 rounded-lg mb-6 text-center"
				style={{
					backgroundColor: "var(--vscode-textBlockQuote-background)",
					border: "1px solid var(--vscode-textBlockQuote-border)",
				}}>
				<div className="mb-4">
					<span className="text-4xl font-bold">{scorePercent}%</span>
					<span className="text-description ml-2">
						({correctCount}/{totalCount} 正解)
					</span>
				</div>

				<div
					className="inline-block px-4 py-2 rounded-full"
					style={{
						backgroundColor:
							result.overallLevel === "advanced"
								? "var(--vscode-testing-iconPassed)"
								: result.overallLevel === "intermediate"
									? "var(--vscode-charts-blue)"
									: "var(--vscode-charts-yellow)",
						color: "white",
					}}>
					<span className="font-medium">
						{OVERALL_LEVEL_LABELS[result.overallLevel] || result.overallLevel}
					</span>
				</div>
			</div>

			{/* Technology Breakdown */}
			<div className="mb-8">
				<h3 className="text-base font-medium mb-4">技術別レベル</h3>

				<div className="space-y-4">
					{Object.entries(result.proficiencyLevels).map(([tech, level]) => {
						// Count correct answers for this technology
						const techAnswers = result.answers.filter((a) => {
							// Note: We don't have direct access to question's technology here
							// This is simplified - in reality, you'd track this during the quiz
							return true
						})

						return (
							<div key={tech}>
								<div className="flex justify-between items-center mb-1">
									<span className="text-sm font-medium">{tech}</span>
									<span className="text-sm text-description">
										{PROFICIENCY_LABELS[level] || level}
									</span>
								</div>
								<div
									className="h-3 rounded-full overflow-hidden"
									style={{ backgroundColor: "var(--vscode-input-background)" }}>
									<div
										className="h-full rounded-full transition-all duration-500"
										style={{
											width: `${getProficiencyWidth(level)}%`,
											backgroundColor: getProficiencyColor(level),
										}}
									/>
								</div>
							</div>
						)
					})}
				</div>
			</div>

			{/* Summary Message */}
			<div
				className="p-4 rounded mb-8"
				style={{
					backgroundColor: "var(--vscode-textBlockQuote-background)",
					border: "1px solid var(--vscode-textBlockQuote-border)",
				}}>
				<p className="text-sm m-0">
					{result.overallLevel === "advanced" && (
						<>
							素晴らしい結果です! 選択した技術について深い理解をお持ちです。
							より高度な内容に挑戦してみましょう。
						</>
					)}
					{result.overallLevel === "intermediate" && (
						<>
							良い結果です! 基礎的な理解はできています。
							実践的な経験を積むことで、さらにスキルアップできるでしょう。
						</>
					)}
					{result.overallLevel === "beginner" && (
						<>
							学習のスタート地点として良い結果です!
							基礎から順番に学んでいくことで、着実にスキルアップできます。
						</>
					)}
				</p>
			</div>

			{/* Action Buttons */}
			<div className="flex gap-4 justify-center">
				<VSCodeButton appearance="secondary" onClick={onGoToProfile}>
					プロファイルを編集
				</VSCodeButton>
				<VSCodeButton onClick={onGoToCurriculum}>カリキュラム生成へ</VSCodeButton>
			</div>
		</div>
	)
}

export default QuizResultView
