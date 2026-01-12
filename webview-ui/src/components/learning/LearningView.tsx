import { useState, useEffect } from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { LearningServiceClient } from "../../services/grpc-client"
import { GetProfileRequest, UserProfile, SaveProfileRequest } from "@shared/proto/cline/learning"
import { Tab, TabHeader, TabContent } from "../common/Tab"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import ProfileSetupView from "./ProfileSetupView"
import CurriculumView from "./CurriculumView"
import QuizView from "./QuizView"

type ViewState = "loading" | "quiz" | "profile" | "curriculum"

interface LearningViewProps {
	onDone?: () => void
}

export const LearningView = ({ onDone }: LearningViewProps) => {
	const [viewState, setViewState] = useState<ViewState>("loading")
	const [suggestedProfile, setSuggestedProfile] = useState<UserProfile | null>(null)

	useEffect(() => {
		checkProfile()
	}, [])

	const checkProfile = async () => {
		setViewState("loading")
		try {
			const response = await LearningServiceClient.getProfile(GetProfileRequest.create({}))
			if (response.exists && response.profile) {
				// Profile exists, show curriculum view
				setViewState("curriculum")
			} else {
				// No profile, start with quiz for level assessment
				setViewState("quiz")
			}
		} catch (error) {
			console.error("Error checking profile:", error)
			// On error, start with quiz
			setViewState("quiz")
		}
	}

	const handleQuizComplete = async (profile?: UserProfile) => {
		if (profile) {
			setSuggestedProfile(profile)
			// Save the suggested profile automatically
			try {
				await LearningServiceClient.saveProfile(
					SaveProfileRequest.create({
						profile,
					}),
				)
				// Go directly to curriculum after saving profile
				setViewState("curriculum")
			} catch (error) {
				console.error("Error saving profile:", error)
				// If save fails, go to profile setup to let user manually configure
				setViewState("profile")
			}
		} else {
			// No profile suggested, go to profile setup
			setViewState("profile")
		}
	}

	const handleProfileComplete = () => {
		// After profile setup, show curriculum view
		setViewState("curriculum")
	}

	const handleEditProfile = () => {
		setViewState("profile")
	}

	const handleStartQuiz = () => {
		setViewState("quiz")
	}

	// Loading state
	if (viewState === "loading") {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<h3 className="text-md m-0">学習モード</h3>
					<VSCodeButton onClick={onDone}>閉じる</VSCodeButton>
				</TabHeader>
				<TabContent className="flex items-center justify-center">
					<VSCodeProgressRing />
					<p className="text-description ml-3">読み込み中...</p>
				</TabContent>
			</Tab>
		)
	}

	// Quiz view (for level assessment before profile setup)
	if (viewState === "quiz") {
		return (
			<QuizView
				onComplete={handleQuizComplete}
				onBack={onDone}
				onGoToProfile={() => setViewState("profile")}
			/>
		)
	}

	// Profile setup view
	if (viewState === "profile") {
		return <ProfileSetupView onComplete={handleProfileComplete} onBack={onDone} />
	}

	// Curriculum view
	return (
		<Tab>
			<TabHeader className="flex justify-between items-center gap-2">
				<div>
					<h3 className="text-md m-0">学習モード</h3>
					<p className="text-description text-sm mt-1 mb-0">プロジェクトを学習するためのカリキュラム</p>
				</div>
				<VSCodeButton onClick={onDone}>閉じる</VSCodeButton>
			</TabHeader>
			<TabContent className="p-0">
				<CurriculumView onEditProfile={handleEditProfile} onBack={onDone} />
			</TabContent>
		</Tab>
	)
}

export default LearningView
