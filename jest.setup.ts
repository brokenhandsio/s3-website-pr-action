// Mock @actions/core
jest.mock('@actions/core', () => ({
	getInput: jest.fn().mockReturnValue(''),
	setOutput: jest.fn(),
	setFailed: jest.fn(),
	info: jest.fn(),
	debug: jest.fn(),
	warning: jest.fn(),
	error: jest.fn()
}), { virtual: true })

// Mock @actions/github with a default context
jest.mock('@actions/github', () => ({
	context: {
		eventName: 'pull_request',
		payload: {
			action: 'opened',
			pull_request: {
				number: 1,
				head: { ref: 'test-branch' }
			}
		},
		repo: {
			owner: 'test-owner',
			repo: 'test-repo'
		},
		ref: 'refs/heads/main'
	},
	getOctokit: jest.fn()
}), { virtual: true })
