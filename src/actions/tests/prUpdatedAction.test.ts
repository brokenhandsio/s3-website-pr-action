import { setS3Client, resetS3Client } from '../../s3Client'
import { setGithubClient, resetGithubClient } from '../../githubClient'
import prUpdatedAction from '../prUpdatedAction'
import { createMockS3Client, createMockGithubClient } from '../../tests/testUtils'
import * as github from '@actions/github'
import * as core from '@actions/core'

// Mock s3UploadDirectory
jest.mock('../../utils/s3UploadDirectory', () => jest.fn().mockResolvedValue(undefined))

// Mock checkBucketExists
jest.mock('../../utils/checkBucketExists')
import checkBucketExists from '../../utils/checkBucketExists'
const mockCheckBucketExists = checkBucketExists as jest.MockedFunction<typeof checkBucketExists>

// Override context for these tests
beforeAll(() => {
	(github.context as any).eventName = 'pull_request';
	(github.context as any).payload = {
		pull_request: {
			number: 42,
			head: { ref: 'feature-branch' }
		}
	};
	(github.context as any).repo = {
		owner: 'test-owner',
		repo: 'test-repo'
	}
})

// Set up env vars
process.env.AWS_ACCESS_KEY_ID = 'test-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
process.env.GITHUB_TOKEN = 'test-token'

describe('prUpdatedAction', () => {
	let mockS3Client: ReturnType<typeof createMockS3Client>
	let mockGithubClient: ReturnType<typeof createMockGithubClient>

	beforeEach(() => {
		mockS3Client = createMockS3Client()
		mockGithubClient = createMockGithubClient()
		setS3Client(mockS3Client)
		setGithubClient(mockGithubClient)

		// Default mock responses
		mockS3Client.send.mockResolvedValue({})
		mockGithubClient.rest.repos.listDeployments.mockResolvedValue({ data: [] })
		mockGithubClient.rest.repos.createDeployment.mockResolvedValue({
			data: { id: 456 }
		})
		mockGithubClient.rest.repos.createDeploymentStatus.mockResolvedValue({})
		mockCheckBucketExists.mockResolvedValue(false)
	})

	afterEach(() => {
		resetS3Client()
		resetGithubClient()
		jest.clearAllMocks()
	})

	test('should create bucket when it does not exist', async () => {
		mockCheckBucketExists.mockResolvedValueOnce(false)

		await prUpdatedAction(
			'test-bucket',
			'us-east-1',
			'./dist',
			'PR-',
			'index.html',
			'error.html'
		)

		// Should have called S3 to create bucket (4 calls: create, ownership, access block, website)
		expect(mockS3Client.send).toHaveBeenCalledTimes(4)

		// First call should be CreateBucketCommand
		const createBucketCall = mockS3Client.send.mock.calls[0][0]
		expect(createBucketCall.input.Bucket).toBe('test-bucket')
	})

	test('should skip bucket creation when bucket exists', async () => {
		mockCheckBucketExists.mockResolvedValueOnce(true)

		await prUpdatedAction(
			'test-bucket',
			'us-east-1',
			'./dist',
			'PR-',
			'index.html',
			'error.html'
		)

		// Should not call S3 for bucket creation
		expect(mockS3Client.send).not.toHaveBeenCalled()
	})

	test('should create deployment and set status', async () => {
		mockCheckBucketExists.mockResolvedValueOnce(true)

		await prUpdatedAction(
			'test-bucket',
			'us-east-1',
			'./dist',
			'PR-',
			'index.html',
			'error.html'
		)

		expect(mockGithubClient.rest.repos.createDeployment).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: 'test-owner',
				repo: 'test-repo',
				ref: 'refs/heads/feature-branch',
				environment: 'PR-42',
				transient_environment: true
			})
		)

		// Should set in_progress status first
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				deployment_id: 456,
				state: 'in_progress'
			})
		)

		// Should set success status after upload
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				deployment_id: 456,
				state: 'success',
				environment_url: 'http://test-bucket.s3-website.us-east-1.amazonaws.com/'
			})
		)
	})

	test('should set websiteUrl output', async () => {
		mockCheckBucketExists.mockResolvedValueOnce(true)

		await prUpdatedAction(
			'test-bucket',
			'us-east-1',
			'./dist',
			'PR-',
			'index.html',
			'error.html'
		)

		expect(core.setOutput).toHaveBeenCalledWith(
			'websiteUrl',
			'http://test-bucket.s3-website.us-east-1.amazonaws.com/'
		)
	})

	test('should deactivate previous deployments', async () => {
		mockCheckBucketExists.mockResolvedValueOnce(true)
		mockGithubClient.rest.repos.listDeployments.mockResolvedValue({
			data: [{ id: 111 }, { id: 222 }]
		})

		await prUpdatedAction(
			'test-bucket',
			'us-east-1',
			'./dist',
			'PR-',
			'index.html',
			'error.html'
		)

		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				deployment_id: 111,
				state: 'inactive'
			})
		)
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				deployment_id: 222,
				state: 'inactive'
			})
		)
	})

	test('should configure website with custom index and error documents', async () => {
		mockCheckBucketExists.mockResolvedValueOnce(false)

		await prUpdatedAction(
			'test-bucket',
			'us-east-1',
			'./dist',
			'PR-',
			'home.html',
			'404.html'
		)

		// Last S3 call should be PutBucketWebsiteCommand
		const websiteCall = mockS3Client.send.mock.calls[3][0]
		expect(websiteCall.input.WebsiteConfiguration).toEqual({
			IndexDocument: { Suffix: 'home.html' },
			ErrorDocument: { Key: '404.html' }
		})
	})
})
