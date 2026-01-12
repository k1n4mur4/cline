import { useState, useEffect } from "react"
import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { LearningServiceClient } from "../../services/grpc-client"
import {
	DetectTechStackRequest,
	GetProfileRequest,
	SaveProfileRequest,
	UserProfile,
} from "@shared/proto/cline/learning"
import { Tab, TabHeader, TabContent } from "../common/Tab"

// Experience level options
const EXPERIENCE_LEVELS = [
	{ value: "less_than_1_year", label: "1年未満" },
	{ value: "1_to_3_years", label: "1〜3年" },
	{ value: "3_to_5_years", label: "3〜5年" },
	{ value: "more_than_5_years", label: "5年以上" },
]

// Primary role options
const PRIMARY_ROLES = [
	{ value: "frontend", label: "Frontend" },
	{ value: "backend", label: "Backend" },
	{ value: "fullstack", label: "Fullstack" },
	{ value: "mobile", label: "Mobile" },
	{ value: "devops", label: "DevOps" },
	{ value: "other", label: "その他" },
]

// Proficiency level options
const PROFICIENCY_LEVELS = [
	{ value: "no_experience", label: "未経験" },
	{ value: "basic", label: "基礎知識あり" },
	{ value: "practical", label: "実務経験あり" },
	{ value: "expert", label: "エキスパート" },
]

// Learning goal options
const LEARNING_GOALS = [
	{ value: "overview", label: "全体像の把握" },
	{ value: "feature_development", label: "機能追加・修正が可能になる" },
	{ value: "architecture", label: "アーキテクチャ理解" },
	{ value: "code_review", label: "コードレビュー参加" },
]

// Learning style options
const LEARNING_STYLES = [
	{ value: "theory", label: "理論重視" },
	{ value: "hands_on", label: "実践（ハンズオン）重視" },
	{ value: "sample_code", label: "サンプルコード重視" },
]

interface ProfileSetupViewProps {
	onComplete?: () => void
	onBack?: () => void
}

