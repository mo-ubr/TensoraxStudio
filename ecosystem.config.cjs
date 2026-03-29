module.exports = {
  apps: [
    {
      name: "tensorax",
      script: "server/index.js",
      interpreter: "node",
      interpreter_args: "--experimental-vm-modules",
      cwd: "/home/mo/tensorax",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
