const { execSync } = require('child_process');

const config = {
  appId: 'com.decentraland.creatorshub',
  directories: {
    output: 'dist',
    buildResources: 'buildResources',
  },
  files: ['packages/**/dist/**'],
  linux: {
    target: 'deb',
  },
  productName: 'Creators Hub',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  win: {
    publisherName: 'Decentraland Foundation',
    appId: 'Decentraland.CreatorsHub',
    icon: 'buildResources/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    extraResources: ['buildResources/icon.ico'],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    createDesktopShortcut: true,
    installerSidebar: 'buildResources/background.bmp',
    installerIcon: 'buildResources/icon.ico',
  },
  dmg: {
    title: 'Creators Hub Installer',
    background: 'buildResources/background.png',
    window: {
      width: 714,
      height: 472,
    },
    contents: [
      {
        x: 230,
        y: 215,
        type: 'file',
      },
      {
        x: 460,
        y: 215,
        type: 'link',
        path: '/Applications',
      },
    ],
    writeUpdateInfo: false,
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: 'arm64',
      },
      {
        target: 'dmg',
        arch: 'x64',
      },
      {
        target: 'zip',
        arch: 'arm64',
      },
      {
        target: 'zip',
        arch: 'x64',
      },
    ],
  },
  asarUnpack: ['./node_modules/npm/**/*', './package.json'],
  publish: [
    {
      provider: 'github',
      vPrefixedTagName: false,
    },
  ],
};

if (process.env.CODE_SIGN_SCRIPT_PATH) {
  console.log('CODE_SIGN_SCRIPT_PATH found in env vars:', process.env.CODE_SIGN_SCRIPT_PATH);
  config.win.sign = configuration => {
    console.log('Requested signing for ', configuration.path);

    // Only proceed if the versioned .exe file is in the configuration path - skip signing everything else
    if (!/Creators Hub-(\d+)\.(\d+)\.(\d+)-win-x64.exe$/.test(configuration.path)) {
      console.log('This is not the versioned .exe, skip signing');
      return true;
    }

    const scriptPath = process.env.CODE_SIGN_SCRIPT_PATH;

    try {
      // Execute the sign script synchronously
      process.env.INPUT_COMMAND = 'sign';
      process.env.INPUT_FILE_PATH = configuration.path;
      const env = {
        command: process.env.INPUT_COMMAND,
        username: process.env.INPUT_USERNAME,
        password: process.env.INPUT_PASSWORD,
        credential_id: process.env.INPUT_CREDENTIAL_ID,
        totp_secret: process.env.INPUT_TOTP_SECRET,
        file_path: process.env.INPUT_FILE_PATH,
        output_path: process.env.INPUT_OUTPUT_PATH,
        malware_block: process.env.INPUT_MALWARE_BLOCK,
        override: process.env.INPUT_OVERRIDE,
        clean_logs: process.env.INPUT_CLEAN_LOGS,
        environment_name: process.env.INPUT_ENVIRONMENT_NAME,
        jvm_max_memory: process.env.INPUT_JVM_MAX_MEMORY,
      };
      console.log('env:', JSON.stringify(env, null, 2));
      const output = execSync(`node "${scriptPath}"`, {
        env: { ...process.env, ...env },
      }).toString();
      console.log(`Script output: ${output}`);
    } catch (error) {
      console.error(`Error executing script: ${error.message}`);
      if (error.stdout) {
        console.log(`Script stdout: ${error.stdout.toString()}`);
      }
      if (error.stderr) {
        console.error(`Script stderr: ${error.stderr.toString()}`);
      }
      return false;
    }

    return true; // Return true at the end of successful signing
  };

  // sign only for Windows 10 and above - adjust for your code as needed
  config.win.signingHashAlgorithms = ['sha256'];
}

module.exports = config;
