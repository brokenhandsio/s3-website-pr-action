// Types for mock clients
export type MockS3Client = {
	send: jest.Mock
}

export type MockGithubClient = {
	rest: {
		repos: {
			listDeployments: jest.Mock
			createDeployment: jest.Mock
			createDeploymentStatus: jest.Mock
			deleteDeployment: jest.Mock
		}
	}
}

// Factory functions for creating mock clients
export function createMockS3Client(): MockS3Client {
	return {
		send: jest.fn()
	}
}

export function createMockGithubClient(): MockGithubClient {
	return {
		rest: {
			repos: {
				listDeployments: jest.fn(),
				createDeployment: jest.fn(),
				createDeploymentStatus: jest.fn(),
				deleteDeployment: jest.fn()
			}
		}
	}
}

// Helper to setup @actions/core mocks
export function mockActionsCore() {
	const mockGetInput = jest.fn()
	const mockSetOutput = jest.fn()
	const mockSetFailed = jest.fn()

	jest.doMock('@actions/core', () => ({
		getInput: mockGetInput,
		setOutput: mockSetOutput,
		setFailed: mockSetFailed
	}))

	return { mockGetInput, mockSetOutput, mockSetFailed }
}

// Helper to setup @actions/github context mocks
export function createMockGithubContext(options: {
	eventName?: string
	action?: string
	prNumber?: number
	ref?: string
	owner?: string
	repo?: string
}) {
	const {
		eventName = 'pull_request',
		action = 'opened',
		prNumber = 123,
		ref = 'feature-branch',
		owner = 'test-owner',
		repo = 'test-repo'
	} = options

	return {
		eventName,
		payload: {
			action,
			pull_request: prNumber ? {
				number: prNumber,
				head: { ref }
			} : undefined
		},
		repo: { owner, repo },
		ref: `refs/heads/${ref}`
	}
}
