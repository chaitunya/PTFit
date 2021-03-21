import * as posenet from '@tensorflow-models/posenet';
import fs from 'fs';
import dat from 'dat.gui';
import Stats from 'stats.js';
import raw_poses_trainer from './raw_poses_trainer.json';
import raw_poses_user from './raw_poses_user.json';
import lengths_trainer from './lengths_trainer.json';
import lengths_user from './lengths_user.json';

import {drawBoundingBox, drawKeypoints, drawSkeleton, isMobile, toggleLoadingUI, tryResNetButtonName, tryResNetButtonText, updateTryResNetButtonDatGuiCss, calculateLengths, drawTrainerSkeleton} from './demo_util';

const videoWidth = 700;
const videoHeight = Math.round(videoWidth * (500/600));
const stats = new Stats();
