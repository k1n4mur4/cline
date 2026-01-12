import { useState, useCallback, useEffect } from "react"
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { LearningServiceClient } from "../../services/grpc-client"
import {
	GenerateQuizRequest,
	SubmitQuizAnswerRequest,
	CompleteQuizRequest,
	Quiz,
	QuizQuestion,
	QuizResult,
	UserProfile,
	QuizGenerationProgress,
} from "@shared/proto/cline/learning"
import { Tab, TabHeader, TabContent } from "../common/Tab"
import TechSelectionView from "./TechSelectionView"
import QuizQuestionView from "./QuizQuestionView"
import QuizResultView from "./QuizResultView"

type QuizPhase = "tech_selection" | "generating" | "question" | "result"

interface AnswerState {
	selectedChoiceId: string
	correctChoiceId: string
	explanation: string
	isCorrect: boolean
}

interface QuizViewProps {
	onComplete: (profile?: UserProfile) => void
	onBack?: () => void
	onGoToProfile?: () => void
	initialTechnologies?: string[]
}

export const QuizView = ({ onComplete, onBack, onGoToProfile, initialTechnologies }: QuizViewProps) => {
	const [phase, setPhase] = useState<QuizPhase>(
		initialTechnologies && initialTechnologies.length > 0 ? "generating" : "tech_selection",
	)
	const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>(initialTechnologies || [])
	const [quiz, setQuiz] = useState<Quiz | null>(null)
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [answerState, setAnswerState] = useState<AnswerState | null>(null)
	const [result, setResult] = useState<QuizResult | null>(null)
	const [suggestedProfile, setSuggestedProfile] = useState<UserProfile | null>(null)
	const [generationProgress, setGenerationProgress] = useState(0)
	const [generationStep, setGenerationStep] = useState("")
	const [error, setError] = useState<string | null>(null)

	// Start quiz generation
	const startQuizGeneration = useCallback(
		async (technologies: string[]) => {
			setSelectedTechnologies(technologies)
			setPhase("generating")
			setGenerationProgress(0)
			setGenerationStep("クイズを準備中...")
			setError(null)

			try {
				const unsubscribe = LearningServiceClient.generateQuiz(
					GenerateQuizRequest.create({
						technologies,
						useProjectContext: false,
					}),
					{
						onResponse: (progress: QuizGenerationProgress) => {
							setGenerationProgress(progress.progressPercent)
							setGenerationStep(progress.currentStep)

							if (progress.phase === "completed" && progress.partialQuiz) {
								setQuiz(progress.partialQuiz)
								setPhase("question")
								setCurrentQuestionIndex(0)
								setAnswerState(null)
							} else if (progress.phase === "error") {
								setError(progress.errorMessage || "クイズ生成中にエラーが発生しました")
								setPhase("tech_selection")
							}
						},
						onError: (err: Error) => {
							console.error("Quiz generation error:", err)
							setError("クイズ生成中にエラーが発生しました")
							setPhase("tech_selection")
						},
						onComplete: () => {
							// Streaming complete
						},
					},
				)

				// Cleanup function
				return () => {
					unsubscribe()
				}
			} catch (err) {
				console.error("Failed to start quiz generation:", err)
				setError("クイズ生成の開始に失敗しました")
				setPhase("tech_selection")
			}
		},
		[],
	)

	// Start generation if initial technologies provided
	useEffect(() => {
		if (initialTechnologies && initialTechnologies.length > 0) {
			startQuizGeneration(initialTechnologies)
		}
	}, [])

	// Handle tech selection
	const handleTechSelect = (technologies: string[]) => {
		startQuizGeneration(technologies)
	}

	// Handle answer submission
	const handleAnswer = async (selectedChoiceId: string, timeSpentSeconds: number) => {
		if (!quiz) return

		const currentQuestion = quiz.questions[currentQuestionIndex]

		try {
			const response = await LearningServiceClient.submitQuizAnswer(
				SubmitQuizAnswerRequest.create({
					quizId: quiz.id,
					questionId: currentQuestion.id,
					selectedChoiceId,
					timeSpentSeconds,
				}),
			)

			setAnswerState({
				selectedChoiceId,
				correctChoiceId: response.correctChoiceId,
				explanation: response.explanation,
				isCorrect: response.isCorrect,
			})
		} catch (err) {
			console.error("Failed to submit answer:", err)
		}
	}

	// Move to next question or show results
	const handleNext = async () => {
		if (!quiz) return

		if (currentQuestionIndex < quiz.questions.length - 1) {
			setCurrentQuestionIndex((prev) => prev + 1)
			setAnswerState(null)
		} else {
			// Complete quiz
			try {
				const response = await LearningServiceClient.completeQuiz(
					CompleteQuizRequest.create({
						quizId: quiz.id,
					}),
				)

				if (response.result) {
					setResult(response.result)
					if (response.suggestedProfile) {
						setSuggestedProfile(response.suggestedProfile)
					}
					setPhase("result")
				} else {
					console.error("CompleteQuiz returned no result")
					setError("診断結果の取得に失敗しました")
					setPhase("tech_selection")
				}
			} catch (err) {
				console.error("Failed to complete quiz:", err)
				setError("クイズの完了に失敗しました")
				setPhase("tech_selection")
			}
		}
	}

	// Handle go to profile
	const handleGoToProfile = () => {
		if (onGoToProfile) {
			onGoToProfile()
		}
	}

	// Handle go to curriculum
	const handleGoToCurriculum = () => {
		onComplete(suggestedProfile || undefined)
	}

	// Render tech selection phase
	if (phase === "tech_selection") {
		return (
			<TechSelectionView
				onSelect={handleTechSelect}
				onBack={onBack}
				initialTechnologies={selectedTechnologies}
			/>
		)
	}

	// Render generating phase
	if (phase === "generating") {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<h3 className="text-md m-0">技術力診断</h3>
					{onBack && <VSCodeButton onClick={onBack}>閉じる</VSCodeButton>}
				</TabHeader>
				<TabContent className="flex flex-col items-center justify-center min-h-64 p-8">
					<VSCodeProgressRing />
					<p className="text-description mt-4 mb-2">{generationStep}</p>
					<div className="w-full max-w-xs">
						<div
							className="h-2 rounded-full overflow-hidden"
							style={{ backgroundColor: "var(--vscode-input-background)" }}>
							<div
								className="h-full rounded-full transition-all duration-300"
								style={{
									width: `${generationProgress}%`,
									backgroundColor: "var(--vscode-button-background)",
								}}
							/>
						</div>
						<p className="text-description text-sm text-center mt-2">{generationProgress}%</p>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Render question phase
	if (phase === "question" && quiz) {
		const currentQuestion = quiz.questions[currentQuestionIndex]
		const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1

		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<h3 className="text-md m-0">技術力診断</h3>
					{onBack && <VSCodeButton onClick={onBack}>閉じる</VSCodeButton>}
				</TabHeader>
				<TabContent className="p-5">
					<QuizQuestionView
						key={currentQuestion.id}
						question={currentQuestion}
						questionNumber={currentQuestionIndex + 1}
						totalQuestions={quiz.questions.length}
						onAnswer={handleAnswer}
						showResult={!!answerState}
						selectedChoiceId={answerState?.selectedChoiceId}
						correctChoiceId={answerState?.correctChoiceId}
						explanation={answerState?.explanation}
					/>

					{answerState && (
						<div className="mt-6 flex justify-end">
							<VSCodeButton onClick={handleNext}>
								{isLastQuestion ? "結果を見る" : "次の問題へ"}
							</VSCodeButton>
						</div>
					)}
				</TabContent>
			</Tab>
		)
	}

	// Render result phase
	if (phase === "result" && result) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<h3 className="text-md m-0">診断結果</h3>
					{onBack && <VSCodeButton onClick={onBack}>閉じる</VSCodeButton>}
				</TabHeader>
				<TabContent>
					<QuizResultView
						result={result}
						suggestedProfile={suggestedProfile || undefined}
						onGoToProfile={handleGoToProfile}
						onGoToCurriculum={handleGoToCurriculum}
					/>
				</TabContent>
			</Tab>
		)
	}

	// Auto-recovery for invalid states
	if (phase === "question" && !quiz) {
		console.error("Invalid state: phase is 'question' but quiz is null")
		// Cannot recover automatically inside render reliably, but showing error is better
		// Ideally we should use useEffect to reset, but here we'll just show the error UI
	}

	// Fallback
	return (
		<Tab>
			<TabHeader className="flex justify-between items-center gap-2">
				<h3 className="text-md m-0">技術力診断</h3>
				{onBack && <VSCodeButton onClick={onBack}>閉じる</VSCodeButton>}
			</TabHeader>
			<TabContent className="flex items-center justify-center min-h-64">
				{error ? (
					<div className="text-center">
						<p className="text-description mb-4">{error}</p>
						<VSCodeButton onClick={() => setPhase("tech_selection")}>やり直す</VSCodeButton>
					</div>
				) : (
					<div className="text-center">
						<p className="text-description">読み込み中...</p>
						<p className="text-xs text-description mt-2">(Phase: {phase})</p>
					</div>
				)}
			</TabContent>
		</Tab>
	)
}

export default QuizView
