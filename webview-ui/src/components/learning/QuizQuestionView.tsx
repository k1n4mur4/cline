import { useState, useEffect, useRef } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import type { QuizQuestion, QuizChoice } from "@shared/proto/cline/learning"

interface QuizQuestionViewProps {
	question: QuizQuestion
	questionNumber: number
	totalQuestions: number
	onAnswer: (selectedChoiceId: string, timeSpentSeconds: number) => void
	showResult?: boolean
	selectedChoiceId?: string
	correctChoiceId?: string
	explanation?: string
}

export const QuizQuestionView = ({
	question,
	questionNumber,
	totalQuestions,
	onAnswer,
	showResult = false,
	selectedChoiceId,
	correctChoiceId,
	explanation,
}: QuizQuestionViewProps) => {
	const [selected, setSelected] = useState<string | null>(selectedChoiceId || null)
	const [timeSpent, setTimeSpent] = useState(0)
	const timerRef = useRef<NodeJS.Timeout | null>(null)
	const startTimeRef = useRef<number>(Date.now())

	// Start timer on mount
	useEffect(() => {
		startTimeRef.current = Date.now()
		timerRef.current = setInterval(() => {
			setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000))
		}, 1000)

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current)
			}
		}
	}, [question.id])

	// Reset when question changes
	useEffect(() => {
		if (!showResult) {
			setSelected(null)
			setTimeSpent(0)
			startTimeRef.current = Date.now()
		}
	}, [question.id, showResult])

	const handleSelect = (choiceId: string) => {
		if (showResult) return
		setSelected(choiceId)
	}

	const handleSubmit = () => {
		if (!selected) return
		const finalTime = Math.floor((Date.now() - startTimeRef.current) / 1000)
		if (timerRef.current) {
			clearInterval(timerRef.current)
		}
		onAnswer(selected, finalTime)
	}

	const getChoiceStyle = (choice: QuizChoice) => {
		const baseStyle = {
			backgroundColor: "var(--vscode-input-background)",
			borderWidth: "2px",
			borderStyle: "solid",
			borderColor: "var(--vscode-input-border)",
			color: "var(--vscode-foreground)",
			outline: "none",
			boxShadow: "none",
		}

		if (showResult) {
			// Show result state
			if (choice.id === correctChoiceId) {
				return {
					...baseStyle,
					backgroundColor: "var(--vscode-testing-iconPassed)",
					borderColor: "var(--vscode-testing-iconPassed)",
					color: "white",
				}
			}
			if (choice.id === selectedChoiceId && choice.id !== correctChoiceId) {
				return {
					...baseStyle,
					backgroundColor: "var(--vscode-testing-iconFailed)",
					borderColor: "var(--vscode-testing-iconFailed)",
					color: "white",
				}
			}
		} else if (selected === choice.id) {
			// Selected state
			return {
				...baseStyle,
				backgroundColor: "var(--vscode-button-background)",
				// Keep borderColor as var(--vscode-input-border) to prevent "glowing" or frame color change
				color: "var(--vscode-button-foreground)",
			}
		}

		return baseStyle
	}

	const progressPercent = (questionNumber / totalQuestions) * 100

	return (
		<div className="flex flex-col h-full">
			{/* Progress bar */}
			<div className="mb-4">
				<div className="flex justify-between items-center mb-2">
					<span className="text-sm font-medium">
						問題 {questionNumber}/{totalQuestions}
					</span>
					<span
						className="text-xs px-2 py-0.5 rounded"
						style={{
							backgroundColor: "var(--vscode-badge-background)",
							color: "var(--vscode-badge-foreground)",
						}}>
						{question.technology}
					</span>
				</div>
				<div
					className="h-2 rounded-full overflow-hidden"
					style={{ backgroundColor: "var(--vscode-progressBar-background)" }}>
					<div
						className="h-full rounded-full transition-all duration-300"
						style={{
							width: `${progressPercent}%`,
							backgroundColor: "var(--vscode-progressBar-background)",
							background: "var(--vscode-button-background)",
						}}
					/>
				</div>
			</div>

			{/* Difficulty badge */}
			<div className="mb-4">
				<span
					className="text-xs px-2 py-0.5 rounded"
					style={{
						backgroundColor:
							question.difficulty === "beginner"
								? "var(--vscode-testing-iconPassed)"
								: question.difficulty === "intermediate"
									? "var(--vscode-charts-yellow)"
									: "var(--vscode-testing-iconFailed)",
						color: "white",
					}}>
					{question.difficulty === "beginner"
						? "初級"
						: question.difficulty === "intermediate"
							? "中級"
							: "上級"}
				</span>
			</div>

			{/* Question text */}
			<div className="mb-6">
				<p className="text-base leading-relaxed">{question.questionText}</p>
			</div>

			{/* Choices */}
			<div className="flex-1 space-y-3">
				{question.choices.map((choice) => (
					<div
						key={choice.id}
						className={`p-4 rounded cursor-pointer transition-colors duration-200 outline-none focus:outline-none ${showResult ? "cursor-default" : "hover:opacity-80"}`}
						style={getChoiceStyle(choice)}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => handleSelect(choice.id)}>
						<div className="flex items-start gap-3">
							<span className="font-bold">{choice.id}.</span>
							<span>{choice.text}</span>
						</div>
					</div>
				))}
			</div>

			{/* Explanation (shown after answer) */}
			{showResult && explanation && (
				<div
					className="mt-4 p-4 rounded"
					style={{
						backgroundColor: "var(--vscode-textBlockQuote-background)",
						border: "1px solid var(--vscode-textBlockQuote-border)",
					}}>
					<p className="text-sm font-medium mb-1">解説</p>
					<p className="text-sm text-description m-0">{explanation}</p>
				</div>
			)}

			{/* Submit button */}
			<div className="mt-6 flex justify-between items-center">
				<span className="text-description text-sm">
					{showResult ? "" : `経過時間: ${timeSpent}秒`}
				</span>
				{!showResult && (
					<VSCodeButton onClick={handleSubmit} disabled={!selected}>
						回答する
					</VSCodeButton>
				)}
			</div>
		</div>
	)
}

export default QuizQuestionView
