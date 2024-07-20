import * as github from '@actions/github'
import S3 from '../s3Client'
import validateEnvVars from '../utils/validateEnvVars'
import deactivateDeployments from '../utils/deactivateDeployments'
import deleteDeployments from '../utils/deleteDeployments'
import { DeleteBucketCommand, ListObjectsV2Command, DeleteObjectsCommand, ObjectIdentifier } from '@aws-sdk/client-s3'

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']

export default async (bucketName: string, environmentPrefix: string) => {
	const { repo } = github.context

	validateEnvVars(requiredEnvVars)

	console.log('Emptying S3 bucket...')

	console.log('Fetching objects...')

	const listObjectsRequest = {
		Bucket: bucketName
	}
	const listObjectsCommand = new ListObjectsV2Command(listObjectsRequest)
	const objects = await S3.send(listObjectsCommand)

	if (objects.Contents && objects.Contents.length >= 1) {

		const deleteObjectsRequest = {
			Bucket: bucketName,
			Delete: {
				Objects: [] as Array<ObjectIdentifier>
			}
		}

		for (const object of objects.Contents) {
			deleteObjectsRequest.Delete.Objects.push({ Key: object.Key })
		}

		console.log('Deleting objects...')
		const deleteObjectsCommand = new DeleteObjectsCommand(deleteObjectsRequest)
		await S3.send(deleteObjectsCommand)
	} else {
		console.log('S3 bucket already empty.')
	}

	const deleteBucketRequest = {
		Bucket: bucketName
	}
	const deleteBucketCommand = new DeleteBucketCommand(deleteBucketRequest)
	await S3.send(deleteBucketCommand)

	await deactivateDeployments(repo, environmentPrefix)
	await deleteDeployments(repo, environmentPrefix)

	console.log('S3 bucket removed')
}
