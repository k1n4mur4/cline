import { useState, useEffect } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { LearningServiceClient } from "../../services/grpc-client"
import { GetAvailableTechnologiesRequest } from "@shared/proto/cline/learning"
import { Tab, TabHeader, TabContent } from "../common/Tab"

// Technology categories for display
const TECHNOLOGY_CATEGORIES: Record<string, string[]> = {
	"JavaScript/TypeScript": ["React", "Vue.js", "Angular", "Next.js", "Node.js", "TypeScript", "JavaScript"],
	Backend: ["Python", "Go", "Java", "Rust", "C#"],
	"Infrastructure/DevOps": ["Docker", "Kubernetes", "AWS", "GCP", "Terraform"],
	Database: ["PostgreSQL", "MySQL", "MongoDB", "Redis"],
}

interface TechSelectionViewProps {
	onSelect: (technologies: string[]) => void
	onBack?: () => void
	initialTechnologies?: string[]
}

export const TechSelectionView = ({ onSelect, onBack, initialTechnologies = [] }: TechSelectionViewProps) => {
	const [selectedTech, setSelectedTech] = useState<Set<string>>(new Set(initialTechnologies))
	const [detectedTech, setDetectedTech] = useState<string[]>([])
	const [hasProject, setHasProject] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const loadTechnologies = async () => {
			try {
				const response = await LearningServiceClient.getAvailableTechnologies(
					GetAvailableTechnologiesRequest.create({}),
				)
				setHasProject(response.hasProject)
				if (response.detectedTechnologies && response.detectedTechnologies.length > 0) {
					setDetectedTech(response.detectedTechnologies)
					// Auto-select detected technologies
					setSelectedTech(new Set(response.detectedTechnologies.slice(0, 5)))
				}
			} catch (error) {
				console.error("Error loading technologies:", error)
			} finally {
				setIsLoading(false)
			}
		}
		loadTechnologies()
	}, [])

	const handleTechToggle = (tech: string) => {
		const newSelected = new Set(selectedTech)
		if (newSelected.has(tech)) {
			newSelected.delete(tech)
		} else if (newSelected.size < 5) {
			newSelected.add(tech)
		}
		setSelectedTech(newSelected)
	}

	const handleStart = () => {
		onSelect(Array.from(selectedTech))
	}

	const handleUseDetected = () => {
		if (detectedTech.length > 0) {
			onSelect(detectedTech.slice(0, 5))
		}
	}

	if (isLoading) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<h3 className="text-md m-0">技術力診断</h3>
					{onBack && <VSCodeButton onClick={onBack}>閉じる</VSCodeButton>}
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
					<h3 className="text-md m-0">技術力診断</h3>
					<p className="text-description text-sm mt-1 mb-0">あなたに最適な学習カリキュラムを作成します</p>
				</div>
				{onBack && <VSCodeButton onClick={onBack}>閉じる</VSCodeButton>}
			</TabHeader>

			<TabContent className="p-5">
				{/* Purpose explanation */}
				<div
					className="mb-6 p-4 rounded"
					style={{
						backgroundColor: "var(--vscode-textBlockQuote-background)",
						border: "1px solid var(--vscode-textBlockQuote-border)",
					}}>
					<h4 className="text-sm font-medium m-0 mb-2">診断の目的</h4>
					<ul className="text-sm text-description m-0 pl-4 space-y-1">
						<li>選択した技術に関する簡単なクイズ（5問）に回答していただきます</li>
						<li>回答結果から、あなたの技術レベルを自動的に判定します</li>
						<li>判定結果をもとに、あなたに最適化された学習カリキュラムを生成します</li>
					</ul>
					<p className="text-xs text-description mt-3 mb-0">
						所要時間: 約3〜5分
					</p>
				</div>

				{/* Auto-detected technologies message */}
				{hasProject && detectedTech.length > 0 && (
					<div
						className="mb-6 p-4 rounded"
						style={{
							backgroundColor: "var(--vscode-textBlockQuote-background)",
							border: "1px solid var(--vscode-textBlockQuote-border)",
						}}>
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium m-0 mb-1">プロジェクトから技術を検出しました</p>
								<p className="text-description text-sm m-0">
									{detectedTech.slice(0, 5).join(", ")}
								</p>
							</div>
							<VSCodeButton onClick={handleUseDetected}>検出技術で診断</VSCodeButton>
						</div>
					</div>
				)}

				{/* Technology selection */}
				<section>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-base font-medium m-0">診断する技術を選択（最大5つ）</h2>
						<span className="text-description text-sm">{selectedTech.size}/5 選択中</span>
					</div>

					{Object.entries(TECHNOLOGY_CATEGORIES).map(([category, technologies]) => (
						<div key={category} className="mb-5">
							<h3 className="text-sm font-medium mb-2" style={{ color: "var(--vscode-foreground)" }}>
								{category}
							</h3>
							<div className="flex flex-wrap gap-2">
								{technologies.map((tech) => {
									const isSelected = selectedTech.has(tech)
									const isDisabled = !isSelected && selectedTech.size >= 5
									return (
										<button
											key={tech}
											type="button"
											className={`
												px-3 py-1.5 rounded cursor-pointer transition-colors focus:outline-none
												${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
											`}
											style={{
												backgroundColor: isSelected
													? "var(--vscode-button-background)"
													: "var(--vscode-input-background)",
												color: isSelected
													? "var(--vscode-button-foreground)"
													: "var(--vscode-foreground)",
												border: `1px solid ${isSelected ? "var(--vscode-button-background)" : "var(--vscode-input-border)"}`,
											}}
											disabled={isDisabled}
											onClick={() => handleTechToggle(tech)}>
											<span className="text-sm">{tech}</span>
										</button>
									)
								})}
							</div>
						</div>
					))}
				</section>

				{/* Start button */}
				<div className="mt-8 flex justify-end">
					<VSCodeButton onClick={handleStart} disabled={selectedTech.size === 0}>
						診断を開始 ({selectedTech.size}件)
					</VSCodeButton>
				</div>
			</TabContent>
		</Tab>
	)
}

export default TechSelectionView
