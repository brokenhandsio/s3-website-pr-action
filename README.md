# Actions - s3-website-pr-action 🚀

### Automatically deploy built PR bundles to an S3 static website

![Example](Example.png?raw=true)

# Usage 📝

See [Vapor's Website](https://github.com/vapor/wesbite) for an example application using this action.

## PR opened or updated:

```yaml
name: PR

on:
  pull_request:
    branches: [ main ]

build:
  runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create Site
        run: |
          swift build

      - name: Deploy S3 Website
        uses: brokenhandsio/s3-website-https-pr-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        with:
          bucket-prefix: "vapor-website-pulls"
          folder-to-copy: "./Output"
          bucket-region: "eu-west-2"
```

Execute the `s3-website-pr-action` action on pull request `opened`, `synchronize` and `reopened` events. This will create a new S3 static site and upload the contents of `folder-to-copy`. 
The site url will be posted as a deployment on the pull request.  

Note: By default, workflows using the `pull_request` activity type will include the above events. [Docs](https://help.github.com/en/actions/reference/events-that-trigger-workflows#pull-request-event-pull_request)

### Required Environment Variables
| Environment Variable  | Description                                    |
| --------------------- | ---------------------------------------------- |
| AWS_ACCESS_KEY_ID     | AWS Access Key ID of an IAM user               |
| AWS_SECRET_ACCESS_KEY | AWS Secret Access Key of an IAM user           |
| GITHUB_TOKEN          | GitHub automatically provides the secret value |

### Required Parameters
| Parameter      | Description                                                           |
| -------------- | --------------------------------------------------------------------- |
| bucket-prefix  | Prefix to the S3 bucket name                                          |
| folder-to-copy | The directory to your built web app. This folder will be copied to S3 |
| bucket-region  | Region to deploy the S3 bucket into                                   |

### Optional Parameters
| Parameter          | Description                                        |
| ------------------ | -------------------------------------------------- |
| environment-prefix | Prefix to the GitHub Deployment. Defaults to 'PR-' |


## PR closed:

```yaml
name: PR - Closed

on:
  pull_request:
    branches: [ main ]
    types: [ closed ]

build:
  runs-on: ubuntu-latest
  steps:
    - name: Delete Website Bucket
        uses: brokenhandsio/s3-website-https-pr-action@v2
        with:
          bucket-prefix: "vapor-website-pulls"
          bucket-region: "eu-west-2"
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Execute the `s3-website-pr-action` action on pull request `closed` events. This will remove the S3 bucket that was created in the previous stage.

### Required Environment Variables
| Environment Variable  | Description                                    |
| --------------------- | ---------------------------------------------- |
| AWS_ACCESS_KEY_ID     | AWS Access Key ID of an IAM user               |
| AWS_SECRET_ACCESS_KEY | AWS Secret Access Key of an IAM user           |
| GITHUB_TOKEN          | GitHub automatically provides the secret value |

### Required Parameters
| Parameter     | Description                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| bucket-prefix | Prefix to the S3 bucket name. This should be the same value as the other stage |
| bucket-region  | Region to deploy the S3 bucket into                                           |

### Optional Parameters
| Parameter          | Description                                        |
| ------------------ | -------------------------------------------------- |
| environment-prefix | Prefix to the GitHub Deployment. Defaults to 'PR-' |

# IAM 🔐

Required IAM permissions for this action.

Replace `<YOUR_BUCKET_PREFIX>` with the same `bucket-prefix` value that you defined in your workflows.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:DeleteBucket",
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:PutBucketWebsite",
                "s3:PutObjectAcl",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<YOUR_BUCKET_PREFIX>-*",
            ]
        }
    ]
}
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
