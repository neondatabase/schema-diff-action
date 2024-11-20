# 🔍 Neon Schema Diff Action

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/neon-logo-dark-color.svg">
    <img alt="Neon logo" src="./docs/neon-logo-light-color.svg">
  </picture>
</p>

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/neondatabase/schema-diff-action/.github%2Fworkflows%2Flinter.yml?label=%F0%9F%94%8D%20Lint)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/neondatabase/schema-diff-action/.github%2Fworkflows%2Fci.yml?label=%F0%9F%8F%97%EF%B8%8F%20Build)
[![coverage](./docs/coverage.svg)](./docs/coverage.svg)

This action performs a database schema diff on specified Neon branches for each
pull request and writes a comment to the pull request highlighting the schema
differences.

It supports workflows where schema changes are made on a development branch, and
pull requests are created for review before merging the changes back into the
main branch. By including schema changes as a comment in the pull request,
reviewers can easily assess the differences directly within the pull request.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/comment-dark-mode.png">
    <img alt="Neon logo" src="./docs/comment-light-mode.png">
  </picture>
</p>

## Contributing

If you would like to contribute to the development of this GitHub Action, see
[Neon Schema Diff Action Development](docs/development.md)

## How to set up the NEON_API_KEY

Using the action requires adding a Neon API key to your GitHub Secrets. There
are two ways you can perform this setup:

- **Using the Neon GitHub Integration** (recommended) — this integration
  connects your Neon project to your GitHub repository, creates an API key, and
  sets the API key in your GitHub repository for you. See
  [Neon GitHub Integration](/docs/guides/neon-github-integration) for
  instructions.
- **Manual setup** — this method requires obtaining a Neon API key and
  configuring it manually in your GitHub repository.

  1. Obtain a Neon API key. See
     [Create an API key](https://neon.tech/docs/manage/api-keys#create-an-api-key)
     for instructions.
  1. In your GitHub repository, go to **Project settings** and locate
     **Secrets** at the bottom of the left sidebar.
  1. Click **Actions** > **New Repository Secret**.
  1. Name the secret `NEON_API_KEY` and paste your API key in the **Secret**
     field
  1. Click **Add Secret**.

## Usage

Setup the action:

```yml
permissions: write-all
steps:
  - uses: neondatabase/schema-diff-action@v1
    with:
      project_id: rapid-haze-373089
      compare_branch: dev/sunny_plant
      api_key: ${{ secrets.NEON_API_KEY }}
```

Alternatively, you can use `${{ vars.NEON_PROJECT_ID }}` to get your
`project_id`. If you have set up the
[Neon GitHub Integration](/docs/guides/neon-github-integration), the
`NEON_PROJECT_ID` variable will be defined as a variable in your GitHub
repository.

By default, the schema diff is calculated between the `compare_branch` and its
parent. If it has no parent, then it will fail. If you want to define the base
branch, add the `base_branch` field. Both the `compare_branch` and `base_branch`
accept either the name or the ID of the branch, and you can use both (_i.e._,
the `compare_branch` can use the branch name while the `base_branch` uses the
branch ID or vice-versa).

For the action to be able to create PR comments you must add the correct
permissions to the job. To do this add the following permissions to your job:

```yml
jobs:
  your_job:
    permisions:
      pull-request: write
      ...other permissions needed for the rest of the job
    steps:
      - uses: neondatabase/schema-diff-action@v1
      ...
```

While setting the permissions please consider any other action that your
workflow may do so you don't miss any permission. For instance, if you
repository is private you also need to grant read or write access to your
repository with `contents: write`. For the full list of permissions please refer
to
[Defining access for the GITHUB_TOKEN permissions](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token#defining-access-for-the-github_token-permissions).

If your branch has more than one database or role, see the
[advanced usage section](#advanced-usage) below.

## Advanced usage

The following fields are required to run the Schema Diff action:

- `project_id` — the Neon project ID. If you have the Neon GitHub Integration
  installed, you can specify `${{ vars.NEON_PROJECT_ID }}`.
- `api_key` — the Neon API key for your Neon project or organization. If you
  have the GitHub integration installed, specify `${{ secrets.NEON_API_KEY }}`.
- `compare_branch` — the name or ID of the branch to compare. This is typically
  the branch where you made schema changes.

If you don't provide values for the following fields explicitly, the action will
use these default values:

- `github-token` — `${{ github.token }}`, the ephemeral GitHub token used to
  create comments
- `api_host` — `https://console.neon.tech/api/v2`
- `username` — `neondb_owner`, the default role for new Neon projects
- `database` — `neondb`, the default database name for new Neon projects

The GitHub token is required to create PR comments. The (`${{ github.token }}`)
value is
[automatically populated by GitHub](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
with a unique value for each workflow job.

By default, Neon creates a database with the name `neondb` with a `neondb_owner`
role. If you intend to use other names, please add the fields explicitly in the
action.

If you don't want to compare the schema of your `compare_branch` with the schema
of its parent branch, you can explicitly specify a different base branch with
the `base_branch` field. The action below compares the schema with the `main`
branch explicitly.

```yml
steps:
  - uses: neondatabase/schema-diff-action@v1
    with:
      project_id: ${{ vars.NEON_PROJECT_ID }}
      compare_branch:
        preview/pr-${{ github.event.number }}-${{ needs.setup.outputs.branch }}
      base_branch: main
      api_key: ${{ secrets.NEON_API_KEY }}
      database: mydatabase
      username: myrole
```

Additionally, you can set up extra parameters to define the state of your
`compare_branch`. The fields `timestamp` and `lsn` allow you to specify a point
in time in your `compare_branch` to be used for schema comparison. Only one of
these two values can be defined at a time.

Supported parameters:

| Field            | Required/optional | Default value                            |
| ---------------- | ----------------- | ---------------------------------------- |
| `project_id`     | required          | n/a                                      |
| `compare_branch` | required          | n/a                                      |
| `api_key`        | required          | n/a                                      |
| `base_branch`    | optional          | empty, will default to the parent branch |
| `api_host`       | optional          | `https://console.neon.tech/api/v2`       |
| `username`       | optional          | `neondb_owner`                           |
| `database`       | optional          | `neondb`                                 |
| `lsn`            | optional          | empty, will default to the branch's head |
| `timestamp`      | optional          | empty, will default to the branch's head |

## Outputs

The action provides two outputs:

- `diff` — the SQL schema diff between the `compare_branch` and the
  `base_branch`.
- `comment_url` — the URL of the created or updated comment.
