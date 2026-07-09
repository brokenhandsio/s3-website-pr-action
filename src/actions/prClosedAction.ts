import * as github from '@actions/github'
import { getS3Client } from '../s3Client'
import validateEnvVars from '../utils/validateEnvVars'
import deactivateDeployments from '../utils/deactivateDeployments'
import deleteDeployments from '../utils/deleteDeployments'
import {
	DeleteBucketCommand,
	ListObjectsV2Command,
	DeleteObjectsCommand,
	type ObjectIdentifier
} from '@aws-sdk/client-s3'

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']

export default async (bucketName: string, environmentPrefix: string) => {
	const { repo } = github.context

	validateEnvVars(requiredEnvVars)

	console.log('Emptying S3 bucket...')

	// ListObjectsV2 returns at most 1000 keys per call, so we page through the
	// bucket with the continuation token and delete each batch until it's empty.
	// Otherwise DeleteBucket fails with BucketNotEmpty on buckets over 1000 objects.
	let continuationToken: string | undefined
	let deletedAny = false

	do {
		console.log('Fetching objects...')
		const listObjectsCommand = new ListObjectsV2Command({
			Bucket: bucketName,
			ContinuationToken: continuationToken
		})
		const objects = await getS3Client().send(listObjectsCommand)

		if (objects.Contents && objects.Contents.length >= 1) {
			const deleteObjectsRequest = {
				Bucket: bucketName,
				Delete: {
					Objects: objects.Contents.map(
						(object): ObjectIdentifier => ({ Key: object.Key })
					)
				}
			}

			console.log(`Deleting ${deleteObjectsRequest.Delete.Objects.length} objects...`)
			const deleteObjectsCommand = new DeleteObjectsCommand(deleteObjectsRequest)
			await getS3Client().send(deleteObjectsCommand)
			deletedAny = true
		}

		continuationToken = objects.IsTruncated ? objects.NextContinuationToken : undefined
	} while (continuationToken)

	if (!deletedAny) {
		console.log('S3 bucket already empty.')
	}

	const deleteBucketRequest = {
		Bucket: bucketName
	}
	const deleteBucketCommand = new DeleteBucketCommand(deleteBucketRequest)
	await getS3Client().send(deleteBucketCommand)

	await deactivateDeployments(repo, environmentPrefix)
	await deleteDeployments(repo, environmentPrefix)

	console.log('S3 bucket removed')
}
