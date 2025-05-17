module.exports = {
  apps: [
    {
      name: 'borg-dev',
      script: 'src/index.ts',
      interpreter: 'node',
      watch: true,
      node_args: '--no-warnings --loader ts-node/esm',
      env: {
        NODE_NO_WARNINGS: '1',
      },
    },
  ],
}; 