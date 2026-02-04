import * as github from '@actions/github'
import { getGithubClient } from '../githubClient'
import dayjs from 'dayjs'

export default async (
	repo: {
		owner: string
		repo: string
	},
	environmentPrefix: string
) => {
	const githubEventName = github.context.eventName
	const environment =
		githubEventName === 'pull_request'
			? `${environmentPrefix || 'PR-'}${github.context.payload.pull_request!.number}`
			: `${environmentPrefix || 'ACTION-'}${dayjs().format('DD-MM-YYYY-hh:mma')}`

	const deployments = await getGithubClient().rest.repos.listDeployments({
		repo: repo.repo,
		owner: repo.owner,
		environment
	})

	const existing = deployments.data.length
	if (existing < 1) {
		console.log('No exiting deployments found for pull request')
		return
	}

	for (const deployment of deployments.data) {
		console.log(`Deactivating existing deployment - ${deployment.id}`)

		await getGithubClient().rest.repos.createDeploymentStatus({
			...repo,
			deployment_id: deployment.id,
			state: 'inactive'
		})
	}
}
