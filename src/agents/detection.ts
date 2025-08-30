import { AgentRegistration } from '../types';
import { validateProjectPath } from '../validation';

export async function createAgentFromProjectPath(
  agentId: string,
  projectPath: string,
): Promise<AgentRegistration> {
  // Validate the project path before using it
  const validatedPath = validateProjectPath(projectPath);
  const { capabilities, role } = await detectProjectCapabilities(validatedPath);

  return {
    id: agentId,
    projectPath: validatedPath,
    role,
    capabilities,
    status: 'active',
    lastSeen: Date.now(),
    collaboratesWith: [],
  };
}

export async function detectProjectCapabilities(projectPath: string): Promise<{
  capabilities: string[];
  role: string;
}> {
  let role = 'Development agent';
  const capabilities: string[] = [];

  // Project path is already validated by createAgentFromProjectPath
  try {
    // Import fs and path dynamically since we only use them here
    const fs = await import('fs/promises');
    const path = await import('path');

    // Detect capabilities from package.json if it exists
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.react) {
        capabilities.push('react', 'frontend');
      }

      if (deps.vue) {
        capabilities.push('vue', 'frontend');
      }

      if (deps.express || deps.fastify) {
        capabilities.push('api', 'backend');
      }

      if (deps.typescript) {
        capabilities.push('typescript');
      }

      if (deps.jest || deps.vitest) {
        capabilities.push('testing');
      }
    } catch {
      // No package.json or error reading it
    }

    // Detect role based on project structure
    try {
      const files = await fs.readdir(projectPath);

      if (files.includes('src') && files.includes('public')) {
        role = 'Frontend development agent';
      } else if (files.includes('src') && capabilities.includes('api')) {
        role = 'Backend development agent';
      } else if (files.some((f: string) => f.endsWith('.py'))) {
        role = 'Python development agent';
        capabilities.push('python');
      } else if (files.some((f: string) => f.endsWith('.go'))) {
        role = 'Go development agent';
        capabilities.push('go');
      } else if (files.some((f: string) => f.endsWith('.rs'))) {
        role = 'Rust development agent';
        capabilities.push('rust');
      }
    } catch {
      // Error reading directory
    }
  } catch {
    // Error importing modules
  }

  return { role, capabilities };
}