export const ProfileSetupView = ({ onComplete, onBack }: ProfileSetupViewProps) => {
	const [experienceLevel, setExperienceLevel] = useState("")
	const [primaryRole, setPrimaryRole] = useState("")
	const [learningGoal, setLearningGoal] = useState("")
	const [learningStyle, setLearningStyle] = useState("")
	const [detectedTech, setDetectedTech] = useState<string[]>([])
	const [techProficiency, setTechProficiency] = useState<Record<string, string>>({})
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	// Load existing profile and detect tech stack on mount
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true)
			try {
				// Detect tech stack
				const techResponse = await LearningServiceClient.detectTechStack(DetectTechStackRequest.create({}))
				if (techResponse.technologies) {
					setDetectedTech(techResponse.technologies)
					// Initialize proficiency for each detected tech
					const initialProficiency: Record<string, string> = {}
					techResponse.technologies.forEach((tech) => {
						initialProficiency[tech] = "no_experience"
					})
					setTechProficiency(initialProficiency)
				}

				// Load existing profile if any
				const profileResponse = await LearningServiceClient.getProfile(GetProfileRequest.create({}))
				if (profileResponse.exists && profileResponse.profile) {
					const profile = profileResponse.profile
					setExperienceLevel(profile.experienceLevel || "")
					setPrimaryRole(profile.primaryRole || "")
					setLearningGoal(profile.learningGoal || "")
					setLearningStyle(profile.learningStyle || "")
					if (profile.techStackProficiency) {
						setTechProficiency((prev) => ({
							...prev,
							...profile.techStackProficiency,
						}))
					}
				}
			} catch (error) {
				console.error("Error loading data:", error)
			} finally {
				setIsLoading(false)
			}
		}
		loadData()
	}, [])

	const handleSave = async () => {
		setIsSaving(true)
		try {
			await LearningServiceClient.saveProfile(
				SaveProfileRequest.create({
					profile: UserProfile.create({
						experienceLevel,
						primaryRole,
						techStackProficiency: techProficiency,
						learningGoal,
						learningStyle,
					}),
				}),
			)
			onComplete?.()
		} catch (error) {
			console.error("Error saving profile:", error)
		} finally {
			setIsSaving(false)
		}
	}

	const handleTechProficiencyChange = (tech: string, level: string) => {
		setTechProficiency((prev) => ({
			...prev,
			[tech]: level,
		}))
	}

	const isFormValid = experienceLevel && primaryRole && learningGoal && learningStyle

	if (isLoading) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<h3 className="text-md m-0">学習プロファイル設定</h3>
					<VSCodeButton onClick={onBack}>閉じる</VSCodeButton>
				</TabHeader>
				<TabContent className="flex items-center justify-center">
					<p className="text-description">読み込み中...</p>
				</TabContent>
			</Tab>
		)
	}

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center gap-2">
				<div>
					<h3 className="text-md m-0">学習プロファイル設定</h3>
					<p className="text-description text-sm mt-1 mb-0">
						あなたのスキルと学習スタイルを教えてください。最適なカリキュラムを生成します。
					</p>
				</div>
				<VSCodeButton onClick={onBack}>閉じる</VSCodeButton>
			</TabHeader>

			<TabContent className="p-5">
				{/* Basic Information */}
				<section className="mb-6">
					<h2 className="text-base font-medium mb-3">基本情報</h2>

					<div className="space-y-4">
						<div>
							<label className="block text-sm mb-1">エンジニア歴</label>
							<VSCodeDropdown
								value={experienceLevel}
								onChange={(e: any) => setExperienceLevel(e.target.value)}
								style={{ maxWidth: "300px", width: "100%" }}>
								<VSCodeOption value="">選択してください</VSCodeOption>
								{EXPERIENCE_LEVELS.map((level) => (
									<VSCodeOption key={level.value} value={level.value}>
										{level.label}
									</VSCodeOption>
								))}
							</VSCodeDropdown>
						</div>

						<div>
							<label className="block text-sm mb-1">主な役割</label>
							<VSCodeDropdown
								value={primaryRole}
								onChange={(e: any) => setPrimaryRole(e.target.value)}
								style={{ maxWidth: "300px", width: "100%" }}>
								<VSCodeOption value="">選択してください</VSCodeOption>
								{PRIMARY_ROLES.map((role) => (
									<VSCodeOption key={role.value} value={role.value}>
										{role.label}
									</VSCodeOption>
								))}
							</VSCodeDropdown>
						</div>
					</div>
				</section>

				{/* Tech Stack Proficiency */}
				{detectedTech.length > 0 && (
					<section className="mb-6">
						<h2 className="text-base font-medium mb-3">技術スタック習熟度</h2>
						<p className="text-description text-sm mb-3">
							プロジェクトで検出された技術について、あなたの習熟度を選択してください。
						</p>

						<div className="space-y-3">
							{detectedTech.map((tech) => (
								<div key={tech} className="flex items-center gap-4">
									<span className="w-32 text-sm">{tech}</span>
									<VSCodeDropdown
										value={techProficiency[tech] || "no_experience"}
										onChange={(e: any) => handleTechProficiencyChange(tech, e.target.value)}
										style={{ maxWidth: "200px", width: "100%" }}>
										{PROFICIENCY_LEVELS.map((level) => (
											<VSCodeOption key={level.value} value={level.value}>
												{level.label}
											</VSCodeOption>
										))}
									</VSCodeDropdown>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Learning Goal */}
				<section className="mb-6">
					<h2 className="text-base font-medium mb-3">学習ゴール</h2>

					<div>
						<VSCodeDropdown
							value={learningGoal}
							onChange={(e: any) => setLearningGoal(e.target.value)}
							style={{ maxWidth: "300px", width: "100%" }}>
							<VSCodeOption value="">選択してください</VSCodeOption>
							{LEARNING_GOALS.map((goal) => (
								<VSCodeOption key={goal.value} value={goal.value}>
									{goal.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
					</div>
				</section>

				{/* Learning Style */}
				<section className="mb-6">
					<h2 className="text-base font-medium mb-3">学習スタイル</h2>

					<div>
						<VSCodeDropdown
							value={learningStyle}
							onChange={(e: any) => setLearningStyle(e.target.value)}
							style={{ maxWidth: "300px", width: "100%" }}>
							<VSCodeOption value="">選択してください</VSCodeOption>
							{LEARNING_STYLES.map((style) => (
								<VSCodeOption key={style.value} value={style.value}>
									{style.label}
								</VSCodeOption>
							))}
						</VSCodeDropdown>
					</div>
				</section>

				{/* Save Button */}
				<div className="mt-8 flex justify-end">
					<VSCodeButton onClick={handleSave} disabled={!isFormValid || isSaving}>
						{isSaving ? "保存中..." : "保存して学習を開始"}
					</VSCodeButton>
				</div>
			</TabContent>
		</Tab>
	)
}

export default ProfileSetupView
