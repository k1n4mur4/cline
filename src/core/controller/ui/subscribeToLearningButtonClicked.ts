import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { getRequestRegistry, StreamingResponseHandler } from "../grpc-handler"
import type { Controller } from "../index"

// Keep track of active learning button clicked subscriptions
const activeLearningButtonClickedSubscriptions = new Set<StreamingResponseHandler<Empty>>()

/**
 * Subscribe to learning button clicked events
 * @param controller The controller instance
 * @param request The empty request
 * @param responseStream The streaming response handler
 * @param requestId The ID of the request (passed by the gRPC handler)
 */
export async function subscribeToLearningButtonClicked(
	_controller: Controller,
	_request: EmptyRequest,
	responseStream: StreamingResponseHandler<Empty>,
	requestId?: string,
): Promise<void> {
	// Add this subscription to the active subscriptions
	activeLearningButtonClickedSubscriptions.add(responseStream)

	// Register cleanup when the connection is closed
	const cleanup = () => {
		activeLearningButtonClickedSubscriptions.delete(responseStream)
	}

	// Register the cleanup function with the request registry if we have a requestId
	if (requestId) {
		getRequestRegistry().registerRequest(requestId, cleanup, { type: "learning_button_clicked_subscription" }, responseStream)
	}
}

/**
 * Send a learning button clicked event to all active subscribers
 */
export async function sendLearningButtonClickedEvent(): Promise<void> {
	// Send the event to all active subscribers
	const promises = Array.from(activeLearningButtonClickedSubscriptions).map(async (responseStream) => {
		try {
			const event = Empty.create({})
			await responseStream(event, false) // Not the last message
		} catch (error) {
			console.error("Error sending learning button clicked event:", error)
			activeLearningButtonClickedSubscriptions.delete(responseStream)
		}
	})

	await Promise.all(promises)
}
