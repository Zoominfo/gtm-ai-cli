import packageJson from '../package.json' with { type: 'json' };

export interface Pkg {
  name: string;
  version: string;
}

export const pkg: Pkg = { name: packageJson.name, version: packageJson.version };
