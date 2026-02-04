import * as github from '@actions/github'
import * as githubCore from '@actions/core'
import { getS3Client } from '../s3Client'
import s3UploadDirectory from '../utils/s3UploadDirectory'
import validateEnvVars from '../utils/validateEnvVars'
import checkBucketExists from '../utils/checkBucketExists'
import { getGithubClient } from '../githubClient'
import deactivateDeployments from '../utils/deactivateDeployments'
import dayjs from 'dayjs'
import { CreateBucketRequest, CreateBucketCommand, PutBucketOwnershipControlsCommand, PutBucketOwnershipControlsRequest, PutPublicAccessBlockCommand, PutBucketWebsiteCommand } from '@aws-sdk/client-s3';

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'GITHUB_TOKEN']

export default async (bucketName: string, bucketRegion: string, uploadDirectory: string, environmentPrefix: string, indexDocument: string, errorDocument: string) => {
	const websiteUrl = `http://${bucketName}.s3-website.${bucketRegion}.amazonaws.com/`
	const { repo } = github.context
	const branchName = github.context.ref

	validateEnvVars(requiredEnvVars)

	const bucketExists = await checkBucketExists(bucketName)

	if (!bucketExists) {
		console.log(`S3 bucket does not exist. Creating ${bucketName}...`)

		const createBucketRequest: CreateBucketRequest = {
			Bucket: bucketName,
			ObjectOwnership: 'ObjectWriter'
		}

		const createBucketCommand = new CreateBucketCommand(createBucketRequest)
		await getS3Client().send(createBucketCommand)

		const putBucketOwnershipControlsRequest: PutBucketOwnershipControlsRequest = {
			Bucket: bucketName,
			OwnershipControls: {
				Rules: [
					{
						ObjectOwnership: 'ObjectWriter'
					}
				]
			}
		}
		const putBucketOwnershipControlsCommand = new PutBucketOwnershipControlsCommand(putBucketOwnershipControlsRequest)
		await getS3Client().send(putBucketOwnershipControlsCommand)

		const putPublicAccessBlockRequest = {
			Bucket: bucketName,
			PublicAccessBlockConfiguration: {
				BlockPublicAcls: false,
				BlockPublicPolicy: false,
				IgnorePublicAcls: false,
				RestrictPublicBuckets: false
			}
		}

		const putPublicAccessBlockCommand = new PutPublicAccessBlockCommand(putPublicAccessBlockRequest)
		await getS3Client().send(putPublicAccessBlockCommand)

		const putBucketWebsiteRequest = {
			Bucket: bucketName,
			WebsiteConfiguration: {
				IndexDocument: { Suffix: indexDocument },
				ErrorDocument: { Key: errorDocument }
			}
		}
		const putBucketWebsiteCommand = new PutBucketWebsiteCommand(putBucketWebsiteRequest)
		await getS3Client().send(putBucketWebsiteCommand)
	} else {
		console.log('S3 Bucket already exists. Skipping creation...')
	}

	await deactivateDeployments(repo, environmentPrefix)

	const deployment = await getGithubClient().rest.repos.createDeployment({
		...repo,
		ref: `${branchName}`,
		environment: `${environmentPrefix || 'ACTION-'}${dayjs().format('DD-MM-YYYY-hh:mma')}`,
		auto_merge: false,
		transient_environment: true,
		required_contexts: []
	})

	if (isSuccessResponse(deployment.data)) {
		await getGithubClient().rest.repos.createDeploymentStatus({
			...repo,
			deployment_id: (deployment.data as any).id,
			state: 'in_progress'
		})

		console.log('Uploading files...')
		await s3UploadDirectory(bucketName, uploadDirectory)

		await getGithubClient().rest.repos.createDeploymentStatus({
			...repo,
			deployment_id: (deployment.data as any).id,
			state: 'success',
			environment_url: websiteUrl
		})

		githubCore.setOutput('websiteUrl', websiteUrl)

		console.log(`Website URL: ${websiteUrl}`)
	}
}

function isSuccessResponse(object: any): object is { id: number } {
	return 'id' in object
}
