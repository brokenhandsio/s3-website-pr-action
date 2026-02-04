import { setS3Client, resetS3Client } from '../../s3Client'
import checkBucketExists from '../checkBucketExists'
import { createMockS3Client } from '../../tests/testUtils'

describe('checkBucketExists', () => {
	let mockS3Client: ReturnType<typeof createMockS3Client>

	beforeEach(() => {
		mockS3Client = createMockS3Client()
		setS3Client(mockS3Client)
	})

	afterEach(() => {
		resetS3Client()
		jest.clearAllMocks()
	})

	test('should return true when bucket exists', async () => {
		mockS3Client.send.mockResolvedValueOnce({})

		const result = await checkBucketExists('test-bucket')

		expect(result).toBe(true)
		expect(mockS3Client.send).toHaveBeenCalledTimes(1)
	})

	test('should return false when bucket does not exist', async () => {
		mockS3Client.send.mockRejectedValueOnce(new Error('Bucket not found'))

		const result = await checkBucketExists('non-existent-bucket')

		expect(result).toBe(false)
		expect(mockS3Client.send).toHaveBeenCalledTimes(1)
	})

	test('should pass correct bucket name in command', async () => {
		mockS3Client.send.mockResolvedValueOnce({})

		await checkBucketExists('my-test-bucket')

		const command = mockS3Client.send.mock.calls[0][0]
		expect(command.input).toEqual({ Bucket: 'my-test-bucket' })
	})
})
