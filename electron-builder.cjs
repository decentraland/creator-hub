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

if (process.env.APPLE_TEAM_ID) {
  console.log('APPLE_TEAM_ID found in env vars: ', process.env.APPLE_TEAM_ID);
  if (!config.mac.notarize) {
    config.mac.notarize = {};
  }
  config.mac.notarize.teamId = process.env.APPLE_TEAM_ID;
}

if (process.env.APP_VERSION) {
  console.log('APP_VERSION found in env vars:', process.env.APP_VERSION);
  if (!config.extraMetadata) {
    config.extraMetadata = {};
  }
  config.extraMetadata.version = process.env.APP_VERSION;
}

if (process.env.CODE_SIGN_SCRIPT_PATH) {
  console.log('CODE_SIGN_SCRIPT_PATH found in env vars:', process.env.CODE_SIGN_SCRIPT_PATH);
  config.win.sign = configuration => {
    console.log('Requested signing for ', configuration.path);

    // Only proceed if the versioned exe file is in the configuration path - skip signing everything else
    if (!configuration.path.endsWith('.exe')) {
      console.log('Configuration path is not .exe file, skipping');
      return true;
    }

    const scriptPath = process.env.CODE_SIGN_SCRIPT_PATH;

    try {
      // Execute the sign script synchronously
      const output = execSync(`node "${scriptPath}"`).toString();
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
