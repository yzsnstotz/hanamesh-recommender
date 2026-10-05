import {checkToolchain} from '@hanamesh/devkit';
import config from '../devkit.config.mjs';
await checkToolchain(config['check-toolchain']);
