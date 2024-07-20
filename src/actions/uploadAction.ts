import * as github from '@actions/github'
import * as githubCore from '@actions/core'
import S3 from '../s3Client'
import s3UploadDirectory from '../utils/s3UploadDirectory'
import validateEnvVars from '../utils/validateEnvVars'
import checkBucketExists from '../utils/checkBucketExists'
import githubClient from '../githubClient'
import deactivateDeployments from '../utils/deactivateDeployments'
import {
	GetResponseDataTypeFromEndpointMethod,
} from "@octokit/types";import dayjs from 'dayjs'
import { CreateBucketRequest, CreateBucketCommand, PutBucketOwnershipControlsCommand, PutBucketOwnershipControlsRequest, PutPublicAccessBlockCommand, PutBucketWebsiteCommand } from "@aws-sdk/client-s3";

export const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'GITHUB_TOKEN']

type ReposCreateDeploymentResponseData = GetResponseDataTypeFromEndpointMethod<
  typeof githubClient.rest.repos.createDeployment
>;

export default async (bucketName: string, bucketRegion: string, uploadDirectory: string, environmentPrefix: string) => {
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
		await S3.send(createBucketCommand)

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
		await S3.send(putBucketOwnershipControlsCommand)

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
		await S3.send(putPublicAccessBlockCommand)

		const putBucketWebsiteRequest = {
			Bucket: bucketName,
			WebsiteConfiguration: {
				IndexDocument: { Suffix: 'index.html' },
				ErrorDocument: { Key: 'index.html' }
			}
		}
		const putBucketWebsiteCommand = new PutBucketWebsiteCommand(putBucketWebsiteRequest)
		await S3.send(putBucketWebsiteCommand)
	} else {
		console.log('S3 Bucket already exists. Skipping creation...')
	}

	await deactivateDeployments(repo, environmentPrefix)

	const deployment = await githubClient.rest.repos.createDeployment({
		...repo,
		ref: `${branchName}`,
		environment: `${environmentPrefix || 'ACTION-'}${dayjs().format('DD-MM-YYYY-hh:mma')}`,
		auto_merge: false,
		transient_environment: true,
		required_contexts: []
	})

	if (isSuccessResponse(deployment.data)) {
		await githubClient.rest.repos.createDeploymentStatus({
			...repo,
			deployment_id: (deployment.data as any).id,
			state: 'in_progress'
		})

		console.log('Uploading files...')
		await s3UploadDirectory(bucketName, uploadDirectory)

		await githubClient.rest.repos.createDeploymentStatus({
			...repo,
			deployment_id: (deployment.data as any).id,
			state: 'success',
			environment_url: websiteUrl
		})

		githubCore.setOutput('websiteUrl', websiteUrl)

		console.log(`Website URL: ${websiteUrl}`)
	}
}

function isSuccessResponse(object: any): object is ReposCreateDeploymentResponseData {
	return 'id' in object
}
