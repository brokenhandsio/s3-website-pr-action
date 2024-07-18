import * as github from '@actions/github'
import githubClient from '../githubClient'
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

	const deployments = await githubClient.rest.repos.listDeployments({
		...repo,
		environment: environment,
		per_page: 100
	});

	console.log(JSON.stringify(deployments))

	if (deployments.data.length <= 0) {
		console.log('No exiting deployments found for pull request')
		return
	}

	for (const deployment of deployments.data) {
		console.log(`Deleting existing deployment - ${deployment.id}`)

		await githubClient.rest.repos.deleteDeployment({
			...repo,
			deployment_id: deployment.id
		})
	}
}
