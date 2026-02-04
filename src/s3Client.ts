import { S3Client } from '@aws-sdk/client-s3'
import * as core from '@actions/core'

let s3Client: S3Client | null = null

export function getS3Client(): S3Client {
	if (!s3Client) {
		s3Client = new S3Client({
			region: core.getInput('bucket-region')
		})
	}
	return s3Client
}

// For testing - allows injecting a mock client
export function setS3Client(client: S3Client | any): void {
	s3Client = client
}

// For testing - resets to allow fresh initialization
export function resetS3Client(): void {
	s3Client = null
}

// Default export for backwards compatibility during migration
export default {
	send: (command: any) => getS3Client().send(command)
}
