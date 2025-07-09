# Garn - Task Runner & Workspace Manager

Garn is a task runner and workspace manager designed for monorepo projects. It provides a simple and efficient way to define, organize, and execute tasks across multiple packages and workspaces.

## Features

- 🚀 **Fast Task Execution** - Execute tasks with minimal overhead
- 📦 **Workspace Management** - Manage multiple packages in a monorepo
- 🌐 **Global & Local Installation** - Works both globally and locally
- 📋 **Task Registration** - Easy task definition and organization
- ⚡ **Cross-Platform** - Works on Windows, macOS, and Linux

## Installation

### Recommended Setup

For the best experience, install garn both globally and locally:

```bash
# Global installation (for running garn from anywhere)
yarn global add @avensia-oss/garn

# Local installation (in your project)
yarn add @avensia-oss/garn
```

This setup allows you to:

- Run `garn` from any directory within your project (global garn runs local garn)
- Use the local version for project-specific tasks
- Avoid needing to add `garn.cmd` and `garn` bash files to project
- Get automatic fallback to local garn when available

**How it works:**

- Global garn detects where local garn
- It automatically spawns the local garn process and passes through all arguments
- Local garn handles task registration and execution

## Quick Start

1. **Create a task registry file** in your project root:

```typescript
// garn-workspace.mts
import { task } from '@avensia-oss/garn';

task('build', 'Build the project', async () => {
  // Your build logic here
});
```

2. **Run tasks**:

```bash
garn build
```

## Configuration Files

Garn supports two types of configuration files:

### garn-workspace.mts (Package-Level Tasks)

Use this file for package-specific tasks

```typescript
import { task, taskGroup } from '@avensia-oss/garn';

taskGroup('dev', () => {
  task('start', 'Start development server', async () => {
    // Start dev server logic
  });

  task('build', 'Build for development', async () => {
    // Dev build logic
  });
});
```

### garn-workspaces.mts (Monorepo Management)

Use this file for managing multiple workspaces and coordinating tasks across packages.

```typescript
import { release, workspaces, taskGroup, task } from '@avensia-oss/garn';

taskGroup('frontend', () => {
  task('build', () => workspaces.runTask('build', 'webapp'));
  task('dev', () => workspaces.runTask('dev', 'webapp'));
});

task('deploy', async () => {
  await workspaces.runTask('build', 'webapp');
  await workspaces.runTask('build', 'api');
  await release.tagPackagesRelease(['webapp', 'api']);
});
```

## Available Helpers

Garn provides a set of helper functions for common development tasks:

• **Release Management** - Tag packages for release and prerelease
• **Docker Integration** - Run Docker commands
• **TypeScript Support** - Type checking
• **Git Operations** - Status, checkout, tag, push, pull operations
• **.NET Development** - Build, test, clean, restore, publish, pack
• **Process Execution** - Spawn processes and check paths
• **Version Management** - Get current version and parse tags
• **GitHub Integration** - Create releases and upload assets
• **Changelog Management** - Generate and write changelogs
• **Variables** - Get and set variables

### Basic Task

```typescript
task('taskName', 'Task description', async () => {
  // Task implementation
});
```

### Task with Dependencies

```typescript
task(
  'build',
  'Build project',
  async () => {
    // Build logic
  },
  ['clean', 'install'],
);
```

### Task Group

```typescript
taskGroup('groupName', () => {
  task('task1', 'Task 1 description', async () => {
    // Task 1 logic
  });

  task('task2', 'Task 2 description', async () => {
    // Task 2 logic
  });
});
```

### Workspace Tasks

```typescript
// Run a task in a specific workspace
workspaces.runTask('build', 'webapp');

// Run tasks in parallel across workspaces
Promise.all([workspaces.runTask('build', 'webapp'), workspaces.runTask('build', 'api')]);
```

## Command Line Usage

### Basic Commands

```bash
# Run a task
garn <taskName>

# Run a task in a workspace
garn <workspaceName> <taskName>

# List all available tasks
garn
```

## Troubleshooting

- Use `garn --verbose` for detailed debugging information
- Check that configuration files exist in the current directory or project root
- Ensure garn is installed both globally and locally in your project
